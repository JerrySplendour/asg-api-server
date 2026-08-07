import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCategory } from './entities/category.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { logger } from '../lib/logger';

/** The fallback system category for contacts whose custom category is deleted. */
export const FALLBACK_CATEGORY = 'friend';

/**
 * System-level categories that are always available to every user.
 * These are seeded once on startup and cannot be deleted by any user.
 */
export const SYSTEM_CATEGORIES: Omit<
  UserCategory,
  'id' | 'userId' | 'user' | 'createdAt' | 'updatedAt'
>[] = [
  { name: 'friend',         behaviorType: 'STANDARD',      isSystem: true },
  { name: 'family',         behaviorType: 'STANDARD',      isSystem: true },
  { name: 'company',        behaviorType: 'PROFESSIONAL',  isSystem: true },
  { name: 'missionaries',   behaviorType: 'STANDARD',      isSystem: true },
  { name: 'public_service', behaviorType: 'PROFESSIONAL',  isSystem: true },
];

@Injectable()
export class CategoriesService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(UserCategory)
    private categoryRepository: Repository<UserCategory>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  /** Seed system categories on app startup if they don't already exist. */
  async onApplicationBootstrap() {
    for (const cat of SYSTEM_CATEGORIES) {
      const exists = await this.categoryRepository.findOne({
        where: { name: cat.name, isSystem: true },
      });
      if (!exists) {
        await this.categoryRepository.save(
          this.categoryRepository.create({ ...cat }),
        );
        logger.info({ name: cat.name }, 'Seeded system category');
      }
    }
  }

  /**
   * Returns all categories visible to a user:
   * - All system categories (userId = null)
   * - User's own custom categories
   */
  async getUserCategories(userId: string): Promise<UserCategory[]> {
    const system = await this.categoryRepository.find({
      where: { isSystem: true },
      order: { name: 'ASC' },
    });
    const custom = await this.categoryRepository.find({
      where: { userId, isSystem: false },
      order: { createdAt: 'ASC' },
    });
    return [...system, ...custom];
  }

  async createCategory(
    userId: string,
    data: { name: string; behaviorType?: 'STANDARD' | 'PROFESSIONAL'; color?: string },
  ): Promise<UserCategory> {
    const cat = this.categoryRepository.create({
      userId,
      name: data.name.toLowerCase().trim(),
      behaviorType: data.behaviorType ?? 'STANDARD',
      color: data.color,
      isSystem: false,
    });
    const saved = await this.categoryRepository.save(cat);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async updateCategory(
    userId: string,
    id: string,
    data: { name?: string; behaviorType?: 'STANDARD' | 'PROFESSIONAL'; color?: string },
  ): Promise<UserCategory> {
    const cat = await this.categoryRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');

    // System categories: allow behaviour type / colour change but NOT name
    if (cat.isSystem && data.name && data.name !== cat.name) {
      throw new ForbiddenException('Cannot rename a system category');
    }

    // Custom categories must belong to the requesting user
    if (!cat.isSystem && cat.userId !== userId) {
      throw new ForbiddenException('Not your category');
    }

    const updates: Partial<UserCategory> = {};
    if (!cat.isSystem && data.name) updates.name = data.name.toLowerCase().trim();
    if (data.behaviorType) updates.behaviorType = data.behaviorType;
    if (data.color !== undefined) updates.color = data.color;

    await this.categoryRepository.update({ id }, updates);
    const updated = await this.categoryRepository.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Category not found after update');
    return updated;
  }

  /**
   * Delete a custom user category.
   * Any contacts currently in this category are migrated to "friend" before deletion.
   */
  async deleteCategory(userId: string, id: string): Promise<void> {
    const cat = await this.categoryRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat.isSystem) throw new ForbiddenException('Cannot delete a system category');
    if (cat.userId !== userId) throw new ForbiddenException('Not your category');

    // Migrate contacts that use this category → fallback
    await this.contactRepository.update(
      { userId, category: cat.name },
      { category: FALLBACK_CATEGORY },
    );

    await this.categoryRepository.delete({ id });
    logger.info({ userId, categoryId: id, name: cat.name }, 'Deleted custom category, contacts migrated to friend');
  }

  async getCategoryByName(name: string): Promise<UserCategory | null> {
    return this.categoryRepository.findOne({ where: { name, isSystem: true } }) ?? null;
  }
}
