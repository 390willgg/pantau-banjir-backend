import { AlertStatus } from '../common/enums/alert-status.enum';
import { FloodSeverity } from '../common/enums/flood-severity.enum';
import { NotificationEvent } from '../common/enums/notification-event.enum';

export interface ExistingAlertSnapshot {
  severity: FloodSeverity;
  status: AlertStatus;
}

export interface AlertLifecycleDecision {
  nextStatus: AlertStatus | null;
  createAlert: boolean;
  updateAlert: boolean;
  resolveAlert: boolean;
  notificationEvent?: NotificationEvent;
}

export class AlertLifecyclePolicy {
  static decide(
    existingAlert: ExistingAlertSnapshot | null,
    nextSeverity: FloodSeverity,
  ): AlertLifecycleDecision {
    if (nextSeverity === FloodSeverity.NORMAL && !existingAlert) {
      return {
        nextStatus: null,
        createAlert: false,
        updateAlert: false,
        resolveAlert: false,
      };
    }

    if (nextSeverity === FloodSeverity.NORMAL && existingAlert) {
      return {
        nextStatus: AlertStatus.RESOLVED,
        createAlert: false,
        updateAlert: true,
        resolveAlert: true,
        notificationEvent: NotificationEvent.ALERT_RESOLVED,
      };
    }

    if (!existingAlert) {
      return {
        nextStatus: AlertStatus.NEW,
        createAlert: true,
        updateAlert: false,
        resolveAlert: false,
        notificationEvent: NotificationEvent.ALERT_CREATED,
      };
    }

    if (existingAlert.severity === nextSeverity) {
      return {
        nextStatus: AlertStatus.ACTIVE,
        createAlert: false,
        updateAlert: false,
        resolveAlert: false,
      };
    }

    return {
      nextStatus: AlertStatus.ACTIVE,
      createAlert: false,
      updateAlert: true,
      resolveAlert: false,
      notificationEvent: NotificationEvent.ALERT_ESCALATED,
    };
  }
}
