import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Follow, FollowSchema } from '../../schemas/follow.schema';
import {
  FollowRequest,
  FollowRequestSchema,
} from '../../schemas/follow-request.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Follow.name, schema: FollowSchema },
      { name: FollowRequest.name, schema: FollowRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
