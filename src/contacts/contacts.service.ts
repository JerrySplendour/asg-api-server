import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { ContactRequest } from './entities/contact-request.entity';
import { User } from '../common/entities/user.entity';
import { logger } from '../lib/logger';
import { TrackingGateway } from '../gateway/tracking.gateway';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(EmergencyContact)
    private emergencyContactRepository: Repository<EmergencyContact>,
    @InjectRepository(ContactRequest)
    private contactRequestRepository: Repository<ContactRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private trackingGateway: TrackingGateway,
  ) { }

  async findUserByPhone(phoneNumber: string): Promise<User | null> {
    if (!phoneNumber) return null;
    const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
    return this.userRepository
      .createQueryBuilder('user')
      .where(
        "REPLACE(REPLACE(REPLACE(REPLACE(user.phoneNumber, ' ', ''), '-', ''), '(', ''), ')', '') = :phone",
        { phone: normalized },
      )
      .getOne();
  }

  // Regular Contacts
  async getContacts(userId: string): Promise<Contact[]> {
    try {
      return await this.contactRepository.find({ where: { userId } });
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to fetch contacts');
      throw error;
    }
  }

  async getContactById(userId: string, id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id, userId } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async addContact(userId: string, contactData: any): Promise<Contact> {
    try {
      const contact = this.contactRepository.create({ ...contactData, userId });
      const saved = await this.contactRepository.save(contact);
      const resultContact = Array.isArray(saved) ? saved[0] : saved;

      if (contactData.phoneNumber) {
        const targetUser = await this.findUserByPhone(contactData.phoneNumber);

        if (targetUser && targetUser.id !== userId) {
          const senderUser = await this.userRepository.findOne({ where: { id: userId } });
          const senderName = senderUser?.displayName || senderUser?.email || 'A user';
          const category = contactData.category || 'friend';

          const existingRequest = await this.contactRequestRepository.findOne({
            where: { fromUserId: userId, toUserId: targetUser.id, status: 'pending' },
          });

          if (!existingRequest) {
            const request = await this.sendContactRequest(
              userId,
              targetUser.id,
              senderName,
              category,
              contactData.message || `${senderName} added you as a contact`,
            );

            await this.contactRepository.update(
              { id: resultContact.id },
              { linkedUserId: targetUser.id, requestStatus: 'pending' },
            );

            this.trackingGateway.notifyContactRequest(
              targetUser.id,
              senderName,
              request.id,
              category,
            );
          } else {
            await this.contactRepository.update(
              { id: resultContact.id },
              { linkedUserId: targetUser.id, requestStatus: 'pending' },
            );
          }
        }
      }

      return resultContact;
    } catch (error) {
      logger.error({ err: error, userId, contactData }, 'Failed to add contact');
      throw error;
    }
  }

  async updateContact(userId: string, id: string, updates: any): Promise<Contact> {
    await this.contactRepository.update({ id, userId }, updates);
    return this.getContactById(userId, id);
  }

  async deleteContact(userId: string, id: string): Promise<void> {
    await this.contactRepository.delete({ id, userId });
  }

  // Emergency Contacts
  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    return this.emergencyContactRepository.find({ where: { userId } });
  }

  async addEmergencyContact(userId: string, data: any): Promise<EmergencyContact> {
    const ec = this.emergencyContactRepository.create({ ...data, userId });
    const saved = await this.emergencyContactRepository.save(ec);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async updateEmergencyContact(
    userId: string,
    id: string,
    updates: any,
  ): Promise<EmergencyContact> {
    await this.emergencyContactRepository.update({ id, userId }, updates);
    const updated = await this.emergencyContactRepository.findOne({ where: { id, userId } });
    if (!updated) throw new NotFoundException('Emergency contact not found');
    return updated;
  }

  async deleteEmergencyContact(userId: string, id: string): Promise<void> {
    await this.emergencyContactRepository.delete({ id, userId });
  }

  // Contact Requests
  async getPendingContactRequests(userId: string): Promise<ContactRequest[]> {
    return this.contactRequestRepository.find({
      where: { toUserId: userId, status: 'pending' },
    });
  }

  async sendContactRequest(
    fromUserId: string,
    toUserId: string,
    fromUserName: string,
    category: string,
    message?: string,
  ): Promise<ContactRequest> {
    const request = this.contactRequestRepository.create({
      fromUserId,
      toUserId,
      fromUserName,
      category,
      message,
    });
    return this.contactRequestRepository.save(request);
  }

  async acceptContactRequest(userId: string, requestId: string): Promise<Contact> {
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, toUserId: userId },
    });
    if (!request) throw new NotFoundException('Contact request not found');

    await this.contactRequestRepository.update({ id: requestId }, { status: 'accepted' });

    const acceptorUser = await this.userRepository.findOne({ where: { id: userId } });
    const requesterUser = await this.userRepository.findOne({ where: { id: request.fromUserId } });

    const contactForAcceptor = this.contactRepository.create({
      userId,
      name: request.fromUserName,
      email: requesterUser?.email || '',
      phoneNumber: requesterUser?.phoneNumber || '',
      relationship: 'friend',
      category: request.category,
      requestStatus: 'accepted',
      isTracked: true,
      linkedUserId: request.fromUserId,
    });
    const saved = await this.contactRepository.save(contactForAcceptor);

    await this.contactRepository.update(
      { userId: request.fromUserId, phoneNumber: acceptorUser?.phoneNumber || '' },
      { requestStatus: 'accepted', linkedUserId: userId },
    );

    if (acceptorUser) {
      const existingReverse = await this.contactRepository.findOne({
        where: { userId: request.fromUserId, linkedUserId: userId },
      });
      if (!existingReverse) {
        const contactForRequester = this.contactRepository.create({
          userId: request.fromUserId,
          name: acceptorUser.displayName || acceptorUser.email,
          email: acceptorUser.email || '',
          phoneNumber: acceptorUser.phoneNumber || '',
          relationship: 'friend',
          category: request.category,
          requestStatus: 'accepted',
          isTracked: true,
          linkedUserId: userId,
        });
        await this.contactRepository.save(contactForRequester);
      }
    }

    return Array.isArray(saved) ? saved[0] : saved;
  }

  async rejectContactRequest(userId: string, requestId: string): Promise<void> {
    await this.contactRequestRepository.update(
      { id: requestId, toUserId: userId },
      { status: 'rejected' },
    );
  }

  // Device Contacts Sync
  async syncDeviceContacts(userId: string, deviceContacts: any[]): Promise<Contact[]> {
    const contacts: Contact[] = [];
    for (const dc of deviceContacts) {
      const existing = await this.contactRepository.findOne({
        where: { userId, deviceContactId: dc.id },
      });

      if (existing) {
        await this.contactRepository.update(
          { id: existing.id },
          { name: dc.name, phoneNumber: dc.phoneNumber, email: dc.email },
        );
        contacts.push(await this.getContactById(userId, existing.id));
      } else {
        const contact = this.contactRepository.create({
          userId,
          name: dc.name,
          phoneNumber: dc.phoneNumber || '',
          email: dc.email || '',
          deviceContactId: dc.id,
          relationship: 'friend',
        });
        contacts.push(await this.contactRepository.save(contact));
      }
    }
    return contacts;
  }

  async findUsersByPhone(
    phoneNumbers: string[],
  ): Promise<{ phoneNumber: string; userId: string; displayName: string }[]> {
    const results: { phoneNumber: string; userId: string; displayName: string }[] = [];
    for (const phone of phoneNumbers) {
      const normalized = phone.replace(/[\s\-\(\)]/g, '');
      const user = await this.userRepository
        .createQueryBuilder('user')
        .where(
          "REPLACE(REPLACE(REPLACE(REPLACE(user.phoneNumber, ' ', ''), '-', ''), '(', ''), ')', '') = :phone",
          { phone: normalized },
        )
        .getOne();
      if (user) {
        results.push({
          phoneNumber: phone,
          userId: user.id,
          displayName: user.displayName || user.email,
        });
      }
    }
    return results;
  }
}