import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('contact_requests')
export class ContactRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fromUserId!: string;

  @Column()
  fromUserName!: string;

  @Column({ nullable: true })
  fromUserAvatar?: string;

  @Column()
  toUserId!: string;

  @Column({
    type: 'varchar',
    enum: ['family', 'company', 'missionaries', 'regular', 'untracked'],
  })
  category!: string;

  @Column({
    type: 'varchar',
    enum: ['pending', 'accepted', 'rejected', 'blocked'],
    default: 'pending',
  })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  respondedAt?: Date;

  @Column({ nullable: true })
  message?: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
