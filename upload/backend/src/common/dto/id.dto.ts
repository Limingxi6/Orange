import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ID 参数 DTO
 */
export class IdParamDto {
  @ApiProperty({ description: 'ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;
}

/**
 * 批次 ID 参数 DTO
 */
export class BatchIdParamDto {
  @ApiProperty({ description: '批次ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId: number;
}
