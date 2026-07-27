import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  name!: string;

  @Column()
  phoneNumber!: string;

  @Column()
  email!: string;

  @Column({
    type: 'varchar',
    enum: ['family', 'friend', 'colleague', 'emergency'],
  })
  relationship!: 'family' | 'friend' | 'colleague' | 'emergency';

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ default: false })
  isEmergencyContact!: boolean;

  @Column({
    type: 'varchar',
    enum: ['family', 'company', 'missionaries', 'regular', 'untracked'],
    default: 'regular',
  })
  category!: string;

  @Column({ default: false })
  isTracked!: boolean;

  @Column({
    type: 'varchar',
    enum: ['pending', 'accepted', 'rejected', 'blocked'],
    nullable: true,
  })
  requestStatus?: string;

  @CreateDateColumn()
  addedAt!: Date;

  @Column({ nullable: true })
  deviceContactId?: string;

  /**
   * The user ID of the linked ASG platform account.
   * Set when a contact request is accepted — allows fetching
   * this contact's live location and trip history.
   */
  @Column({ nullable: true })
  linkedUserId?: string;

  @Column({ type: 'simple-json', nullable: true })
  lastSeenLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    timestamp: number;
    speed?: number;
    heading?: number;
  };

  @Column({ nullable: true })
  lastSeenTime?: number;

  @ManyToOne(() => User, (user) => user.contacts)
  user!: User;
}
