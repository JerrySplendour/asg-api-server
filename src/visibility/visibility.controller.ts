import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { VisibilityService } from './visibility.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;
  };
}

@Controller('visibility')
@UseGuards(JwtGuard)
export class VisibilityController {
  constructor(private visibilityService: VisibilityService) {}

  @Get()
  async getVisibilitySettings(@Req() req: AuthenticatedRequest) {
    return this.visibilityService.getVisibilitySettings(req.user.userId);
  }

  @Patch(':category')
  async updateVisibilitySettings(
    @Req() req: AuthenticatedRequest,
    @Param('category') category: string,
    @Body() settings: any,
  ) {
    return this.visibilityService.updateVisibilitySettings(req.user.userId, category, settings);
  }
}
