import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyAlert } from './entities/emergency-alert.entity';

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(EmergencyAlert)
    private emergencyAlertRepository: Repository<EmergencyAlert>,
  ) {}

  async getEmergencyAlerts(userId: string): Promise<EmergencyAlert[]> {
    return this.emergencyAlertRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }

  async getEmergencyAlertById(userId: string, id: string): Promise<EmergencyAlert | null> {
    return this.emergencyAlertRepository.findOne({
      where: { id, userId },
    });
  }

  async activateEmergency(userId: string, emergencyData: Partial<EmergencyAlert>): Promise<EmergencyAlert> {
    const alert = this.emergencyAlertRepository.create({
      userId,
      ...emergencyData,
      timestamp: Date.now(),
      isActive: true,
      notifiedContacts: [],
    }) as EmergencyAlert;
    return this.emergencyAlertRepository.save(alert);
  }

  async resolveEmergency(userId: string, alertId: string, notes?: string): Promise<EmergencyAlert | null> {
    await this.emergencyAlertRepository.update(
      { id: alertId, userId },
      { isActive: false, resolvedAt: Date.now(), responderNotes: notes },
    );
    return this.getEmergencyAlertById(userId, alertId);
  }

  async getActiveEmergencies(userId: string): Promise<EmergencyAlert[]> {
    return this.emergencyAlertRepository.find({
      where: { userId, isActive: true },
    });
  }
}
