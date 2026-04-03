import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBatchDto {
  @ApiPropertyOptional({ description: '批次编号，不传则后端自动生成' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchNo?: string;

  @ApiProperty({ description: '果园/地块名称', example: '东区3号地' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  orchardName: string;

  @ApiProperty({ description: '品种', example: '纽荷尔脐橙' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  variety: string;

  @ApiPropertyOptional({ description: '面积', example: '5亩' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  area?: string;

  @ApiPropertyOptional({ description: '树木数量', example: 250 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  treeCount?: number;

  @ApiProperty({ description: '种植日期', example: '2026-01-15' })
  @IsDateString()
  plantingDate: string;

  @ApiPropertyOptional({ description: '预计采收日期', example: '2026-05-20' })
  @IsOptional()
  @IsDateString()
  expectedHarvestDate?: string;

  @ApiPropertyOptional({ description: '当前阶段', example: '苗期' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  stage?: string;

  @ApiPropertyOptional({ description: '负责人ID，不传默认当前登录用户' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  managerId?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

