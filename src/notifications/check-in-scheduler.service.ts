import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserCheckIn } from './entities/user-check-in.entity';
import { FcmService } from './fcm.service';
import { User } from '../common/entities/user.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { EmergencyAlert } from '../emergency/entities/emergency-alert.entity';
import { Location } from '../locations/entities/location.entity';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000; // T+6h (First Safety Check-In)
const NINE_HOURS_MS = 9 * 60 * 60 * 1000; // T+9h (3h later: Concern Notice #2)
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // T+12h (3h later: Auto-Panic Emergency Notice)

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
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
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
   *   T+9h  → Push Notification #2 (3 hours later concern warning)
   *   T+12h → Auto-panic triggered for enabled categories (3 hours later emergency)
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

    // ── T+12h: Auto-panic (3 hours after concern notification) ──────────────
    if (
      elapsedMs >= TWELVE_HOURS_MS &&
      !record.autoPanicTriggeredAt &&
      record.secondNotificationSentAt // only if 2nd notification was actually sent
    ) {
      this.logger.warn({ userId: record.userId }, 'Auto-panic triggered — no check-in response');

      await this.triggerAutoPanic(record, user);

      record.autoPanicTriggeredAt = now;
      await this.checkInRepository.save(record);
      return;
    }

    // ── T+9h: Second notification (Concern Alert - 3 hours after 1st notice) ─
    if (
      elapsedMs >= NINE_HOURS_MS &&
      !record.secondNotificationSentAt
    ) {
      if (user.fcmToken) {
        await this.fcmService.sendToDevice(user.fcmToken, {
          title: '⚠️ Safety Concern Check-In',
          body: `We haven't heard from you in 9 hours. Please confirm you're okay — your contacts will be alerted in 3 hours if you don't respond.`,
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

    // ── T+6h: First notification (Safety Check-In) ─────────────────────────
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
    // Fetch user's latest recorded location point
    const latestLoc = await this.locationRepository.findOne({
      where: { userId: record.userId },
      order: { timestamp: 'DESC' },
    });

    const locationData = latestLoc
      ? { latitude: latestLoc.latitude, longitude: latestLoc.longitude, accuracy: latestLoc.accuracy, timestamp: latestLoc.timestamp }
      : { latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now() };

    // Create an emergency alert record
    const alert = this.alertRepository.create({
      userId: record.userId,
      type: 'manual',
      location: locationData,
      timestamp: Date.now(),
      isActive: true,
      notifiedContacts: [],
      message: 'Auto-triggered: no check-in response after 12 hours',
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
        body: `${user.displayName || 'A contact'} has not checked in for 12 hours and may need help.`,
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
