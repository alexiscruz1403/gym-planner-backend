import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { ExerciseHistoryQueryDto } from './dto/exercise-history-query.dto';
import { StatsQueryDto } from './dto/stats-query.dto';
import { CurrentUser, type JwtPayload } from '../../common/decorators';

@ApiTags('Stats')
@ApiBearerAuth('access-token')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('exercises/:exerciseId/history')
  @ApiOperation({
    summary:
      'Get paginated history for a specific exercise across all sessions',
  })
  @ApiResponse({ status: 200, description: 'Exercise history returned' })
  @ApiResponse({ status: 400, description: 'Invalid exerciseId format' })
  getExerciseHistory(
    @Param('exerciseId') exerciseId: string,
    @Query() query: ExerciseHistoryQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.statsService.getExerciseHistory(user.sub, exerciseId, query);
  }

  @Get('exercises/:exerciseId/volume')
  @ApiOperation({
    summary:
      'Get volume stats for a specific exercise scoped to a given period',
  })
  @ApiQuery({ name: 'period', enum: ['week', 'month', 'year'] })
  @ApiQuery({
    name: 'date',
    description:
      'Reference date. Format: YYYY-Www (week), YYYY-MM (month), YYYY (year)',
    example: '2026-03',
  })
  @ApiResponse({ status: 200, description: 'Exercise volume stats returned' })
  @ApiResponse({
    status: 400,
    description: 'Invalid exerciseId or date format',
  })
  getExerciseVolume(
    @Param('exerciseId') exerciseId: string,
    @Query() query: StatsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.statsService.getExerciseVolume(user.sub, exerciseId, query);
  }

  @Get('volume')
  @ApiOperation({
    summary:
      'Get total training volume and breakdown for a given period (week, month, year)',
  })
  @ApiQuery({ name: 'period', enum: ['week', 'month', 'year'] })
  @ApiQuery({
    name: 'date',
    description:
      'Reference date. Format: YYYY-Www (week), YYYY-MM (month), YYYY (year)',
    example: '2026-03',
  })
  @ApiResponse({ status: 200, description: 'Volume stats returned' })
  @ApiResponse({ status: 400, description: 'Invalid period or date format' })
  getVolumeByPeriod(
    @Query() query: StatsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.statsService.getVolumeByPeriod(user.sub, query);
  }

  @Get('muscles')
  @ApiOperation({
    summary:
      'Get training volume ranked by primary muscle group for a given period',
  })
  @ApiQuery({ name: 'period', enum: ['week', 'month', 'year'] })
  @ApiQuery({
    name: 'date',
    description:
      'Reference date. Format: YYYY-Www (week), YYYY-MM (month), YYYY (year)',
    example: '2026-03',
  })
  @ApiResponse({ status: 200, description: 'Muscle ranking returned' })
  @ApiResponse({ status: 400, description: 'Invalid period or date format' })
  getVolumeByMuscle(
    @Query() query: StatsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.statsService.getVolumeByMuscle(user.sub, query);
  }
}
