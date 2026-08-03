import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly featureKey: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // resolved per-request via FeatureService in the controller for freshness;
    // this guard serves as a lightweight static gate that reads from a cached flag.
    const request = context.switchToHttp().getRequest();
    const overrides = (request as any).featureOverrides;
    if (overrides && overrides[this.featureKey] === false) {
      throw new ForbiddenException(`Feature "${this.featureKey}" is disabled`);
    }
    return true;
  }
}