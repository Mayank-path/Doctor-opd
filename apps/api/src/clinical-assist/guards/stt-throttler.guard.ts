import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestWithAuth } from '../../auth/interfaces/auth.interfaces';

@Injectable()
export class SttThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const authReq = req as unknown as RequestWithAuth;
    const clinicId = authReq.clinic?.clinicId;
    const userId = authReq.user?.id;

    if (clinicId && userId) {
      return Promise.resolve(`stt_${clinicId}_${userId}`);
    }

    if (clinicId) {
      return Promise.resolve(`stt_clinic_${clinicId}`);
    }

    if (userId) {
      return Promise.resolve(`stt_user_${userId}`);
    }

    const ips = req['ips'];
    if (Array.isArray(ips) && ips.length > 0 && typeof ips[0] === 'string') {
      return Promise.resolve(ips[0]);
    }

    const ip = typeof req['ip'] === 'string' ? req['ip'] : 'anonymous_stt';
    return Promise.resolve(ip);
  }
}
