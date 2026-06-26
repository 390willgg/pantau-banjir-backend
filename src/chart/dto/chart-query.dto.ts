import { IsOptional, IsString } from "class-validator";

export const defaultChartSeriesLimit = 24;
export const maxChartSeriesLimit = 720;
export const chartSeriesRanges = ["day", "week", "month", "archive"] as const;
export const chartSeriesBuckets = ["raw", "hour", "day"] as const;

export type ChartSeriesRange = (typeof chartSeriesRanges)[number];
export type ChartSeriesBucket = (typeof chartSeriesBuckets)[number];

export class ChartQueryDto {
  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  range?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  bucket?: string;
}
