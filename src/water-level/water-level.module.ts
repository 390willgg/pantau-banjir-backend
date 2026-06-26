import { Module } from '@nestjs/common';
import { WaterLevelController } from './water-level.controller';
import { WaterLevelService } from './water-level.service';

@Module({
  controllers: [WaterLevelController],
  providers: [WaterLevelService],
})
export class WaterLevelModule {}
