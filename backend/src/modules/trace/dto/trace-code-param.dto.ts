import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TraceCodeParamDto {
  @ApiProperty({ description: '溯源码', example: 'P1-B1001-KS8Q1A' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
