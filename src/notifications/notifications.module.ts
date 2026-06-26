import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { isNotificationsQueueEnabled } from '../config/runtime-config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: isNotificationsQueueEnabled()
    ? [
        BullModule.registerQueue({
          name: 'notifications',
        }),
      ]
    : [],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ...(isNotificationsQueueEnabled() ? [NotificationsProcessor] : []),
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
