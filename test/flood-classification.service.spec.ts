import { FloodClassificationService } from '../src/domain/flood-classification.service';
import { FloodSeverity } from '../src/common/enums/flood-severity.enum';

describe('FloodClassificationService', () => {
  const service = new FloodClassificationService();
  const now = new Date('2026-03-13T10:00:00.000Z');

  it('classifies danger when water level reaches danger threshold', () => {
    expect(
      service.classify({
        waterLevelMeters: 0.16,
        measuredAt: new Date('2026-03-13T09:58:00.000Z'),
        warningThreshold: 0.1,
        dangerThreshold: 0.15,
        staleReadingMinutes: 15,
        now,
      }),
    ).toBe(FloodSeverity.DANGER);
  });

  it('classifies warning when above warning threshold but below danger', () => {
    expect(
      service.classify({
        waterLevelMeters: 0.12,
        measuredAt: new Date('2026-03-13T09:59:00.000Z'),
        warningThreshold: 0.1,
        dangerThreshold: 0.15,
        staleReadingMinutes: 15,
        now,
      }),
    ).toBe(FloodSeverity.WARNING);
  });

  it('classifies normal when below warning threshold', () => {
    expect(
      service.classify({
        waterLevelMeters: 0.05,
        measuredAt: new Date('2026-03-13T09:57:00.000Z'),
        warningThreshold: 0.1,
        dangerThreshold: 0.15,
        staleReadingMinutes: 15,
        now,
      }),
    ).toBe(FloodSeverity.NORMAL);
  });

  it('classifies stale when the reading is too old', () => {
    expect(
      service.classify({
        waterLevelMeters: 0.2,
        measuredAt: new Date('2026-03-13T09:30:00.000Z'),
        warningThreshold: 0.1,
        dangerThreshold: 0.15,
        staleReadingMinutes: 15,
        now,
      }),
    ).toBe(FloodSeverity.STALE);
  });
});
