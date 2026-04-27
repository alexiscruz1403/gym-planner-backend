import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RanksService } from './ranks.service';
import { MuscleRankQueryDto } from './dto/muscle-rank-query.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { ExerciseRankResponseDto } from './dto/exercise-rank-response.dto';
import { CurrentUser, type JwtPayload } from '../../common/decorators';

@ApiTags('Ranks')
@ApiBearerAuth('access-token')
@Controller('ranks')
export class RanksController {
  constructor(private readonly ranksService: RanksService) {}

  @Get('muscles')
  @ApiOperation({
    summary: "Get the current user's muscle ranks with exercise rank details",
  })
  @ApiQuery({
    name: 'muscle',
    required: false,
    description:
      'Comma-separated muscle group(s) to filter by (e.g. chest,quads)',
    example: 'chest,quads',
  })
  @ApiResponse({ status: 200, description: 'Muscle ranks returned' })
  getMuscleRanks(
    @Query() query: MuscleRankQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ranksService.getMuscleRanks(user.sub, query.muscle);
  }

  @Get('exercises/:exerciseId')
  @ApiOperation({
    summary: "Get the current user's rank for a specific exercise",
  })
  @ApiResponse({ status: 200, type: ExerciseRankResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid exerciseId format' })
  getExerciseRank(
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ranksService.getExerciseRank(user.sub, exerciseId);
  }

  @Get('leaderboard')
  @ApiOperation({
    summary:
      "Leaderboard comparing the current user's muscle ranks with followed users",
  })
  @ApiQuery({
    name: 'muscle',
    required: false,
    description: 'Filter leaderboard by a single muscle group',
    example: 'chest',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Leaderboard returned' })
  getLeaderboard(
    @Query() query: LeaderboardQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ranksService.getLeaderboard(
      user.sub,
      query.muscle,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }
}
