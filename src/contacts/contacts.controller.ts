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
import { ContactsService } from './contacts.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { TrackingGateway } from '../gateway/tracking.gateway';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email?: string };
}

@Controller('contacts')
@UseGuards(JwtGuard)
export class ContactsController {
  constructor(
    private contactsService: ContactsService,
    private trackingGateway: TrackingGateway,
  ) {}

  @Get()
  async getContacts(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getContacts(req.user.userId);
  }

  @Post('emergency')
  async addEmergencyContact(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.contactsService.addEmergencyContact(req.user.userId, body);
  }

  // Contact Requests
  @Get('requests')
  async getPendingContactRequests(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getPendingContactRequests(req.user.userId);
  }

  @Get(':id')
  async getContactById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.getContactById(req.user.userId, id);
  }

  @Post()
  async addContact(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.contactsService.addContact(req.user.userId, body);
  }

  @Patch(':id')
  async updateContact(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.contactsService.updateContact(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteContact(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.deleteContact(req.user.userId, id);
  }

  // Emergency Contacts
  @Get('emergency')
  async getEmergencyContacts(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getEmergencyContacts(req.user.userId);
  }

  @Patch('emergency/:id')
  async updateEmergencyContact(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
    return this.contactsService.updateEmergencyContact(req.user.userId, id, body);
  }

  @Delete('emergency/:id')
  async deleteEmergencyContact(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.deleteEmergencyContact(req.user.userId, id);
  }

  @Post('requests')
  async sendContactRequest(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const result = await this.contactsService.sendContactRequest(
      req.user.userId,
      body.toUserId,
      body.fromUserName,
      body.category,
      body.message,
    );
    // Real-time notification to the recipient
    this.trackingGateway.notifyContactRequest(
      body.toUserId,
      body.fromUserName,
      result.id,
      body.category,
    );
    return result;
  }

  @Post('requests/:id/accept')
  async acceptContactRequest(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.acceptContactRequest(req.user.userId, id);
  }

  @Post('requests/:id/reject')
  async rejectContactRequest(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.rejectContactRequest(req.user.userId, id);
  }

  // Device Contact Sync
  @Post('device/sync')
  async syncDeviceContacts(@Req() req: AuthenticatedRequest, @Body() body: { contacts: any[] }) {
    return this.contactsService.syncDeviceContacts(req.user.userId, body.contacts);
  }

  /**
   * POST /contacts/platform/lookup
   * Body: { phoneNumbers: string[] }
   * Returns which phone numbers belong to registered ASG users.
   * Used by the app to know who you can send a contact request to.
   */
  @Post('platform/lookup')
  async lookupPlatformUsers(@Body() body: { phoneNumbers: string[] }) {
    return this.contactsService.findUsersByPhone(body.phoneNumbers || []);
  }
}
