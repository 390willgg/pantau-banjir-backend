import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { NotificationEvent } from '../common/enums/notification-event.enum';
import { isNotificationsQueueEnabled } from '../config/runtime-config';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertNotificationJob {
  event: NotificationEvent;
  alertId: string;
  title: string;
  message: string;
  areaId: string;
}

export interface UpsertNotificationSubscriptionInput {
  userId: string;
  fcmToken: string;
  areaId?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly queueEnabled = isNotificationsQueueEnabled();
  private hasLoggedFirebaseSkip = false;

  constructor(
    @Optional()
    @InjectQueue('notifications')
    private readonly notificationsQueue?: Queue<AlertNotificationJob>,
    private readonly prisma?: PrismaService,
    private readonly firebaseAdminService?: FirebaseAdminService,
  ) {}

  async upsertSubscription(input: UpsertNotificationSubscriptionInput) {
    if (!this.prisma) {
      throw new Error('Prisma service is not available.');
    }

    const subscription = await this.prisma.notificationSubscription.upsert({
      where: { fcmToken: input.fcmToken },
      update: {
        userId: input.userId,
        areaId: input.areaId?.trim() || null,
      },
      create: {
        userId: input.userId,
        fcmToken: input.fcmToken,
        areaId: input.areaId?.trim() || null,
      },
    });

    return {
      id: subscription.id,
      userId: subscription.userId,
      areaId: subscription.areaId,
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  async queueAlertNotification(job: AlertNotificationJob) {
    if (!this.queueEnabled || !this.notificationsQueue) {
      await this.sendAlertNotification(job);
      return;
    }

    await this.notificationsQueue.add(job.event, job, {
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  async sendAlertNotification(job: AlertNotificationJob) {
    if (!this.prisma || !this.firebaseAdminService?.isEnabled()) {
      this.logFirebaseSkipOnce();
      return;
    }

    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where: {
        OR: [{ areaId: null }, { areaId: job.areaId }],
      },
      select: {
        fcmToken: true,
      },
    });

    const tokens = [...new Set(subscriptions.map((item) => item.fcmToken))];
    if (tokens.length === 0) {
      this.logger.debug(`No notification subscriptions for area ${job.areaId}.`);
      return;
    }

    const response = await this.firebaseAdminService.sendMulticastMessage({
      tokens,
      notification: {
        title: job.title,
        body: job.message,
      },
      data: {
        event: job.event,
        alertId: job.alertId,
        areaId: job.areaId,
      },
      webpush: {
        fcmOptions: {
          link: '/',
        },
      },
    });

    this.logger.log(
      `Notification sent for alert ${job.alertId}: ${response.successCount}/${tokens.length} delivered.`,
    );

    const invalidTokens = response.responses
      .map((item, index) => ({
        token: tokens[index],
        code: item.error?.code,
      }))
      .filter((item) =>
        [
          'messaging/invalid-registration-token',
          'messaging/registration-token-not-registered',
        ].includes(item.code ?? ''),
      )
      .map((item) => item.token);

    if (invalidTokens.length > 0) {
      await this.prisma.notificationSubscription.deleteMany({
        where: {
          fcmToken: {
            in: invalidTokens,
          },
        },
      });
    }
  }

  private logFirebaseSkipOnce() {
    if (this.hasLoggedFirebaseSkip) {
      return;
    }

    this.logger.warn(
      'Firebase Admin or Prisma is not configured. Alert push notifications will be skipped in this environment.',
    );
    this.hasLoggedFirebaseSkip = true;
  }
}
