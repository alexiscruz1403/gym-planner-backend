import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  // We store the token hashed — if the collection is compromised,
  // raw tokens are not exposed
  @Prop({ required: true })
  tokenHash: string;

  // TTL index — MongoDB automatically deletes the document
  // when this date is reached
  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
