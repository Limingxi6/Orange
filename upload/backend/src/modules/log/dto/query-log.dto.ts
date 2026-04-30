import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryLogDto {
  @ApiProperty({ description: '批次ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId: number;

  @ApiPropertyOptional({ description: '日志类型筛选', example: 'fertilization' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  type?: string;
}

