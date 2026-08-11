import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { TripsService } from './trips.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email?: string };
}

@Controller('trips')
@UseGuards(JwtGuard)
export class TripsController {
  constructor(private tripsService: TripsService) { }

  @Get()
  async getTrips(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.tripsService.getTrips(
      req.user.userId,
      parseInt(limit, 10) || 50,
      parseInt(offset, 10) || 0
    );
  }
  @Get('active')
  async getActiveTrip(@Req() req: AuthenticatedRequest) {
    return this.tripsService.getActiveTrip(req.user.userId);
  }

  @Post('active')
  async startTrip(@Req() req: AuthenticatedRequest, @Body() tripData: any) {
    return this.tripsService.startTrip(req.user.userId, tripData);
  }

  // Fix: support both 'waypoint' (backend) and 'waypoints' (frontend typo)
  @Post('active/waypoint')
  async updateTripWaypoint(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.tripsService.updateTripWaypoint(req.user.userId, body.location);
  }

  @Post('active/waypoints')
  async updateTripWaypointAlias(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.tripsService.updateTripWaypoint(req.user.userId, body.location);
  }

  @Post('active/end')
  async endTrip(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.tripsService.endTrip(req.user.userId, body.endLocation);
  }

  @Get('history')
  async getTripHistory(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.tripsService.getTripHistory(req.user.userId, startDate, endDate, limit);
  }

  /**
   * GET /trips/contacts/:contactId
   * Returns trip history for a specific contact (via their linked account).
   */
  @Get('contacts/:contactId')
  async getContactTripHistory(
    @Req() req: AuthenticatedRequest,
    @Param('contactId') contactId: string,
    @Query('limit') limit: string = '50',
  ) {
    const parsedLimit = parseInt(limit, 10) || 50;
    return this.tripsService.getContactTripHistory(req.user.userId, contactId, parsedLimit);
  }

  @Get(':id')
  async getTripById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.getTripById(req.user.userId, id);
  }

  @Delete(':id')
  async deleteTrip(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tripsService.deleteTrip(req.user.userId, id);
  }
}
