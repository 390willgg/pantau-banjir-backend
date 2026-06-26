import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationSubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional({ nullable: true })
  areaId!: string | null;

  @ApiProperty()
  createdAt!: string;
}
