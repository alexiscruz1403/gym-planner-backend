import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Optional — absent for OAuth users who never set a password
  @Prop({ required: false, select: false })
  passwordHash?: string;

  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: false })
  avatar?: string;

  // Optional — present only for Google OAuth users
  // sparse: true allows multiple documents without this field
  // while still enforcing uniqueness when the field is present
  @Prop({ required: false, index: { sparse: true, unique: true } })
  googleId?: string;

  @Prop({
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  })
  role: 'user' | 'admin';

  // Soft disable — deactivated users cannot log in.
  // Never hard-deleted to preserve referential integrity with sessions and posts.
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: 0 })
  followersCount: number;

  @Prop({ default: 0 })
  followingCount: number;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
