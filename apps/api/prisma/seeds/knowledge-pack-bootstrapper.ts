import { Prisma, PrismaClient } from '@prisma/client';
import {
  computeCanonicalChecksum,
  validateKnowledgePackSeed,
} from './canonical-serializer';
import {
  KnowledgePackReleaseStatus,
  KnowledgePackSeed,
} from './knowledge-pack.types';

export interface BootstrapResult {
  packId: string;
  versionId: string;
  domain: string;
  version: string;
  releaseStatus: KnowledgePackReleaseStatus;
  checksumSha256: string;
  action: 'CREATED' | 'UPDATED' | 'UP_TO_DATE' | 'DRY_RUN';
  conditionsCount: number;
  rulesCount: number;
  redFlagsCount: number;
  sourcesCount: number;
  mappingsCount: number;
}

export interface BootstrapOptions {
  dryRun?: boolean;
}

/**
 * Deterministic, idempotent knowledge-pack bootstrapper.
 *
 * Clinical Safety Guarantees:
 * - Every version is strictly created with releaseStatus = DRAFT.
 * - Non-draft (APPROVED / RELEASED) versions are immutable; attempts to re-bootstrap abort immediately.
 * - Zero clinical review approvals are created or fabricated.
 * - Zero knowledge pack releases are activated.
 * - Complete transactional rollback on any constraint violation.
 */
export class KnowledgePackBootstrapper {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Bootstraps a knowledge pack seed bundle in a single atomic database transaction.
   */
  async bootstrap(
    seed: KnowledgePackSeed,
    options: BootstrapOptions = {},
  ): Promise<BootstrapResult> {
    // 1. Structural schema & AST invariant validation
    validateKnowledgePackSeed(seed);

    // 2. Compute canonical SHA-256 checksum
    const checksumSha256 = computeCanonicalChecksum(seed);
    const versionStr = `${seed.version.major}.${seed.version.minor}.${seed.version.patch}`;

    if (options.dryRun) {
      return {
        packId: 'dry-run-pack-id',
        versionId: 'dry-run-version-id',
        domain: seed.domain,
        version: versionStr,
        releaseStatus: KnowledgePackReleaseStatus.DRAFT,
        checksumSha256,
        action: 'DRY_RUN',
        conditionsCount: seed.conditions.length,
        rulesCount: seed.rules.length,
        redFlagsCount: seed.redFlags.length,
        sourcesCount: seed.sources.length,
        mappingsCount: seed.mappings.length,
      };
    }

    return await this.prisma.$transaction(
      async (tx) => {
        return await this.executeBootstrap(tx, seed, checksumSha256, versionStr);
      },
      {
        maxWait: 15000,
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Internal transactional execution logic.
   */
  private async executeBootstrap(
    tx: Prisma.TransactionClient,
    seed: KnowledgePackSeed,
    checksumSha256: string,
    versionStr: string,
  ): Promise<BootstrapResult> {
    // 1. Find or create ClinicalKnowledgePack
    let pack = await tx.clinicalKnowledgePack.findUnique({
      where: { domain: seed.domain },
    });

    if (!pack) {
      pack = await tx.clinicalKnowledgePack.create({
        data: {
          domain: seed.domain,
          name: seed.name,
          description: seed.description,
        },
      });
    } else if (
      pack.name !== seed.name ||
      pack.description !== seed.description
    ) {
      pack = await tx.clinicalKnowledgePack.update({
        where: { id: pack.id },
        data: {
          name: seed.name,
          description: seed.description,
        },
      });
    }

    // 2. Check existing KnowledgePackVersion
    const existingVersion = await tx.knowledgePackVersion.findUnique({
      where: {
        packId_majorVersion_minorVersion_patchVersion: {
          packId: pack.id,
          majorVersion: seed.version.major,
          minorVersion: seed.version.minor,
          patchVersion: seed.version.patch,
        },
      },
    });

    let action: 'CREATED' | 'UPDATED' | 'UP_TO_DATE' = 'CREATED';
    let versionId: string;

    if (existingVersion) {
      // Immutability check: Disallow mutating non-draft versions
      if (existingVersion.releaseStatus !== KnowledgePackReleaseStatus.DRAFT) {
        throw new Error(
          `Security Abort: KnowledgePackVersion ${versionStr} has releaseStatus "${existingVersion.releaseStatus}". Only DRAFT versions can be bootstrapped or updated.`,
        );
      }

      // Idempotency check: If checksum matches identically, verify governance invariants and return
      if (existingVersion.checksumSha256 === checksumSha256) {
        await this.assertGovernanceInvariants(tx, existingVersion.id);
        return {
          packId: pack.id,
          versionId: existingVersion.id,
          domain: seed.domain,
          version: versionStr,
          releaseStatus: existingVersion.releaseStatus,
          checksumSha256,
          action: 'UP_TO_DATE',
          conditionsCount: seed.conditions.length,
          rulesCount: seed.rules.length,
          redFlagsCount: seed.redFlags.length,
          sourcesCount: seed.sources.length,
          mappingsCount: seed.mappings.length,
        };
      }

      // Update existing draft version metadata
      const updatedVersion = await tx.knowledgePackVersion.update({
        where: { id: existingVersion.id },
        data: {
          changelog: seed.version.changelog,
          checksumSha256,
        },
      });
      versionId = updatedVersion.id;
      action = 'UPDATED';
    } else {
      // Create fresh DRAFT version
      const newVersion = await tx.knowledgePackVersion.create({
        data: {
          packId: pack.id,
          majorVersion: seed.version.major,
          minorVersion: seed.version.minor,
          patchVersion: seed.version.patch,
          releaseStatus: KnowledgePackReleaseStatus.DRAFT,
          changelog: seed.version.changelog,
          checksumSha256,
        },
      });
      versionId = newVersion.id;
      action = 'CREATED';
    }

    // 3. Upsert Clinical Conditions
    const conditionIdMap = new Map<string, string>();
    for (const cond of seed.conditions) {
      const conditionRecord = await tx.clinicalCondition.upsert({
        where: {
          versionId_conditionCode: {
            versionId,
            conditionCode: cond.conditionCode,
          },
        },
        create: {
          versionId,
          conditionCode: cond.conditionCode,
          displayName: cond.displayName,
          description: cond.description,
          category: cond.category,
          icd10Guidance: cond.icd10Guidance || null,
        },
        update: {
          displayName: cond.displayName,
          description: cond.description,
          category: cond.category,
          icd10Guidance: cond.icd10Guidance || null,
        },
      });
      conditionIdMap.set(cond.conditionCode, conditionRecord.id);
    }

    // 4. Upsert Differential Rules
    const ruleIdMap = new Map<string, string>();
    for (const rule of seed.rules) {
      const conditionId = conditionIdMap.get(rule.conditionCode);
      if (!conditionId) {
        throw new Error(
          `Internal Error: Condition ID not found for code "${rule.conditionCode}"`,
        );
      }

      const ruleRecord = await tx.differentialRule.upsert({
        where: {
          conditionId_ruleCode: {
            conditionId,
            ruleCode: rule.ruleCode,
          },
        },
        create: {
          conditionId,
          ruleCode: rule.ruleCode,
          ruleTitle: rule.ruleTitle,
          minMajorCount: rule.minMajorCount,
          applicabilityJson: rule.applicability as any,
          mandatoryAstJson: rule.mandatoryAst as any,
          majorSupportingJson: rule.majorSupporting as any,
          minorSupportingJson: (rule.minorSupporting || Prisma.JsonNull) as any,
          contradictionsJson: (rule.contradictions || Prisma.JsonNull) as any,
          missingDataRulesJson:
            (rule.missingDataRules || Prisma.JsonNull) as any,
          investigationsJson: (rule.investigations || Prisma.JsonNull) as any,
        },
        update: {
          ruleTitle: rule.ruleTitle,
          minMajorCount: rule.minMajorCount,
          applicabilityJson: rule.applicability as any,
          mandatoryAstJson: rule.mandatoryAst as any,
          majorSupportingJson: rule.majorSupporting as any,
          minorSupportingJson: (rule.minorSupporting || Prisma.JsonNull) as any,
          contradictionsJson: (rule.contradictions || Prisma.JsonNull) as any,
          missingDataRulesJson:
            (rule.missingDataRules || Prisma.JsonNull) as any,
          investigationsJson: (rule.investigations || Prisma.JsonNull) as any,
        },
      });
      ruleIdMap.set(rule.ruleCode, ruleRecord.id);
    }

    // 5. Upsert Red Flag Rules
    for (const rf of seed.redFlags) {
      await tx.redFlagRule.upsert({
        where: {
          versionId_flagCode: {
            versionId,
            flagCode: rf.flagCode,
          },
        },
        create: {
          versionId,
          flagCode: rf.flagCode,
          title: rf.title,
          urgencyLevel: rf.urgencyLevel,
          clinicalAction: rf.clinicalAction,
          ruleAstJson: rf.ruleAst as any,
        },
        update: {
          title: rf.title,
          urgencyLevel: rf.urgencyLevel,
          clinicalAction: rf.clinicalAction,
          ruleAstJson: rf.ruleAst as any,
        },
      });
    }

    // 6. Upsert Clinical Source References
    const sourceIdMap = new Map<string, string>();
    for (const src of seed.sources) {
      // Find existing source by unique content in this version
      let sourceRecord = await tx.clinicalSourceReference.findFirst({
        where: {
          versionId,
          sourceOrganization: src.sourceOrganization,
          sourceTitle: src.sourceTitle,
          sectionIdentifier: src.sectionIdentifier,
        },
      });

      if (!sourceRecord) {
        sourceRecord = await tx.clinicalSourceReference.create({
          data: {
            versionId,
            sourceOrganization: src.sourceOrganization,
            sourceTitle: src.sourceTitle,
            publicationDate: src.publicationDate,
            sectionIdentifier: src.sectionIdentifier,
            sourceUrlOrDoi: src.sourceUrlOrDoi,
            licensingStatus: src.licensingStatus,
            evidenceScope: src.evidenceScope,
          },
        });
      } else {
        sourceRecord = await tx.clinicalSourceReference.update({
          where: { id: sourceRecord.id },
          data: {
            publicationDate: src.publicationDate,
            sourceUrlOrDoi: src.sourceUrlOrDoi,
            licensingStatus: src.licensingStatus,
            evidenceScope: src.evidenceScope,
          },
        });
      }
      sourceIdMap.set(src.referenceIdentifier, sourceRecord.id);
    }

    // 7. Upsert Rule-Source Mappings
    for (const mapping of seed.mappings) {
      const ruleId = ruleIdMap.get(mapping.ruleCode);
      const sourceId = sourceIdMap.get(mapping.sourceReferenceIdentifier);

      if (!ruleId || !sourceId) {
        throw new Error(
          `Mapping error: ruleId (${ruleId}) or sourceId (${sourceId}) missing for mapping ${mapping.ruleCode} -> ${mapping.sourceReferenceIdentifier}`,
        );
      }

      await tx.ruleSourceMapping.upsert({
        where: {
          ruleId_sourceId: {
            ruleId,
            sourceId,
          },
        },
        create: {
          ruleId,
          sourceId,
        },
        update: {},
      });
    }

    // 8. Governance Integrity Assertions
    // Strictly verify that no approvals or releases exist for this version
    await this.assertGovernanceInvariants(tx, versionId);

    return {
      packId: pack.id,
      versionId,
      domain: seed.domain,
      version: versionStr,
      releaseStatus: KnowledgePackReleaseStatus.DRAFT,
      checksumSha256,
      action,
      conditionsCount: seed.conditions.length,
      rulesCount: seed.rules.length,
      redFlagsCount: seed.redFlags.length,
      sourcesCount: seed.sources.length,
      mappingsCount: seed.mappings.length,
    };
  }

  /**
   * Governance Invariant: A seed execution or idempotency verification must NEVER
   * encounter or allow clinical approvals or releases on a draft version.
   */
  private async assertGovernanceInvariants(
    tx: Prisma.TransactionClient,
    versionId: string,
  ): Promise<void> {
    const approvalCount = await tx.clinicalReviewApproval.count({
      where: { versionId },
    });
    if (approvalCount > 0) {
      throw new Error(
        'Critical Governance Breach: Approvals cannot exist or be created during knowledge pack seeding.',
      );
    }

    const releaseCount = await tx.knowledgePackRelease.count({
      where: { versionId },
    });
    if (releaseCount > 0) {
      throw new Error(
        'Critical Governance Breach: Releases cannot exist or be activated during knowledge pack seeding.',
      );
    }
  }
}

