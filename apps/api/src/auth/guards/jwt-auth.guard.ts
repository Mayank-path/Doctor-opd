import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { RequestWithAuth } from '../interfaces/auth.interfaces';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing authorization bearer token');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token || token.trim().length === 0) {
      throw new UnauthorizedException('Malformed authorization bearer token');
    }

    // Cryptographically verify token
    const payload = await this.authService.verifyToken(token.trim());

    // Verify user exists and is active in database
    const user = await this.authService.validateUser(payload.sub);

    // Overwrite request.user with verified identity; client-supplied identity headers cannot override this
    request.user = user;

    return true;
  }
}
