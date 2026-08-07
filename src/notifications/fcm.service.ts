import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  /** Android notification channel ID (required for Android 8+) */
  androidChannelId?: string;
  /** Badge count for iOS */
  badge?: number;
}

/**
 * Wraps Firebase Admin SDK to send FCM push notifications.
 *
 * Initialization Note:
 *   Firebase Admin is initialised lazily — if the `FIREBASE_SERVICE_ACCOUNT_PATH`
 *   environment variable is not set, FCM calls will be silently skipped and
 *   a warning logged.  This keeps the backend functional in development
 *   environments that don't have Firebase credentials configured yet.
 *
 * See FCM_SETUP_GUIDE.md for credential placement instructions.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_PATH not set — FCM push notifications are disabled. ' +
          'See FCM_SETUP_GUIDE.md for setup instructions.',
      );
      return;
    }

    try {
      // Avoid duplicate initialization if the app is already initialised
      if (!admin.apps.length) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const serviceAccount = require(serviceAccountPath);
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        this.app = admin.app();
      }
      this.logger.log('Firebase Admin SDK initialised successfully');
    } catch (err) {
      this.logger.error({ err }, 'Failed to initialise Firebase Admin SDK');
    }
  }

  private get isReady(): boolean {
    return this.app !== null;
  }

  /**
   * Send a push notification to a single device FCM token.
   */
  async sendToDevice(fcmToken: string, payload: FcmPayload): Promise<boolean> {
    if (!this.isReady || !fcmToken) return false;

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: this.stringifyData(payload.data),
      android: {
        priority: payload.priority === 'high' ? 'high' : 'normal',
        notification: {
          channelId: payload.androidChannelId ?? 'asg_default',
          sound: 'default',
        },
      },
      apns: {
        headers: {
          'apns-priority': payload.priority === 'high' ? '10' : '5',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: payload.badge,
            contentAvailable: payload.priority === 'high' ? true : undefined,
          },
        },
      },
    };

    try {
      const result = await this.app!.messaging().send(message);
      this.logger.debug({ result, fcmToken: fcmToken.slice(0, 12) + '…' }, 'FCM sent');
      return true;
    } catch (err: any) {
      // Invalid / expired tokens should be handled gracefully
      if (err?.code === 'messaging/registration-token-not-registered') {
        this.logger.warn({ fcmToken: fcmToken.slice(0, 12) + '…' }, 'FCM token expired/invalid');
      } else {
        this.logger.error({ err }, 'FCM send error');
      }
      return false;
    }
  }

  /**
   * Send a push notification to multiple device tokens simultaneously (multicast).
   * Returns the count of successful sends.
   */
  async sendToMultiple(fcmTokens: string[], payload: FcmPayload): Promise<number> {
    if (!this.isReady || !fcmTokens.length) return 0;

    const validTokens = fcmTokens.filter(Boolean);
    if (!validTokens.length) return 0;

    const message: admin.messaging.MulticastMessage = {
      tokens: validTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: this.stringifyData(payload.data),
      android: {
        priority: payload.priority === 'high' ? 'high' : 'normal',
        notification: {
          channelId: payload.androidChannelId ?? 'asg_default',
          sound: 'default',
        },
      },
      apns: {
        headers: {
          'apns-priority': payload.priority === 'high' ? '10' : '5',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: payload.badge,
            contentAvailable: payload.priority === 'high' ? true : undefined,
          },
        },
      },
    };

    try {
      const result = await this.app!.messaging().sendEachForMulticast(message);
      this.logger.debug(
        {
          successCount: result.successCount,
          failureCount: result.failureCount,
        },
        'FCM multicast sent',
      );
      return result.successCount;
    } catch (err) {
      this.logger.error({ err }, 'FCM multicast error');
      return 0;
    }
  }

  /** Ensure all data values are strings (FCM requirement). */
  private stringifyData(data?: Record<string, string>): Record<string, string> {
    if (!data) return {};
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? '')]),
    );
  }
}
