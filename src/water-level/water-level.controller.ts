import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { WaterLevelOverviewResponseDto } from './dto/water-level-overview-response.dto';
import { WaterLevelService } from './water-level.service';

@ApiTags('water-level')
@Controller('water-level')
export class WaterLevelController {
  constructor(private readonly waterLevelService: WaterLevelService) {}

  @Get('overview')
  @ApiOkResponse({ type: WaterLevelOverviewResponseDto })
  getOverview() {
    return this.waterLevelService.getOverview();
  }
}
