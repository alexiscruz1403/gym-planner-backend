import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PREMIUM_KEY } from '../decorators/premium.decorator';
import { MembershipTier } from '../enums/membership-tier.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPremiumRoute = this.reflector.getAllAndOverride<boolean>(
      IS_PREMIUM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isPremiumRoute) return true;

    const { user } = context.switchToHttp().getRequest();

    if (
      !user ||
      user.membershipTier !== MembershipTier.PREMIUM ||
      user.membershipStatus !== MembershipStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'This feature requires an active Premium membership.',
      );
    }

    return true;
  }
}
