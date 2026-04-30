import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class PredictDiseaseDto {
  @ApiProperty({
    description: '批次ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId: number;

  @ApiProperty({
    description: '可选，已可访问的图片 URL（不传则使用上传文件）',
    example: 'https://example.com/disease/leaf.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'imageUrl 必须是合法 URL' })
  imageUrl?: string;
}

