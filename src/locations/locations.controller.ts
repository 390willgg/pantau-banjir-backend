import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { LocationsService } from './locations.service';
import { LocationStatusDto } from './dto/location-status.dto';
import { InstallLocationDto } from './dto/install-location.dto';
import { CreateLocationDto } from './dto/create-location.dto';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: LocationStatusDto, isArray: true })
  listLocations() {
    return this.locationsService.listLocations();
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreateLocationDto })
  @ApiCreatedResponse({ type: LocationStatusDto })
  createLocation(@Body() dto: CreateLocationDto) {
    return this.locationsService.createLocation(dto);
  }

  @Get(':id/status')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: LocationStatusDto })
  getLocationStatus(@Param('id') id: string) {
    return this.locationsService.getLocationStatus(id);
  }

  @Patch(':id/install')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiBody({ type: InstallLocationDto })
  @ApiOkResponse({ type: LocationStatusDto })
  installLocation(
    @Param('id') id: string,
    @Body() dto: InstallLocationDto,
  ) {
    return this.locationsService.installLocation(id, dto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ schema: { example: { id: 'FW-0001', deleted: true } } })
  deleteLocation(@Param('id') id: string) {
    return this.locationsService.deleteLocation(id);
  }
}
