import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth('JWT')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: '上传图片（微信小程序）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '图片文件（jpg/jpeg/png/webp）',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: '上传成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          url: 'http://localhost:8080/uploads/1742450000000-uuid.jpg',
          filename: '1742450000000-uuid.jpg',
          size: 12345,
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.uploadService.uploadImage(file, req);
  }
}

