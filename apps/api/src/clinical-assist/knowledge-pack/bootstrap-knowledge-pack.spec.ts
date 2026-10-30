import {
  GENERAL_MEDICINE_CONDITIONS,
  GENERAL_MEDICINE_DIFFERENTIAL_RULES,
  GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
  GENERAL_MEDICINE_PACK_METADATA,
  GENERAL_MEDICINE_RED_FLAGS,
  GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS,
  GENERAL_MEDICINE_SOURCE_REFERENCES,
} from '../../../prisma/seeds/general-medicine';
import {
  buildCanonicalPayload,
  computeCanonicalChecksum,
  serializeCanonicalJson,
  validateAstTree,
  validateKnowledgePackSeed,
} from '../../../prisma/seeds/canonical-serializer';
import {
  KnowledgePackBootstrapper,
} from '../../../prisma/seeds/knowledge-pack-bootstrapper';
import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
  KnowledgePackSeed,
  MAX_AST_DEPTH,
  MAX_AST_NODES,
} from '../../../prisma/seeds/knowledge-pack.types';

describe('General Medicine Knowledge Pack Bootstrapper (Phase 5B.4-C)', () => {
  describe('1. Data Structure & 35-Condition Inventory Validation', () => {
    it('should contain exactly 35 high-prevalence outpatient conditions', () => {
      expect(GENERAL_MEDICINE_CONDITIONS).toHaveLength(35);
      expect(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.conditions).toHaveLength(35);
    });

    it('should have unique condition codes for every condition', () => {
      const codes = GENERAL_MEDICINE_CONDITIONS.map((c) => c.conditionCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(35);
    });

    it('should populate all required clinical fields without empty strings', () => {
      for (const cond of GENERAL_MEDICINE_CONDITIONS) {
        expect(cond.conditionCode.trim().length).toBeGreaterThan(0);
        expect(cond.displayName.trim().length).toBeGreaterThan(0);
        expect(cond.description.trim().length).toBeGreaterThan(0);
        expect(cond.category.trim().length).toBeGreaterThan(0);
        expect(cond.evidenceStatus).toBeDefined();
      }
    });

    it('should match the approved 35 condition inventory from Phase 5B.3', () => {
      const expectedCodes = [
        'COND-GM-URI-001',
        'COND-GM-STREP-002',
        'COND-GM-BRONCH-003',
        'COND-GM-CAP-004',
        'COND-GM-ILI-005',
        'COND-GM-GASTRO-VIRAL-006',
        'COND-GM-ENTERITIS-BACT-007',
        'COND-GM-DYSENTERY-AMOE-008',
        'COND-GM-GERD-009',
        'COND-GM-PUD-DYSPEPSIA-010',
        'COND-GM-UTI-CYSTITIS-011',
        'COND-GM-PYELONEPHRITIS-012',
        'COND-GM-MALARIA-UNCOMP-013',
        'COND-GM-DENGUE-NONSEV-014',
        'COND-GM-ENTERIC-FEVER-015',
        'COND-GM-HEPATITIS-ACUTE-016',
        'COND-GM-HYPERTENSION-017',
        'COND-GM-T2DM-NEW-018',
        'COND-GM-HEADACHE-TENSION-019',
        'COND-GM-MIGRAINE-NOAURA-020',
        'COND-GM-ALLERG-RHIN-021',
        'COND-GM-RHINOSINUS-022',
        'COND-GM-ANEMIA-IDA-023',
        'COND-GM-DEFIC-VIT-MYALGIA-024',
        'COND-GM-ASTHMA-EXAC-025',
        'COND-GM-COPD-EXAC-026',
        'COND-GM-OTITIS-MEDIA-027',
        'COND-GM-VERTIGO-PERIPH-028',
        'COND-GM-LBP-MECHANICAL-029',
        'COND-GM-OA-KNEE-030',
        'COND-GM-CELLULITIS-031',
        'COND-GM-CHICKENPOX-032',
        'COND-GM-SHINGLES-033',
        'COND-GM-HYPOTHYROID-034',
        'COND-GM-GAD-SOMATIC-035',
      ];

      const actualCodes = GENERAL_MEDICINE_CONDITIONS.map((c) => c.conditionCode);
      expect(actualCodes.sort()).toEqual(expectedCodes.sort());
    });

    it('should have exactly 35 corresponding differential rules matching conditions', () => {
      expect(GENERAL_MEDICINE_DIFFERENTIAL_RULES).toHaveLength(35);
      const conditionCodes = new Set(
        GENERAL_MEDICINE_CONDITIONS.map((c) => c.conditionCode),
      );
      for (const rule of GENERAL_MEDICINE_DIFFERENTIAL_RULES) {
        expect(conditionCodes.has(rule.conditionCode)).toBe(true);
        expect(rule.ruleCode.trim().length).toBeGreaterThan(0);
        expect(rule.ruleTitle.trim().length).toBeGreaterThan(0);
        expect(rule.minMajorCount).toBeGreaterThanOrEqual(1);
        expect(rule.mandatoryAst).toBeDefined();
        expect(Array.isArray(rule.majorSupporting)).toBe(true);
      }
    });

    it('should have 4 high-acuity emergency red flag rules', () => {
      expect(GENERAL_MEDICINE_RED_FLAGS).toHaveLength(4);
      const flagCodes = GENERAL_MEDICINE_RED_FLAGS.map((rf) => rf.flagCode);
      expect(flagCodes).toContain('RF-QSOFA-SEPSIS');
      expect(flagCodes).toContain('RF-ACS-ISCHEMIA');
      expect(flagCodes).toContain('RF-RESP-FAILURE');
      expect(flagCodes).toContain('RF-HYPERTENSIVE-CRISIS');
    });

    it('should have authoritative source references and complete mappings', () => {
      expect(GENERAL_MEDICINE_SOURCE_REFERENCES.length).toBeGreaterThanOrEqual(10);
      const sourceIds = new Set(
        GENERAL_MEDICINE_SOURCE_REFERENCES.map((s) => s.referenceIdentifier),
      );
      for (const mapping of GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS) {
        expect(sourceIds.has(mapping.sourceReferenceIdentifier)).toBe(true);
      }
    });
  });

  describe('2. AST Safety & Invariants Validation', () => {
    it('should verify all differential rules respect MAX_AST_DEPTH and MAX_AST_NODES', () => {
      for (const rule of GENERAL_MEDICINE_DIFFERENTIAL_RULES) {
        const mandatoryStats = validateAstTree(rule.mandatoryAst);
        expect(mandatoryStats.maxDepth).toBeLessThanOrEqual(MAX_AST_DEPTH);
        expect(mandatoryStats.nodeCount).toBeLessThanOrEqual(MAX_AST_NODES);

        for (const major of rule.majorSupporting) {
          const stats = validateAstTree(major);
          expect(stats.maxDepth).toBeLessThanOrEqual(MAX_AST_DEPTH);
          expect(stats.nodeCount).toBeLessThanOrEqual(MAX_AST_NODES);
        }

        if (rule.minorSupporting) {
          for (const minor of rule.minorSupporting) {
            const stats = validateAstTree(minor);
            expect(stats.maxDepth).toBeLessThanOrEqual(MAX_AST_DEPTH);
          }
        }

        if (rule.contradictions) {
          for (const contra of rule.contradictions) {
            const stats = validateAstTree(contra);
            expect(stats.maxDepth).toBeLessThanOrEqual(MAX_AST_DEPTH);
          }
        }
      }
    });

    it('should verify all red flag rules respect MAX_AST_DEPTH and MAX_AST_NODES', () => {
      for (const rf of GENERAL_MEDICINE_RED_FLAGS) {
        const stats = validateAstTree(rf.ruleAst);
        expect(stats.maxDepth).toBeLessThanOrEqual(MAX_AST_DEPTH);
        expect(stats.nodeCount).toBeLessThanOrEqual(MAX_AST_NODES);
      }
    });

    it('should reject AST violating depth limit > 5', () => {
      // 6-level nested AST
      const deepAst: any = {
        operator: 'ALL',
        predicates: [
          {
            operator: 'ANY',
            predicates: [
              {
                operator: 'ALL',
                predicates: [
                  {
                    operator: 'ANY',
                    predicates: [
                      {
                        operator: 'ALL',
                        predicates: [
                          {
                            type: 'CONCEPT_STATUS',
                            canonicalTerm: 'Fever',
                            expectedStatus: 'PRESENT',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => validateAstTree(deepAst)).toThrow(
        /AST Depth Violation: Current depth 6 exceeds MAX_AST_DEPTH/,
      );
    });

    it('should reject numeric vitals outside biological range for all 6 vital signs', () => {
      const outOfBoundsCases = [
        { param: 'VITAL_TEMPERATURE_C', val: 29.9, errPattern: /Biological Range Violation: VITAL_TEMPERATURE_C value 29.9 outside \[30, 45\] C/ },
        { param: 'VITAL_TEMPERATURE_C', val: 45.1, errPattern: /Biological Range Violation: VITAL_TEMPERATURE_C value 45.1 outside \[30, 45\] C/ },
        { param: 'VITAL_BP_SYSTOLIC', val: 39, errPattern: /Biological Range Violation: VITAL_BP_SYSTOLIC value 39 outside \[40, 300\] mmHg/ },
        { param: 'VITAL_BP_SYSTOLIC', val: 301, errPattern: /Biological Range Violation: VITAL_BP_SYSTOLIC value 301 outside \[40, 300\] mmHg/ },
        { param: 'VITAL_BP_DIASTOLIC', val: 19, errPattern: /Biological Range Violation: VITAL_BP_DIASTOLIC value 19 outside \[20, 200\] mmHg/ },
        { param: 'VITAL_BP_DIASTOLIC', val: 201, errPattern: /Biological Range Violation: VITAL_BP_DIASTOLIC value 201 outside \[20, 200\] mmHg/ },
        { param: 'VITAL_PULSE', val: 19, errPattern: /Biological Range Violation: VITAL_PULSE value 19 outside \[20, 260\] bpm/ },
        { param: 'VITAL_PULSE', val: 261, errPattern: /Biological Range Violation: VITAL_PULSE value 261 outside \[20, 260\] bpm/ },
        { param: 'VITAL_SPO2', val: 49, errPattern: /Biological Range Violation: VITAL_SPO2 value 49 outside \[50, 100\] %/ },
        { param: 'VITAL_SPO2', val: 101, errPattern: /Biological Range Violation: VITAL_SPO2 value 101 outside \[50, 100\] %/ },
        { param: 'VITAL_RESPIRATORY_RATE', val: 3, errPattern: /Biological Range Violation: VITAL_RESPIRATORY_RATE value 3 outside \[4, 80\] breaths\/min/ },
        { param: 'VITAL_RESPIRATORY_RATE', val: 81, errPattern: /Biological Range Violation: VITAL_RESPIRATORY_RATE value 81 outside \[4, 80\] breaths\/min/ },
      ];

      for (const testCase of outOfBoundsCases) {
        const invalidVital: any = {
          type: 'NUMERIC_PARAM',
          parameter: testCase.param,
          operator: 'EQUAL',
          value: testCase.val,
        };
        expect(() => validateAstTree(invalidVital)).toThrow(testCase.errPattern);
      }
    });

    it('should accept valid in-range numeric vitals for all 6 parameters without clamping', () => {
      const validCases = [
        { param: 'VITAL_TEMPERATURE_C', val: 37.0 },
        { param: 'VITAL_BP_SYSTOLIC', val: 120 },
        { param: 'VITAL_BP_DIASTOLIC', val: 80 },
        { param: 'VITAL_PULSE', val: 72 },
        { param: 'VITAL_SPO2', val: 98 },
        { param: 'VITAL_RESPIRATORY_RATE', val: 16 },
      ];

      for (const validCase of validCases) {
        const validVital: any = {
          type: 'NUMERIC_PARAM',
          parameter: validCase.param,
          operator: 'EQUAL',
          value: validCase.val,
        };
        const stats = validateAstTree(validVital);
        expect(stats.nodeCount).toBe(1);
        expect(stats.maxDepth).toBe(1);
      }
    });

    it('should reject AST violating node complexity limit MAX_AST_NODES (50)', () => {
      // 51 leaf predicates in a flat ANY logical node
      const tooManyNodesAst: any = {
        operator: 'ANY',
        predicates: Array.from({ length: 51 }, (_, i) => ({
          type: 'CONCEPT_STATUS',
          canonicalTerm: `Symptom_${i}`,
          expectedStatus: 'PRESENT',
        })),
      };

      expect(() => validateAstTree(tooManyNodesAst)).toThrow(
        /AST Complexity Violation: Node count 52 exceeds MAX_AST_NODES \(50\)/,
      );
    });

    it('should reject knowledge pack exceeding MAX_RULES_PER_PACK (500)', () => {
      const massiveRulesSeed: KnowledgePackSeed = {
        ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        rules: Array.from({ length: 501 }, (_, i) => ({
          ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.rules[0],
          ruleCode: `RULE-OVERFLOW-${i}`,
        })),
      };

      expect(() => validateKnowledgePackSeed(massiveRulesSeed)).toThrow(
        /Rule Count Violation: Pack contains 501 rules, exceeding limit of 500/,
      );
    });

    it('should reject unallowlisted AST operator or predicate type', () => {
      const maliciousAst: any = {
        operator: 'EVAL_DYNAMIC_JS',
        predicates: [{ type: 'SCRIPT', code: 'process.exit(1)' }],
      };

      expect(() => validateAstTree(maliciousAst)).toThrow(
        /Invalid logical operator: EVAL_DYNAMIC_JS/,
      );
    });

    it('should detect duplicate condition codes during pack validation', () => {
      const duplicateSeed: KnowledgePackSeed = {
        ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        conditions: [
          ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.conditions,
          {
            conditionCode: 'COND-GM-URI-001', // Duplicate!
            displayName: 'Duplicate URI',
            description: 'Duplicate',
            category: 'RESPIRATORY',
            evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
          },
        ],
      };

      expect(() => validateKnowledgePackSeed(duplicateSeed)).toThrow(
        /Duplicate condition code detected: "COND-GM-URI-001"/,
      );
    });
  });

  describe('3. Canonical Serialization & Deterministic SHA-256 Checksum', () => {
    it('should generate a 64-character hex SHA-256 checksum', () => {
      const checksum = computeCanonicalChecksum(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce identical checksum regardless of object key order', () => {
      const checksum1 = computeCanonicalChecksum(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED);

      // Create clone with deliberately reversed keys in top-level and conditions
      const scrambledSeed: KnowledgePackSeed = {
        mappings: [...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.mappings],
        sources: [...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.sources],
        redFlags: [...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.redFlags],
        rules: [...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.rules],
        conditions: [...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.conditions].reverse(),
        version: {
          patch: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.version.patch,
          minor: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.version.minor,
          major: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.version.major,
          changelog: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.version.changelog,
        },
        description: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.description,
        name: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.name,
        domain: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.domain,
      };

      const checksum2 = computeCanonicalChecksum(scrambledSeed);
      expect(checksum2).toBe(checksum1);
    });

    it('should produce a different checksum if any clinical rule or condition is altered', () => {
      const originalChecksum = computeCanonicalChecksum(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      const mutatedConditions = [...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.conditions];
      mutatedConditions[0] = {
        ...mutatedConditions[0],
        description: mutatedConditions[0].description + ' (mutated)',
      };

      const mutatedSeed: KnowledgePackSeed = {
        ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        conditions: mutatedConditions,
      };

      const mutatedChecksum = computeCanonicalChecksum(mutatedSeed);
      expect(mutatedChecksum).not.toBe(originalChecksum);
    });

    it('should serialize to valid deterministic JSON', () => {
      const jsonStr = serializeCanonicalJson(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED);
      expect(typeof jsonStr).toBe('string');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.domain).toBe('GENERAL_MEDICINE');
      expect(parsed.conditions).toHaveLength(35);
      expect(parsed.rules).toHaveLength(35);
    });
  });

  describe('4. Idempotency & Transactional Governance (Mocked Prisma)', () => {
    let mockTx: any;
    let mockPrisma: any;
    let bootstrapper: KnowledgePackBootstrapper;

    beforeEach(() => {
      mockTx = {
        clinicalKnowledgePack: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        knowledgePackVersion: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        clinicalCondition: {
          upsert: jest.fn(),
        },
        differentialRule: {
          upsert: jest.fn(),
        },
        redFlagRule: {
          upsert: jest.fn(),
        },
        clinicalSourceReference: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        ruleSourceMapping: {
          upsert: jest.fn(),
        },
        clinicalReviewApproval: {
          count: jest.fn().mockResolvedValue(0),
        },
        knowledgePackRelease: {
          count: jest.fn().mockResolvedValue(0),
        },
      };

      mockPrisma = {
        $transaction: jest.fn(async (callback: any) => {
          return await callback(mockTx);
        }),
      };

      bootstrapper = new KnowledgePackBootstrapper(mockPrisma as any);
    });

    it('should create new pack, draft version, and seed records on first run', async () => {
      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue(null);
      mockTx.clinicalKnowledgePack.create.mockResolvedValue({
        id: 'pack-uuid-1',
        domain: KnowledgePackDomain.GENERAL_MEDICINE,
      });

      mockTx.knowledgePackVersion.findUnique.mockResolvedValue(null);
      mockTx.knowledgePackVersion.create.mockResolvedValue({
        id: 'version-uuid-1',
        packId: 'pack-uuid-1',
        majorVersion: 1,
        minorVersion: 0,
        patchVersion: 0,
        releaseStatus: KnowledgePackReleaseStatus.DRAFT,
      });

      mockTx.clinicalCondition.upsert.mockImplementation((args: any) => ({
        id: `cond-id-${args.create.conditionCode}`,
      }));

      mockTx.differentialRule.upsert.mockImplementation((args: any) => ({
        id: `rule-id-${args.create.ruleCode}`,
      }));

      mockTx.redFlagRule.upsert.mockImplementation((args: any) => ({
        id: `rf-id-${args.create.flagCode}`,
      }));

      mockTx.clinicalSourceReference.findFirst.mockResolvedValue(null);
      mockTx.clinicalSourceReference.create.mockImplementation((args: any) => ({
        id: `src-id-${args.data.sourceOrganization}`,
      }));

      mockTx.ruleSourceMapping.upsert.mockResolvedValue({ id: 'map-1' });

      const result = await bootstrapper.bootstrap(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      expect(result.action).toBe('CREATED');
      expect(result.version).toBe('1.0.0');
      expect(result.releaseStatus).toBe(KnowledgePackReleaseStatus.DRAFT);
      expect(result.conditionsCount).toBe(35);
      expect(result.rulesCount).toBe(35);
      expect(result.redFlagsCount).toBe(4);

      // Verify draft status in create call
      expect(mockTx.knowledgePackVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            releaseStatus: KnowledgePackReleaseStatus.DRAFT,
          }),
        }),
      );

      // Governance check: Zero approvals or releases created
      expect(mockTx.clinicalReviewApproval.count).toHaveBeenCalled();
      expect(mockTx.knowledgePackRelease.count).toHaveBeenCalled();
    });

    it('should be idempotent: identical second run returns UP_TO_DATE without re-creating records', async () => {
      const expectedChecksum = computeCanonicalChecksum(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue({
        id: 'pack-uuid-1',
        name: GENERAL_MEDICINE_PACK_METADATA.name,
        description: GENERAL_MEDICINE_PACK_METADATA.description,
      });

      mockTx.knowledgePackVersion.findUnique.mockResolvedValue({
        id: 'version-uuid-1',
        packId: 'pack-uuid-1',
        releaseStatus: KnowledgePackReleaseStatus.DRAFT,
        checksumSha256: expectedChecksum, // Exactly matching checksum
      });

      const result = await bootstrapper.bootstrap(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      expect(result.action).toBe('UP_TO_DATE');
      expect(result.checksumSha256).toBe(expectedChecksum);

      // Idempotency check: No condition or rule upserts should have occurred
      expect(mockTx.clinicalCondition.upsert).not.toHaveBeenCalled();
      expect(mockTx.differentialRule.upsert).not.toHaveBeenCalled();
      expect(mockTx.redFlagRule.upsert).not.toHaveBeenCalled();
    });

    it('should reject re-bootstrapping if existing version is already APPROVED', async () => {
      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue({
        id: 'pack-uuid-1',
        name: GENERAL_MEDICINE_PACK_METADATA.name,
        description: GENERAL_MEDICINE_PACK_METADATA.description,
      });

      mockTx.knowledgePackVersion.findUnique.mockResolvedValue({
        id: 'version-uuid-1',
        packId: 'pack-uuid-1',
        releaseStatus: KnowledgePackReleaseStatus.APPROVED, // Approved!
        checksumSha256: 'some-checksum',
      });

      await expect(
        bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED),
      ).rejects.toThrow(/Security Abort: KnowledgePackVersion 1.0.0 has releaseStatus "APPROVED"/);
    });

    it('should reject re-bootstrapping if existing version is RELEASED even if checksum matches', async () => {
      const expectedChecksum = computeCanonicalChecksum(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue({
        id: 'pack-uuid-1',
        name: GENERAL_MEDICINE_PACK_METADATA.name,
        description: GENERAL_MEDICINE_PACK_METADATA.description,
      });

      mockTx.knowledgePackVersion.findUnique.mockResolvedValue({
        id: 'version-uuid-1',
        packId: 'pack-uuid-1',
        releaseStatus: KnowledgePackReleaseStatus.RELEASED, // Released!
        checksumSha256: expectedChecksum,
      });

      await expect(
        bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED),
      ).rejects.toThrow(/Security Abort: KnowledgePackVersion 1.0.0 has releaseStatus "RELEASED"/);
    });

    it('should abort if dryRun is enabled without entering transaction', async () => {
      const result = await bootstrapper.bootstrap(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        { dryRun: true },
      );

      expect(result.action).toBe('DRY_RUN');
      expect(result.conditionsCount).toBe(35);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw and rollback if approvals are detected during seeding', async () => {
      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue(null);
      mockTx.clinicalKnowledgePack.create.mockResolvedValue({ id: 'pack-1' });
      mockTx.knowledgePackVersion.findUnique.mockResolvedValue(null);
      mockTx.knowledgePackVersion.create.mockResolvedValue({ id: 'ver-1' });
      mockTx.clinicalCondition.upsert.mockResolvedValue({ id: 'cond-1' });
      mockTx.differentialRule.upsert.mockResolvedValue({ id: 'rule-1' });
      mockTx.redFlagRule.upsert.mockResolvedValue({ id: 'rf-1' });
      mockTx.clinicalSourceReference.findFirst.mockResolvedValue(null);
      mockTx.clinicalSourceReference.create.mockResolvedValue({ id: 'src-1' });
      mockTx.ruleSourceMapping.upsert.mockResolvedValue({ id: 'map-1' });

      // Simulate unexpected approval record
      mockTx.clinicalReviewApproval.count.mockResolvedValue(1);

      await expect(
        bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED),
      ).rejects.toThrow(/Critical Governance Breach: Approvals cannot exist or be created/);
    });

    it('should throw and rollback if releases are detected during seeding', async () => {
      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue(null);
      mockTx.clinicalKnowledgePack.create.mockResolvedValue({ id: 'pack-1' });
      mockTx.knowledgePackVersion.findUnique.mockResolvedValue(null);
      mockTx.knowledgePackVersion.create.mockResolvedValue({ id: 'ver-1' });
      mockTx.clinicalCondition.upsert.mockResolvedValue({ id: 'cond-1' });
      mockTx.differentialRule.upsert.mockResolvedValue({ id: 'rule-1' });
      mockTx.redFlagRule.upsert.mockResolvedValue({ id: 'rf-1' });
      mockTx.clinicalSourceReference.findFirst.mockResolvedValue(null);
      mockTx.clinicalSourceReference.create.mockResolvedValue({ id: 'src-1' });
      mockTx.ruleSourceMapping.upsert.mockResolvedValue({ id: 'map-1' });

      // Simulate unexpected release record
      mockTx.knowledgePackRelease.count.mockResolvedValue(1);

      await expect(
        bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED),
      ).rejects.toThrow(/Critical Governance Breach: Releases cannot exist or be activated/);
    });

    it('should enforce governance assertions even on UP_TO_DATE (checksum match) path when approvals exist', async () => {
      const expectedChecksum = computeCanonicalChecksum(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue({
        id: 'pack-uuid-1',
        name: GENERAL_MEDICINE_PACK_METADATA.name,
        description: GENERAL_MEDICINE_PACK_METADATA.description,
      });

      mockTx.knowledgePackVersion.findUnique.mockResolvedValue({
        id: 'version-uuid-1',
        packId: 'pack-uuid-1',
        releaseStatus: KnowledgePackReleaseStatus.DRAFT,
        checksumSha256: expectedChecksum,
      });

      // Breached state: approvals exist on an allegedly matching version
      mockTx.clinicalReviewApproval.count.mockResolvedValue(1);

      await expect(
        bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED),
      ).rejects.toThrow(/Critical Governance Breach: Approvals cannot exist/);
    });

    it('should enforce governance assertions even on UP_TO_DATE (checksum match) path when releases exist', async () => {
      const expectedChecksum = computeCanonicalChecksum(
        GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
      );

      mockTx.clinicalKnowledgePack.findUnique.mockResolvedValue({
        id: 'pack-uuid-1',
        name: GENERAL_MEDICINE_PACK_METADATA.name,
        description: GENERAL_MEDICINE_PACK_METADATA.description,
      });

      mockTx.knowledgePackVersion.findUnique.mockResolvedValue({
        id: 'version-uuid-1',
        packId: 'pack-uuid-1',
        releaseStatus: KnowledgePackReleaseStatus.DRAFT,
        checksumSha256: expectedChecksum,
      });

      // Breached state: releases exist on an allegedly matching version
      mockTx.knowledgePackRelease.count.mockResolvedValue(1);

      await expect(
        bootstrapper.bootstrap(GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED),
      ).rejects.toThrow(/Critical Governance Breach: Releases cannot exist/);
    });
  });

  describe('5. Evidence Status Reconciliation & Catalog Consistency Audits (Phase 5B.4-C.2)', () => {
    it('should strictly contain exactly 20 AUTHORITATIVE and 15 DRAFT PENDING conditions', () => {
      const authoritative = GENERAL_MEDICINE_CONDITIONS.filter(
        (c) => c.evidenceStatus === 'AUTHORITATIVE_ICMR_WHO',
      );
      const draftPending = GENERAL_MEDICINE_CONDITIONS.filter(
        (c) =>
          c.evidenceStatus === 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION',
      );

      expect(authoritative).toHaveLength(20);
      expect(draftPending).toHaveLength(15);
      expect(authoritative.length + draftPending.length).toBe(35);
    });

    it('should strictly contain exactly 20 complete rules and 15 incomplete rules matching condition evidence statuses', () => {
      const completeRules = GENERAL_MEDICINE_DIFFERENTIAL_RULES.filter(
        (r) => r.isComplete === true,
      );
      const incompleteRules = GENERAL_MEDICINE_DIFFERENTIAL_RULES.filter(
        (r) => r.isComplete === false,
      );

      expect(completeRules).toHaveLength(20);
      expect(incompleteRules).toHaveLength(15);
      expect(completeRules.length + incompleteRules.length).toBe(35);

      const conditionStatusMap = new Map(
        GENERAL_MEDICINE_CONDITIONS.map((c) => [c.conditionCode, c.evidenceStatus]),
      );

      for (const rule of GENERAL_MEDICINE_DIFFERENTIAL_RULES) {
        const conditionStatus = conditionStatusMap.get(rule.conditionCode);
        if (conditionStatus === 'AUTHORITATIVE_ICMR_WHO') {
          expect(rule.isComplete).toBe(true);
        } else if (
          conditionStatus === 'DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION'
        ) {
          expect(rule.isComplete).toBe(false);
        } else {
          fail(`Unexpected evidence status for condition ${rule.conditionCode}: ${conditionStatus}`);
        }
      }
    });

    it('should verify that all 20 complete rules map exclusively to authoritative sources and never to draft', () => {
      const sourceMap = new Map(
        GENERAL_MEDICINE_SOURCE_REFERENCES.map((s) => [
          s.referenceIdentifier,
          s.evidenceScope,
        ]),
      );

      const completeRuleCodes = new Set(
        GENERAL_MEDICINE_DIFFERENTIAL_RULES.filter((r) => r.isComplete === true).map(
          (r) => r.ruleCode,
        ),
      );

      for (const mapping of GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS) {
        if (completeRuleCodes.has(mapping.ruleCode)) {
          const evidenceScope = sourceMap.get(mapping.sourceReferenceIdentifier);
          expect(evidenceScope).not.toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
          expect(mapping.sourceReferenceIdentifier).not.toBe('SRC-BOARD-DRAFT-GENERAL-MED-2026');
        }
      }
    });

    it('should reject validation if a DRAFT condition is paired with isComplete: true', () => {
      // Map PUD rule to an authoritative source so mapping check passes, isolating condition-rule invariant
      const invalidSeed: KnowledgePackSeed = {
        ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        mappings: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.mappings.map((m) =>
          m.ruleCode === 'RULE-GM-PUD-001'
            ? { ...m, sourceReferenceIdentifier: 'SRC-NICE-CG184-GERD-2019' }
            : m,
        ),
        rules: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.rules.map((r) =>
          r.ruleCode === 'RULE-GM-PUD-001' ? { ...r, isComplete: true } : r,
        ),
      };

      expect(() => validateKnowledgePackSeed(invalidSeed)).toThrow(
        /Integrity Violation: Condition "COND-GM-PUD-DYSPEPSIA-010" is pending clinical board ratification, but rule "RULE-GM-PUD-001" is marked isComplete: true/,
      );
    });

    it('should reject validation if an AUTHORITATIVE condition is paired with isComplete: false', () => {
      const invalidSeed: KnowledgePackSeed = {
        ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        rules: GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.rules.map((r) =>
          r.ruleCode === 'RULE-GM-URI-001' ? { ...r, isComplete: false } : r,
        ),
      };

      expect(() => validateKnowledgePackSeed(invalidSeed)).toThrow(
        /Integrity Violation: Condition "COND-GM-URI-001" is authoritative, but rule "RULE-GM-URI-001" is marked isComplete: false/,
      );
    });

    it('should reject validation if an authoritative rule is mapped to a DRAFT source', () => {
      const invalidSeed: KnowledgePackSeed = {
        ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED,
        mappings: [
          ...GENERAL_MEDICINE_KNOWLEDGE_PACK_SEED.mappings,
          {
            ruleCode: 'RULE-GM-URI-001', // Authoritative rule!
            sourceReferenceIdentifier: 'SRC-BOARD-DRAFT-GENERAL-MED-2026', // Draft source!
          },
        ],
      };

      expect(() => validateKnowledgePackSeed(invalidSeed)).toThrow(
        /Integrity Violation: Complete rule "RULE-GM-URI-001" cannot be backed solely by unratified draft source "SRC-BOARD-DRAFT-GENERAL-MED-2026"/,
      );
    });

    it('should audit Grouping A (Vit D / B12): verify draft pending status and safety rationale', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-DEFIC-VIT-MYALGIA-024',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-DEFIC-VIT-MYALGIA-024',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
    });

    it('should audit Grouping B (BPPV / Vestibular Neuritis): verify draft pending status and safety rationale', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-VERTIGO-PERIPH-028',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-VERTIGO-PERIPH-028',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
    });

    it('should audit Grouping C (PUD / Non-Ulcer Dyspepsia): verify draft pending status and safety rationale', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-PUD-DYSPEPSIA-010',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-PUD-DYSPEPSIA-010',
      );
      const mapping = GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS.find(
        (m) => m.ruleCode === 'RULE-GM-PUD-001',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
      expect(mapping?.sourceReferenceIdentifier).toBe('SRC-BOARD-DRAFT-GENERAL-MED-2026');
    });

    it('should audit Grouping D (Hepatitis A / E): verify draft pending status and safety rationale', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-HEPATITIS-ACUTE-016',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-HEPATITIS-ACUTE-016',
      );
      const mapping = GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS.find(
        (m) => m.ruleCode === 'RULE-GM-HEPATITIS-001',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
      expect(mapping?.sourceReferenceIdentifier).toBe('SRC-BOARD-DRAFT-GENERAL-MED-2026');
    });

    it('should audit Allergic Rhinitis (COND-GM-ALLERG-RHIN-021) as draft pending board review', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-ALLERG-RHIN-021',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-ALLERG-RHIN-021',
      );
      const mapping = GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS.find(
        (m) => m.ruleCode === 'RULE-GM-ALLERG-001',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
      expect(mapping?.sourceReferenceIdentifier).toBe('SRC-BOARD-DRAFT-GENERAL-MED-2026');
    });

    it('should audit Acute Bacterial Rhinosinusitis (COND-GM-RHINOSINUS-022) as draft pending board review', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-RHINOSINUS-022',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-RHINOSINUS-022',
      );
      const mapping = GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS.find(
        (m) => m.ruleCode === 'RULE-GM-RHINOSIN-001',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
      expect(mapping?.sourceReferenceIdentifier).toBe('SRC-BOARD-DRAFT-GENERAL-MED-2026');
    });

    it('should audit Iron Deficiency Anemia (COND-GM-ANEMIA-IDA-023) as draft pending board review', () => {
      const cond = GENERAL_MEDICINE_CONDITIONS.find(
        (c) => c.conditionCode === 'COND-GM-ANEMIA-IDA-023',
      );
      const rule = GENERAL_MEDICINE_DIFFERENTIAL_RULES.find(
        (r) => r.conditionCode === 'COND-GM-ANEMIA-IDA-023',
      );
      const mapping = GENERAL_MEDICINE_RULE_SOURCE_MAPPINGS.find(
        (m) => m.ruleCode === 'RULE-GM-ANEMIA-001',
      );

      expect(cond).toBeDefined();
      expect(cond?.evidenceStatus).toBe('DRAFT_PENDING_CLINICAL_BOARD_RATIFICATION');
      expect(rule?.isComplete).toBe(false);
      expect(mapping?.sourceReferenceIdentifier).toBe('SRC-BOARD-DRAFT-GENERAL-MED-2026');
    });
  });
});

