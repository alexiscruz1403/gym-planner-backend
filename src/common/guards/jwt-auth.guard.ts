import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route or its controller is marked with @Public()
    // getAllAndOverride checks the handler first, then the class —
    // so a @Public() on the method takes precedence over the class
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Skip JWT validation entirely for public routes
    if (isPublic) {
      return true;
    }

    // Delegate to Passport JWT validation
    return super.canActivate(context);
  }
}
