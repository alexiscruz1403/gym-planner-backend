import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkoutSessionsService } from './workout-sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { LogSetDto } from './dto/log-set.dto';
import { ModifyExerciseDto } from './dto/modify-exercise.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
import { CurrentUser, type JwtPayload } from '../../common/decorators';

@ApiTags('Workout Sessions')
@ApiBearerAuth('access-token')
@Controller('sessions')
export class WorkoutSessionsController {
  constructor(
    private readonly workoutSessionsService: WorkoutSessionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Start a new workout session from the active plan for the given day',
  })
  @ApiResponse({ status: 201, description: 'Session started successfully' })
  @ApiResponse({
    status: 422,
    description: 'No active plan or no exercises for this day',
  })
  startSession(@Body() dto: StartSessionDto, @CurrentUser() user: JwtPayload) {
    return this.workoutSessionsService.startSession(user.sub, dto);
  }

  // NOTE: /active must be declared before /:id to prevent NestJS from
  // treating the literal string "active" as a MongoDB ObjectId parameter
  @Get('active')
  @ApiOperation({ summary: 'Get the current in_progress session' })
  @ApiResponse({ status: 200, description: 'Active session returned' })
  @ApiResponse({ status: 404, description: 'No active session found' })
  getActiveSession(@CurrentUser() user: JwtPayload) {
    return this.workoutSessionsService.getActiveSession(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiResponse({ status: 200, description: 'Session returned' })
  @ApiResponse({
    status: 403,
    description: 'Session does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getSessionById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.workoutSessionsService.getSessionById(id, user.sub);
  }

  @Post(':id/sets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log a set for an exercise in the session' })
  @ApiResponse({ status: 200, description: 'Set logged successfully' })
  @ApiResponse({
    status: 403,
    description: 'Session does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({
    status: 422,
    description: 'Session not in progress or exercise not found',
  })
  logSet(
    @Param('id') id: string,
    @Body() dto: LogSetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workoutSessionsService.logSet(id, user.sub, dto);
  }

  @Patch(':id/exercises/:exerciseId')
  @ApiOperation({
    summary:
      'Modify exercise config within the session (does not affect the plan)',
  })
  @ApiResponse({ status: 200, description: 'Exercise modified successfully' })
  @ApiResponse({
    status: 403,
    description: 'Session does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({
    status: 422,
    description: 'Session not in progress or exercise not found',
  })
  modifyExercise(
    @Param('id') id: string,
    @Param('exerciseId') exerciseId: string,
    @Body() dto: ModifyExerciseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workoutSessionsService.modifyExercise(
      id,
      exerciseId,
      user.sub,
      dto,
    );
  }

  @Patch(':id/finish')
  @ApiOperation({ summary: 'Finish the session as completed or partial' })
  @ApiResponse({ status: 200, description: 'Session finished successfully' })
  @ApiResponse({
    status: 403,
    description: 'Session does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({
    status: 422,
    description: 'Session not in progress or invalid status',
  })
  finishSession(
    @Param('id') id: string,
    @Body() dto: FinishSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workoutSessionsService.finishSession(id, user.sub, dto);
  }
}
