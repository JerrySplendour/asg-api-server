import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { Contact } from './entities/contact.entity';
import { EmergencyContact } from './entities/emergency-contact.entity';
import { ContactRequest } from './entities/contact-request.entity';
import { User } from '../common/entities/user.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserCategory } from '../categories/entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, EmergencyContact, ContactRequest, User, UserCategory]),
    GatewayModule,
    NotificationsModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
