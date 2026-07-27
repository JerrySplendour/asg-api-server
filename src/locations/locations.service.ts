import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Location, UpdateLocationDto } from './entities/location.entity';
import { SharedLocation } from './entities/shared-location.entity';
import { Contact } from '../contacts/entities/contact.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(SharedLocation)
    private sharedLocationRepository: Repository<SharedLocation>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  async getCurrentLocation(userId: string): Promise<Location | null> {
    return this.locationRepository.findOne({
      where: { userId },
      order: { timestamp: 'DESC' },
    });
  }

  async updateCurrentLocation(userId: string, locationData: UpdateLocationDto): Promise<Location> {
    const location = this.locationRepository.create({ userId, ...locationData });
    return this.locationRepository.save(location);
  }

  async getLocationHistory(
    userId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 100,
  ): Promise<Location[]> {
    let query = this.locationRepository
      .createQueryBuilder('location')
      .where('location.userId = :userId', { userId })
      .orderBy('location.timestamp', 'DESC')
      .limit(limit);

    if (startDate) {
      query = query.andWhere('location.timestamp >= :startTime', {
        startTime: new Date(startDate).getTime(),
      });
    }
    if (endDate) {
      query = query.andWhere('location.timestamp <= :endTime', {
        endTime: new Date(endDate).getTime(),
      });
    }

    return query.getMany();
  }

  async clearLocationHistory(userId: string): Promise<void> {
    await this.locationRepository.delete({ userId });
  }

  async getTopPlaces(userId: string): Promise<any[]> {
    const locations = await this.locationRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: 200,
    });

    const places = new Map<string, any>();
    locations.forEach((loc) => {
      const key = `${Math.round(loc.latitude * 1000) / 1000},${Math.round(loc.longitude * 1000) / 1000}`;
      if (places.has(key)) {
        places.get(key).count++;
      } else {
        places.set(key, {
          latitude: loc.latitude,
          longitude: loc.longitude,
          count: 1,
          lastVisited: loc.timestamp,
        });
      }
    });

    return Array.from(places.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async updateTopPlace(userId: string, id: string, name?: string): Promise<any> {
    return { id, name };
  }

  async getLocationHistorySummary(userId: string, date: string): Promise<any> {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const locations = await this.locationRepository.find({
      where: { userId, timestamp: MoreThan(startOfDay) },
      order: { timestamp: 'ASC' },
    });

    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      totalDistance += this.calculateDistance(
        locations[i - 1].latitude,
        locations[i - 1].longitude,
        locations[i].latitude,
        locations[i].longitude,
      );
    }

    const totalDuration =
      locations.length > 1
        ? locations[locations.length - 1].timestamp - locations[0].timestamp
        : 0;

    return {
      id: `${userId}-${date}`,
      userId,
      date,
      totalDistance,
      totalDuration,
      tripCount: 0,
      averageSpeed: totalDuration > 0 ? totalDistance / (totalDuration / 3600000) : 0,
    };
  }

  /**
   * Returns the current location of each contact who:
   * 1. belongs to the requesting user
   * 2. has a linkedUserId (is registered on the platform)
   */
  async getContactsLocations(userId: string): Promise<any[]> {
    const contacts = await this.contactRepository.find({
      where: { userId, isTracked: true },
    });

    const results: any[] = [];

    for (const contact of contacts) {
      if (!contact.linkedUserId) continue;

      const latestLocation = await this.locationRepository.findOne({
        where: { userId: contact.linkedUserId },
        order: { timestamp: 'DESC' },
      });

      results.push({
        contactId: contact.id,
        linkedUserId: contact.linkedUserId,
        name: contact.name,
        category: contact.category,
        requestStatus: contact.requestStatus,
        location: latestLocation
          ? {
              latitude: latestLocation.latitude,
              longitude: latestLocation.longitude,
              accuracy: latestLocation.accuracy,
              speed: latestLocation.speed,
              heading: latestLocation.heading,
              timestamp: latestLocation.timestamp,
            }
          : null,
      });
    }

    return results;
  }

  /**
   * Get location history for a specific contact (by their linkedUserId).
   */
  async getContactLocationHistory(
    userId: string,
    contactId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 100,
  ): Promise<Location[]> {
    const contact = await this.contactRepository.findOne({ where: { id: contactId, userId } });
    if (!contact?.linkedUserId) return [];

    return this.getLocationHistory(contact.linkedUserId, startDate, endDate, limit);
  }

  // Shared Locations
  async getSharedLocations(userId: string): Promise<SharedLocation[]> {
    return this.sharedLocationRepository.find({
      where: { ownerId: userId, isActive: true },
    });
  }

  async shareLocation(ownerId: string, contactId: string, durationHours?: number): Promise<SharedLocation> {
    const now = Date.now();
    const expiresAt = now + (durationHours || 24) * 60 * 60 * 1000;

    const share = this.sharedLocationRepository.create({
      ownerId,
      contactId,
      startTime: now,
      expiresAt,
      isActive: true,
      permissions: { canSeeLocation: true, canSeeTrips: true, canSeeBattery: false },
    });
    return this.sharedLocationRepository.save(share);
  }

  async stopSharingLocation(userId: string, shareId: string): Promise<void> {
    await this.sharedLocationRepository.update(
      { id: shareId, ownerId: userId },
      { isActive: false, endTime: Date.now() },
    );
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
