import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: '手机号',
    example: '13800000000',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({
    description: '登录密码',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: '密码长度不能小于6位' })
  password: string;
}

