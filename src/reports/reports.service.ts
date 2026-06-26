import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportResponseDto } from './dto/report-response.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReportDto): Promise<ReportResponseDto> {
    const report = await this.prisma.report.create({
      data: {
        areaId: dto.areaId,
        reporterName: dto.reporterName,
        message: dto.message,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });

    const auditPayload: Prisma.InputJsonValue = {
      areaId: dto.areaId ?? null,
      reporterName: dto.reporterName ?? null,
      message: dto.message,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    };

    await this.prisma.auditLog.create({
      data: {
        action: 'report.created',
        entityType: 'report',
        entityId: report.id,
        payload: auditPayload,
      },
    });

    return {
      id: report.id,
      areaId: report.areaId ?? undefined,
      message: report.message,
      reporterName: report.reporterName ?? undefined,
      createdAt: report.createdAt.toISOString(),
    };
  }
}

