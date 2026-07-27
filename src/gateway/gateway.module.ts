import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingGateway } from './tracking.gateway';
import { Contact } from '../contacts/entities/contact.entity';
import { EmergencyContact } from '../contacts/entities/emergency-contact.entity';
import { Location } from '../locations/entities/location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contact, EmergencyContact, Location])],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class GatewayModule {}
