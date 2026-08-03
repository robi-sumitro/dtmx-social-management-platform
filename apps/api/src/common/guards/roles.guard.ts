import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly allowedRoles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}

export function Roles(...roles: string[]) {
  return function (target: any) {
    return target; // marker; combined with RolesGuard in module
  };
}