import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateProductQrcodeDto {
  @ApiPropertyOptional({
    description: '可选，自定义二维码内容（优先级最高）',
    example: 'TRACE-P-10001',
  })
  @IsOptional()
  @IsString()
  traceCode?: string;

  @ApiPropertyOptional({
    description: '可选，自定义跳转链接（未传则使用默认产品链接）',
    example: 'https://example.com/trace/10001',
  })
  @IsOptional()
  @IsString()
  accessUrl?: string;
}
