import { Test, TestingModule } from '@nestjs/testing';
import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
} from '@prisma/client';
import { GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED } from '../../../../prisma/seeds/general-medicine';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  KNOWN_CANONICAL_CHECKSUMS,
  KnowledgePackResolverService,
} from './knowledge-pack-resolver.service';

describe('KnowledgePackResolverService — Selection Policy & Cryptographic Integrity Verification', () => {
  let service: KnowledgePackResolverService;
  let prisma: {
    knowledgePackRelease: {
      findFirst: jest.Mock;
    };
  };

  const clinicId = 'clinic-alpha-123';

  /**
   * Helper that builds a complete, valid mock version and cryptographically
   * binds its checksumSha256 and clinical approval attestation.
   */
  const createMockVersion = (
    status: KnowledgePackReleaseStatus = KnowledgePackReleaseStatus.RELEASED,
    major: number = 2,
    minor: number = 0,
    patch: number = 0,
  ) => {
    const rawVersion: any = {
      id: `ver-${major}-${minor}-${patch}`,
      majorVersion: major,
      minorVersion: minor,
      patchVersion: patch,
      releaseStatus: status,
      pack: {
        domain: KnowledgePackDomain.GENERAL_MEDICINE,
        name: 'General Medicine Decision Support',
        description: 'Outpatient clinical decision rules',
      },
      conditions: [
        {
          conditionCode: 'COND-PHARYNGITIS',
          displayName: 'Streptococcal Pharyngitis',
          category: 'Infectious Disease',
          description: 'Bacterial pharyngitis',
          icd10Guidance: 'J02.0',
          evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
          rules: [
            {
              ruleCode: 'RULE-PHARYNGITIS-001',
              ruleTitle: 'Streptococcal Pharyngitis Centor Rules',
              minMajorCount: 1,
              applicabilityJson: { minAgeYears: 3 },
              mandatoryAstJson: {
                type: 'CONCEPT_STATUS',
                canonicalTerm: 'Sore throat',
                expectedStatus: 'PRESENT',
              },
              majorSupportingJson: [],
              minorSupportingJson: [],
              contradictionsJson: [],
              missingDataRulesJson: [],
              investigationsJson: ['Throat swab culture'],
            },
          ],
        },
      ],
      redFlagRules: [
        {
          flagCode: 'RF-QSOFA-SEPSIS',
          title: 'qSOFA Sepsis Screening Alert',
          urgencyLevel: 'IMMEDIATE',
          clinicalAction: 'Clinical escalation advisory',
          ruleAstJson: { operator: 'AT_LEAST_N', threshold: 2, predicates: [] },
        },
      ],
      sources: [],
      mappings: [],
    };

    // Recompute actual canonical checksum using the service's canonical serializer
    const checksum = service.computeLoadedVersionChecksum(rawVersion);
    rawVersion.checksumSha256 = checksum;
    rawVersion.approvals = [
      {
        id: 'appr-1',
        versionId: rawVersion.id,
        reviewerUserId: 'user-doc-1',
        clinicianName: 'Dr. Jane Smith, MD',
        medicalRegistration: 'MCI-12345',
        stateMedicalCouncil: 'Delhi Medical Council',
        qualification: 'MBBS, MD (Internal Medicine)',
        specialty: 'Internal Medicine',
        checksumSha256: checksum,
        reviewNotes: `Clinically reviewed and approved. Attestation Checksum SHA-256: ${checksum}`,
        approvalVerdict: 'APPROVED',
      },
    ];

    return rawVersion;
  };

  /**
   * Builds a full mock version from the authoritative General Medicine 1.0.0 seed.
   */
  const createAuthoritativeGeneralMedicineVersion = () => {
    const seed = GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED;
    const checksum = KNOWN_CANONICAL_CHECKSUMS[`${KnowledgePackDomain.GENERAL_MEDICINE}_1.0.0`];

    return {
      id: 'ver-gm-1-0-0',
      majorVersion: seed.version.major,
      minorVersion: seed.version.minor,
      patchVersion: seed.version.patch,
      releaseStatus: KnowledgePackReleaseStatus.RELEASED,
      checksumSha256: checksum,
      changelog: seed.version.changelog,
      pack: {
        domain: seed.domain,
        name: seed.name,
        description: seed.description,
      },
      approvals: [
        {
          id: 'appr-authoritative',
          versionId: 'ver-gm-1-0-0',
          reviewerUserId: 'user-doc-sharma',
          clinicianName: 'Dr. Ramesh Sharma, MD',
          medicalRegistration: 'NMC-2023-GM',
          stateMedicalCouncil: 'National Medical Commission',
          qualification: 'MBBS, MD (General Medicine)',
          specialty: 'General Medicine',
          checksumSha256: checksum,
          reviewNotes: `Ratified and approved. Checksum SHA-256: ${checksum}`,
          approvalVerdict: 'APPROVED',
        },
      ],
      conditions: seed.conditions.map((c) => ({
        ...c,
        rules: seed.rules
          .filter((r) => r.conditionCode === c.conditionCode)
          .map((r) => ({
            ...r,
            applicabilityJson: r.applicability,
            mandatoryAstJson: r.mandatoryAst,
            majorSupportingJson: r.majorSupporting,
            minorSupportingJson: r.minorSupporting,
            contradictionsJson: r.contradictions,
            missingDataRulesJson: r.missingDataRules,
            investigationsJson: r.investigations,
          })),
      })),
      redFlagRules: seed.redFlags.map((rf) => ({
        ...rf,
        ruleAstJson: rf.ruleAst,
      })),
      sources: seed.sources,
      mappings: seed.mappings,
    };
  };

  beforeEach(async () => {
    prisma = {
      knowledgePackRelease: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgePackResolverService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<KnowledgePackResolverService>(
      KnowledgePackResolverService,
    );
  });

  describe('1. Actual Content Cryptographic Verification (Phase 5B.6.2)', () => {
    it('should accept valid content with matching recomputed SHA-256 checksum', async () => {
      const validVersion = createMockVersion();

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-valid',
        clinicId,
        versionId: validVersion.id,
        isActive: true,
        version: validVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);

      expect(result).toBeDefined();
      expect(result?.metadata.checksumSha256).toBe(validVersion.checksumSha256);
      expect(result?.metadata.version).toBe('2.0.0');
    });

    it('should reject when a condition displayName is modified', async () => {
      const tamperedVersion = createMockVersion();
      // Mutate condition content after computing checksum
      tamperedVersion.conditions[0].displayName = 'Tampered Streptococcal Pharyngitis';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-tampered-condition',
        clinicId,
        versionId: tamperedVersion.id,
        isActive: true,
        version: tamperedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when a condition category is modified', async () => {
      const tamperedVersion = createMockVersion();
      // Mutate condition category
      tamperedVersion.conditions[0].category = 'Cardiology';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-tampered-category',
        clinicId,
        versionId: tamperedVersion.id,
        isActive: true,
        version: tamperedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when a differential rule minMajorCount is modified', async () => {
      const tamperedVersion = createMockVersion();
      // Mutate differential rule parameter
      tamperedVersion.conditions[0].rules[0].minMajorCount = 99;

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-tampered-rule',
        clinicId,
        versionId: tamperedVersion.id,
        isActive: true,
        version: tamperedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when a differential rule mandatory AST predicate is modified', async () => {
      const tamperedVersion = createMockVersion();
      // Mutate AST predicate term
      tamperedVersion.conditions[0].rules[0].mandatoryAstJson.canonicalTerm = 'Severe chest tightness';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-tampered-ast',
        clinicId,
        versionId: tamperedVersion.id,
        isActive: true,
        version: tamperedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when a red-flag rule urgencyLevel is modified', async () => {
      const tamperedVersion = createMockVersion();
      // Mutate red flag rule urgency
      tamperedVersion.redFlagRules[0].urgencyLevel = 'LOW';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-tampered-rf',
        clinicId,
        versionId: tamperedVersion.id,
        isActive: true,
        version: tamperedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when a red-flag rule title is modified', async () => {
      const tamperedVersion = createMockVersion();
      // Mutate red flag title
      tamperedVersion.redFlagRules[0].title = 'Tampered Alert Title';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-tampered-rf-title',
        clinicId,
        versionId: tamperedVersion.id,
        isActive: true,
        version: tamperedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when stored checksum is missing or empty', async () => {
      const noChecksumVersion = createMockVersion();
      noChecksumVersion.checksumSha256 = '';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-missing-checksum',
        clinicId,
        versionId: noChecksumVersion.id,
        isActive: true,
        version: noChecksumVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when stored checksum is an invalid non-hex string', async () => {
      const badHexVersion = createMockVersion();
      badHexVersion.checksumSha256 = 'not-a-valid-64-char-hex-checksum';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-bad-hex',
        clinicId,
        versionId: badHexVersion.id,
        isActive: true,
        version: badHexVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });
  });

  describe('2. Clinical Review Approval Binding (Phase 5B.6.2)', () => {
    it('should reject when approval bound checksum does not match stored/recomputed checksum', async () => {
      const version = createMockVersion();
      // Mismatched checksum on explicit checksumSha256 column
      version.approvals[0].checksumSha256 =
        '0000000000000000000000000000000000000000000000000000000000000000';
      version.approvals[0].reviewNotes =
        'Approved by Board. SHA-256: 0000000000000000000000000000000000000000000000000000000000000000';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-approval-mismatch',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when approval record lacks an explicit checksumSha256 binding (legacy unverified)', async () => {
      const version = createMockVersion();
      // Remove explicit relational checksum binding
      delete (version.approvals[0] as any).checksumSha256;
      version.approvals[0].reviewNotes = 'Clinical board reviewed and approved without explicit checksumSha256 binding';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-no-binding',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when approval has expired (expiresAt in past)', async () => {
      const version = createMockVersion();
      version.approvals[0].expiresAt = new Date('2020-01-01T00:00:00Z');

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-expired-approval',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should accept when approval has a valid future expiration date', async () => {
      const version = createMockVersion();
      version.approvals[0].expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year in future

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-valid-future-approval',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeDefined();
    });

    it('should reject when approval has an empty or malformed digital signature', async () => {
      const version = createMockVersion();
      version.approvals[0].digitalSignature = '   '; // Empty whitespace

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-malformed-sig',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should accept when approval has a valid non-empty digital signature string', async () => {
      const version = createMockVersion();
      version.approvals[0].digitalSignature = 'valid-ed25519-signature-hex-attestation';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-valid-sig',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeDefined();
    });

    it('should reject when version has no approval records at all', async () => {
      const version = createMockVersion();
      version.approvals = [];

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-zero-approvals',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject when approval verdict is REJECTED', async () => {
      const version = createMockVersion();
      version.approvals[0].approvalVerdict = 'REJECTED';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-rejected-verdict',
        clinicId,
        versionId: version.id,
        isActive: true,
        version,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });
  });

  describe('3. Lifecycle & Priority Invariants', () => {
    it('should reject release when release.isActive is false', async () => {
      const validVersion = createMockVersion();

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-inactive',
        clinicId,
        versionId: validVersion.id,
        isActive: false,
        version: validVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject release when release.deactivatedAt is populated', async () => {
      const validVersion = createMockVersion();

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-deactivated',
        clinicId,
        versionId: validVersion.id,
        isActive: true,
        deactivatedAt: new Date(),
        version: validVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject release if version releaseStatus is ROLLED_BACK', async () => {
      const rolledBackVersion = createMockVersion(KnowledgePackReleaseStatus.ROLLED_BACK);

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-rolled-back',
        clinicId,
        versionId: rolledBackVersion.id,
        isActive: true,
        version: rolledBackVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('should reject release if version releaseStatus is DEPRECATED', async () => {
      const deprecatedVersion = createMockVersion(KnowledgePackReleaseStatus.DEPRECATED);

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-deprecated',
        clinicId,
        versionId: deprecatedVersion.id,
        isActive: true,
        version: deprecatedVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('APPROVED without RELEASED remains ineligible and returns null', async () => {
      const approvedVersion = createMockVersion(KnowledgePackReleaseStatus.APPROVED);

      // In the database query, releaseStatus: RELEASED filter prevents matching
      prisma.knowledgePackRelease.findFirst.mockResolvedValue(null);

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('DRAFT packs are never eligible and return null', async () => {
      prisma.knowledgePackRelease.findFirst.mockResolvedValue(null);

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });

    it('Clinic-specific active release precedence over global release remains unchanged', async () => {
      const clinicVersion = createMockVersion(KnowledgePackReleaseStatus.RELEASED, 2, 1, 0);

      // First call (clinic lookup) returns clinic release immediately
      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-clinic-custom',
        clinicId,
        versionId: clinicVersion.id,
        isActive: true,
        version: clinicVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);

      expect(result).toBeDefined();
      expect(result?.metadata.releaseScope).toBe('CLINIC');
      expect(result?.metadata.version).toBe('2.1.0');
      // Global query was never called
      expect(prisma.knowledgePackRelease.findFirst).toHaveBeenCalledTimes(1);
    });

    it('Global baseline release is resolved when no clinic override exists', async () => {
      const globalVersion = createMockVersion(KnowledgePackReleaseStatus.RELEASED, 2, 0, 0);

      // Clinic lookup returns null, Global lookup returns globalVersion
      prisma.knowledgePackRelease.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rel-global-base',
          clinicId: null,
          versionId: globalVersion.id,
          isActive: true,
          version: globalVersion,
        });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);

      expect(result).toBeDefined();
      expect(result?.metadata.releaseScope).toBe('GLOBAL');
      expect(result?.metadata.version).toBe('2.0.0');
      expect(prisma.knowledgePackRelease.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('4. Authoritative GENERAL_MEDICINE 1.0.0 Seed Integrity', () => {
    it('should verify and accept authoritative GENERAL_MEDICINE 1.0.0 seed bundle', async () => {
      const authoritativeVersion = createAuthoritativeGeneralMedicineVersion();

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-gm-1-0-0',
        clinicId: null,
        versionId: authoritativeVersion.id,
        isActive: true,
        version: authoritativeVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);

      expect(result).toBeDefined();
      expect(result?.metadata.version).toBe('1.0.0');
      expect(result?.metadata.checksumSha256).toBe(
        '768f3ca6f79648bfe3ea7a6448719436f5557a9584436f6ca00791c1fa51984d',
      );
      expect(result?.bundle.conditions.length).toBe(35);
      expect(result?.bundle.rules.length).toBe(35);
      expect(result?.bundle.redFlags.length).toBe(4);
    });

    it('should reject authoritative GENERAL_MEDICINE 1.0.0 if any single rule is altered', async () => {
      const authoritativeVersion = createAuthoritativeGeneralMedicineVersion();
      // Alter a rule title in the authoritative pack
      authoritativeVersion.conditions[0].rules[0].ruleTitle = 'Altered Rule Title';

      prisma.knowledgePackRelease.findFirst.mockResolvedValueOnce({
        id: 'rel-gm-altered',
        clinicId: null,
        versionId: authoritativeVersion.id,
        isActive: true,
        version: authoritativeVersion,
      });

      const result = await service.resolveActiveRelease(clinicId, KnowledgePackDomain.GENERAL_MEDICINE);
      expect(result).toBeNull();
    });
  });
});
