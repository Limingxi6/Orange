import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryWeatherDto {
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
}
