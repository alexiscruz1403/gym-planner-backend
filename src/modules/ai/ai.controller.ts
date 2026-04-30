import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { Premium } from '../../common/decorators/premium.decorator';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { AiService } from './ai.service';
import { AiProgressionService } from './ai-progression.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { ConfirmProgressionDto } from './dto/confirm-progression.dto';
import { ProgressionAnalysisResponseDto } from './dto/progression-analysis-response.dto';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(PremiumGuard)
@Premium()
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly progressionService: AiProgressionService,
  ) {}

  @Post('plans/generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate an AI workout plan (Premium)',
    description:
      'Generates a personalized workout plan using Google Gemini based on the user fitness profile. Premium users can have up to 3 AI-generated plans.',
  })
  @ApiResponse({ status: 201, description: 'Plan generated successfully' })
  @ApiResponse({
    status: 422,
    description: 'AI plan limit reached (max 3) or no matching exercises found',
  })
  @ApiResponse({
    status: 503,
    description: 'Gemini API unavailable or could not generate a valid plan',
  })
  async generatePlan(
    @Body() dto: GeneratePlanDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aiService.generatePlan(dto, user.sub);
  }

  @Post('progression/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze progression for the active plan (Premium)',
    description:
      'Evaluates session history using Double Progression rules and returns proposed changes. Does NOT modify the plan. Call /confirm to apply or reject. Idempotent within the same ISO week.',
  })
  @ApiResponse({ status: 200, type: ProgressionAnalysisResponseDto })
  async analyzeProgression(
    @CurrentUser() user: JwtPayload,
  ): Promise<ProgressionAnalysisResponseDto> {
    return this.aiService.triggerProgressionAnalysis(user.sub);
  }

  @Post('progression/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm or reject a pending progression analysis (Premium)',
    description:
      'Applies (apply: true) or rejects (apply: false) the proposed changes from a previous /analyze call. Throws 409 if the log was already processed.',
  })
  @ApiResponse({ status: 200, type: ProgressionAnalysisResponseDto })
  @ApiResponse({ status: 404, description: 'Progression log not found' })
  @ApiResponse({ status: 409, description: 'Log already applied or rejected' })
  async confirmProgression(
    @Body() dto: ConfirmProgressionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProgressionAnalysisResponseDto> {
    return this.progressionService.confirmProgression(
      dto.logId,
      user.sub,
      dto.apply,
    );
  }

  @Get('progression/current-week')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Get this week's progression analysis for the active plan (Premium)",
    description:
      'Returns the progression log for the current ISO week if one exists, or null if no analysis has been run yet. Allows the UI to restore analysis state after a page reload.',
  })
  @ApiResponse({ status: 200, type: ProgressionAnalysisResponseDto })
  async getCurrentWeekAnalysis(
    @CurrentUser() user: JwtPayload,
  ): Promise<ProgressionAnalysisResponseDto | null> {
    return this.progressionService.getCurrentWeekAnalysis(user.sub);
  }

  @Get('plans/profiles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List AI plan profiles (Premium)',
    description:
      'Returns the fitness profiles used to generate AI plans for the current user.',
  })
  async getProfiles(@CurrentUser() user: JwtPayload) {
    return this.aiService.getProfiles(user.sub);
  }
}
