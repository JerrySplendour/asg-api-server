import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { Location } from '../../locations/entities/location.entity';
import { Trip } from '../../trips/entities/trip.entity';
import { EmergencyAlert } from '../../emergency/entities/emergency-alert.entity';
import { Geofence } from '../../geofences/entities/geofence.entity';
import { VisibilitySettings } from '../../visibility/entities/visibility-settings.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  displayName!: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  privacySettings?: {
    allowLocationSharing: boolean;
    emergencyContactsCanSeeLocation: boolean;
    publicProfile: boolean;
    dataRetentionDays: number;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  @OneToMany(() => Contact, (contact) => contact.user)
  contacts!: Contact[];

  @OneToMany(() => Location, (location) => location.user)
  locations!: Location[];

  @OneToMany(() => Trip, (trip) => trip.user)
  trips!: Trip[];

  @OneToMany(() => EmergencyAlert, (alert) => alert.user)
  emergencyAlerts!: EmergencyAlert[];

  @OneToMany(() => Geofence, (geofence) => geofence.user)
  geofences!: Geofence[];

  @OneToMany(() => VisibilitySettings, (visibility) => visibility.user)
  visibilitySettings!: VisibilitySettings[];
}
