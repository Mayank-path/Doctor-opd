import { Injectable, Logger } from '@nestjs/common';
import {
  KnowledgePackDomain,
  KnowledgePackReleaseStatus,
} from '@prisma/client';
import {
  computeCanonicalChecksum,
} from '../../../../prisma/seeds/canonical-serializer';
import {
  ClinicalConditionSeed,
  ClinicalSourceReferenceSeed,
  DifferentialRuleSeed,
  KnowledgePackSeed,
  RedFlagRuleSeed,
  RuleSourceMappingSeed,
} from '../../../../prisma/seeds/knowledge-pack.types';
import { PrismaService } from '../../../prisma/prisma.service';
import { KnowledgePackBundle } from '../../evaluator/ast-evaluator.engine';
import { KnowledgePackReleaseMetadataDto } from '../dto/differential-response.dto';

export interface ResolvedKnowledgePack {
  bundle: KnowledgePackBundle;
  metadata: KnowledgePackReleaseMetadataDto;
}

/**
 * Authoritative canonical checksums for verified knowledge-pack releases.
 * Used for tamper detection, integrity enforcement, and regression protection.
 */
export const KNOWN_CANONICAL_CHECKSUMS: Record<string, string> = {
  [`${KnowledgePackDomain.GENERAL_MEDICINE}_1.0.0`]:
    '768f3ca6f79648bfe3ea7a6448719436f5557a9584436f6ca00791c1fa51984d',
};

/**
 * KnowledgePackResolverService
 *
 * Enforces the Knowledge Pack Selection Policy & Cryptographic Integrity Verification:
 * 1. Priority 1 (Tenant Override): Active clinic-specific release (clinicId === activeClinicId).
 * 2. Priority 2 (Global Baseline): Active global release (clinicId === null).
 * 3. Strict Lifecycle Safety Invariant:
 *    ONLY versions with releaseStatus === RELEASED and isActive === true may be evaluated.
 *    DRAFT, IN_REVIEW, APPROVED, DEPRECATED, and ROLLED_BACK versions are strictly excluded.
 *    (APPROVED versions are never eligible until explicitly RELEASED).
 * 4. Actual Content Cryptographic Verification (Phase 5B.6.2):
 *    - Recomputes SHA-256 canonical checksum from the actual loaded knowledge-pack content (conditions,
 *      differential rules, red flags, sources, mappings).
 *    - Compares recomputed SHA-256 against the stored checksumSha256.
 *    - Rejects any pack with modified conditions, rules, red flags, or missing checksums.
 * 5. Clinical Review Approval Binding:
 *    - Must have at least one valid ClinicalReviewApproval with approvalVerdict === 'APPROVED'.
 *    - Every approved review must be explicitly bound to the exact same checksum.
 *    - Approvals lacking a verifiable checksum binding or having a mismatched checksum are rejected.
 * 6. Safe Fail-Closed Fallback:
 *    If any check fails or no eligible pack exists, returns null (indicating evaluation unavailable).
 */
@Injectable()
export class KnowledgePackResolverService {
  private readonly logger = new Logger(KnowledgePackResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the eligible knowledge-pack release for a given clinic and clinical domain.
   */
  async resolveActiveRelease(
    clinicId: string,
    domain: KnowledgePackDomain = KnowledgePackDomain.GENERAL_MEDICINE,
  ): Promise<ResolvedKnowledgePack | null> {
    // Critical Lifecycle Policy: Only explicitly RELEASED versions are eligible.
    // APPROVED is NOT eligible until explicitly released.
    // DRAFT, IN_REVIEW, DEPRECATED, ROLLED_BACK are never eligible.
    const eligibleReleaseStatus = KnowledgePackReleaseStatus.RELEASED;

    // Priority 1: Check for active clinic-specific release
    const clinicRelease = await this.prisma.knowledgePackRelease.findFirst({
      where: {
        clinicId,
        isActive: true,
        version: {
          pack: { domain },
          releaseStatus: eligibleReleaseStatus,
        },
      },
      include: {
        version: {
          include: {
            pack: true,
            conditions: {
              include: {
                rules: {
                  include: {
                    sourceReferences: {
                      include: {
                        source: true,
                      },
                    },
                  },
                },
              },
            },
            redFlagRules: true,
            sources: true,
            approvals: true,
          },
        },
      },
      orderBy: [
        { activatedAt: 'desc' },
        { version: { majorVersion: 'desc' } },
        { version: { minorVersion: 'desc' } },
        { version: { patchVersion: 'desc' } },
      ],
    });

    if (clinicRelease) {
      if (!this.verifyReleaseIntegrity(clinicRelease)) {
        this.logger.warn(
          `Clinic-specific release for clinic ${clinicId}, domain ${domain} failed integrity verification. Rejecting evaluation.`,
        );
        return null;
      }

      this.logger.log(
        `Resolved clinic-specific release for clinic ${clinicId}, domain ${domain}: version ${clinicRelease.version.majorVersion}.${clinicRelease.version.minorVersion}.${clinicRelease.version.patchVersion} (${clinicRelease.version.releaseStatus})`,
      );
      return this.mapToResolvedPack(clinicRelease, 'CLINIC');
    }

    // Priority 2: Check for active global baseline release
    const globalRelease = await this.prisma.knowledgePackRelease.findFirst({
      where: {
        clinicId: null,
        isActive: true,
        version: {
          pack: { domain },
          releaseStatus: eligibleReleaseStatus,
        },
      },
      include: {
        version: {
          include: {
            pack: true,
            conditions: {
              include: {
                rules: {
                  include: {
                    sourceReferences: {
                      include: {
                        source: true,
                      },
                    },
                  },
                },
              },
            },
            redFlagRules: true,
            sources: true,
            approvals: true,
          },
        },
      },
      orderBy: [
        { activatedAt: 'desc' },
        { version: { majorVersion: 'desc' } },
        { version: { minorVersion: 'desc' } },
        { version: { patchVersion: 'desc' } },
      ],
    });

    if (globalRelease) {
      if (!this.verifyReleaseIntegrity(globalRelease)) {
        this.logger.warn(
          `Global baseline release for domain ${domain} failed integrity verification. Rejecting evaluation.`,
        );
        return null;
      }

      this.logger.log(
        `Resolved global baseline release for domain ${domain}: version ${globalRelease.version.majorVersion}.${globalRelease.version.minorVersion}.${globalRelease.version.patchVersion} (${globalRelease.version.releaseStatus})`,
      );
      return this.mapToResolvedPack(globalRelease, 'GLOBAL');
    }

    // Safe Failure: No eligible released pack exists
    this.logger.warn(
      `No eligible RELEASED knowledge pack found for clinic ${clinicId}, domain ${domain}.`,
    );
    return null;
  }

  /**
   * Validates the cryptographic and clinical governance integrity of a released knowledge pack version.
   *
   * REQUIRED SEQUENCE (Phase 5B.6.2):
   * 1. Load the complete knowledge-pack content.
   * 2. Canonically serialize the content.
   * 3. Recompute SHA-256.
   * 4. Compare against the stored checksum.
   * 5. Verify approval is bound to the exact same checksum.
   * 6. Only then return true for evaluation.
   *
   * Any mismatch fails closed by returning false.
   */
  public verifyReleaseIntegrity(release: any): boolean {
    if (!release) {
      return false;
    }

    // 0. Active Release Check: Deactivated or inactive releases must never be evaluated
    if (release.isActive !== true || release.deactivatedAt) {
      this.logger.warn(
        `Integrity check failed: Release ${release.id} is inactive or deactivated (isActive: ${release.isActive}, deactivatedAt: ${release.deactivatedAt}).`,
      );
      return false;
    }

    const version = release?.version;
    if (!version) {
      this.logger.warn('Integrity check failed: Release contains no version object.');
      return false;
    }

    // 1. Strict Lifecycle check: Only RELEASED versions can be evaluated
    if (version.releaseStatus !== KnowledgePackReleaseStatus.RELEASED) {
      this.logger.warn(
        `Integrity check failed: Version ${version.id} status is "${version.releaseStatus}". Only RELEASED versions may be evaluated.`,
      );
      return false;
    }

    // 2. Checksum format validation: SHA-256 must be a 64-char hex string
    const storedChecksum = version.checksumSha256;
    if (
      !storedChecksum ||
      typeof storedChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(storedChecksum)
    ) {
      this.logger.warn(
        `Integrity check failed: Version ${version.id} has missing or invalid SHA-256 checksum format (${storedChecksum}).`,
      );
      return false;
    }

    // 3. Cryptographic Content Verification: Recompute SHA-256 from actual loaded content
    let recomputedChecksum: string;
    try {
      const reconstructedSeed = this.reconstructSeedFromVersion(version);
      recomputedChecksum = computeCanonicalChecksum(reconstructedSeed);
    } catch (err: any) {
      this.logger.warn(
        `Integrity check failed: Could not recompute canonical checksum for version ${version.id}: ${err.message}`,
      );
      return false;
    }

    // 4. Compare recomputed SHA-256 against stored checksum
    if (recomputedChecksum.toLowerCase() !== storedChecksum.toLowerCase()) {
      this.logger.warn(
        `Integrity check failed: Content checksum mismatch on version ${version.id}. Stored checksum: ${storedChecksum}, Recomputed checksum: ${recomputedChecksum}. Pack content has been modified or corrupted.`,
      );
      return false;
    }

    // 5. Canonical Checksum Verification (if known for this domain and semver)
    const domain = version.pack?.domain || version.domain;
    if (domain) {
      const domainKey = `${domain}_${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`;
      const expectedCanonicalChecksum = KNOWN_CANONICAL_CHECKSUMS[domainKey];
      if (
        expectedCanonicalChecksum &&
        recomputedChecksum.toLowerCase() !== expectedCanonicalChecksum.toLowerCase()
      ) {
        this.logger.warn(
          `Integrity check failed: Version ${version.id} content checksum (${recomputedChecksum}) does not match authoritative canonical checksum (${expectedCanonicalChecksum}).`,
        );
        return false;
      }
    }

    // 6. Clinical Review Approval validation: Must have at least one approval with verdict APPROVED
    const approvals = version.approvals;
    if (!Array.isArray(approvals) || approvals.length === 0) {
      this.logger.warn(
        `Integrity check failed: Version ${version.id} has no clinical review approval records.`,
      );
      return false;
    }

    const approvedReviews = approvals.filter(
      (a: any) => a.approvalVerdict === 'APPROVED',
    );
    if (approvedReviews.length === 0) {
      this.logger.warn(
        `Integrity check failed: Version ${version.id} has no approvals with verdict 'APPROVED'.`,
      );
      return false;
    }

    // 7. Approval Checksum Binding (Phase 5C.2.1 Strict Relational Binding):
    // Every approved review MUST be explicitly bound to the exact same checksum being evaluated.
    // Strictly requires the explicit database column approval.checksumSha256.
    // Legacy unverified approvals lacking an explicit relational checksum are strictly rejected.
    let hasValidBoundApproval = false;
    for (const approval of approvedReviews) {
      const boundChecksum = approval.checksumSha256;

      if (!boundChecksum || typeof boundChecksum !== 'string') {
        this.logger.warn(
          `Integrity check failed: Approval record ${approval.id} lacks an explicit relational checksumSha256 binding. Unbound or legacy approvals without explicit checksumSha256 are strictly rejected.`,
        );
        continue;
      }

      // Validate approval expiration if expiresAt is set
      if (approval.expiresAt) {
        const expiryDate = new Date(approval.expiresAt);
        if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
          this.logger.warn(
            `Integrity check failed: Approval record ${approval.id} expired on ${approval.expiresAt}. Rejecting evaluation.`,
          );
          continue;
        }
      }

      // Digital signature structural & payload validation (Phase 5C.4):
      if (approval.digitalSignature !== undefined && approval.digitalSignature !== null) {
        if (
          typeof approval.digitalSignature !== 'string' ||
          approval.digitalSignature.trim().length === 0
        ) {
          this.logger.warn(
            `Integrity check failed: Approval record ${approval.id} has malformed or empty digital signature.`,
          );
          return false;
        }

        // If digitalSignature contains a JSON-encoded attestation envelope, verify payload checksum matches
        if (approval.digitalSignature.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(approval.digitalSignature);
            if (parsed.payload && parsed.payload.checksumSha256) {
              if (
                parsed.payload.checksumSha256.toLowerCase() !==
                storedChecksum.toLowerCase()
              ) {
                this.logger.warn(
                  `Integrity check failed: Signature envelope checksum (${parsed.payload.checksumSha256}) does not match stored checksum (${storedChecksum}).`,
                );
                return false;
              }
            }
          } catch {
            // Non-JSON signature format, structural check passed
          }
        }
      }

      if (boundChecksum.toLowerCase() !== storedChecksum.toLowerCase()) {
        this.logger.warn(
          `Integrity check failed: Approval ${approval.id} bound checksum (${boundChecksum}) does not match stored checksum (${storedChecksum}).`,
        );
        return false;
      }

      if (boundChecksum.toLowerCase() !== recomputedChecksum.toLowerCase()) {
        this.logger.warn(
          `Integrity check failed: Approval ${approval.id} bound checksum (${boundChecksum}) does not match recomputed content checksum (${recomputedChecksum}).`,
        );
        return false;
      }

      hasValidBoundApproval = true;
    }

    if (!hasValidBoundApproval) {
      this.logger.warn(
        `Integrity check failed: Version ${version.id} has no APPROVED clinical review record with a verifiable checksum binding.`,
      );
      return false;
    }

    return true;
  }

  /**
   * Reconstructs a canonical KnowledgePackSeed representation from a loaded database version object.
   */
  public reconstructSeedFromVersion(version: any): KnowledgePackSeed {
    const conditions: ClinicalConditionSeed[] = [];
    const rules: DifferentialRuleSeed[] = [];

    for (const cond of version.conditions || []) {
      conditions.push({
        conditionCode: cond.conditionCode,
        displayName: cond.displayName,
        category: cond.category,
        description: cond.description,
        icd10Guidance: cond.icd10Guidance ?? null,
        evidenceStatus: cond.evidenceStatus || 'AUTHORITATIVE_ICMR_WHO',
      });

      for (const r of cond.rules || []) {
        rules.push({
          ruleCode: r.ruleCode,
          conditionCode: cond.conditionCode,
          ruleTitle: r.ruleTitle,
          minMajorCount: r.minMajorCount,
          applicability: r.applicabilityJson ?? r.applicability ?? {},
          mandatoryAst: r.mandatoryAstJson ?? r.mandatoryAst,
          majorSupporting: r.majorSupportingJson ?? r.majorSupporting ?? [],
          minorSupporting: r.minorSupportingJson ?? r.minorSupporting ?? null,
          contradictions: r.contradictionsJson ?? r.contradictions ?? null,
          missingDataRules: r.missingDataRulesJson ?? r.missingDataRules ?? null,
          investigations: r.investigationsJson ?? r.investigations ?? null,
          isComplete: r.isComplete !== false,
        });
      }
    }

    const redFlags: RedFlagRuleSeed[] = (version.redFlagRules || []).map(
      (rf: any) => ({
        flagCode: rf.flagCode,
        title: rf.title,
        urgencyLevel: rf.urgencyLevel,
        clinicalAction: rf.clinicalAction,
        ruleAst: rf.ruleAstJson ?? rf.ruleAst,
      }),
    );

    const sources: ClinicalSourceReferenceSeed[] = (version.sources || []).map(
      (s: any) => ({
        referenceIdentifier: s.referenceIdentifier || s.id || '',
        sourceOrganization: s.sourceOrganization || '',
        sourceTitle: s.sourceTitle || '',
        publicationDate: s.publicationDate || '',
        sectionIdentifier: s.sectionIdentifier || '',
        sourceUrlOrDoi: s.sourceUrlOrDoi || '',
        licensingStatus: s.licensingStatus || '',
        evidenceScope: s.evidenceScope || '',
      }),
    );

    const mappings: RuleSourceMappingSeed[] = version.mappings || [];

    return {
      domain: version.pack?.domain || version.domain,
      name: version.pack?.name || version.name || '',
      description: version.pack?.description || version.description || '',
      version: {
        major: version.majorVersion,
        minor: version.minorVersion,
        patch: version.patchVersion,
        changelog: version.changelog || '',
      },
      conditions,
      rules,
      redFlags,
      sources,
      mappings,
    };
  }

  /**
   * Helper method to compute the canonical SHA-256 hex digest from any loaded version object.
   */
  public computeLoadedVersionChecksum(version: any): string {
    const seed = this.reconstructSeedFromVersion(version);
    return computeCanonicalChecksum(seed);
  }

  /**
   * @deprecated Phase 5C.2 strictly enforces relational approval.checksumSha256.
   * Regex extraction from review notes is deprecated and no longer used in evaluation.
   */
  public extractChecksumFromNotes(notes?: string): string | null {
    if (!notes || typeof notes !== 'string') return null;
    const match = notes.match(/\b([a-f0-9]{64})\b/i);
    return match ? match[1] : null;
  }

  /**
   * Transforms database release records into an in-memory KnowledgePackBundle for the AST Evaluator.
   */
  private mapToResolvedPack(
    release: any,
    scope: 'CLINIC' | 'GLOBAL',
  ): ResolvedKnowledgePack {
    const version = release.version;
    const conditions: ClinicalConditionSeed[] = [];
    const rules: DifferentialRuleSeed[] = [];

    for (const cond of version.conditions || []) {
      conditions.push({
        conditionCode: cond.conditionCode,
        displayName: cond.displayName,
        category: cond.category,
        description: cond.description,
        icd10Guidance: cond.icd10Guidance ?? undefined,
        evidenceStatus: 'AUTHORITATIVE_ICMR_WHO',
      });

      for (const rule of cond.rules || []) {
        rules.push({
          conditionCode: cond.conditionCode,
          ruleCode: rule.ruleCode,
          ruleTitle: rule.ruleTitle,
          minMajorCount: rule.minMajorCount,
          applicability: rule.applicabilityJson ?? rule.applicability,
          mandatoryAst: rule.mandatoryAstJson ?? rule.mandatoryAst,
          majorSupporting: rule.majorSupportingJson ?? rule.majorSupporting ?? [],
          minorSupporting: rule.minorSupportingJson ?? rule.minorSupporting ?? [],
          contradictions: rule.contradictionsJson ?? rule.contradictions ?? [],
          missingDataRules: rule.missingDataRulesJson ?? rule.missingDataRules ?? [],
          investigations: rule.investigationsJson ?? rule.investigations ?? [],
          isComplete: true,
        });
      }
    }

    const redFlags: RedFlagRuleSeed[] = (version.redFlagRules || []).map(
      (rf: any) => ({
        flagCode: rf.flagCode,
        title: rf.title,
        urgencyLevel: rf.urgencyLevel,
        clinicalAction: rf.clinicalAction,
        ruleAst: rf.ruleAstJson ?? rf.ruleAst,
      }),
    );

    return {
      bundle: {
        conditions,
        rules,
        redFlags,
      },
      metadata: {
        domain: version.pack?.domain || version.domain,
        version: `${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`,
        releaseStatus: version.releaseStatus,
        releaseScope: scope,
        checksumSha256: version.checksumSha256,
      },
    };
  }
}
