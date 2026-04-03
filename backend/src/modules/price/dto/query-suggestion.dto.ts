import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QuerySuggestionDto {
  @ApiPropertyOptional({ description: '批次ID（可选）', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ description: '等级', example: 'A' })
  @IsOptional()
  @IsString()
  @IsIn(['A', 'B', 'C'])
  grade?: 'A' | 'B' | 'C';

  @ApiPropertyOptional({ description: '渠道', example: 'ecommerce' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: '包装类型', example: 'gift' })
  @IsOptional()
  @IsString()
  packageType?: string;
}

