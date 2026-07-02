import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { HistoryService } from "./history.service";
import { HistoryEntryResponseDto } from "./dto/history-entry-response.dto";
import {
  defaultHistoryFeedLimit,
  defaultHistoryWindowDays,
  HistoryQueryDto,
  maxHistoryFeedLimit,
  maxHistoryWindowDays,
} from "./dto/history-query.dto";

@ApiTags("history")
@Controller("history")
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    example: defaultHistoryFeedLimit,
    description: `Maximum number of timeline entries to return. Capped at ${maxHistoryFeedLimit}.`,
  })
  @ApiQuery({
    name: "days",
    required: false,
    type: Number,
    example: defaultHistoryWindowDays,
    description: `Recent day window for timeline source queries. Defaults to ${defaultHistoryWindowDays} and is capped at ${maxHistoryWindowDays}.`,
  })
  @ApiOkResponse({ type: HistoryEntryResponseDto, isArray: true })
  listHistory(@Query() query: HistoryQueryDto) {
    return this.historyService.listHistory(query);
  }
}
