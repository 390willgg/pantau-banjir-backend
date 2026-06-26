import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AlertNotificationJob } from './notifications.service';
import { NotificationsService } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<AlertNotificationJob>) {
    this.logger.log(
      `Processing notification: ${job.data.event} for alert ${job.data.alertId} in area ${job.data.areaId}`,
    );
    await this.notificationsService.sendAlertNotification(job.data);
  }
}
