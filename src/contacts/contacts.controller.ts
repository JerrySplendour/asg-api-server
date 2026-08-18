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
  ) { }

  @Get()
  async getContacts(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getContacts(req.user.userId);
  }

  @Post('emergency')
  async addEmergencyContact(@Req() req: AuthenticatedRequest, @Body() body: any) {
    return this.contactsService.addEmergencyContact(req.user.userId, body);
  }

  @Get('emergency')
  async getEmergencyContacts(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getEmergencyContacts(req.user.userId);
  }

  // ─── Contact Requests ───────────────────────────────────────────────────────

  @Get('requests')
  async getPendingContactRequests(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getPendingContactRequests(req.user.userId);
  }

  @Get('requests/sent')
  async getSentContactRequests(@Req() req: AuthenticatedRequest) {
    return this.contactsService.getSentContactRequests(req.user.userId);
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
  async updateContact(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.contactsService.updateContact(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteContact(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.deleteContact(req.user.userId, id);
  }

  // ─── Emergency Contacts ─────────────────────────────────────────────────────


  @Patch('emergency/:id')
  async updateEmergencyContact(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.contactsService.updateEmergencyContact(req.user.userId, id, body);
  }

  @Delete('emergency/:id')
  async deleteEmergencyContact(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.deleteEmergencyContact(req.user.userId, id);
  }

  @Post('requests')
  async sendContactRequest(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const sender = await this.contactsService.getSenderDetails(req.user.userId);
    const categoryBehaviorType = await this.contactsService.getCategoryBehaviorTypeForRequest(
      req.user.userId,
      body.category,
    );

    const result = await this.contactsService.sendContactRequest(
      req.user.userId,
      body.toUserId,
      sender,
      body.category,
      categoryBehaviorType,
      body.message,
    );

    // Real-time WebSocket notification to the recipient
    this.trackingGateway.notifyContactRequest(
      body.toUserId,
      sender,
      result.id,
      body.category,
      categoryBehaviorType,
    );
    return result;
  }

  /**
   * POST /contacts/requests/:id/accept
   * Body (for STANDARD requests): { recipientCategory: string }
   * Body (for PROFESSIONAL requests): {} — recipientCategory is ignored
   */
  @Post('requests/:id/accept')
  async acceptContactRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { recipientCategory?: string },
  ) {
    return this.contactsService.acceptContactRequest(
      req.user.userId,
      id,
      body.recipientCategory,
    );
  }

  @Post('requests/:id/reject')
  async rejectContactRequest(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.contactsService.rejectContactRequest(req.user.userId, id);
  }

  // ─── Device Contact Sync ────────────────────────────────────────────────────

  @Post('device/sync')
  async syncDeviceContacts(
    @Req() req: AuthenticatedRequest,
    @Body() body: { contacts: any[] },
  ) {
    return this.contactsService.syncDeviceContacts(req.user.userId, body.contacts);
  }

  /**
   * POST /contacts/platform/lookup
   * Body: { phoneNumbers: string[] }
   * Returns which phone numbers belong to registered ASG users.
   */
  @Post('platform/lookup')
  async lookupPlatformUsers(@Body() body: { phoneNumbers: string[] }) {
    return this.contactsService.findUsersByPhone(body.phoneNumbers || []);
  }
}
