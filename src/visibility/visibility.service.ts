import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisibilitySettings, VisibilitySettingsDto } from './entities/visibility-settings.entity';
import { User } from '../common/entities/user.entity';

@Injectable()
export class VisibilityService {
  constructor(
    @InjectRepository(VisibilitySettings)
    private visibilitySettingsRepository: Repository<VisibilitySettings>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getVisibilitySettings(userId: string): Promise<VisibilitySettings[]> {
    let settings = await this.visibilitySettingsRepository.find({
      where: { userId },
    });

    // Initialize if not exists
    if (settings.length === 0) {
      const categories = ['family', 'company', 'missionaries', 'regular', 'untracked'];
      for (const category of categories) {
        const setting = this.visibilitySettingsRepository.create({
          userId,
          category,
          isVisible: category === 'family',
          enableCheckIn: false,
          isPanicCategory: category === 'family',
        });
        await this.visibilitySettingsRepository.save(setting);
      }
      settings = await this.visibilitySettingsRepository.find({ where: { userId } });
    }

    return settings;
  }

  async updateVisibilitySettings(
    userId: string,
    category: string,
    updates: VisibilitySettingsDto,
  ): Promise<VisibilitySettings> {
    let setting = await this.visibilitySettingsRepository.findOne({
      where: { userId, category },
    });

    if (!setting) {
      setting = this.visibilitySettingsRepository.create({
        userId,
        category,
        ...updates,
      });
    } else {
      Object.assign(setting, updates);
    }

    return this.visibilitySettingsRepository.save(setting);
  }

  async getUserSettings(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return {
      trackingEnabled: true,
      backgroundTrackingInterval: 10000,
      foregroundTrackingInterval: 5000,
      batteryOptimizationMode: false,
      locationAccuracy: 'high',
      theme: 'auto',
      notificationsEnabled: true,
    };
  }

  async updateUserSettings(userId: string, settings: any): Promise<any> {
    // Settings would be stored in user preferences
    return settings;
  }

  async getPrivacySettings(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return (
      user?.privacySettings || {
        allowLocationSharing: true,
        emergencyContactsCanSeeLocation: true,
        publicProfile: false,
        dataRetentionDays: 90,
      }
    );
  }

  async updatePrivacySettings(userId: string, settings: any): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.privacySettings = { ...user.privacySettings, ...settings };
      await this.userRepository.save(user);
    }
    return user?.privacySettings;
  }
}
