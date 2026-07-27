// auth/guards/jwt.guard.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    // This will print the internal Passport verification error (e.g., "TokenExpiredError" or "JsonWebTokenError")
    if (info) {
      console.log('Passport Error Info:', info.message);
    }
    
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}