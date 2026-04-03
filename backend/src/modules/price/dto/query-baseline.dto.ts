import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryBaselineDto {
  @ApiPropertyOptional({ description: '品种', example: '纽荷尔脐橙' })
  @IsOptional()
  @IsString()
  variety?: string;

  @ApiPropertyOptional({ description: '地区', example: '湖北宜城' })
  @IsOptional()
  @IsString()
  region?: string;
}

