import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateBatchStageDto {
  @ApiProperty({ description: '批次阶段', example: '果实膨大期' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  stage: string;
}

