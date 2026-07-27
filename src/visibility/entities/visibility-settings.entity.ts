import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';


export class VisibilitySettingsDto {
  id!: string;
  isVisible!: boolean;
  enableCheckIn!: boolean;
  isPanicCategory!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  user!: User;
}

@Entity('visibility_settings')
export class VisibilitySettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({
    type: 'varchar',
    enum: ['family', 'company', 'missionaries', 'regular', 'untracked'],
  })
  category!: string;

  @Column({ default: true })
  isVisible!: boolean;

  @Column({ default: false })
  enableCheckIn!: boolean;

  @Column({ default: false })
  isPanicCategory!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.visibilitySettings)
  user!: User;
}
