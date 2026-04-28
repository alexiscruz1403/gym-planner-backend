import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { ToggleAutoRenewDto } from './dto/toggle-auto-renew.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a MercadoPago Preapproval checkout session',
    description:
      'Returns an init_point URL. Redirect the user to this URL to complete subscription setup on MercadoPago.',
  })
  @ApiResponse({ status: 201, type: CheckoutResponseDto })
  createCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    return this.subscriptionsService.createCheckout(user.sub, dto);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'MercadoPago Preapproval webhook (public)',
    description:
      'Called by MercadoPago when a subscription status changes. Signature is verified via HMAC-SHA256.',
  })
  async webhook(
    @Query('topic') topic: string,
    @Query('id') id: string,
    @Headers('x-signature') rawSignature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    await this.subscriptionsService.handleWebhook(
      topic,
      id,
      rawSignature,
      req.rawBody ?? Buffer.alloc(0),
    );
  }

  @Patch('auto-renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle automatic subscription renewal on or off' })
  @ApiResponse({
    status: 200,
    schema: { example: { autoRenew: false } },
  })
  toggleAutoRenew(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ToggleAutoRenewDto,
  ): Promise<{ autoRenew: boolean }> {
    return this.subscriptionsService.toggleAutoRenew(user.sub, dto);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current user subscription details' })
  @ApiResponse({ status: 200, type: SubscriptionResponseDto })
  getMySubscription(
    @CurrentUser() user: JwtPayload,
  ): Promise<SubscriptionResponseDto | null> {
    return this.subscriptionsService.getMySubscription(user.sub);
  }
}
