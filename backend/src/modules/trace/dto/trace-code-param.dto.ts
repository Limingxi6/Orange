import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TraceCodeParamDto {
  @ApiProperty({ description: 'หÝิดย๋', example: 'P1-B1001-KS8Q1A' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
