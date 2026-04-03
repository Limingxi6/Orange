import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class QueryRiskAssessmentDto {
  @ApiProperty({ description: '批次ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId: number;
}

