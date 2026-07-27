import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';
import { GeofenceEvent } from './geofence-event.entity';

export class CreateGeofenceDto {
  id?: string;
  name!: string;
  latitude!: number;
  longitude!: number;
  radius!: number;
  type!: 'home' | 'work' | 'custom';
  isActive?: boolean;
  notifyOnEntry?: boolean;
  notifyOnExit?: boolean;
}

@Entity('geofences')
export class Geofence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  name!: string;

  @Column('decimal', { precision: 11, scale: 8 })
  latitude!: number;

  @Column('decimal', { precision: 11, scale: 8 })
  longitude!: number;

  @Column('float')
  radius!: number;

  @Column({
    type: 'varchar',
    enum: ['home', 'work', 'custom'],
    default: 'custom',
  })
  type!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: true })
  notifyOnEntry!: boolean;

  @Column({ default: true })
  notifyOnExit!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.geofences)
  user!: User;

  @OneToMany(() => GeofenceEvent, (event) => event.geofence)
  events!: GeofenceEvent[];
}
