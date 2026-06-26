import { Logger } from '@nestjs/common';
import { NotificationEvent } from '../src/common/enums/notification-event.enum';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('NotificationsService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips queueing when notifications queue is disabled', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    delete process.env.ENABLE_NOTIFICATIONS_QUEUE;

    const service = new NotificationsService();

    await service.queueAlertNotification({
      event: NotificationEvent.ALERT_CREATED,
      alertId: 'alert-1',
      title: 'Danger',
      message: 'Water level is dangerous.',
      areaId: 'jakarta-utara',
    });
    await service.queueAlertNotification({
      event: NotificationEvent.ALERT_CREATED,
      alertId: 'alert-2',
      title: 'Danger',
      message: 'Water level is dangerous.',
      areaId: 'jakarta-utara',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('queues notifications when queue integration is enabled', async () => {
    process.env.ENABLE_NOTIFICATIONS_QUEUE = 'true';
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add };

    const service = new NotificationsService(queue as never);

    await service.queueAlertNotification({
      event: NotificationEvent.ALERT_RESOLVED,
      alertId: 'alert-1',
      title: 'Resolved',
      message: 'Water level returned to normal.',
      areaId: 'jakarta-utara',
    });

    expect(add).toHaveBeenCalledWith(
      NotificationEvent.ALERT_RESOLVED,
      expect.objectContaining({
        alertId: 'alert-1',
      }),
      {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
  });
});
