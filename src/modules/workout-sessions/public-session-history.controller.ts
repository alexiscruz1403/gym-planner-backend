import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { WorkoutSessionsService } from './workout-sessions.service';
import { PublicSessionHistoryQueryDto } from './dto/public-session-history-query.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class PublicSessionHistoryController {
  constructor(
    private readonly workoutSessionsService: WorkoutSessionsService,
  ) {}

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Get public session history for a user' })
  @ApiParam({ name: 'id', description: 'Target user MongoDB ObjectId' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of completed and partial sessions',
  })
  @ApiResponse({ status: 400, description: 'Invalid ObjectId format' })
  getPublicSessionHistory(
    @Param('id') userId: string,
    @Query() query: PublicSessionHistoryQueryDto,
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    return this.workoutSessionsService.getPublicSessionHistory(userId, query);
  }
}
