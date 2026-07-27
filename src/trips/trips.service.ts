import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripDto, TripWaypoint } from './entities/trip.entity';
import { Contact } from '../contacts/entities/contact.entity';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  async getTrips(userId: string, limit: number = 50, offset: number = 0): Promise<Trip[]> {
    return this.tripRepository.find({
      where: { userId },
      order: { startTime: 'DESC' },
      skip: offset,
      take: limit,
    });
  }

  async getTripById(userId: string, id: string): Promise<Trip> {
    const trip = await this.tripRepository.findOne({ where: { id, userId } });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async startTrip(userId: string, tripData: TripDto): Promise<Trip> {
    const trip = this.tripRepository.create({
      userId,
      ...tripData,
      isActive: true,
      waypoints: [tripData.startLocation],
    });
    return this.tripRepository.save(trip);
  }

  async getActiveTrip(userId: string): Promise<Trip | null> {
    return this.tripRepository.findOne({ where: { userId, isActive: true } });
  }

  async updateTripWaypoint(userId: string, location: TripWaypoint): Promise<Trip> {
    const trip = await this.getActiveTrip(userId);
    if (!trip) throw new NotFoundException('No active trip');

    const waypoints = [...trip.waypoints, location];
    trip.waypoints = waypoints;

    if (waypoints.length > 1) {
      const prev = waypoints[waypoints.length - 2];
      trip.distance += this.calculateDistance(prev.latitude, prev.longitude, location.latitude, location.longitude);
      trip.maxSpeed = Math.max(trip.maxSpeed, location.speed || 0);
    }

    return this.tripRepository.save(trip);
  }

  async endTrip(userId: string, endLocation: TripWaypoint): Promise<Trip> {
    const trip = await this.getActiveTrip(userId);
    if (!trip) throw new NotFoundException('No active trip');

    trip.endLocation = endLocation;
    trip.endTime = endLocation.timestamp || Date.now();
    trip.isActive = false;
    trip.duration = trip.endTime - trip.startTime;

    if (trip.duration > 0) {
      trip.averageSpeed = trip.distance / (trip.duration / 3600000);
    }

    return this.tripRepository.save(trip);
  }

  async getTripHistory(
    userId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 50,
  ): Promise<Trip[]> {
    let query = this.tripRepository
      .createQueryBuilder('trip')
      .where('trip.userId = :userId', { userId })
      .andWhere('trip.isActive = false')
      .orderBy('trip.startTime', 'DESC')
      .limit(limit);

    if (startDate) {
      query = query.andWhere('trip.startTime >= :startTime', { startTime: new Date(startDate).getTime() });
    }
    if (endDate) {
      query = query.andWhere('trip.endTime <= :endTime', { endTime: new Date(endDate).getTime() });
    }

    return query.getMany();
  }

  /**
   * Get trip history for a specific contact via their linkedUserId.
   */
  async getContactTripHistory(
    userId: string,
    contactId: string,
    limit: number = 50,
  ): Promise<Trip[]> {
    const contact = await this.contactRepository.findOne({ where: { id: contactId, userId } });
    if (!contact?.linkedUserId) return [];

    return this.tripRepository.find({
      where: { userId: contact.linkedUserId, isActive: false },
      order: { startTime: 'DESC' },
      take: limit,
    });
  }

  async deleteTrip(userId: string, id: string): Promise<void> {
    await this.tripRepository.delete({ id, userId });
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
