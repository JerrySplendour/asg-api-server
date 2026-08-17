import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../common/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { normalizePhoneNumber } from '../common/utils/phone-number.util';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'asg-jwt-secret-2024';

@Injectable()
export class AuthService {
  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async requestOtp(rawPhone: string) {
    if (!rawPhone) throw new BadRequestException('Phone number is required');
    const phoneNumber = normalizePhoneNumber(rawPhone);
    const code = '123456'; // Default demo OTP code (can be wired to SMS gateway)
    const expiresAt = Date.now() + 10 * 60 * 1000;

    this.otpStore.set(phoneNumber, { code, expiresAt });

    return {
      success: true,
      message: 'OTP sent successfully',
      phoneNumber,
    };
  }

  async verifyOtp(rawPhone: string, otp: string) {
    if (!rawPhone || !otp) throw new BadRequestException('Phone number and OTP are required');
    const phoneNumber = normalizePhoneNumber(rawPhone);

    const stored = this.otpStore.get(phoneNumber);
    const isDemoOtp = otp === '123456';

    if (!isDemoOtp && (!stored || stored.code !== otp || Date.now() > stored.expiresAt)) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    this.otpStore.delete(phoneNumber);

    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const last10 = digitsOnly.slice(-10);

    // Look for existing user
    let user = await this.userRepository.findOne({ where: { phoneNumber } });

    if (!user) {
      user = await this.userRepository
        .createQueryBuilder('user')
        .where('user.phoneNumber = :phoneNumber', { phoneNumber })
        .orWhere("RIGHT(REGEXP_REPLACE(user.phoneNumber, '[^0-9]', '', 'g'), 10) = :last10", { last10 })
        .getOne();
    }

    if (user) {
      // User exists -> Return auth tokens
      const accessToken = this.jwtService.sign({ sub: user.id, email: user.email || user.phoneNumber });
      const refreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '30d' },
      );

      return {
        isNewUser: false,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          isVerified: true,
        },
      };
    }

    // User does not exist -> Return onboarding token
    const onboardingToken = this.jwtService.sign(
      { phoneNumber, type: 'onboarding' },
      { expiresIn: '1h' },
    );

    return {
      isNewUser: true,
      onboardingToken,
      phoneNumber,
    };
  }

  async completeOnboarding(onboardingToken: string, displayName: string, email?: string) {
    if (!onboardingToken || !displayName) {
      throw new BadRequestException('Onboarding token and display name are required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(onboardingToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired onboarding token');
    }

    if (payload.type !== 'onboarding' || !payload.phoneNumber) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const phoneNumber = payload.phoneNumber;

    if (email) {
      const existingEmailUser = await this.userRepository.findOne({ where: { email } });
      if (existingEmailUser) {
        throw new BadRequestException('Email already in use by another user');
      }
    }

    const user = this.userRepository.create({
      phoneNumber,
      displayName,
      email: email || `${phoneNumber.replace(/\+/g, '')}@asg.app`,
      isActive: true,
      privacySettings: {
        allowLocationSharing: true,
        emergencyContactsCanSeeLocation: true,
        publicProfile: false,
        dataRetentionDays: 90,
      },
    });

    const savedUser = await this.userRepository.save(user);

    const accessToken = this.jwtService.sign({ sub: savedUser.id, email: savedUser.email });
    const refreshToken = this.jwtService.sign(
      { sub: savedUser.id, type: 'refresh' },
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        displayName: savedUser.displayName,
        phoneNumber: savedUser.phoneNumber,
        isVerified: true,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, displayName, phoneNumber } = registerDto;
    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : undefined;

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      displayName,
      phoneNumber: normalizedPhone,
      isActive: true,
      privacySettings: {
        allowLocationSharing: true,
        emergencyContactsCanSeeLocation: true,
        publicProfile: false,
        dataRetentionDays: 90,
      },
    });

    const savedUser = await this.userRepository.save(user);
    const accessToken = this.jwtService.sign({ sub: savedUser.id, email: savedUser.email });
    const refreshToken = this.jwtService.sign(
      { sub: savedUser.id, type: 'refresh' },
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        displayName: savedUser.displayName,
        phoneNumber: savedUser.phoneNumber,
        isVerified: true,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        isVerified: true,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: JWT_SECRET });
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

      const user = await this.userRepository.findOne({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('User not found');

      const newAccessToken = this.jwtService.sign({ sub: user.id, email: user.email });
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '30d' },
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          isVerified: true,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async findUserById(userId: string) {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return { valid: true, userId: payload.sub };
    } catch {
      return { valid: false };
    }
  }
}
