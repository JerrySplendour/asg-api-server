import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { EmergencyAlert } from './entities/emergency-alert.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { User } from '../common/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { VisibilitySettings } from '../visibility/entities/visibility-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmergencyAlert, Contact, User, VisibilitySettings]),
    NotificationsModule,
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
