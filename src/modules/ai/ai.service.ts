import {
  Injectable,
  Inject,
  UnprocessableEntityException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
} from '@google/generative-ai';
import {
  AiPlanProfile,
  AiPlanProfileDocument,
} from '../../schemas/ai-plan-profile.schema';
import {
  WorkoutPlan,
  WorkoutPlanDocument,
} from '../../schemas/workout-plan.schema';
import { Exercise, ExerciseDocument } from '../../schemas/exercise.schema';
import {
  AiEquipment,
  AiFitnessGoal,
  AiPhysicalLimitation,
  LoadType,
  MuscleGroup,
} from '../../common/enums';
import { WorkoutPlansService } from '../workout-plans/workout-plans.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { ProgressionAnalysisResponseDto } from './dto/progression-analysis-response.dto';
import { AiProgressionService } from './ai-progression.service';

// ─── Template mapping ─────────────────────────────────────────────────────────

const TEMPLATE_MAP: Record<string, Record<number, string[]>> = {
  [AiFitnessGoal.MUSCLE_GAIN]: {
    1: ['FullBody'],
    2: ['Upper/Lower'],
    3: ['FullBody F2', 'FullBody F3', 'Push-Pull-Legs'],
    4: ['Upper/Lower'],
    5: ['PPL + Upper/Lower', 'PPL + Arnold Split'],
    6: ['Push-Pull-Legs F2'],
  },
  [AiFitnessGoal.FAT_LOSS]: {
    1: ['FullBody + Cardio'],
    2: ['Upper/Lower + Cardio'],
    3: ['FullBody + Cardio'],
    4: ['Upper/Lower + Cardio'],
    5: ['Push-Pull-Legs + Cardio'],
    6: ['Push-Pull-Legs + Cardio'],
  },
  [AiFitnessGoal.STRENGTH]: {
    1: ['FullBody Strength'],
    2: ['Upper/Lower Strength'],
    3: ['FullBody Strength'],
    4: ['Upper/Lower Strength'],
    5: ['Powerbuilding'],
  },
  [AiFitnessGoal.BODY_RECOMPOSITION]: {
    3: ['FullBody F3'],
  },
  [AiFitnessGoal.GENERAL_HEALTH]: {
    3: ['FullBody F3'],
  },
  [AiFitnessGoal.ENDURANCE]: {
    3: ['1x FullBody + 2x Cardio'],
    4: ['2x FullBody + 2x Cardio'],
  },
  [AiFitnessGoal.MOBILITY]: {
    3: ['FullBody Mobility'],
  },
};

// ─── Equipment → LoadType mapping ────────────────────────────────────────────

const EQUIPMENT_TO_LOAD_TYPES: Record<AiEquipment, LoadType[]> = {
  [AiEquipment.NO_EQUIPMENT]: [LoadType.BODYWEIGHT],
  [AiEquipment.DUMBBELLS]: [LoadType.BODYWEIGHT, LoadType.DUMBBELL],
  [AiEquipment.BANDS]: [LoadType.BODYWEIGHT, LoadType.RESISTANCE_BAND],
  [AiEquipment.BARBELL_PLATES]: [LoadType.BODYWEIGHT, LoadType.BARBELL],
  [AiEquipment.FULL_GYM]: Object.values(LoadType),
};

// ─── Physical limitation → excluded primary muscles ──────────────────────────

const LIMITATION_EXCLUDED_MUSCLES: Record<AiPhysicalLimitation, MuscleGroup[]> =
  {
    [AiPhysicalLimitation.KNEE_INJURY]: [
      MuscleGroup.QUADS,
      MuscleGroup.HAMSTRINGS,
      MuscleGroup.CALVES,
    ],
    [AiPhysicalLimitation.LOWER_BACK_PAIN]: [MuscleGroup.LOWER_BACK],
    [AiPhysicalLimitation.SHOULDER_SENSITIVITY]: [
      MuscleGroup.FRONT_DELTS,
      MuscleGroup.SIDE_DELTS,
      MuscleGroup.REAR_DELTS,
    ],
    [AiPhysicalLimitation.PREVIOUS_SURGERY]: [],
  };

// ─── Gemini response schema for plan generation ───────────────────────────────

const PLAN_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    days: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          dayOfWeek: {
            type: SchemaType.STRING,
            enum: [
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
              'sunday',
            ],
          },
          dayName: { type: SchemaType.STRING },
          exercises: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                exerciseId: { type: SchemaType.STRING },
                sets: { type: SchemaType.INTEGER },
                reps: { type: SchemaType.INTEGER },
                repsMax: { type: SchemaType.INTEGER },
                weight: { type: SchemaType.NUMBER },
                rest: { type: SchemaType.INTEGER },
                notes: { type: SchemaType.STRING },
              },
              required: ['exerciseId', 'sets', 'rest'],
            },
          },
        },
        required: ['dayOfWeek', 'exercises'],
      },
    },
  },
  required: ['name', 'days'],
};

// ─── Gemini exercise catalog item ────────────────────────────────────────────

interface CatalogExercise {
  id: string;
  name: string;
  musclesPrimary: MuscleGroup[];
  loadType: LoadType;
  bilateral: boolean;
  trackingType: 'reps' | 'duration';
}

interface GeminiPlanExercise {
  exerciseId: string;
  sets: number;
  reps?: number;
  repsMax?: number;
  weight?: number;
  rest: number;
  notes?: string;
}

interface GeminiPlanDay {
  dayOfWeek: string;
  dayName?: string;
  exercises: GeminiPlanExercise[];
}

interface GeminiPlanResponse {
  name: string;
  days: GeminiPlanDay[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private _model: GenerativeModel | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(AiPlanProfile.name)
    private readonly aiPlanProfileModel: Model<AiPlanProfileDocument>,
    @InjectModel(WorkoutPlan.name)
    private readonly workoutPlanModel: Model<WorkoutPlanDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    private readonly workoutPlansService: WorkoutPlansService,
    private readonly progressionService: AiProgressionService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ─── Feature A: Plan generation ──────────────────────────────────────────────

  async generatePlan(
    dto: GeneratePlanDto,
    userId: string,
  ): Promise<{
    plan: object;
    profileId: string;
    templateUsed: string;
    message: string;
  }> {
    const template = this.determineTemplate(dto.goal, dto.daysPerWeek);

    const loadTypes = this.buildEquipmentFilter(dto.equipment);
    const excludedMuscles = this.buildLimitationFilter(dto.physicalLimitations);

    const filter: Record<string, unknown> = {
      isActive: true,
      loadType: { $in: loadTypes },
    };
    if (excludedMuscles.length > 0) {
      filter['musclesPrimary'] = { $nin: excludedMuscles };
    }

    const exercises = await this.exerciseModel
      .find(filter)
      .select('_id name musclesPrimary loadType bilateral trackingType')
      .lean()
      .exec();

    if (exercises.length === 0) {
      throw new UnprocessableEntityException(
        'No exercises found matching the specified equipment and limitations',
      );
    }

    const catalog: CatalogExercise[] = exercises.map((e) => ({
      id: (e._id as Types.ObjectId).toString(),
      name: e.name,
      musclesPrimary: e.musclesPrimary,
      loadType: e.loadType,
      bilateral: e.bilateral,
      trackingType: e.trackingType,
    }));

    // Apply exclusions before passing catalog to Gemini
    const excludedSet = new Set(dto.excludedExerciseIds ?? []);
    const filteredCatalog = catalog.filter((e) => !excludedSet.has(e.id));

    // Validate inclusions against filtered catalog
    const filteredIds = new Set(filteredCatalog.map((e) => e.id));
    const validInclusions = (dto.includedExerciseIds ?? []).filter((id) =>
      filteredIds.has(id),
    );

    const validIds = new Set(filteredCatalog.map((e) => e.id));

    const prompt = this.buildGenerationPrompt(
      dto,
      template,
      filteredCatalog,
      validInclusions,
    );
    let geminiResponse: GeminiPlanResponse | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await this.callGemini<GeminiPlanResponse>(
        attempt === 0
          ? prompt
          : prompt +
              `\n\nPrevious attempt used invalid exerciseIds. Use ONLY these IDs: ${JSON.stringify([...validIds])}`,
        PLAN_RESPONSE_SCHEMA,
      );

      const allValid = response.days
        .flatMap((d) => d.exercises)
        .every((e) => validIds.has(e.exerciseId));

      if (allValid && response.days.length === dto.daysPerWeek) {
        geminiResponse = response;
        break;
      }
    }

    if (!geminiResponse) {
      throw new ServiceUnavailableException(
        'AI could not generate a valid plan. Please try again.',
      );
    }

    const bilateralMap = new Map(catalog.map((e) => [e.id, e.bilateral]));
    const createDto = this.mapGeminiResponseToDto(geminiResponse, bilateralMap);
    const planDoc = await this.workoutPlansService.createAiPlan(
      createDto,
      userId,
    );

    const profile = await this.aiPlanProfileModel.create({
      userId: new Types.ObjectId(userId),
      planId: planDoc._id,
      physicalProfile: dto.physicalProfile,
      goal: dto.goal,
      experience: dto.experience,
      daysPerWeek: dto.daysPerWeek,
      minutesPerSession: dto.minutesPerSession,
      equipment: dto.equipment,
      physicalLimitations: dto.physicalLimitations,
      preferences: dto.preferences,
      templateUsed: template,
    });

    return {
      plan: {
        id: planDoc._id.toString(),
        name: planDoc.name,
        isActive: planDoc.isActive,
        isAiGenerated: true,
        days: planDoc.days,
        createdAt: planDoc.createdAt,
        updatedAt: planDoc.updatedAt,
      },
      profileId: profile._id.toString(),
      templateUsed: template,
      message: `Your ${template} plan has been generated successfully`,
    };
  }

  // ─── Feature C: Manual progression trigger ───────────────────────────────────

  async triggerProgressionAnalysis(
    userId: string,
  ): Promise<ProgressionAnalysisResponseDto> {
    return this.progressionService.analyzeOnly(userId);
  }

  // ─── AI Plan Profiles ─────────────────────────────────────────────────────────

  async getProfiles(userId: string): Promise<AiPlanProfileDocument[]> {
    return this.aiPlanProfileModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private determineTemplate(goal: AiFitnessGoal, daysPerWeek: number): string {
    const goalMap = TEMPLATE_MAP[goal];
    if (!goalMap) {
      return 'FullBody';
    }
    const options = goalMap[daysPerWeek];
    if (!options || options.length === 0) {
      // Fall back to closest available days count
      const days = Object.keys(goalMap)
        .map(Number)
        .sort((a, b) => Math.abs(a - daysPerWeek) - Math.abs(b - daysPerWeek));
      return goalMap[days[0]][0];
    }
    return options[0];
  }

  private buildEquipmentFilter(equipment: AiEquipment[]): LoadType[] {
    const loadTypeSet = new Set<LoadType>();
    for (const eq of equipment) {
      const types = EQUIPMENT_TO_LOAD_TYPES[eq] ?? [];
      types.forEach((t) => loadTypeSet.add(t));
    }
    if (loadTypeSet.size === 0) {
      loadTypeSet.add(LoadType.BODYWEIGHT);
    }
    return [...loadTypeSet];
  }

  private buildLimitationFilter(
    limitations: AiPhysicalLimitation[],
  ): MuscleGroup[] {
    const excluded = new Set<MuscleGroup>();
    for (const lim of limitations) {
      const muscles = LIMITATION_EXCLUDED_MUSCLES[lim] ?? [];
      muscles.forEach((m) => excluded.add(m));
    }
    return [...excluded];
  }

  private buildGenerationPrompt(
    dto: GeneratePlanDto,
    template: string,
    catalog: CatalogExercise[],
    includedIds: string[],
  ): string {
    const { physicalProfile: p } = dto;
    const limitationText =
      dto.physicalLimitations.length > 0
        ? dto.physicalLimitations.join(', ')
        : 'none';
    const preferenceText =
      dto.preferences.length > 0 ? dto.preferences.join(', ') : 'none';
    const inclusionLine =
      includedIds.length > 0
        ? `- MUST include these exerciseIds at least once: ${JSON.stringify(includedIds)}`
        : '';

    return `You are an expert personal trainer and exercise programmer.
Generate a safe, evidence-based workout plan using ONLY the exercises from the provided catalog.

Rules:
- Use ONLY the exerciseIds from the catalog below. Do NOT invent or modify IDs.
- Respect physical limitations strictly (do not include exercises for injured areas).
- Include exactly ${dto.daysPerWeek} training days.
- Keep each session under ${dto.minutesPerSession} minutes (~3-4 min per set including rest).
- Follow the assigned training template structure.
- For reps-based exercises: set reps (minimum) and repsMax (reps + 2 to 4).
- Set starting weights appropriate to experience level (0 for beginners on heavy lifts).
${inclusionLine}

User profile:
- Age: ${p.age}, Sex: ${p.sex}, Height: ${p.heightCm}cm, Weight: ${p.currentWeightKg}kg
${p.targetWeightKg ? `- Target weight: ${p.targetWeightKg}kg` : ''}
${p.estimatedBodyFatPercent ? `- Estimated body fat: ${p.estimatedBodyFatPercent}%` : ''}
- Goal: ${dto.goal}
- Experience: ${dto.experience}
- Training: ${dto.daysPerWeek} days/week, ${dto.minutesPerSession} min/session
- Equipment: ${dto.equipment.join(', ')}
- Physical limitations: ${limitationText}
- Preferences: ${preferenceText}
- Template: ${template}

Available exercises (use ONLY these exerciseIds):
${JSON.stringify(catalog, null, 2)}

Generate a complete ${template} plan with ${dto.daysPerWeek} training days.
Name the plan appropriately (e.g. "AI ${template} Plan").`;
  }

  private mapGeminiResponseToDto(
    response: GeminiPlanResponse,
    bilateralMap: Map<string, boolean>,
  ) {
    return {
      name: response.name,
      days: response.days.map((day) => ({
        dayOfWeek: day.dayOfWeek as never,
        dayName: day.dayName,
        exercises: day.exercises.map((ex) => {
          const isBilateral = bilateralMap.get(ex.exerciseId) ?? true;
          const repsMax = ex.repsMax ?? (ex.reps ? ex.reps + 2 : undefined);

          if (!isBilateral) {
            // Unilateral: move reps/weight into left and right; omit top-level fields
            return {
              exerciseId: ex.exerciseId,
              sets: ex.sets,
              rest: ex.rest,
              notes: ex.notes,
              left: { reps: ex.reps ?? 10, weight: ex.weight ?? 0 },
              right: { reps: ex.reps ?? 10, weight: ex.weight ?? 0 },
            };
          }

          return {
            exerciseId: ex.exerciseId,
            sets: ex.sets,
            reps: ex.reps,
            repsMax,
            weight: ex.weight ?? 0,
            rest: ex.rest,
            notes: ex.notes,
          };
        }),
      })),
    };
  }

  private getGeminiModel(): GenerativeModel {
    if (this._model) return this._model;
    const key = this.configService.get<string>('GEMINI_API_KEY');
    if (!key) {
      throw new ServiceUnavailableException('Gemini API key not configured');
    }
    const genAI = new GoogleGenerativeAI(key);
    this._model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    return this._model;
  }

  private async callGemini<T>(
    prompt: string,
    responseSchema?: object,
  ): Promise<T> {
    const model = this.getGeminiModel();
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema as never,
        },
      });
      const text = result.response.text();
      return JSON.parse(text) as T;
    } catch (err) {
      this.logger.error('Gemini API call failed', err);
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable. Please try again later.',
      );
    }
  }
}
