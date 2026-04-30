import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '手机号+密码登录' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: '登录成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          token: 'jwt.token.value',
          userInfo: {
            userId: 1,
            id: 1,
            phone: '13800000000',
            nickname: '测试用户',
            avatar: '',
            role: 'farmer',
          },
        },
      },
    },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('send-code')
  @ApiOperation({ summary: '发送验证码（MVP: Redis/内存缓存）' })
  @ApiBody({ type: SendCodeDto })
  @ApiResponse({
    status: 201,
    description: '发送成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          success: true,
          expireIn: 300,
          debugCode: '123456',
        },
      },
    },
  })
  sendCode(@Body() dto: SendCodeDto) {
    return this.authService.sendCode(dto);
  }

  @Get('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          userId: 1,
          id: 1,
          phone: '13800000000',
          nickname: '测试用户',
          avatar: '',
          role: 'farmer',
        },
      },
    },
  })
  profile(
    @CurrentUser()
    user: { id: number; phone: string; nickname?: string; avatar?: string; role: string },
  ) {
    return this.authService.profile(user);
  }

  @Post('logout')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: '退出登录' })
  @ApiResponse({
    status: 201,
    description: '退出成功',
    schema: {
      example: {
        code: 0,
        message: 'ok',
        data: {
          success: true,
        },
      },
    },
  })
  logout() {
    return this.authService.logout();
  }
}

