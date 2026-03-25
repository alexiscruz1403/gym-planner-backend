import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UploadService } from './upload.service';
import { User, UserSchema } from '../../schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import {
  CLOUDINARY,
  getCloudinaryConfig,
} from '../../config/cloudinary.config';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // Register User model so UsersService can inject it
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Import AuthModule to access AuthService.toResponseDto()
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UploadService,
    {
      provide: CLOUDINARY,
      inject: [ConfigService],
      useFactory: getCloudinaryConfig,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
