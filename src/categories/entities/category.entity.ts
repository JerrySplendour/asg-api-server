import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../common/entities/user.entity';

/**
 * A category that a user can use to organise their contacts.
 *
 * System categories (isSystem=true) are seeded on startup and cannot be
 * renamed, deleted, or changed by users.
 *
 * Custom categories are user-scoped and deletable; when deleted, any
 * contacts in that category automatically revert to the system "friend"
 * category (enforced in CategoriesService.deleteCategory).
 */
@Entity('user_categories')
export class UserCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * null = system-wide category (available to all users).
   * set  = user-specific custom category.
   */
  @Column({ nullable: true })
  userId?: string;

  @Column()
  name!: string;

  /**
   * STANDARD  – recipient may choose which category to place the sender in
   *             upon accepting a contact request.
   * PROFESSIONAL – recipient is forced into the sender's chosen category;
   *               they are notified of this upon receiving the request.
   */
  @Column({
    type: 'varchar',
    default: 'STANDARD',
  })
  behaviorType!: 'STANDARD' | 'PROFESSIONAL';

  /** True for built-in system categories that cannot be deleted. */
  @Column({ default: false })
  isSystem!: boolean;

  /** Optional hex colour for UI display. */
  @Column({ nullable: true })
  color?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  user?: User;
}
