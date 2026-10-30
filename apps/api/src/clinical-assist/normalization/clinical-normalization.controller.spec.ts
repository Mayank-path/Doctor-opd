import { Test, TestingModule } from '@nestjs/testing';
import { ClinicRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClinicalNormalizationController } from './clinical-normalization.controller';
import { ClinicalNormalizationRegistry } from './clinical-normalization.registry';
import { ClinicalNormalizationService } from './clinical-normalization.service';
import {
  DetectedClinicalLanguage,
  SymptomPolarity,
} from './clinical-normalization.types';

describe('ClinicalNormalizationController', () => {
  let controller: ClinicalNormalizationController;
  let service: ClinicalNormalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalNormalizationController],
      providers: [ClinicalNormalizationService, ClinicalNormalizationRegistry],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClinicalNormalizationController>(
      ClinicalNormalizationController,
    );
    service = module.get<ClinicalNormalizationService>(
      ClinicalNormalizationService,
    );
  });

  it('should be defined and inject service', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should have RequireRoles(ClinicRole.DOCTOR) applied on normalize endpoint', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ClinicalNormalizationController.prototype.normalize,
    );
    expect(roles).toEqual([ClinicRole.DOCTOR]);
  });

  it('should delegate normalization request to service and return result', () => {
    const text = 'Mareez ko teen din se bukhar hai.';
    const result = controller.normalize({ text });

    expect(result).toBeDefined();
    expect(result.originalText).toBe(text);
    expect(result.language).toBe(DetectedClinicalLanguage.HINGLISH);
    expect(result.requiresDoctorReview).toBe(true);
    expect(result.symptoms.length).toBe(1);
    expect(result.symptoms[0].canonicalTerm).toBe('Fever');
    expect(result.symptoms[0].polarity).toBe(SymptomPolarity.POSITIVE);
  });
});
