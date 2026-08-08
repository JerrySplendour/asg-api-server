import { Controller, Get, Post, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CheckInSchedulerService } from './check-in-scheduler.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

/**
 * REST API for the server-side safety check-in system.
 * All endpoints require authentication.
 */
@Controller('check-in')
@UseGuards(JwtGuard)
export class CheckInController {
  constructor(private readonly checkInScheduler: CheckInSchedulerService) {}

  /**
   * GET /check-in/settings
   * Returns the current check-in settings and status for the authenticated user.
   */
  @Get('settings')
  async getSettings(@Req() req: AuthenticatedRequest) {
    return this.checkInScheduler.getSettings(req.user.userId);
  }

  /**
   * PATCH /check-in/settings
   * Body: { isEnabled?: boolean, enabledCategories?: string[] }
   * Toggle check-in on/off or configure which categories trigger alerts.
   */
  @Patch('settings')
  async updateSettings(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.checkInScheduler.updateSettings(req.user.userId, body);
  }

  /**
   * POST /check-in/confirm
   * Resets the 6-hour timer.  Called when the user taps the notification or
   * presses "I'm OK" in-app.
   */
  @Post('confirm')
  async confirmCheckIn(@Req() req: AuthenticatedRequest) {
    const record = await this.checkInScheduler.confirmCheckIn(req.user.userId);
    return {
      success: true,
      lastConfirmedAt: record.lastConfirmedAt,
      nextCheckInDue: Number(record.lastConfirmedAt) + 6 * 60 * 60 * 1000,
    };
  }
}
