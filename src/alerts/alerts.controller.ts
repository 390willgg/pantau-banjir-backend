import { Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { AlertsService } from './alerts.service';
import { AlertResponseDto } from './dto/alert-response.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOkResponse({ type: AlertResponseDto, isArray: true })
  listAlerts() {
    return this.alertsService.listActiveAlerts();
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: AlertResponseDto })
  getAlert(@Param('id') id: string) {
    return this.alertsService.getAlertById(id);
  }

  @Patch(':id/acknowledge')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: AlertResponseDto })
  acknowledgeAlert(
    @Param('id') id: string,
    @Request() request: { user?: DecodedIdToken },
  ) {
    return this.alertsService.acknowledgeAlert(id, request.user);
  }

  @Patch(':id/resolve')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: AlertResponseDto })
  resolveAlert(
    @Param('id') id: string,
    @Request() request: { user?: DecodedIdToken },
  ) {
    return this.alertsService.resolveAlert(id, request.user);
  }
}
