import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { FirebaseAuthGuard } from "../auth/firebase-auth.guard";
import { ChartService } from "./chart.service";
import {
  ChartQueryDto,
  chartSeriesRanges,
  defaultChartSeriesLimit,
  maxChartSeriesLimit,
} from "./dto/chart-query.dto";
import { ChartSensorSeriesDto } from "./dto/chart-sensor-series.dto";

@ApiTags("chart")
@Controller("chart")
export class ChartController {
  constructor(private readonly chartService: ChartService) {}

  @Get("archive-months")
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({
    description: "Daftar bulan arsip yang memiliki data sensor.",
  })
  getArchiveMonths() {
    return this.chartService.getArchiveMonths();
  }

  @Get("sensor-series")
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    example: defaultChartSeriesLimit,
    description: `Jumlah maksimal reading terbaru per sensor. Default ${defaultChartSeriesLimit}, maksimum ${maxChartSeriesLimit}.`,
  })
  @ApiQuery({
    name: "range",
    required: false,
    enum: chartSeriesRanges,
    description:
      "Rentang waktu data sensor. Default day, opsi: day, week, month, archive.",
  })
  @ApiQuery({
    name: "from",
    required: false,
    type: String,
    description: "Awal arsip/rentang custom dalam format ISO date.",
  })
  @ApiQuery({
    name: "to",
    required: false,
    type: String,
    description: "Akhir arsip/rentang custom dalam format ISO date.",
  })
  @ApiQuery({
    name: "bucket",
    required: false,
    type: String,
    description: "Resolusi data: raw, hour, atau day.",
  })
  @ApiOkResponse({ type: [ChartSensorSeriesDto] })
  getSensorSeries(@Query() query: ChartQueryDto) {
    return this.chartService.getSensorSeries(query);
  }
}
