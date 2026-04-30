import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class AiPredictDiseaseDto {
  @ApiPropertyOptional({ description: 'batchId', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ description: 'batch_id (legacy field)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batch_id?: number;

  @ApiPropertyOptional({
    description: 'optional remote image url',
    example: 'https://example.com/disease/leaf.jpg',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'imageUrl must be a valid url' })
  imageUrl?: string;
}

