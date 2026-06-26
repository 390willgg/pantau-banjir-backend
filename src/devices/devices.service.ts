import { randomBytes } from "crypto";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ClaimDeviceDto } from "./dto/claim-device.dto";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { DeviceResponseDto } from "./dto/device-response.dto";

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createDevice(dto: CreateDeviceDto): Promise<DeviceResponseDto> {
    const id = dto.id?.trim() || `pb-${randomBytes(4).toString("hex")}`;
    const device = await this.prisma.device
      .create({
        data: {
          id,
          label: dto.label?.trim() || null,
          claimCode: this.buildClaimCode(),
          secret: randomBytes(16).toString("hex"),
        },
      })
      .catch((error: unknown) => {
        const errorCode =
          typeof error === "object" && error != null && "code" in error
            ? String((error as { code?: unknown }).code)
            : null;

        if (errorCode === "P2002") {
          throw new ConflictException(`Device ${id} already exists.`);
        }

        throw error;
      });

    return this.toDto(device);
  }

  async claimDevice(dto: ClaimDeviceDto): Promise<DeviceResponseDto> {
    const claimCode = dto.claimCode.trim();
    const locationId = dto.locationId.trim();
    const existingDevice = await this.prisma.device.findUnique({
      where: { claimCode },
      select: { id: true },
    });

    if (!existingDevice) {
      throw new NotFoundException("Device claim code was not found.");
    }

    const existingLocation = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });

    if (!existingLocation) {
      throw new NotFoundException(`Location ${locationId} was not found.`);
    }

    const device = await this.prisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id: locationId },
        data: {
          latitude: dto.latitude,
          longitude: dto.longitude,
          invalidCoordinateCount: 0,
        },
      });

      return tx.device.update({
        where: { id: existingDevice.id },
        data: {
          assignedLocationId: locationId,
          label: dto.label?.trim() || undefined,
        },
      });
    });

    await Promise.all([
      this.redis.delete("locations:list"),
      this.redis.delete("water-level:overview"),
    ]);

    return this.toDto(device);
  }

  async resolveAssignedLocationId(deviceId: string): Promise<string> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { assignedLocationId: true },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} was not found.`);
    }

    if (!device.assignedLocationId) {
      throw new NotFoundException(
        `Device ${deviceId} has not been assigned to a location.`,
      );
    }

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });

    return device.assignedLocationId;
  }

  private buildClaimCode(): string {
    return randomBytes(5).toString("hex").toUpperCase();
  }

  private toDto(device: {
    id: string;
    claimCode: string;
    label: string | null;
    assignedLocationId: string | null;
    lastSeenAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DeviceResponseDto {
    return {
      id: device.id,
      claimCode: device.claimCode,
      label: device.label,
      assignedLocationId: device.assignedLocationId,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }
}
