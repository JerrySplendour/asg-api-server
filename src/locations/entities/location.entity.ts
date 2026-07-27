import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';


export class UpdateLocationDto {
  latitude!: number;
  longitude!: number;
  accuracy!: number;
  altitude?: number;
  timestamp!: number;
  speed?: number;
  heading?: number;
}

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column('decimal', { precision: 11, scale: 8 })
  latitude!: number;

  @Column('decimal', { precision: 11, scale: 8 })
  longitude!: number;

  @Column('float')
  accuracy!: number;

  @Column('float', { nullable: true })
  altitude?: number;

  @Column('bigint')
  timestamp!: number;

  @Column('float', { nullable: true })
  speed?: number;

  @Column('float', { nullable: true })
  heading?: number;

  @CreateDateColumn()
  recordedAt!: Date;

  @ManyToOne(() => User, (user) => user.locations)
  user!: User;
}
