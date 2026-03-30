import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { ExerciseHistoryQueryDto } from './dto/exercise-history-query.dto';
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
}
