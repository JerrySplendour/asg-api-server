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
import { LocationsService } from './locations.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email?: string };
}

@Controller('locations')
@UseGuards(JwtGuard)
export class LocationsController {
  constructor(private locationsService: LocationsService) {}

  @Get('current')
  async getCurrentLocation(@Req() req: AuthenticatedRequest) {
    return this.locationsService.getCurrentLocation(req.user.userId);
  }

  @Post('current')
  async updateCurrentLocation(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.locationsService.updateCurrentLocation(req.user.userId, body);
  }

  @Get('history')
  async getLocationHistory(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit: number = 100,
  ) {
    return this.locationsService.getLocationHistory(req.user.userId, startDate, endDate, limit);
  }

  @Delete('history')
  async clearLocationHistory(@Req() req: AuthenticatedRequest) {
    return this.locationsService.clearLocationHistory(req.user.userId);
  }

  @Get('top-places')
  async getTopPlaces(@Req() req: AuthenticatedRequest) {
    return this.locationsService.getTopPlaces(req.user.userId);
  }

  @Patch('top-places/:id')
  async updateTopPlace(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.locationsService.updateTopPlace(req.user.userId, id, body.name);
  }

  @Get('history/:date/summary')
  async getLocationHistorySummary(@Req() req: AuthenticatedRequest, @Param('date') date: string) {
    return this.locationsService.getLocationHistorySummary(req.user.userId, date);
  }

  /**
   * GET /locations/contacts
   * Returns the latest location of all tracked contacts that are on the platform.
   */
  @Get('contacts')
  async getContactsLocations(@Req() req: AuthenticatedRequest) {
    return this.locationsService.getContactsLocations(req.user.userId);
  }

  /**
   * GET /locations/contacts/:contactId/history
   * Returns location history for a specific contact.
   */
  @Get('contacts/:contactId/history')
  async getContactLocationHistory(
    @Req() req: AuthenticatedRequest,
    @Param('contactId') contactId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit: number = 100,
  ) {
    return this.locationsService.getContactLocationHistory(
      req.user.userId,
      contactId,
      startDate,
      endDate,
      limit,
    );
  }

  @Get('shared')
  async getSharedLocations(@Req() req: AuthenticatedRequest) {
    return this.locationsService.getSharedLocations(req.user.userId);
  }

  @Post('shared')
  async shareLocation(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.locationsService.shareLocation(req.user.userId, body.contactId, body.durationHours);
  }

  @Delete('shared/:id')
  async stopSharingLocation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.locationsService.stopSharingLocation(req.user.userId, id);
  }
}
