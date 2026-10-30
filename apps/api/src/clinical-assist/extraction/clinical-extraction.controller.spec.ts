import { Test, TestingModule } from '@nestjs/testing';
import { ClinicRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/require-roles.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClinicalExtractionController } from './clinical-extraction.controller';
import { ClinicalExtractionService } from './clinical-extraction.service';
import {
  DetectedClinicalLanguage,
  StructuredClinicalExtractionResult,
} from './clinical-extraction.types';
import { ExtractStructuredClinicalDto } from './dto/extract-structured-clinical.dto';

describe('ClinicalExtractionController', () => {
  let controller: ClinicalExtractionController;
  let service: ClinicalExtractionService;

  const mockResult: StructuredClinicalExtractionResult = {
    schemaVersion: '1.0.0',
    extractionEngineVersion: '1.0.0',
    normalizationEngineVersion: '1.0.0',
    source: {
      originalDoctorConfirmedText: 'Mareez ko bukhar hai',
      detectedLanguage: DetectedClinicalLanguage.HINGLISH,
      characterCount: 20,
    },
    findings: [],
    clinicalAssessments: [],
    unmappedExpressions: [],
    summaryCounts: {
      totalFindings: 0,
      presentCount: 0,
      absentCount: 0,
      uncertainCount: 0,
      unknownCount: 0,
      unmappedCount: 0,
      clinicalAssessmentsCount: 0,
    },
    review: {
      requiresDoctorReview: true,
      reviewStatus: 'PENDING_REVIEW',
      systemSafetyNotice: 'Assistive aid only',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalExtractionController],
      providers: [
        {
          provide: ClinicalExtractionService,
          useValue: {
            extract: jest.fn().mockReturnValue(mockResult),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClinicalExtractionController>(
      ClinicalExtractionController,
    );
    service = module.get<ClinicalExtractionService>(ClinicalExtractionService);
  });

  it('should be defined and inject extraction service', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should have RequireRoles(ClinicRole.DOCTOR) applied on extractStructured endpoint', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ClinicalExtractionController.prototype.extractStructured,
    );
    expect(roles).toEqual([ClinicRole.DOCTOR]);
  });

  it('should invoke extraction service with validated DTO and return structured result', () => {
    const dto: ExtractStructuredClinicalDto = {
      text: 'Mareez ko bukhar hai',
    };

    const result = controller.extractStructured(dto);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(service.extract).toHaveBeenCalledWith(dto);
    expect(result).toBe(mockResult);
    expect(result.review.reviewStatus).toBe('PENDING_REVIEW');
    expect(result.review.requiresDoctorReview).toBe(true);
  });
});

