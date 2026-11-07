import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicAuthGuard } from '../auth/guards/clinic-auth.guard';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: any;

  const mockClinic = { clinicId: 'clinic-1' };
  const mockUser = { id: 'user-1' };

  beforeEach(async () => {
    service = {
      createPayment: jest.fn(),
      listPayments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('delegates createPayment with extracted active clinicId and current userId', async () => {
    const dto = {
      patientId: 'patient-1',
      amount: 400,
      method: PaymentMethod.CASH,
    };
    service.createPayment.mockResolvedValue({ id: 'pay-1', ...dto });

    const result = await controller.createPayment(mockClinic, mockUser, dto);
    expect(result.id).toBe('pay-1');
    expect(service.createPayment).toHaveBeenCalledWith('clinic-1', 'user-1', dto);
  });

  it('delegates listPayments with extracted active clinicId', async () => {
    service.listPayments.mockResolvedValue({ data: [], total: 0 });
    const query = { status: PaymentStatus.COMPLETED };

    const result = await controller.listPayments(mockClinic, query);
    expect(result).toEqual({ data: [], total: 0 });
    expect(service.listPayments).toHaveBeenCalledWith('clinic-1', query);
  });
});

