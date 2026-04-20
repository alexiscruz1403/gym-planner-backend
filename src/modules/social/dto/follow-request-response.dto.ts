import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowRequestResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  avatar?: string;

  @ApiProperty()
  createdAt: Date;
}

export class FollowRequestListResponseDto {
  @ApiProperty({ type: [FollowRequestResponseDto] })
  data: FollowRequestResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
