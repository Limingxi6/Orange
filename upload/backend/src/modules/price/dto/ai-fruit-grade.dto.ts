import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class AiFruitGradeDto {
  @ApiPropertyOptional({ description: 'batchId', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ description: 'batch_id (legacy)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batch_id?: number;

  @ApiPropertyOptional({ description: 'optional image url', example: 'https://example.com/fruit.jpg' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'imageUrl must be a valid url' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'channel', example: '电商' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'packageType', example: '礼盒' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  packageType?: string;

  @ApiPropertyOptional({ description: 'packaging (legacy)', example: '简装' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  packaging?: string;

  @ApiPropertyOptional({ description: 'region', example: '湖北宜昌' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'diameter(mm)', example: 75 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(120)
  diameter?: number;

  @ApiPropertyOptional({ description: 'brix', example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(25)
  brix?: number;

  @ApiPropertyOptional({ description: 'weight(g)', example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(1000)
  weight?: number;

  @ApiPropertyOptional({ description: 'defect level', example: 'low' })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'mid', 'high'])
  defectLevel?: 'low' | 'mid' | 'high';
}

