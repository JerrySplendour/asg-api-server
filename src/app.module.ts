import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { User } from './common/entities/user.entity';
import { Contact } from './contacts/entities/contact.entity';
import { EmergencyContact } from './contacts/entities/emergency-contact.entity';
import { ContactRequest } from './contacts/entities/contact-request.entity';
import { Location } from './locations/entities/location.entity';
import { SharedLocation } from './locations/entities/shared-location.entity';
import { Trip } from './trips/entities/trip.entity';
import { EmergencyAlert } from './emergency/entities/emergency-alert.entity';
import { Geofence } from './geofences/entities/geofence.entity';
import { GeofenceEvent } from './geofences/entities/geofence-event.entity';
import { VisibilitySettings } from './visibility/entities/visibility-settings.entity';

// Modules
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { LocationsModule } from './locations/locations.module';
import { TripsModule } from './trips/trips.module';
import { EmergencyModule } from './emergency/emergency.module';
import { GeofencesModule } from './geofences/geofences.module';
import { VisibilityModule } from './visibility/visibility.module';
import { UserModule } from './user/user.module';
import { GatewayModule } from './gateway/gateway.module';

const allEntities = [
  User,
  Contact,
  EmergencyContact,
  ContactRequest,
  Location,
  SharedLocation,
  Trip,
  EmergencyAlert,
  Geofence,
  GeofenceEvent,
  VisibilitySettings,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DB_TYPE', 'sqlite');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');

        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5432),
            username: configService.get<string>('DB_USERNAME'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_DATABASE'),
            entities: allEntities,
            synchronize: configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true' || nodeEnv === 'development',
            logging: false,
            ssl: nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
          };
        }

        return {
          type: 'sqlite',
          database: configService.get<string>('DB_DATABASE', './asg_app.db'),
          entities: allEntities,
          synchronize: true,
          logging: false,
        };
      },
    }),
    AuthModule,
    ContactsModule,
    LocationsModule,
    TripsModule,
    EmergencyModule,
    GeofencesModule,
    VisibilityModule,
    UserModule,
    GatewayModule,
  ],
})
export class AppModule { }
