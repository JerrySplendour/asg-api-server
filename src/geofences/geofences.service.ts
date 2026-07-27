import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence, CreateGeofenceDto } from './entities/geofence.entity';
import { GeofenceEvent } from './entities/geofence-event.entity';



@Injectable()
export class GeofencesService {
  constructor(
    @InjectRepository(Geofence)
    private geofenceRepository: Repository<Geofence>,
    @InjectRepository(GeofenceEvent)
    private geofenceEventRepository: Repository<GeofenceEvent>,
  ) { }

  async getGeofences(userId: string): Promise<Geofence[]> {
    return this.geofenceRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getGeofenceById(userId: string, id: string): Promise<Geofence> {
    const geofence = await this.geofenceRepository.findOne({
      where: { id, userId },
    });
    if (!geofence) throw new NotFoundException('Geofence not found');
    return geofence;
  }

  async createGeofence(
    userId: string,
    geofenceData: CreateGeofenceDto,
  ): Promise<Geofence> {
    const geofence = this.geofenceRepository.create({
      userId,
      ...geofenceData,
    });

    return this.geofenceRepository.save(geofence);
  }

  async updateGeofence(userId: string, id: string, updates: any): Promise<Geofence> {
    await this.geofenceRepository.update({ id, userId }, updates);
    return this.getGeofenceById(userId, id);
  }

  async deleteGeofence(userId: string, id: string): Promise<void> {
    await this.geofenceRepository.delete({ id, userId });
  }

  async getGeofenceEvents(userId: string, geofenceId?: string, limit: number = 100): Promise<GeofenceEvent[]> {
    let query = this.geofenceEventRepository.createQueryBuilder('event')
      .where('event.userId = :userId', { userId })
      .orderBy('event.timestamp', 'DESC')
      .limit(limit);

    if (geofenceId) {
      query = query.andWhere('event.geofenceId = :geofenceId', { geofenceId });
    }

    return query.getMany();
  }

  async clearGeofenceEvents(userId: string, geofenceId?: string): Promise<void> {
    const query = this.geofenceEventRepository.createQueryBuilder()
      .delete()
      .where('userId = :userId', { userId });

    if (geofenceId) {
      query.andWhere('geofenceId = :geofenceId', { geofenceId });
    }

    await query.execute();
  }

  async logGeofenceEvent(userId: string, geofenceId: string, type: string, location: any): Promise<GeofenceEvent> {
    const event = this.geofenceEventRepository.create({
      userId,
      geofenceId,
      type,
      location,
      timestamp: Date.now(),
    });
    return this.geofenceEventRepository.save(event);
  }
}
