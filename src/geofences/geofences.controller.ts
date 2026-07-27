import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { GeofencesService } from './geofences.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;
  };
}

@Controller('geofences')
@UseGuards(JwtGuard)
export class GeofencesController {
  constructor(private geofencesService: GeofencesService) {}

  @Get()
  async getGeofences(@Req() req: AuthenticatedRequest) {
    return this.geofencesService.getGeofences(req.user.userId);
  }

  @Get(':id')
  async getGeofenceById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.geofencesService.getGeofenceById(req.user.userId, id);
  }

  @Post()
  async createGeofence(@Req() req: AuthenticatedRequest, @Body() geofenceData: any) {
    return this.geofencesService.createGeofence(req.user.userId, geofenceData);
  }

  @Patch(':id')
  async updateGeofence(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() updates: any) {
    return this.geofencesService.updateGeofence(req.user.userId, id, updates);
  }

  @Delete(':id')
  async deleteGeofence(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.geofencesService.deleteGeofence(req.user.userId, id);
  }

  @Get('events')
  async getGeofenceEvents(
    @Req() req: AuthenticatedRequest,
    @Query('geofenceId') geofenceId: string,
    @Query('limit') limit: number = 100,
  ) {
    return this.geofencesService.getGeofenceEvents(req.user.userId, geofenceId, limit);
  }

  @Delete('events')
  async clearGeofenceEvents(@Req() req: AuthenticatedRequest, @Query('geofenceId') geofenceId: string) {
    return this.geofencesService.clearGeofenceEvents(req.user.userId, geofenceId);
  }
}
