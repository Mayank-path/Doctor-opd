import { RedFlagRuleSeed } from '../../../prisma/seeds/knowledge-pack.types';
import {
  ClinicalEvaluationContext,
  InfectionSuspicionState,
  NodeEvaluationDetail,
  PredicateEvaluationResult,
  RedFlagEvaluationResult,
} from './ast-evaluator.types';
import { evaluateAst } from './ast-traversal';

export const RED_FLAG_DISCLAIMER =
  'High-acuity emergency triage alert for clinician review. Does not constitute a prescription, medication order, dosage directive, or autonomous treatment recommendation.';

/**
 * Determines whether clinician-documented suspected infection is explicitly established.
 * STRICT CLINICAL GOVERNANCE:
 * Only explicitly documented SUSPECTED infection state enables adult qSOFA evaluation.
 * Fever, chills, body temperature thresholds, and infection-related concept IDs are
 * supporting evidence only and MUST NEVER independently establish clinician-documented
 * suspected infection. Broad substring matching is strictly prohibited.
 */
export function hasDocumentedSuspectedInfection(context: ClinicalEvaluationContext): boolean {
  return context.infectionSuspicion === InfectionSuspicionState.SUSPECTED;
}

/**
 * Pure, deterministic evaluator for emergency red-flag rules with clinical safety escalation governance.
 * Strictly eradicates autonomous procedural/therapeutic commands, enforcing neutral escalation language.
 */
export function evaluateRedFlags(
  redFlagRules: RedFlagRuleSeed[],
  context: ClinicalEvaluationContext,
): RedFlagEvaluationResult[] {
  if (!Array.isArray(redFlagRules)) {
    return [];
  }

  const results: RedFlagEvaluationResult[] = [];

  for (const rule of redFlagRules) {
    let detail: NodeEvaluationDetail;

    // =========================================================================
    // 1. RF-QSOFA-SEPSIS: Pediatric Context, Age Validation & Suspected Infection Gating
    // =========================================================================
    if (rule.flagCode === 'RF-QSOFA-SEPSIS') {
      const age = context.demographics?.ageYears;
      const isAdult = typeof age === 'number' && !Number.isNaN(age) && age >= 18 && age <= 130;
      const isPediatric = typeof age === 'number' && !Number.isNaN(age) && age >= 0 && age < 18;
      const isAgeMissingOrInvalid = !isAdult && !isPediatric;

      // 1.1 Pediatric applicability safety: adult qSOFA logic is NEVER applied to pediatric patients (< 18 years)
      if (isPediatric) {
        detail = {
          nodeType: 'AT_LEAST_N',
          result: PredicateEvaluationResult.FALSE,
          satisfied: false,
          explanation:
            'Adult qSOFA criteria are clinically invalid in pediatric patients (< 18 years). Normal pediatric vital signs differ by age.',
          children: [],
        };

        results.push({
          flagCode: rule.flagCode,
          title: 'Potential Sepsis Alert (qSOFA Inapplicable — Pediatric Context)',
          urgencyLevel: rule.urgencyLevel,
          triggered: false,
          clinicalAction:
            'Clinical Escalation Advisory: Adult qSOFA criteria (RR >= 22, SBP <= 100) are clinically invalid in pediatric patients (< 18 years). Normal pediatric vital signs vary by age. Sepsis evaluation in children requires age-stratified criteria (e.g. PEWS, Phoenix criteria) and prompt attending pediatrician or physician bedside assessment. Adult qSOFA screening logic was not applied.',
          evaluatedAstDetail: detail,
          sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
          disclaimer: RED_FLAG_DISCLAIMER,
          isProvisional: true,
          provisionalWarning:
            'PEDIATRIC SAFETY NOTICE: Adult qSOFA criteria are not applicable to pediatric patients (< 18 years). Normal vital sign ranges vary by age. Pediatric sepsis screening requires age-stratified criteria.',
          clinicalContextNotice:
            'Pediatric Context: Patient age is under 18 years. Adult qSOFA criteria are clinically invalid.',
          infectionSuspicionState: context.infectionSuspicion,
          gatingExplanation:
            'Adult qSOFA criteria are clinically invalid in pediatric patients (< 18 years). Sepsis evaluation in children requires age-stratified criteria (e.g. PEWS, Phoenix criteria).',
          supportingInfectionEvidence: context.supportingInfectionEvidence,
        });
        continue;
      }

      // 1.2 Missing or invalid age safety: do not assume adult applicability
      if (isAgeMissingOrInvalid) {
        detail = {
          nodeType: 'AT_LEAST_N',
          result: PredicateEvaluationResult.FALSE,
          satisfied: false,
          explanation:
            'Patient age is unrecorded or invalid. Adult qSOFA screening cannot be applied without verified adult age (>= 18 years).',
          children: [],
        };

        results.push({
          flagCode: rule.flagCode,
          title: 'Potential Sepsis Alert (Adult qSOFA Inapplicable — Patient Age Unrecorded)',
          urgencyLevel: rule.urgencyLevel,
          triggered: false,
          clinicalAction:
            'Clinical Escalation Advisory: Adult qSOFA criteria cannot be safely applied because patient age is unrecorded or invalid. Physiological thresholds differ between pediatric and adult populations. Bedside attending clinician assessment and age verification are required. Adult qSOFA logic was not applied.',
          evaluatedAstDetail: detail,
          sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
          disclaimer: RED_FLAG_DISCLAIMER,
          isProvisional: true,
          provisionalWarning:
            'AGE VERIFICATION NOTICE: Patient age is unrecorded or invalid. Adult qSOFA criteria cannot be applied without verified adult age (>= 18 years).',
          clinicalContextNotice:
            'Age Context: Patient age is missing or unverified. Adult qSOFA criteria require verified patient age >= 18 years.',
          infectionSuspicionState: context.infectionSuspicion,
          gatingExplanation:
            'Patient age is unrecorded or invalid. Adult qSOFA screening cannot be applied without verified adult age (>= 18 years).',
          supportingInfectionEvidence: context.supportingInfectionEvidence,
        });
        continue;
      }

      // 1.3 Verified Adult context: Evaluate vital signs with quarantined Dizziness predicate
      const ast = rule.ruleAst as any;
      const childDetails: NodeEvaluationDetail[] = [];

      for (const child of ast.predicates || []) {
        if (child.type === 'CONCEPT_STATUS' && child.canonicalTerm?.toLowerCase() === 'dizziness') {
          // Legacy invalid substitute quarantined
          childDetails.push({
            nodeType: 'CONCEPT_STATUS',
            result: PredicateEvaluationResult.FALSE,
            satisfied: false,
            explanation:
              'QUARANTINED LEGACY PREDICATE: Dizziness is not clinically equivalent to Altered Mental Status. Contributes 0 criteria to qSOFA.',
            canonicalTerm: 'Dizziness',
            expected: 'PRESENT',
            actual: 'QUARANTINED_INVALID_SUBSTITUTE',
          });
        } else {
          childDetails.push(evaluateAst(child, context));
        }
      }

      const threshold = ast.threshold ?? 2;
      const satisfiedCount = childDetails.filter((c) => c.satisfied).length;
      const meetsVitalCriteria = satisfiedCount >= threshold;

      detail = {
        nodeType: 'AT_LEAST_N',
        result: meetsVitalCriteria ? PredicateEvaluationResult.TRUE : PredicateEvaluationResult.FALSE,
        satisfied: meetsVitalCriteria,
        explanation: meetsVitalCriteria
          ? `AT_LEAST_N (${threshold}) satisfied: ${satisfiedCount}/3 criteria met (excluding quarantined Dizziness).`
          : `AT_LEAST_N (${threshold}) failed: only ${satisfiedCount}/3 criteria met (excluding quarantined Dizziness).`,
        children: childDetails,
      };

      const hasSuspectedInfection = hasDocumentedSuspectedInfection(context);

      if (meetsVitalCriteria && hasSuspectedInfection) {
        // Adult with explicitly documented SUSPECTED infection: Validated provisional qSOFA screening alert
        results.push({
          flagCode: rule.flagCode,
          title: 'Potential Sepsis Screening Alert (Provisional qSOFA Criteria in Suspected Infection)',
          urgencyLevel: rule.urgencyLevel,
          triggered: true,
          clinicalAction:
            'Clinical Escalation Advisory: Observed tachypnea (RR >= 22) and systolic hypotension (SBP <= 100) in an adult patient with explicitly documented suspected infection satisfy provisional qSOFA criteria (>= 2). This indicates a high risk of acute organ dysfunction, but does NOT constitute a definitive diagnosis of sepsis. Immediate attending physician assessment is warranted to evaluate for systemic sepsis and determine resuscitation, diagnostic laboratory testing, and emergency referral or transfer pathways. All diagnostic sampling and therapeutic interventions require the attending clinician\'s assessment and decision.',
          evaluatedAstDetail: detail,
          sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
          disclaimer: RED_FLAG_DISCLAIMER,
          isProvisional: true,
          provisionalWarning:
            'PROVISIONAL QSOFA WARNING: Sepsis alert evaluated using 2 vital sign criteria only (RR >= 22, SBP <= 100; threshold >= 2). The 3rd criterion (Altered Mental Status / GCS < 15) is unavailable in v1.0.0 ontology; legacy Dizziness predicate is quarantined and contributes 0 criteria. Patients with altered mentation and single vital abnormality may be under-detected. Clinical assessment of mental status is required.',
          quarantinedPredicates: ['Dizziness'],
          missingAssessmentNotice:
            'Altered Mental Status (GCS < 15) assessment is missing from structured input. qSOFA score is provisional (2/3 criteria evaluated).',
          clinicalContextNotice:
            'Infectious Context: Explicit clinician-documented infection suspicion state is SUSPECTED. Adult qSOFA criteria evaluated.',
          infectionSuspicionState: context.infectionSuspicion,
          gatingExplanation:
            'Adult patient (age >= 18) with explicitly documented SUSPECTED infection. Meets provisional qSOFA vital criteria (RR >= 22, SBP <= 100).',
          supportingInfectionEvidence: context.supportingInfectionEvidence,
        });
      } else if (meetsVitalCriteria && !hasSuspectedInfection) {
        // Adult WITHOUT explicitly documented SUSPECTED infection: High-risk physiology alert (NOT a qSOFA sepsis screen!)
        let gatingExpl = `Infection suspicion state is "${context.infectionSuspicion}". Active infection is not documented as SUSPECTED. Evaluating as high-risk physiology advisory instead.`;
        if (context.supportingInfectionEvidence.length > 0) {
          gatingExpl = `Infection suspicion state is "${context.infectionSuspicion}". Supporting signs detected (${context.supportingInfectionEvidence.join(', ')}), but qSOFA sepsis screening strictly requires explicit clinician-documented SUSPECTED infection. Sepsis screening not enabled; evaluating as high-risk physiology advisory instead.`;
        }

        results.push({
          flagCode: rule.flagCode,
          title: 'High-Risk Hemodynamic / Respiratory Compromise Alert (Non-Sepsis Physiology Advisory)',
          urgencyLevel: rule.urgencyLevel,
          triggered: true,
          clinicalAction:
            'Clinical Escalation Advisory: Observed tachypnea (RR >= 22) and systolic hypotension (SBP <= 100) indicate acute physiological compromise and hemodynamic instability without clinician-documented suspected infection. Because qSOFA is strictly validated in suspected infection, this alert reflects acute physiological distress (such as hypovolemia, acute hemorrhage, pulmonary embolism, or cardiogenic compromise) rather than a qSOFA sepsis screen. Immediate attending physician assessment is warranted to evaluate etiology and establish disposition. All clinical interventions require attending physician evaluation.',
          evaluatedAstDetail: detail,
          sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
          disclaimer: RED_FLAG_DISCLAIMER,
          isProvisional: true,
          provisionalWarning:
            'PHYSIOLOGY ADVISORY: Severe tachypnea and hypotension detected without clinician-documented suspected infection. Does not represent a qSOFA sepsis screening result. Immediate clinician evaluation of non-infectious shock or respiratory compromise is required.',
          quarantinedPredicates: ['Dizziness'],
          missingAssessmentNotice:
            'Infection status is not documented as SUSPECTED. qSOFA sepsis screening is strictly validated in suspected infection only.',
          clinicalContextNotice:
            `Infection Suspicion State: ${context.infectionSuspicion}. qSOFA sepsis screening requires explicit clinician-documented SUSPECTED infection. Alert reflects high-risk non-sepsis physiology.`,
          infectionSuspicionState: context.infectionSuspicion,
          gatingExplanation: gatingExpl,
          supportingInfectionEvidence: context.supportingInfectionEvidence,
        });
      } else {
        // Subthreshold vital criteria
        results.push({
          flagCode: rule.flagCode,
          title: hasSuspectedInfection
            ? 'Potential Sepsis Screening Alert (Provisional qSOFA Criteria in Suspected Infection)'
            : 'Potential Sepsis Screening Alert (Provisional qSOFA Criteria)',
          urgencyLevel: rule.urgencyLevel,
          triggered: false,
          clinicalAction:
            'Clinical Escalation Advisory: Observed vital signs do not meet provisional qSOFA screening criteria (score < 2). If clinical concern for acute infection or clinical deterioration persists, ongoing bedside monitoring and attending physician assessment and decision are recommended. Note that altered mental status is not assessed in v1.0.0.',
          evaluatedAstDetail: detail,
          sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
          disclaimer: RED_FLAG_DISCLAIMER,
          isProvisional: true,
          provisionalWarning:
            'PROVISIONAL QSOFA WARNING: Sepsis alert evaluated using 2 vital sign criteria only (RR >= 22, SBP <= 100; threshold >= 2). The 3rd criterion (Altered Mental Status / GCS < 15) is unavailable in v1.0.0 ontology; legacy Dizziness predicate is quarantined and contributes 0 criteria. Patients with altered mentation and single vital abnormality may be under-detected. Clinical assessment of mental status is required.',
          quarantinedPredicates: ['Dizziness'],
          missingAssessmentNotice:
            'Altered Mental Status (GCS < 15) assessment is missing from structured input. qSOFA score is provisional (2/3 criteria evaluated).',
          clinicalContextNotice:
            `Infection Suspicion State: ${context.infectionSuspicion}.`,
          infectionSuspicionState: context.infectionSuspicion,
          gatingExplanation:
            `Provisional qSOFA score ${satisfiedCount}/3 is below threshold (>= 2).`,
          supportingInfectionEvidence: context.supportingInfectionEvidence,
        });
      }
      continue;
    }

    // =========================================================================
    // 2. RF-ACS-ISCHEMIA: Neutral Clinical Escalation Language
    // =========================================================================
    if (rule.flagCode === 'RF-ACS-ISCHEMIA') {
      detail = evaluateAst(rule.ruleAst, context);
      const triggered = detail.satisfied === true;

      results.push({
        flagCode: rule.flagCode,
        title: 'Acute Coronary Syndrome / Myocardial Infarction Emergency Alert',
        urgencyLevel: rule.urgencyLevel,
        triggered,
        clinicalAction:
          'Clinical Escalation Advisory: Acute chest pain accompanied by secondary ischemic features (dyspnea, acute weakness, or nausea) indicates potential acute coronary syndrome or myocardial ischemia. Urgent attending clinician assessment is warranted for emergency cardiac evaluation (including 12-lead ECG and cardiac biomarker testing) and urgent escalation or emergency transfer pathways. Clinical diagnostic testing and therapeutic management require attending physician assessment and decision.',
        evaluatedAstDetail: detail,
        sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
        disclaimer: RED_FLAG_DISCLAIMER,
        infectionSuspicionState: context.infectionSuspicion,
      });
      continue;
    }

    // =========================================================================
    // 3. RF-RESP-FAILURE: Neutral Clinical Escalation Language
    // =========================================================================
    if (rule.flagCode === 'RF-RESP-FAILURE') {
      detail = evaluateAst(rule.ruleAst, context);
      const triggered = detail.satisfied === true;

      results.push({
        flagCode: rule.flagCode,
        title: 'Acute Hypoxemic Respiratory Failure Alert',
        urgencyLevel: rule.urgencyLevel,
        triggered,
        clinicalAction:
          'Clinical Escalation Advisory: Acute dyspnea combined with pulse oximetry desaturation (SpO2 < 90%) indicates severe acute hypoxemic respiratory compromise. Urgent bedside clinician evaluation is warranted to assess airway patency, work of breathing, and respiratory etiology, and to determine oxygenation support or emergency facility transfer. Respiratory interventions and disposition require attending clinician assessment and decision.',
        evaluatedAstDetail: detail,
        sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
        disclaimer: RED_FLAG_DISCLAIMER,
        infectionSuspicionState: context.infectionSuspicion,
      });
      continue;
    }

    // =========================================================================
    // 4. RF-HYPERTENSIVE-CRISIS: Target-Organ Evaluation & Clinician-Directed Disposition
    // =========================================================================
    if (rule.flagCode === 'RF-HYPERTENSIVE-CRISIS') {
      detail = evaluateAst(rule.ruleAst, context);
      const triggered = detail.satisfied === true;

      const hasTargetOrganSymptoms =
        context.findingsMap.get('chest pain')?.status === 'PRESENT' ||
        context.findingsMap.get('breathlessness')?.status === 'PRESENT';

      const title = hasTargetOrganSymptoms
        ? 'Severe Blood Pressure Elevation with Acute Symptoms (Suspected Target-Organ Involvement)'
        : 'Severe Blood Pressure Elevation Advisory (Severe-Range BP; Requires Target-Organ Evaluation)';

      const clinicalAction = hasTargetOrganSymptoms
        ? 'Clinical Escalation Advisory: Blood pressure elevation in the severe range (SBP >= 180 mmHg or DBP >= 120 mmHg) co-occurs with acute clinical symptoms (chest pain or dyspnea), raising clinical suspicion for acute target-organ involvement (suspected hypertensive emergency). Immediate attending clinician evaluation is warranted to assess cardiovascular/pulmonary status and establish emergency disposition. Clinical interventions and emergency referral require attending clinician assessment and decision.'
        : 'Clinical Escalation Advisory: Blood pressure elevation in the severe range (SBP >= 180 mmHg or DBP >= 120 mmHg) requires prompt attending clinician evaluation. Severe-range blood pressure elevation alone does not establish a diagnosis of hypertensive emergency. The attending physician must assess for symptoms of acute target-organ damage (e.g. acute chest pain, dyspnea, acute neurological deficit, encephalopathy, visual disturbance, or severe headache). Disposition—including outpatient oral medication titration versus emergency department referral—depends entirely on the presence of acute target-organ compromise and the attending clinician\'s clinical judgment.';

      results.push({
        flagCode: rule.flagCode,
        title,
        urgencyLevel: rule.urgencyLevel,
        triggered,
        clinicalAction,
        evaluatedAstDetail: detail,
        sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
        disclaimer: RED_FLAG_DISCLAIMER,
        clinicalContextNotice: hasTargetOrganSymptoms
          ? 'Acute target-organ symptoms (chest pain or dyspnea) are documented alongside severe blood pressure elevation.'
          : 'No acute target-organ symptoms documented. Severe-range blood pressure requires clinician-directed disposition.',
        infectionSuspicionState: context.infectionSuspicion,
      });
      continue;
    }

    // Default fallback for any additional rule
    detail = evaluateAst(rule.ruleAst, context);
    results.push({
      flagCode: rule.flagCode,
      title: rule.title,
      urgencyLevel: rule.urgencyLevel,
      triggered: detail.satisfied === true,
      clinicalAction: rule.clinicalAction,
      evaluatedAstDetail: detail,
      sourceReferenceIdentifier: rule.sourceReferenceIdentifier,
      disclaimer: RED_FLAG_DISCLAIMER,
      infectionSuspicionState: context.infectionSuspicion,
    });
  }

  return results;
}
