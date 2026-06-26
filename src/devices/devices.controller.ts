import { Body, Controller, Post } from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ClaimDeviceDto } from "./dto/claim-device.dto";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { DeviceResponseDto } from "./dto/device-response.dto";
import { DevicesService } from "./devices.service";

@ApiTags("devices")
@Controller("devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @ApiBody({ type: CreateDeviceDto })
  @ApiCreatedResponse({ type: DeviceResponseDto })
  createDevice(@Body() dto: CreateDeviceDto) {
    return this.devicesService.createDevice(dto);
  }

  @Post("claim")
  @ApiBody({ type: ClaimDeviceDto })
  @ApiOkResponse({ type: DeviceResponseDto })
  claimDevice(@Body() dto: ClaimDeviceDto) {
    return this.devicesService.claimDevice(dto);
  }
}
