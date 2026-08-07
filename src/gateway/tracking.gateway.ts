import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../contacts/entities/contact.entity';
import { EmergencyContact } from '../contacts/entities/emergency-contact.entity';
import { Location } from '../locations/entities/location.entity';

@WebSocketGateway({
  path: '/api/socket.io/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Maps socketId → userId for reverse lookup
  private socketToUser = new Map<string, string>();

  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(EmergencyContact)
    private emergencyContactRepository: Repository<EmergencyContact>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  handleConnection(client: Socket) {
    console.log(`[WS] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.socketToUser.delete(client.id);
      console.log(`[WS] User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('join-user-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    client.join(`user-${userId}`);
    this.socketToUser.set(client.id, userId);
    console.log(`[WS] User ${userId} joined room user-${userId}`);
    client.emit('joined', { room: `user-${userId}` });
  }

  @SubscribeMessage('join-alert-room')
  handleJoinAlertRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    client.join(`alerts-${userId}`);
    client.emit('joined-alerts', { room: `alerts-${userId}` });
  }

  /**
   * Called when a user sends their location update.
   * Saves it to DB and broadcasts to all contacts who have this user's linkedUserId.
   */
  @SubscribeMessage('location-update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; location: any },
  ) {
    const { userId, location } = data;

    // Persist the location
    const loc = this.locationRepository.create({
      userId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      timestamp: location.timestamp || Date.now(),
    });
    await this.locationRepository.save(loc);

    // Find all contacts who have linkedUserId = userId (i.e., users who have this person as a contact)
    const watchingContacts = await this.contactRepository.find({
      where: { linkedUserId: userId, isTracked: true },
    });

    // Broadcast to each watcher's room
    for (const contact of watchingContacts) {
      this.server.to(`user-${contact.userId}`).emit('contact-location-update', {
        contactId: contact.id,
        linkedUserId: userId,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          timestamp: loc.timestamp,
        },
      });
    }
  }

  @SubscribeMessage('trip-start')
  async handleTripStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; trip: any },
  ) {
    const { userId, trip } = data;
    const watchingContacts = await this.contactRepository.find({
      where: { linkedUserId: userId, isTracked: true },
    });
    for (const contact of watchingContacts) {
      this.server.to(`user-${contact.userId}`).emit('contact-trip-start', {
        contactId: contact.id,
        linkedUserId: userId,
        trip,
      });
    }
  }

  @SubscribeMessage('trip-end')
  async handleTripEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; trip: any },
  ) {
    const { userId, trip } = data;
    const watchingContacts = await this.contactRepository.find({
      where: { linkedUserId: userId, isTracked: true },
    });
    for (const contact of watchingContacts) {
      this.server.to(`user-${contact.userId}`).emit('contact-trip-end', {
        contactId: contact.id,
        linkedUserId: userId,
        trip,
      });
    }
  }

  @SubscribeMessage('emergency-activated')
  async handleEmergencyActivated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; type: string; location: any },
  ) {
    const { userId, type, location } = data;

    // Notify all emergency contacts
    const emergencyContacts = await this.emergencyContactRepository.find({
      where: { userId },
    });

    for (const ec of emergencyContacts) {
      // ec.contactId is the Contact row id; we need the linked user
      const contact = await this.contactRepository.findOne({ where: { id: ec.contactId } });
      if (contact?.linkedUserId) {
        this.server.to(`user-${contact.linkedUserId}`).emit('emergency-alert', {
          fromUserId: userId,
          type,
          location,
          timestamp: Date.now(),
        });
      }
    }

    // Also broadcast to the user's own alert room (for multi-device)
    this.server.to(`alerts-${userId}`).emit('emergency-alert', {
      fromUserId: userId,
      type,
      location,
      timestamp: Date.now(),
    });
  }

  /**
   * Called by the contacts service to notify a user of a new contact request.
   * Exposed as a public method so other services can call it.
   */
  notifyContactRequest(
    toUserId: string,
    fromUserName: string,
    requestId: string,
    category: string,
    categoryBehaviorType: 'STANDARD' | 'PROFESSIONAL' = 'STANDARD',
  ) {
    this.server.to(`user-${toUserId}`).emit('contact-request', {
      requestId,
      fromUserName,
      category,
      categoryBehaviorType,
      timestamp: Date.now(),
    });
  }

  notifyGeofenceEvent(userId: string, event: any) {
    this.server.to(`user-${userId}`).emit('geofence-event', event);
  }
}
