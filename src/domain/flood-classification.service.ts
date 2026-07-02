import { Injectable } from '@nestjs/common';
import { FloodSeverity } from '../common/enums/flood-severity.enum';

export interface ClassificationInput {
  waterLevelMeters: number;
  measuredAt: Date;
  warningThreshold: number;
  dangerThreshold: number;
  staleReadingMinutes: number;
  now?: Date;
}

@Injectable()
export class FloodClassificationService {
  classify(input: ClassificationInput): FloodSeverity {
    const now = input.now ?? new Date();
    const ageMinutes = (now.getTime() - input.measuredAt.getTime()) / 60000;

    if (ageMinutes >= input.staleReadingMinutes) {
      return FloodSeverity.STALE;
    }

    if (input.waterLevelMeters >= input.dangerThreshold) {
      return FloodSeverity.DANGER;
    }

    if (input.waterLevelMeters >= input.warningThreshold) {
      return FloodSeverity.WARNING;
    }

    return FloodSeverity.NORMAL;
  }
}
