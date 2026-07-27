import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Geofence } from './geofence.entity';

@Entity('geofence_events')
export class GeofenceEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  geofenceId!: string;

  @Column()
  userId!: string;

  @Column({
    type: 'varchar',
    enum: ['entry', 'exit'],
  })
  type!: string;

  @Column('bigint')
  timestamp!: number;

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

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Geofence, (geofence) => geofence.events)
  geofence!: Geofence;
}
