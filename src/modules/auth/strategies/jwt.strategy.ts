import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../schemas/user.schema';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  // ✅ Método ESTÁTICO que NO accede a 'this'
  private static getJwtOptions(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET is not defined in environment variables. ' +
          'Please add JWT_SECRET to your .env file.',
      );
    }

    return {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    };
  }

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    // ✅ PASO 1: super() es la primera línea
    // ✅ Usar el método estático para obtener las opciones
    super(JwtStrategy.getJwtOptions(configService));
  }

  // Called by Passport after the token signature is verified.
  // The return value is attached to request.user — available via @CurrentUser()
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Verify the user still exists in the DB —
    // handles cases where a user was deleted after the token was issued
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated.');
    }

    return { sub: payload.sub, email: payload.email, role: user.role };
  }
}
