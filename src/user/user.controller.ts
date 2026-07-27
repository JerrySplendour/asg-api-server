import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

@Controller('user')
@UseGuards(JwtGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  async getProfile(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = (req as any).user;
    return this.userService.getProfile(user.userId);
  }

  @Patch('profile')
  async updateProfile(@Req() req: Request, @Body() updates: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = (req as any).user;
    return this.userService.updateProfile(user.userId, updates);
  }

  @Delete('profile')
  async deleteAccount(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = (req as any).user;
    return this.userService.deleteAccount(user.userId);
  }

  @Post('profile/change-password')
  async changePassword(@Req() req: Request, @Body() body: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = (req as any).user;
    return this.userService.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @Get('settings')
  async getUserSettings(@Req() req: Request) {
    // This would be imported from visibility service
    return {
      trackingEnabled: true,
      backgroundTrackingInterval: 10000,
      foregroundTrackingInterval: 5000,
    };
  }

  @Patch('settings')
  async updateUserSettings(@Req() req: Request, @Body() updates: any) {
    return updates;
  }

  @Get('privacy')
  async getPrivacySettings(@Req() req: Request) {
    // This would be imported from visibility service
    return {
      allowLocationSharing: true,
      emergencyContactsCanSeeLocation: true,
      publicProfile: false,
      dataRetentionDays: 90,
    };
  }

  @Patch('privacy')
  async updatePrivacySettings(@Req() req: Request, @Body() updates: any) {
    return updates;
  }
}
