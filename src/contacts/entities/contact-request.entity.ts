import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('contact_requests')
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fromUserId!: string;

  @Column()
  fromUserName!: string;

  @Column({ nullable: true })
  fromUserAvatar?: string;

  @Column()
  toUserId!: string;

  /**
   * The category the sender wants User B placed in (for PROFESSIONAL)
   * or wants themselves placed in on User B's side (for STANDARD).
   * Free-form varchar to support custom categories.
   */
  @Column({ type: 'varchar' })
  category!: string;

  /**
   * STANDARD    – Recipient can choose their own category for the sender.
   * PROFESSIONAL – Recipient is forced to accept the sender under 'category'.
   */
  @Column({ type: 'varchar', default: 'STANDARD' })
  categoryBehaviorType!: 'STANDARD' | 'PROFESSIONAL';

  /**
   * The category the RECIPIENT chose to place the sender in.
   * Only meaningful for STANDARD requests, populated on acceptance.
   */
  @Column({ type: 'varchar', nullable: true })
  recipientCategory?: string;

  @Column({
    type: 'varchar',
    default: 'pending',
  })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  respondedAt?: Date;

  @Column({ nullable: true })
  message?: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
