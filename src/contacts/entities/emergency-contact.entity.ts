import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('emergency_contacts')
export class EmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  contactId!: string;

  @Column()
  name!: string;

  @Column()
  phoneNumber!: string;

  @Column()
  email!: string;

  @Column({
    type: 'varchar',
    enum: ['sms', 'call', 'email', 'push'],
    default: 'sms',
  })
  notificationMethod!: string;

  @Column({ default: false })
  isPrimary!: boolean;

  @Column({ nullable: true })
  category?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
