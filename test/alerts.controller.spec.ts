import { AlertsController } from '../src/alerts/alerts.controller';

describe('AlertsController', () => {
  it('forwards decoded firebase user to acknowledgeAlert', async () => {
    const alertsService = {
      acknowledgeAlert: jest.fn(),
    };
    const controller = new AlertsController(alertsService as never);
    const request = {
      user: {
        uid: 'firebase-user-1',
        email: 'operator@example.com',
      },
    };

    await controller.acknowledgeAlert('alert-1', request as never);

    expect(alertsService.acknowledgeAlert).toHaveBeenCalledWith(
      'alert-1',
      request.user,
    );
  });

  it('forwards decoded firebase user to resolveAlert', async () => {
    const alertsService = {
      resolveAlert: jest.fn(),
    };
    const controller = new AlertsController(alertsService as never);
    const request = {
      user: {
        uid: 'firebase-user-2',
        email: 'resolver@example.com',
      },
    };

    await controller.resolveAlert('alert-2', request as never);

    expect(alertsService.resolveAlert).toHaveBeenCalledWith(
      'alert-2',
      request.user,
    );
  });
});
