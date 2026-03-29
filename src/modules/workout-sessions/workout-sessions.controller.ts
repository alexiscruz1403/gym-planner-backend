import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkoutSessionsService } from './workout-sessions.service';

@ApiTags('Workout Sessions')
@Controller('sessions')
export class WorkoutSessionsController {
  constructor(
    private readonly workoutSessionsService: WorkoutSessionsService,
  ) {}
}
