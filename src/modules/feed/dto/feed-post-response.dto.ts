import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionSummarySetDto {
  @ApiPropertyOptional({ nullable: true })
  reps?: number;

  @ApiPropertyOptional({ nullable: true })
  durationSeconds?: number;

  @ApiPropertyOptional({ nullable: true })
  weightKg?: number;

  @ApiProperty()
  completed: boolean;
}

export class SessionSummaryExerciseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: [SessionSummarySetDto] })
  sets: SessionSummarySetDto[];
}

export class SessionSummaryDto {
  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  totalSets: number;

  @ApiProperty()
  volumeKg: number;

  @ApiProperty({ type: [SessionSummaryExerciseDto] })
  exercises: SessionSummaryExerciseDto[];
}

export class FeedAuthorDto {
  @ApiProperty({ example: '661f1b2c3d4e5f6a7b8c9d0e' })
  _id: string;

  @ApiProperty({ example: 'miusuario' })
  username: string;

  @ApiProperty({ required: false, nullable: true })
  avatar?: string;
}

export class FeedPostResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty({ type: FeedAuthorDto })
  author: FeedAuthorDto;

  @ApiProperty()
  sessionId: string;

  @ApiProperty({ required: false, nullable: true })
  photoUrl?: string;

  @ApiProperty({ required: false, nullable: true })
  caption?: string;

  @ApiPropertyOptional({ type: SessionSummaryDto, nullable: true })
  sessionSummary: SessionSummaryDto | null;

  @ApiProperty({ example: 3 })
  reactionsCount: number;

  @ApiProperty({ example: 7 })
  commentsCount: number;

  @ApiProperty({
    example: false,
    description: 'True if the requesting user has reacted to this post',
  })
  userReacted: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class FeedListResponseDto {
  @ApiProperty({ type: [FeedPostResponseDto] })
  data: FeedPostResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ReplyResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  createdAt: Date;
}

export class CommentResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  text: string;

  @ApiProperty({ type: [ReplyResponseDto] })
  replies: ReplyResponseDto[];

  @ApiProperty()
  createdAt: Date;
}

export class CommentListResponseDto {
  @ApiProperty({ type: [CommentResponseDto] })
  data: CommentResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
