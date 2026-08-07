import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores server-side check-in state per user.
 *
 * The check-in scheduler (CheckInSchedulerService) reads this table every
 * 5 minutes to determine which users need notifications or auto-escalation.
 *
 * Timeline (from lastConfirmedAt):
 *   T+6h  → send first notification (firstNotificationSentAt set)
 *   T+12h → send second notification (secondNotificationSentAt set)
 *   T+15h → auto-trigger panic mode for configured categories
 */
@Entity('user_check_ins')
export class UserCheckIn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  userId!: string;

  /** Whether the check-in feature is enabled for this user. */
  @Column({ default: true })
  isEnabled!: boolean;

  /**
   * UTC timestamp (ms) of the last confirmed check-in.
   * Reset by the user tapping the notification or pressing "I'm OK" in-app.
   */
  @Column('bigint', { default: () => "(strftime('%s','now') * 1000)" })
  lastConfirmedAt!: number;

  /**
   * Comma-separated list of category names for which check-in auto-alerts are
   * active (e.g., "family,missionaries").
   * Always includes "family" by default.
   */
  @Column({ type: 'simple-array', default: 'family' })
  enabledCategories!: string[];

  /** UTC timestamp (ms) when the 6h (first) notification was sent. Null if not yet sent in this cycle. */
  @Column('bigint', { nullable: true })
  firstNotificationSentAt?: number;

  /** UTC timestamp (ms) when the 12h (second) notification was sent. Null if not yet sent in this cycle. */
  @Column('bigint', { nullable: true })
  secondNotificationSentAt?: number;

  /** UTC timestamp (ms) when auto-panic was triggered. Null if not yet triggered in this cycle. */
  @Column('bigint', { nullable: true })
  autoPanicTriggeredAt?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
