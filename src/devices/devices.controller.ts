import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { ClaimDeviceDto } from "./dto/claim-device.dto";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { DeviceResponseDto } from "./dto/device-response.dto";
import { DevicesService } from "./devices.service";

@ApiTags("devices")
@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreateDeviceDto })
  @ApiCreatedResponse({ type: DeviceResponseDto })
  createDevice(@Body() dto: CreateDeviceDto) {
    return this.devicesService.createDevice(dto);
  }

  @Post("claim")
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ClaimDeviceDto })
  @ApiOkResponse({ type: DeviceResponseDto })
  claimDevice(@Body() dto: ClaimDeviceDto) {
    return this.devicesService.claimDevice(dto);
  }
}
