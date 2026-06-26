import {
  AlertStatus as PrismaAlertStatus,
  FloodSeverity as PrismaFloodSeverity,
} from '@prisma/client';
import { AlertStatus } from './enums/alert-status.enum';
import { FloodSeverity } from './enums/flood-severity.enum';

export function toPrismaSeverity(severity: FloodSeverity): PrismaFloodSeverity {
  return severity.toUpperCase() as PrismaFloodSeverity;
}

export function fromPrismaSeverity(severity: PrismaFloodSeverity): FloodSeverity {
  return severity.toLowerCase() as FloodSeverity;
}

export function toPrismaAlertStatus(status: AlertStatus): PrismaAlertStatus {
  return status.toUpperCase() as PrismaAlertStatus;
}

export function fromPrismaAlertStatus(status: PrismaAlertStatus): AlertStatus {
  return status.toLowerCase() as AlertStatus;
}

