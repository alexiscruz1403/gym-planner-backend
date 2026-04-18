import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.extractTokenFromHeader(client);

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
      client.data.userId = payload.sub;
      await client.join(this.roomFor(payload.sub));
    } catch (err) {
      this.logger.warn(
        `Rejected socket ${client.id}: ${(err as Error).message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // Socket.IO auto-leaves rooms on disconnect.
  }

  emitToUser(userId: string, notification: NotificationResponseDto): void {
    this.server.to(this.roomFor(userId)).emit('notification', notification);
  }

  private roomFor(userId: string): string {
    return `user:${userId}`;
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const auth = client.handshake.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return undefined;
    return auth.slice('Bearer '.length);
  }
}
