// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Contact } from './entities/contact.entity';
// import { EmergencyContact } from './entities/emergency-contact.entity';
// import { ContactRequest } from './entities/contact-request.entity';
// import { User } from '../common/entities/user.entity';
// // import { ContactRequest } from './entities/contact-request.entity';
// import { TrackingGateway } from '../gateway/tracking.gateway';

// @Injectable()
// export class ContactsService {
//   constructor(
//     @InjectRepository(Contact)
//     private contactRepository: Repository<Contact>,
//     @InjectRepository(EmergencyContact)
//     private emergencyContactRepository: Repository<EmergencyContact>,
//     @InjectRepository(ContactRequest)
//     private contactRequestRepository: Repository<ContactRequest>,
//     @InjectRepository(User)
//     private userRepository: Repository<User>,
//     private trackingGateway: TrackingGateway,
//   ) { }


//   async findUserByPhone(phoneNumber: string): Promise<User | null> {
//     if (!phoneNumber) return null;
//     const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
//     return this.userRepository
//       .createQueryBuilder('user')
//       .where("REPLACE(REPLACE(REPLACE(REPLACE(user.phoneNumber, ' ', ''), '-', ''), '(', ''), ')', '') = :phone", { phone: normalized })
//       .getOne();
//   }

//   // Regular Contacts
//   async getContacts(userId: string): Promise<Contact[]> {
//     return this.contactRepository.find({ where: { userId } });
//   }

//   async getContactById(userId: string, id: string): Promise<Contact> {
//     const contact = await this.contactRepository.findOne({ where: { id, userId } });
//     if (!contact) throw new NotFoundException('Contact not found');
//     return contact;
//   }

//   async addContact__(userId: string, contactData: any): Promise<Contact> {
//     const contact = this.contactRepository.create({ ...contactData, userId });
//     const saved = await this.contactRepository.save(contact);
//     return Array.isArray(saved) ? saved[0] : saved;
//   }

//   async addContact(userId: string, contactData: any): Promise<Contact> {
//     // async addContact(userId: string, contactData: any): Promise<{ contact?: Contact; requestSent: boolean; request?: ContactRequest }> {
//     // 1. Save standard contact record
//     const contact = this.contactRepository.create({ ...contactData, userId });
//     const savedContact = await this.contactRepository.save(contact);
//     const resultContact = Array.isArray(savedContact) ? savedContact[0] : savedContact;

//     // 2. Check if the target phone number belongs to an active user
//     let requestSent = false;
//     let createdRequest: ContactRequest | undefined;

//     if (contactData.phoneNumber) {
//       const targetUser = await this.findUserByPhone(contactData.phoneNumber);

//       // Make sure we aren't sending a request to ourselves
//       if (targetUser && targetUser.id !== userId) {
//         // Fetch sender details for display name
//         const senderUser = await this.userRepository.findOne({ where: { id: userId } });
//         const senderName = senderUser?.displayName || senderUser?.email || 'A user';

//         // Check if a pending request already exists to avoid duplicates
//         const existingRequest = await this.contactRequestRepository.findOne({
//           where: { fromUserId: userId, toUserId: targetUser.id, status: 'pending' },
//         });

//         if (!existingRequest) {
//           createdRequest = this.contactRequestRepository.create({
//             fromUserId: userId,
//             toUserId: targetUser.id,
//             fromUserName: senderName,
//             category: contactData.category || 'friend',
//             message: contactData.message || `${senderName} added you as a contact`,
//           });

//           await this.contactRequestRepository.save(createdRequest);
//           requestSent = true;

//           // Dispatch real-time socket event
//           this.trackingGateway.notifyContactRequest(
//             targetUser.id,
//             senderName,
//             createdRequest.id,
//             createdRequest.category,
//           );
//         }
//       }
//     }

//     return resultContact;

//     // return {
//     //   contact: resultContact,
//     //   requestSent,
//     //   request: createdRequest,
//     // };
//   }

//   async updateContact(userId: string, id: string, updates: any): Promise<Contact> {
//     await this.contactRepository.update({ id, userId }, updates);
//     return this.getContactById(userId, id);
//   }

//   async deleteContact(userId: string, id: string): Promise<void> {
//     await this.contactRepository.delete({ id, userId });
//   }

//   // Emergency Contacts
//   async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
//     return this.emergencyContactRepository.find({ where: { userId } });
//   }

//   async addEmergencyContact(userId: string, data: any): Promise<EmergencyContact> {
//     const ec = this.emergencyContactRepository.create({ ...data, userId });
//     const saved = await this.emergencyContactRepository.save(ec);
//     return Array.isArray(saved) ? saved[0] : saved;
//   }

//   async updateEmergencyContact(userId: string, id: string, updates: any): Promise<EmergencyContact> {
//     await this.emergencyContactRepository.update({ id, userId }, updates);
//     const updated = await this.emergencyContactRepository.findOne({ where: { id, userId } });
//     if (!updated) throw new NotFoundException('Emergency contact not found');
//     return updated;
//   }

//   async deleteEmergencyContact(userId: string, id: string): Promise<void> {
//     await this.emergencyContactRepository.delete({ id, userId });
//   }

//   // Contact Requests
//   async getPendingContactRequests(userId: string): Promise<ContactRequest[]> {
//     return this.contactRequestRepository.find({
//       where: { toUserId: userId, status: 'pending' },
//     });
//   }

//   async sendContactRequest(
//     fromUserId: string,
//     toUserId: string,
//     fromUserName: string,
//     category: string,
//     message?: string,
//   ): Promise<ContactRequest> {
//     const request = this.contactRequestRepository.create({
//       fromUserId,
//       toUserId,
//       fromUserName,
//       category,
//       message,
//     });
//     return this.contactRequestRepository.save(request);
//   }

//   /**
//    * Accept a contact request.
//    * Creates a Contact record for both the acceptor and the requester,
//    * each with linkedUserId pointing to the other's account.
//    */
//   async acceptContactRequest(userId: string, requestId: string): Promise<Contact> {
//     const request = await this.contactRequestRepository.findOne({
//       where: { id: requestId, toUserId: userId },
//     });
//     if (!request) throw new NotFoundException('Contact request not found');

//     await this.contactRequestRepository.update({ id: requestId }, { status: 'accepted' });

//     // Fetch both users for contact info
//     const acceptorUser = await this.userRepository.findOne({ where: { id: userId } });
//     const requesterUser = await this.userRepository.findOne({ where: { id: request.fromUserId } });

//     // Contact for acceptor → linked to requester's account
//     const contactForAcceptor = this.contactRepository.create({
//       userId,
//       name: request.fromUserName,
//       email: requesterUser?.email || '',
//       phoneNumber: requesterUser?.phoneNumber || '',
//       relationship: 'friend',
//       category: request.category,
//       requestStatus: 'accepted',
//       isTracked: true,
//       linkedUserId: request.fromUserId,
//     });
//     const saved = await this.contactRepository.save(contactForAcceptor);

//     // Also create reverse contact for requester → linked to acceptor's account
//     if (acceptorUser) {
//       const existingReverse = await this.contactRepository.findOne({
//         where: { userId: request.fromUserId, linkedUserId: userId },
//       });
//       if (!existingReverse) {
//         const contactForRequester = this.contactRepository.create({
//           userId: request.fromUserId,
//           name: acceptorUser.displayName || acceptorUser.email,
//           email: acceptorUser.email || '',
//           phoneNumber: acceptorUser.phoneNumber || '',
//           relationship: 'friend',
//           category: request.category,
//           requestStatus: 'accepted',
//           isTracked: true,
//           linkedUserId: userId,
//         });
//         await this.contactRepository.save(contactForRequester);
//       }
//     }

//     return Array.isArray(saved) ? saved[0] : saved;
//   }

//   async rejectContactRequest(userId: string, requestId: string): Promise<void> {
//     await this.contactRequestRepository.update(
//       { id: requestId, toUserId: userId },
//       { status: 'rejected' },
//     );
//   }

//   // Device Contacts Sync
//   async syncDeviceContacts(userId: string, deviceContacts: any[]): Promise<Contact[]> {
//     const contacts: Contact[] = [];
//     for (const dc of deviceContacts) {
//       const existing = await this.contactRepository.findOne({
//         where: { userId, deviceContactId: dc.id },
//       });

//       if (existing) {
//         await this.contactRepository.update(
//           { id: existing.id },
//           { name: dc.name, phoneNumber: dc.phoneNumber, email: dc.email },
//         );
//         contacts.push(await this.getContactById(userId, existing.id));
//       } else {
//         const contact = this.contactRepository.create({
//           userId,
//           name: dc.name,
//           phoneNumber: dc.phoneNumber || '',
//           email: dc.email || '',
//           deviceContactId: dc.id,
//           relationship: 'friend',
//         });
//         contacts.push(await this.contactRepository.save(contact));
//       }
//     }
//     return contacts;
//   }

//   /**
//    * Look up a registered user by phone number.
//    * Used to identify which device contacts are on the ASG platform.
//    */
//   async findUsersByPhone(phoneNumbers: string[]): Promise<{ phoneNumber: string; userId: string; displayName: string }[]> {
//     const results: { phoneNumber: string; userId: string; displayName: string }[] = [];
//     for (const phone of phoneNumbers) {
//       // Normalize: strip spaces/dashes
//       const normalized = phone.replace(/[\s\-\(\)]/g, '');
//       const user = await this.userRepository
//         .createQueryBuilder('user')
//         .where("REPLACE(REPLACE(REPLACE(REPLACE(user.phoneNumber, ' ', ''), '-', ''), '(', ''), ')', '') = :phone", { phone: normalized })
//         .getOne();
//       if (user) {
//         results.push({ phoneNumber: phone, userId: user.id, displayName: user.displayName || user.email });
//       }
//     }
//     return results;
//   }
// }





import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { ContactRequest } from './entities/contact-request.entity';
import { User } from '../common/entities/user.entity';
import { logger } from '../lib/logger';

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
      // 1. Save local contact record
      const contact = this.contactRepository.create({ ...contactData, userId });
      const saved = await this.contactRepository.save(contact);
      const resultContact = Array.isArray(saved) ? saved[0] : saved;

      // 2. Check if phone number exists in DB
      if (contactData.phoneNumber) {
        const targetUser = await this.findUserByPhone(contactData.phoneNumber);

        // Don't send request to self
        if (targetUser && targetUser.id !== userId) {
          const senderUser = await this.userRepository.findOne({ where: { id: userId } });
          const senderName = senderUser?.displayName || senderUser?.email || 'A user';

          // Prevent duplicate pending requests
          const existingRequest = await this.contactRequestRepository.findOne({
            where: { fromUserId: userId, toUserId: targetUser.id, status: 'pending' },
          });

          if (!existingRequest) {
            await this.sendContactRequest(
              userId,
              targetUser.id,
              senderName,
              contactData.category || 'friend',
              contactData.message || `${senderName} added you as a contact`,
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