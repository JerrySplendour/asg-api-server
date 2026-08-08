import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { ContactRequest } from './entities/contact-request.entity';
import { User } from '../common/entities/user.entity';
import { logger } from '../lib/logger';
import { TrackingGateway } from '../gateway/tracking.gateway';
import { FcmService } from '../notifications/fcm.service';
import { UserCategory } from '../categories/entities/category.entity';

/** Default category name contacts fall back to when their category is deleted. */
const FALLBACK_CATEGORY = 'friend';

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
    @InjectRepository(UserCategory)
    private categoryRepository: Repository<UserCategory>,
    private trackingGateway: TrackingGateway,
    private fcmService: FcmService,
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

  async getSenderDetails(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user.displayName || user.email;
  }

  async getCategoryBehaviorTypeForRequest(userId: string, categoryName: string) {
    return this.getCategoryBehaviorType(userId, categoryName);
  }

  // ─── Regular Contacts ───────────────────────────────────────────────────────

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
          const category = contactData.category || FALLBACK_CATEGORY;
          const categoryBehaviorType = await this.getCategoryBehaviorType(userId, category);

          const existingRequest = await this.contactRequestRepository.findOne({
            where: { fromUserId: userId, toUserId: targetUser.id, status: 'pending' },
          });

          if (!existingRequest) {
            const request = await this.sendContactRequest(
              userId,
              targetUser.id,
              senderName,
              category,
              categoryBehaviorType,
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
              categoryBehaviorType,
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

  // ─── Emergency Contacts ─────────────────────────────────────────────────────

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

  // ─── Contact Requests ───────────────────────────────────────────────────────

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
    categoryBehaviorType: 'STANDARD' | 'PROFESSIONAL' = 'STANDARD',
    message?: string,
  ): Promise<ContactRequest> {
    const request = this.contactRequestRepository.create({
      fromUserId,
      toUserId,
      fromUserName,
      category,
      categoryBehaviorType,
      message,
    });
    const saved = await this.contactRequestRepository.save(request);

    // Send FCM push notification to the recipient
    const recipientUser = await this.userRepository.findOne({
      where: { id: toUserId },
      select: ['fcmToken'],
    });

    if (recipientUser?.fcmToken) {
      await this.fcmService.sendToDevice(recipientUser.fcmToken, {
        title: 'New Contact Request',
        body: `${fromUserName} wants to add you as a contact`,
        priority: 'high',
        androidChannelId: 'asg_default',
        data: {
          type: 'contact_request',
          deepLink: '/contacts',
        },
      });
    }

    return saved;
  }

  /**
   * Accept a contact request with asymmetric category support:
   *
   * - STANDARD:     `recipientCategory` is required — the acceptor chooses
   *                 which category they place the sender in.
   * - PROFESSIONAL: `recipientCategory` is ignored — the sender's category
   *                 is used for both sides.
   */
  async acceptContactRequest(
    userId: string,
    requestId: string,
    recipientCategory?: string,
  ): Promise<Contact> {
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, toUserId: userId },
    });
    if (!request) throw new NotFoundException('Contact request not found');

    // Determine which category the acceptor places the sender in
    let acceptorSideCategory: string;
    if (request.categoryBehaviorType === 'PROFESSIONAL') {
      // Forced — use sender's category
      acceptorSideCategory = request.category;
    } else {
      // STANDARD — recipient must provide a category
      if (!recipientCategory) {
        throw new BadRequestException(
          'recipientCategory is required when accepting a STANDARD contact request',
        );
      }
      // Recipients can only choose a category that belongs to them (or a
      // system default), rather than introducing arbitrary category strings.
      await this.getCategoryBehaviorType(userId, recipientCategory);
      acceptorSideCategory = recipientCategory;
    }

    await this.contactRequestRepository.update(
      { id: requestId },
      {
        status: 'accepted',
        respondedAt: new Date(),
        recipientCategory: acceptorSideCategory,
      },
    );

    const acceptorUser = await this.userRepository.findOne({ where: { id: userId } });
    const requesterUser = await this.userRepository.findOne({ where: { id: request.fromUserId } });

    // Create the contact entry on the ACCEPTOR's side
    // (acceptor views the sender through acceptorSideCategory)
    const contactForAcceptor = this.contactRepository.create({
      userId,
      name: request.fromUserName,
      email: requesterUser?.email || '',
      phoneNumber: requesterUser?.phoneNumber || '',
      relationship: 'friend',
      category: acceptorSideCategory,
      requestStatus: 'accepted',
      isTracked: true,
      linkedUserId: request.fromUserId,
    });
    const saved = await this.contactRepository.save(contactForAcceptor);

    // Update or create the contact entry on the SENDER's side
    // (sender placed acceptor in request.category — the originally requested category)
    const existingRequesterContact = await this.contactRepository.findOne({
      where: { userId: request.fromUserId, linkedUserId: userId },
    });

    if (existingRequesterContact) {
      await this.contactRepository.update(
        { id: existingRequesterContact.id },
        { requestStatus: 'accepted', linkedUserId: userId },
      );
    } else if (acceptorUser) {
      const contactForRequester = this.contactRepository.create({
        userId: request.fromUserId,
        name: acceptorUser.displayName || acceptorUser.email,
        email: acceptorUser.email || '',
        phoneNumber: acceptorUser.phoneNumber || '',
        relationship: 'friend',
        category: request.category, // sender placed acceptor in their original chosen category
        requestStatus: 'accepted',
        isTracked: true,
        linkedUserId: userId,
      });
      await this.contactRepository.save(contactForRequester);
    }

    return Array.isArray(saved) ? saved[0] : saved;
  }

  async rejectContactRequest(userId: string, requestId: string): Promise<void> {
    await this.contactRequestRepository.update(
      { id: requestId, toUserId: userId },
      { status: 'rejected', respondedAt: new Date() },
    );
  }

  /** Resolve the sender's category behavior from their own category definition. */
  private async getCategoryBehaviorType(
    userId: string,
    categoryName: string,
  ): Promise<'STANDARD' | 'PROFESSIONAL'> {
    const category = await this.categoryRepository
      .createQueryBuilder('category')
      .where('LOWER(category.name) = LOWER(:categoryName)', { categoryName })
      .andWhere('(category.isSystem = :isSystem OR category.userId = :userId)', {
        isSystem: true,
        userId,
      })
      .getOne();

    if (!category) {
      throw new BadRequestException('Selected category is not available to this user');
    }
    return category.behaviorType;
  }

  // ─── Device Contacts Sync ───────────────────────────────────────────────────

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
          category: FALLBACK_CATEGORY,
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
