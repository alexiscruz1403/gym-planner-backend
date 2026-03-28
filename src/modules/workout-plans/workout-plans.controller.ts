import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { WorkoutPlansService } from './workout-plans.service';
import { CreateWorkoutPlanDto } from './dto/create-workout-plan.dto';
import { UpdateWorkoutPlanDto } from './dto/update-workout-plan.dto';
import {
  WorkoutPlanResponseDto,
  WorkoutPlanSummaryDto,
} from './dto/workout-plan-response.dto';
import { CurrentUser, JwtPayload } from '../../common/decorators';

@ApiTags('Workout Plans')
@ApiBearerAuth('access-token')
@Controller('workout-plans')
export class WorkoutPlansController {
  constructor(private readonly workoutPlansService: WorkoutPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List all plans for the authenticated user' })
  @ApiResponse({ status: 200, type: [WorkoutPlanSummaryDto] })
  findAll(@CurrentUser() user: JwtPayload): Promise<WorkoutPlanSummaryDto[]> {
    return this.workoutPlansService.findAll(user.sub);
  }

  // NOTE: /active must be declared before /:id to avoid NestJS treating
  // the literal string "active" as a MongoDB ObjectId parameter
  @Get('active')
  @ApiOperation({ summary: "Get the authenticated user's active plan" })
  @ApiResponse({ status: 200, type: WorkoutPlanResponseDto })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  findActive(@CurrentUser() user: JwtPayload): Promise<WorkoutPlanResponseDto> {
    return this.workoutPlansService.findActive(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a plan by ID' })
  @ApiResponse({ status: 200, type: WorkoutPlanResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Plan does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkoutPlanResponseDto> {
    return this.workoutPlansService.findById(id, user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workout plan' })
  @ApiResponse({ status: 201, type: WorkoutPlanResponseDto })
  @ApiResponse({
    status: 422,
    description: 'Maximum of 3 workout plans allowed per user',
  })
  create(
    @Body() dto: CreateWorkoutPlanDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkoutPlanResponseDto> {
    return this.workoutPlansService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workout plan' })
  @ApiResponse({ status: 200, type: WorkoutPlanResponseDto })
  @ApiResponse({
    status: 403,
    description: 'Plan does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutPlanDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkoutPlanResponseDto> {
    return this.workoutPlansService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workout plan' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Plan does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    return this.workoutPlansService.delete(id, user.sub);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Activate a plan — deactivates any currently active plan',
  })
  @ApiResponse({ status: 200, description: 'Plan activated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Plan does not belong to the authenticated user',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  activate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; activePlanId: string }> {
    return this.workoutPlansService.activate(id, user.sub);
  }
}
