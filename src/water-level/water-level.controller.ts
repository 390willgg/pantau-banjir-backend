import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { WaterLevelOverviewResponseDto } from './dto/water-level-overview-response.dto';
import { WaterLevelService } from './water-level.service';

@ApiTags('water-level')
@Controller('water-level')
export class WaterLevelController {
  constructor(private readonly waterLevelService: WaterLevelService) {}

  @Get('overview')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: WaterLevelOverviewResponseDto })
  getOverview() {
    return this.waterLevelService.getOverview();
  }
}
