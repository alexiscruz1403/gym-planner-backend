import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { MembershipStatus, MembershipTier } from '../../common/enums';
import { AiProgressionService } from './ai-progression.service';

@Injectable()
export class AiCronService {
  private readonly logger = new Logger(AiCronService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly progressionService: AiProgressionService,
  ) {}

  // Runs every Monday at 03:00 UTC
  @Cron('0 3 * * 1', { timeZone: 'UTC' })
  async handleWeeklyProgression(): Promise<void> {
    this.logger.log('Starting weekly progression analysis');

    const premiumUsers = await this.userModel
      .find({
        membershipTier: MembershipTier.PREMIUM,
        membershipStatus: MembershipStatus.ACTIVE,
        isActive: true,
      })
      .select('_id')
      .lean()
      .exec();

    this.logger.log(`Processing ${premiumUsers.length} premium users`);

    for (const user of premiumUsers) {
      try {
        await this.progressionService.analyzeAndApplyForCron(
          user._id.toString(),
        );
      } catch (err) {
        this.logger.error(
          `Progression analysis failed for user ${user._id.toString()}`,
          err,
        );
      }
    }

    this.logger.log('Weekly progression analysis complete');
  }
}
