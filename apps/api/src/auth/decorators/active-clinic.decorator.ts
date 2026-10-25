import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  ActiveClinicContext,
  RequestWithAuth,
} from '../interfaces/auth.interfaces';

export const ActiveClinic = createParamDecorator(
  (data: keyof ActiveClinicContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    const clinic = request.clinic;

    if (!clinic) {
      return null;
    }

    return data ? clinic[data] : clinic;
  },
);
