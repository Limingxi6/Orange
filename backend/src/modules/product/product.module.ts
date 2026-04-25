import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { WechatMiniCodeService } from './wechat-mini-code.service';
import { TraceModule } from '../trace/trace.module';

@Module({
  imports: [TraceModule],
  controllers: [ProductController],
  providers: [ProductService, WechatMiniCodeService],
  exports: [ProductService],
})
export class ProductModule {}
