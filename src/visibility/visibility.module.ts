import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisibilityService } from './visibility.service';
import { VisibilityController } from './visibility.controller';
import { VisibilitySettings } from './entities/visibility-settings.entity';
import { User } from '../common/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VisibilitySettings, User])],
  controllers: [VisibilityController],
  providers: [VisibilityService],
  exports: [VisibilityService],
})
export class VisibilityModule {}
