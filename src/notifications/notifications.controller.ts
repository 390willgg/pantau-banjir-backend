import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { NotificationSubscriptionResponseDto } from './dto/notification-subscription-response.dto';
import { UpsertNotificationSubscriptionDto } from './dto/upsert-notification-subscription.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscriptions')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: NotificationSubscriptionResponseDto })
  upsertSubscription(
    @Body() dto: UpsertNotificationSubscriptionDto,
    @Request() request: { user?: DecodedIdToken },
  ) {
    return this.notificationsService.upsertSubscription({
      userId: request.user?.uid ?? 'local-development-user',
      fcmToken: dto.fcmToken,
      areaId: dto.areaId,
    });
  }
}
