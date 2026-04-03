import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateLogDto {
  @ApiPropertyOptional({ description: '批次ID（camelCase）', example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ description: '批次ID（snake_case 兼容）', example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  batch_id?: number;

  @ApiPropertyOptional({ description: '日志类型（camelCase）', example: 'fertilization' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '日志类型（snake_case 兼容）', example: 'fertilization' })
  @IsOptional()
  @IsString()
  log_type?: string;

  @ApiPropertyOptional({ description: '标题', example: '春季追肥' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '内容（snake_case 兼容 description）', example: '施用复合肥 15kg/亩' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '内容（camelCase）', example: '施用复合肥 15kg/亩' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: '操作时间，不传默认当前时间',
    example: '2026-03-16T09:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  operationDate?: string;

  @ApiPropertyOptional({
    description: '图片数组（推荐）',
    example: ['https://example.com/a.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: '单图地址（snake_case 兼容 image_url）',
    example: 'https://example.com/a.jpg',
  })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({
    description: '来源：manual | disease_recognize',
    example: 'manual',
  })
  @IsOptional()
  @IsString()
  source?: string;
}

