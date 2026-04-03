import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryForecastDto {
  @ApiPropertyOptional({ description: '地区编码（camelCase）', example: '420684' })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiPropertyOptional({ description: '地区编码（snake_case 兼容）', example: '420684' })
  @IsOptional()
  @IsString()
  region_code?: string;

  @ApiPropertyOptional({ description: '城市名称', example: '宜城市' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '预报天数，默认 15', example: 15, minimum: 1, maximum: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15)
  days?: number = 15;
}
