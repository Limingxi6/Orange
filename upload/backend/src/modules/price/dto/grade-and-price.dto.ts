import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GradeAndPriceDto {
  @ApiPropertyOptional({ description: '批次ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ description: '果径(mm)', example: 75 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(120)
  diameter?: number;

  @ApiPropertyOptional({ description: '糖度 Brix', example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(25)
  brix?: number;

  @ApiPropertyOptional({ description: '单果重量(g)', example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(1000)
  weight?: number;

  @ApiPropertyOptional({ description: '瑕疵等级: low/mid/high', example: 'low' })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'mid', 'high'])
  defectLevel?: 'low' | 'mid' | 'high';

  @ApiPropertyOptional({ description: '渠道', example: 'ecommerce' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: '包装类型', example: 'gift' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  packageType?: string;
}

