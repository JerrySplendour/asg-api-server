import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('shared_locations')
export class SharedLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  ownerId!: string;

  @Column()
  contactId!: string;

  @Column('bigint')
  startTime!: number;

  @Column('bigint', { nullable: true })
  endTime?: number;

  @Column('bigint')
  expiresAt!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'simple-json' })
  permissions!: {
    canSeeLocation: boolean;
    canSeeTrips: boolean;
    canSeeBattery: boolean;
  };

  @CreateDateColumn()
  createdAt!: Date;
}
