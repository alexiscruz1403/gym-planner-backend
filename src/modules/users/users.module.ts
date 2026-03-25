import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from '../../schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // Register User model so UsersService can inject it
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // Import AuthModule to access AuthService.toResponseDto()
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
