import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { FcmService } from './fcm.service';
import { CheckInSchedulerService } from './check-in-scheduler.service';
import { CheckInController } from './check-in.controller';
import { UserCheckIn } from './entities/user-check-in.entity';
import { User } from '../common/entities/user.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { EmergencyAlert } from '../emergency/entities/emergency-alert.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([UserCheckIn, User, Contact, EmergencyAlert]),
  ],
  controllers: [CheckInController],
  providers: [FcmService, CheckInSchedulerService],
  exports: [FcmService, CheckInSchedulerService],
})
export class NotificationsModule {}
