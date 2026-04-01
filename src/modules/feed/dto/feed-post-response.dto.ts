import { ApiProperty } from '@nestjs/swagger';

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

export class CommentResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  text: string;

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
