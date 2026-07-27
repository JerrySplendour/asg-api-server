import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';

export class TripWaypoint {
  latitude!: number;
  longitude!: number;
  accuracy!: number;
  altitude?: number;
  timestamp!: number;
  speed?: number;
  heading?: number;
}

export class TripDto {
  id!: string;
  startLocation!: TripWaypoint;
  endLocation?: TripWaypoint;
  startTime!: number;
  endTime?: number;
  distance!: number;
  duration!: number;
  isActive!: boolean;
  waypoints!: TripWaypoint[];
  averageSpeed!: number;
  maxSpeed!: number;
  detectedTransportMode?: 'walking' | 'cycling' | 'driving' | 'transit';
  purpose?: string;
  createdAt!: Date;
  updatedAt!: Date;

  user!: User;
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'simple-json' })
  startLocation!: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    timestamp: number;
    speed?: number;
    heading?: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  endLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    timestamp: number;
    speed?: number;
    heading?: number;
  };

  @Column('bigint')
  startTime!: number;

  @Column('bigint', { nullable: true })
  endTime?: number;

  @Column('float', { default: 0 })
  distance!: number;

  @Column('bigint', { default: 0 })
  duration!: number;

  @Column({ default: false })
  isActive!: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  waypoints!: Array<{
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    timestamp: number;
    speed?: number;
    heading?: number;
  }>;

  @Column('float', { default: 0 })
  averageSpeed!: number;

  @Column('float', { default: 0 })
  maxSpeed!: number;

  @Column({
    type: 'varchar',
    enum: ['walking', 'cycling', 'driving', 'transit'],
    nullable: true,
  })
  detectedTransportMode?: string;

  @Column({ nullable: true })
  purpose?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.trips)
  user!: User;
}
