import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { devLogger } from '../../../..';

@Controller('auth')
export class AuthController {
  private logger = devLogger.create('AuthController', 'nest');

  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }) {
    this.logger.info('POST /auth/login', { email: body.email });
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    this.logger.info('POST /auth/register', { name: body.name, email: body.email });
    return this.authService.register(body.name, body.email, body.password);
  }
}
