import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UserIdParamDto {
  @ApiProperty({ description: '用户 ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;
}
