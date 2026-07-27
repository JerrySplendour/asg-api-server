import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';

@Entity('emergency_alerts')
export class EmergencyAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({
    type: 'varchar',
    enum: ['panic', 'theft', 'manual'],
  })
  type!: string;

  @Column({ type: 'simple-json' })
  location!: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    timestamp: number;
    speed?: number;
    heading?: number;
  };

  @Column('bigint')
  timestamp!: number;

  @Column({ nullable: true })
  message?: string;

  @Column({ type: 'simple-array', default: '' })
  notifiedContacts!: string[];

  @Column({ default: true })
  isActive!: boolean;

  @Column('bigint', { nullable: true })
  resolvedAt?: number;

  @Column({ nullable: true })
  responderNotes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.emergencyAlerts)
  user!: User;
}
