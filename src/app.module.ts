import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation';
import { getDatabaseConfig } from './config/database.config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { WorkoutPlansModule } from './modules/workout-plans/workout-plans.module';
import { WorkoutSessionsModule } from './modules/workout-sessions/workout-sessions.module';
import { StatsModule } from './modules/stats/stats.module';
import { SocialModule } from './modules/social/social.module';
import { FeedModule } from './modules/feed/feed.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true, // fail fast on first missing variable
      },
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Global in-memory cache — user-specific endpoints use manual get/set with userId keys
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // default 5 minutes (in seconds)
      max: 500, // max 500 items in LRU cache
    }),

    // Global rate limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
    ]),

    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),

    AuthModule,
    UsersModule,
    ExercisesModule,
    WorkoutPlansModule,
    WorkoutSessionsModule,
    StatsModule,
    SocialModule,
    FeedModule,
    AdminModule,
    NotificationsModule,
  ],
  providers: [
    // Global JWT guard — protects all routes by default.
    // Use @Public() on any route that should be open.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global throttler guard — applies rate limiting to all routes.
    // Auth routes override this with a stricter limit via @Throttle().
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
