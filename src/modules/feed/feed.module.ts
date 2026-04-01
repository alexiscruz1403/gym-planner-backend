import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedPost, FeedPostSchema } from '../../schemas/feed-post.schema';
import { Follow, FollowSchema } from '../../schemas/follow.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../../schemas/workout-session.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeedPost.name, schema: FeedPostSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // Import UsersModule to access the exported UploadService + CLOUDINARY token
    UsersModule,
  ],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
