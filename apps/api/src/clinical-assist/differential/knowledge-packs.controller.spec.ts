import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClinicRole, KnowledgePackDomain } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { KnowledgePacksController } from './knowledge-packs.controller';
import { DifferentialDiagnosisService } from './services/differential-diagnosis.service';

describe('KnowledgePacksController — Endpoints & RBAC', () => {
  let controller: KnowledgePacksController;
  let service: DifferentialDiagnosisService;

  const mockPacks = [
    {
      id: KnowledgePackDomain.GENERAL_MEDICINE,
      domain: KnowledgePackDomain.GENERAL_MEDICINE,
      name: 'ICMR-WHO General Medicine OPD Clinical Decision Support',
      activeVersion: null,
      status: 'UNAVAILABLE',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgePacksController],
      providers: [
        {
          provide: DifferentialDiagnosisService,
          useValue: {
            listKnowledgePacks: jest.fn().mockResolvedValue(mockPacks),
            getKnowledgePackVersion: jest.fn().mockResolvedValue({
              domain: KnowledgePackDomain.GENERAL_MEDICINE,
              version: '1.0.0',
              status: 'AVAILABLE',
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KnowledgePacksController>(KnowledgePacksController);
    service = module.get<DifferentialDiagnosisService>(DifferentialDiagnosisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should declare guards on controller class', () => {
    const guards = Reflect.getMetadata('__guards__', KnowledgePacksController);
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(ClinicAuthGuard);
    expect(guards).toContain(ThrottlerGuard);
  });

  it('should require ClinicRole.DOCTOR on listKnowledgePacks', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      KnowledgePacksController.prototype.listKnowledgePacks,
    );
    expect(roles).toEqual([ClinicRole.DOCTOR]);
  });

  it('should return knowledge pack list from service', async () => {
    const res = await controller.listKnowledgePacks('clinic-123');
    expect(service.listKnowledgePacks).toHaveBeenCalledWith('clinic-123');
    expect(res).toEqual(mockPacks);
  });

  it('should return knowledge pack version from service', async () => {
    const res = await controller.getKnowledgePackVersion('clinic-123', 'GENERAL_MEDICINE');
    expect(service.getKnowledgePackVersion).toHaveBeenCalledWith('clinic-123', 'GENERAL_MEDICINE');
    expect(res.domain).toBe(KnowledgePackDomain.GENERAL_MEDICINE);
  });
});

