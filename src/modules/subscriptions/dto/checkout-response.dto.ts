import { ApiProperty } from '@nestjs/swagger';

export class CheckoutResponseDto {
  @ApiProperty({
    description:
      'MercadoPago Preapproval init_point URL — redirect the user here to complete subscription',
    example:
      'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=...',
  })
  initPoint: string;

  @ApiProperty({ description: 'MercadoPago Preapproval ID' })
  preapprovalId: string;
}
