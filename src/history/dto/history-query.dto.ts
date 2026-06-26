import { IsOptional, IsString } from "class-validator";

export const defaultHistoryFeedLimit = 100;
export const maxHistoryFeedLimit = 200;
export const defaultHistoryWindowDays = 30;
export const maxHistoryWindowDays = 365;

export class HistoryQueryDto {
  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  days?: string;
}
