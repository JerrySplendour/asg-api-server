import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { EmergencyService } from './emergency.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;
  };
}

@Controller('emergency')
@UseGuards(JwtGuard)
export class EmergencyController {
  constructor(private emergencyService: EmergencyService) {}

  @Get('alerts')
  async getEmergencyAlerts(@Req() req: AuthenticatedRequest) {
    return this.emergencyService.getEmergencyAlerts(req.user.userId);
  }

  @Get('alerts/:id')
  async getEmergencyAlertById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.emergencyService.getEmergencyAlertById(req.user.userId, id);
  }

  @Post('activate')
  async activateEmergency(@Req() req: AuthenticatedRequest, @Body() emergencyData: any) {
    return this.emergencyService.activateEmergency(req.user.userId, emergencyData);
  }

  @Post('resolve')
  async resolveEmergency(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.emergencyService.resolveEmergency(req.user.userId, body.alertId, body.responderNotes);
  }

  @Get('alerts')
  async getActiveEmergencies(@Req() req: AuthenticatedRequest, @Query('isActive') isActive: boolean) {
    if (isActive) {
      return this.emergencyService.getActiveEmergencies(req.user.userId);
    }
    return this.emergencyService.getEmergencyAlerts(req.user.userId);
  }
}
