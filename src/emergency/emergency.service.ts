import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmergencyAlert } from './entities/emergency-alert.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { User } from '../common/entities/user.entity';
import { FcmService } from '../notifications/fcm.service';
import { VisibilitySettings } from '../visibility/entities/visibility-settings.entity';

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(EmergencyAlert)
    private emergencyAlertRepository: Repository<EmergencyAlert>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(VisibilitySettings)
    private visibilitySettingsRepository: Repository<VisibilitySettings>,
    private fcmService: FcmService,
  ) {}

  async getEmergencyAlerts(userId: string): Promise<EmergencyAlert[]> {
    return this.emergencyAlertRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }

  async getEmergencyAlertById(userId: string, id: string): Promise<EmergencyAlert | null> {
    return this.emergencyAlertRepository.findOne({
      where: { id, userId },
    });
  }

  async activateEmergency(
    userId: string,
    emergencyData: Partial<EmergencyAlert>,
  ): Promise<EmergencyAlert> {
    const alert = this.emergencyAlertRepository.create({
      userId,
      ...emergencyData,
      timestamp: Date.now(),
      isActive: true,
      notifiedContacts: [],
    }) as EmergencyAlert;

    const saved = await this.emergencyAlertRepository.save(alert);

    // ── Send FCM push notifications to all accepted tracked contacts ────────
    await this.sendPanicNotifications(userId, emergencyData.type ?? 'panic');

    return saved;
  }

  async resolveEmergency(
    userId: string,
    alertId: string,
    notes?: string,
  ): Promise<EmergencyAlert | null> {
    await this.emergencyAlertRepository.update(
      { id: alertId, userId },
      { isActive: false, resolvedAt: Date.now(), responderNotes: notes },
    );
    return this.getEmergencyAlertById(userId, alertId);
  }

  async getActiveEmergencies(userId: string): Promise<EmergencyAlert[]> {
    return this.emergencyAlertRepository.find({
      where: { userId, isActive: true },
    });
  }

  /**
   * Sends high-priority FCM push notifications to family and explicitly
   * high-priority categories, never to every tracked contact by default.
   * Used both for manual panic and auto-triggered escalations.
   */
  async sendPanicNotifications(userId: string, type: string = 'panic'): Promise<void> {
    const triggerUser = await this.userRepository.findOne({ where: { id: userId } });
    const senderName = triggerUser?.displayName || 'A contact';

    const settings = await this.visibilitySettingsRepository.find({ where: { userId } });
    const panicCategories = new Set([
      'family',
      ...settings.filter((setting) => setting.isPanicCategory).map((setting) => setting.category),
    ]);

    // Collect only accepted contacts in the configured emergency categories.
    const contacts = await this.contactRepository.find({
      where: { userId, requestStatus: 'accepted', isTracked: true },
    });

    const fcmTokens: string[] = [];
    for (const contact of contacts.filter((contact) => panicCategories.has(contact.category))) {
      if (!contact.linkedUserId) continue;
      const contactUser = await this.userRepository.findOne({
        where: { id: contact.linkedUserId },
        select: ['fcmToken'],
      });
      if (contactUser?.fcmToken) {
        fcmTokens.push(contactUser.fcmToken);
      }
    }

    if (fcmTokens.length === 0) return;

    const titleMap: Record<string, string> = {
      panic: '🚨 PANIC ALERT',
      theft: '⚠️ Theft Alert',
      manual: '🚨 Emergency Alert',
    };

    const bodyMap: Record<string, string> = {
      panic: `${senderName} has triggered a panic alert and may need immediate help!`,
      theft: `${senderName} has reported a possible theft. Please check on them.`,
      manual: `${senderName} has activated an emergency alert.`,
    };

    await this.fcmService.sendToMultiple(fcmTokens, {
      title: titleMap[type] ?? '🚨 Emergency Alert',
      body: bodyMap[type] ?? `${senderName} needs help.`,
      priority: 'high',
      androidChannelId: 'asg_emergency',
      data: {
        type: type === 'panic' ? 'panic_alert' : 'emergency_alert',
        fromUserId: userId,
        fromUserName: senderName,
        deepLink: '/',
      },
    });
  }
}
