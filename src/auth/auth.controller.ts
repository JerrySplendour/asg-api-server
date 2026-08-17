import { Controller, Post, Body, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('request-otp')
  async requestOtp(@Body() body: { phoneNumber: string }) {
    return this.authService.requestOtp(body.phoneNumber);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { phoneNumber: string; otp: string }) {
    return this.authService.verifyOtp(body.phoneNumber, body.otp);
  }

  @Post('complete-onboarding')
  async completeOnboarding(@Body() body: { onboardingToken: string; displayName: string; email?: string }) {
    return this.authService.completeOnboarding(body.onboardingToken, body.displayName, body.email);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) throw new UnauthorizedException('Refresh token required');
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('validate')
  @UseGuards(JwtGuard)
  async validateToken(@Req() req: Request) {
    const user = req.user as { userId: string } | undefined;
    if (!user) throw new UnauthorizedException();
    return { valid: true, userId: user.userId };
  }
}
