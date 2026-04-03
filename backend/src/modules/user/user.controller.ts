import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SelfOrAdmin } from '../../common/decorators/self-or-admin.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { UserService } from './user.service';

@ApiTags('user')
@ApiBearerAuth('JWT')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息（登录即可访问）' })
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
          status: 'active',
        },
      },
    },
  })
  getMe(@CurrentUser('id') userId: number) {
    return this.userService.getProfileById(userId);
  }

  @Get(':userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '按用户 ID 查询（仅管理员）' })
  @ApiParam({ name: 'userId', example: 1 })
  @ApiResponse({
    status: 200,
    description: '查询成功',
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
          role: 'admin',
          status: 'active',
        },
      },
    },
  })
  getById(@Param() params: UserIdParamDto) {
    return this.userService.getProfileById(params.userId);
  }

  @Get(':userId/business-scope')
  @SelfOrAdmin()
  @ApiOperation({ summary: '示例：仅本人可访问，管理员可访问全部' })
  @ApiParam({ name: 'userId', example: 1 })
  @ApiResponse({
    status: 200,
    description: '查询成功',
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
          status: 'active',
        },
      },
    },
  })
  getBusinessScope(@Param() params: UserIdParamDto) {
    return this.userService.getProfileById(params.userId);
  }
}
