import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserCheckIn } from './entities/user-check-in.entity';
import { FcmService } from './fcm.service';
import { User } from '../common/entities/user.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { EmergencyAlert } from '../emergency/entities/emergency-alert.entity';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const FIFTEEN_HOURS_MS = 15 * 60 * 60 * 1000;

@Injectable()
export class CheckInSchedulerService {
  private readonly logger = new Logger(CheckInSchedulerService.name);

  constructor(
    @InjectRepository(UserCheckIn)
    private checkInRepository: Repository<UserCheckIn>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(EmergencyAlert)
    private alertRepository: Repository<EmergencyAlert>,
    private fcmService: FcmService,
  ) { }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Confirm a check-in — resets the 6h timer to now.
   * Creates the UserCheckIn record if one doesn't exist yet.
   */
  async confirmCheckIn(userId: string): Promise<UserCheckIn> {
    let record = await this.checkInRepository.findOne({ where: { userId } });
    const now = Date.now();

    if (!record) {
      record = this.checkInRepository.create({
        userId,
        isEnabled: true,
        lastConfirmedAt: now,
        enabledCategories: ['family'],
      });
    } else {
      record.lastConfirmedAt = now;
      record.firstNotificationSentAt = undefined;
      record.secondNotificationSentAt = undefined;
      record.autoPanicTriggeredAt = undefined;
    }

    return this.checkInRepository.save(record);
  }

  /**
   * Update check-in settings for a user.
   */
  async updateSettings(
    userId: string,
    data: { isEnabled?: boolean; enabledCategories?: string[] },
  ): Promise<UserCheckIn> {
    let record = await this.checkInRepository.findOne({ where: { userId } });
    if (!record) {
      record = this.checkInRepository.create({
        userId,
        lastConfirmedAt: Date.now(),
        isEnabled: data.isEnabled ?? true,
        enabledCategories: data.enabledCategories ?? ['family'],
      });
    } else {
      if (data.isEnabled !== undefined) record.isEnabled = data.isEnabled;
      if (data.enabledCategories) record.enabledCategories = data.enabledCategories;
    }
    return this.checkInRepository.save(record);
  }

  async getSettings(userId: string): Promise<UserCheckIn | null> {
    let record = await this.checkInRepository.findOne({ where: { userId } });
    if (!record) {
      record = this.checkInRepository.create({
        userId,
        isEnabled: true,
        lastConfirmedAt: Date.now(),
        enabledCategories: ['family'],
      });
      record = await this.checkInRepository.save(record);
    }
    return record;
  }

  // ─── Scheduler ──────────────────────────────────────────────────────────────

  /**
   * Runs every 5 minutes, checking all users for missed check-ins.
   *
   * Timeline from lastConfirmedAt:
   *   T+6h  → Push Notification #1 ("Safety Check-in")
   *   T+12h → Push Notification #2 (warning — no response to #1)
   *   T+15h → Auto-panic triggered for enabled categories
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runCheckInCycle() {
    this.logger.debug('Running check-in cycle...');

    const activeRecords = await this.checkInRepository.find({
      where: { isEnabled: true },
    });

    const now = Date.now();

    for (const record of activeRecords) {
      const elapsed = now - Number(record.lastConfirmedAt);

      try {
        await this.processCheckIn(record, elapsed, now);
      } catch (err) {
        this.logger.error({ err, userId: record.userId }, 'Error processing check-in for user');
      }
    }
  }

  private async processCheckIn(
    record: UserCheckIn,
    elapsedMs: number,
    now: number,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: record.userId } });
    if (!user) return;

    // ── T+15h: Auto-panic ──────────────────────────────────────────────────
    if (
      elapsedMs >= FIFTEEN_HOURS_MS &&
      !record.autoPanicTriggeredAt &&
      record.secondNotificationSentAt // only if 2nd notification was actually sent
    ) {
      this.logger.warn({ userId: record.userId }, 'Auto-panic triggered — no check-in response');

      await this.triggerAutoPanic(record, user);

      record.autoPanicTriggeredAt = now;
      await this.checkInRepository.save(record);
      return;
    }

    // ── T+12h: Second notification ─────────────────────────────────────────
    if (
      elapsedMs >= TWELVE_HOURS_MS &&
      !record.secondNotificationSentAt
    ) {
      if (user.fcmToken) {
        await this.fcmService.sendToDevice(user.fcmToken, {
          title: '⚠️ Safety Check-In',
          body: `We haven't heard from you. Please confirm you're okay — your contacts will be alerted if you don't respond soon.`,
          priority: 'high',
          androidChannelId: 'asg_checkin',
          data: {
            type: 'check_in',
            notificationNumber: '2',
            deepLink: '/check-in/confirm',
          },
        });
      }
      record.secondNotificationSentAt = now;
      await this.checkInRepository.save(record);
      return;
    }

    // ── T+6h: First notification ───────────────────────────────────────────
    if (
      elapsedMs >= SIX_HOURS_MS &&
      !record.firstNotificationSentAt
    ) {
      if (user.fcmToken) {
        await this.fcmService.sendToDevice(user.fcmToken, {
          title: '🔔 Safety Check-In',
          body: 'Just checking in — tap to confirm you\'re okay.',
          priority: 'high',
          androidChannelId: 'asg_checkin',
          data: {
            type: 'check_in',
            notificationNumber: '1',
            deepLink: '/check-in/confirm',
          },
        });
      }
      record.firstNotificationSentAt = now;
      await this.checkInRepository.save(record);
    }
  }

  /**
   * Triggers a panic alert and notifies all contacts in the user's
   * enabled check-in categories via FCM.
   */
  private async triggerAutoPanic(record: UserCheckIn, user: User): Promise<void> {
    // Create an emergency alert record
    const alert = this.alertRepository.create({
      userId: record.userId,
      type: 'manual',
      location: { latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now() },
      timestamp: Date.now(),
      isActive: true,
      notifiedContacts: [],
      message: 'Auto-triggered: no check-in response after 15 hours',
    });
    await this.alertRepository.save(alert);

    // Find contacts in the enabled categories who have a linked user
    const contacts = await this.contactRepository.find({
      where: {
        userId: record.userId,
        category: In(record.enabledCategories),
        isTracked: true,
        requestStatus: 'accepted',
      },
    });

    const fcmTokens: string[] = [];
    for (const contact of contacts) {
      if (!contact.linkedUserId) continue;
      const contactUser = await this.userRepository.findOne({
        where: { id: contact.linkedUserId },
        select: ['fcmToken'],
      });
      if (contactUser?.fcmToken) {
        fcmTokens.push(contactUser.fcmToken);
      }
    }

    if (fcmTokens.length > 0) {
      await this.fcmService.sendToMultiple(fcmTokens, {
        title: '🚨 SAFETY ALERT',
        body: `${user.displayName || 'A contact'} has not checked in for 15 hours and may need help.`,
        priority: 'high',
        androidChannelId: 'asg_emergency',
        data: {
          type: 'auto_panic',
          fromUserId: record.userId,
          fromUserName: user.displayName || user.email,
          deepLink: '/',
        },
      });
    }

    this.logger.warn(
      { userId: record.userId, notifiedCount: fcmTokens.length },
      'Auto-panic: notified contacts',
    );
  }
}
