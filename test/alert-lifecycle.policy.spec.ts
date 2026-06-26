import { AlertLifecyclePolicy } from '../src/domain/alert-lifecycle.policy';
import { AlertStatus } from '../src/common/enums/alert-status.enum';
import { FloodSeverity } from '../src/common/enums/flood-severity.enum';
import { NotificationEvent } from '../src/common/enums/notification-event.enum';

describe('AlertLifecyclePolicy', () => {
  it('creates a new alert when severity first becomes warning', () => {
    expect(AlertLifecyclePolicy.decide(null, FloodSeverity.WARNING)).toEqual({
      nextStatus: AlertStatus.NEW,
      createAlert: true,
      updateAlert: false,
      resolveAlert: false,
      notificationEvent: NotificationEvent.ALERT_CREATED,
    });
  });

  it('does not retrigger notification for duplicate active severity', () => {
    expect(
      AlertLifecyclePolicy.decide(
        {
          severity: FloodSeverity.WARNING,
          status: AlertStatus.ACTIVE,
        },
        FloodSeverity.WARNING,
      ),
    ).toEqual({
      nextStatus: AlertStatus.ACTIVE,
      createAlert: false,
      updateAlert: false,
      resolveAlert: false,
    });
  });

  it('resolves an existing alert when severity returns to normal', () => {
    expect(
      AlertLifecyclePolicy.decide(
        {
          severity: FloodSeverity.DANGER,
          status: AlertStatus.ACTIVE,
        },
        FloodSeverity.NORMAL,
      ),
    ).toEqual({
      nextStatus: AlertStatus.RESOLVED,
      createAlert: false,
      updateAlert: true,
      resolveAlert: true,
      notificationEvent: NotificationEvent.ALERT_RESOLVED,
    });
  });
});
