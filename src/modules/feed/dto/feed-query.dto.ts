import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum FeedFilter {
  ALL = 'all',
  MINE = 'mine',
}

export class FeedQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter posts: "all" returns own + followed users posts, "mine" returns only own posts',
    enum: FeedFilter,
    default: FeedFilter.ALL,
  })
  @IsOptional()
  @IsEnum(FeedFilter)
  filter?: FeedFilter = FeedFilter.ALL;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of posts per page',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
