import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CategoriesService } from './categories.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email?: string };
}

@Controller('categories')
@UseGuards(JwtGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * GET /categories
   * Returns all system categories + user's own custom categories.
   */
  @Get()
  async getCategories(@Req() req: AuthenticatedRequest) {
    return this.categoriesService.getUserCategories(req.user.userId);
  }

  /**
   * POST /categories
   * Body: { name, behaviorType?: 'STANDARD'|'PROFESSIONAL', color?: string }
   */
  @Post()
  async createCategory(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.categoriesService.createCategory(req.user.userId, body);
  }

  /**
   * PATCH /categories/:id
   * Body: { name?, behaviorType?, color? }
   */
  @Patch(':id')
  async updateCategory(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.categoriesService.updateCategory(req.user.userId, id, body);
  }

  /**
   * DELETE /categories/:id
   * Migrates contacts in this category to "friend" then deletes the category.
   */
  @Delete(':id')
  async deleteCategory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.categoriesService.deleteCategory(req.user.userId, id);
    return { success: true };
  }
}
