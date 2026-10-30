import { RedFlagRuleSeed } from '../knowledge-pack.types';

export const GENERAL_MEDICINE_RED_FLAGS: RedFlagRuleSeed[] = [
  {
    flagCode: 'RF-QSOFA-SEPSIS',
    title: 'Potential Severe Sepsis Alert (qSOFA Positive Criteria)',
    urgencyLevel: 'IMMEDIATE',
    clinicalAction:
      'Urgent immediate clinical triage: Establish intravenous access, obtain blood cultures, measure serum lactate, initiate empiric broad-spectrum IV antimicrobials within 1 hour, and arrange urgent higher-center ICU/hospital transfer.',
    ruleAst: {
      operator: 'AT_LEAST_N',
      threshold: 2,
      predicates: [
        {
          type: 'NUMERIC_PARAM',
          parameter: 'VITAL_RESPIRATORY_RATE',
          operator: 'GREATER_THAN_OR_EQUAL',
          value: 22,
        },
        {
          type: 'NUMERIC_PARAM',
          parameter: 'VITAL_BP_SYSTOLIC',
          operator: 'LESS_THAN_OR_EQUAL',
          value: 100,
        },
        {
          type: 'CONCEPT_STATUS',
          canonicalTerm: 'Dizziness',
          expectedStatus: 'PRESENT',
        },
      ],
    },
    sourceReferenceIdentifier: 'SRC-SURVIVING-SEPSIS-2021',
  },
  {
    flagCode: 'RF-ACS-ISCHEMIA',
    title: 'Acute Coronary Syndrome / Myocardial Infarction Emergency Alert',
    urgencyLevel: 'IMMEDIATE',
    clinicalAction:
      'Immediate medical emergency: Perform immediate 12-lead ECG within 10 minutes, administer chewable Aspirin 300mg if not contraindicated, initiate oxygen if SpO2 < 90%, and activate immediate emergency cardiac care / ambulance transfer.',
    ruleAst: {
      operator: 'ALL',
      predicates: [
        {
          type: 'CONCEPT_STATUS',
          canonicalTerm: 'Chest pain',
          expectedStatus: 'PRESENT',
        },
        {
          operator: 'ANY',
          predicates: [
            {
              type: 'CONCEPT_STATUS',
              canonicalTerm: 'Breathlessness',
              expectedStatus: 'PRESENT',
            },
            {
              type: 'CONCEPT_STATUS',
              canonicalTerm: 'Weakness',
              expectedStatus: 'PRESENT',
            },
            {
              type: 'CONCEPT_STATUS',
              canonicalTerm: 'Nausea',
              expectedStatus: 'PRESENT',
            },
          ],
        },
      ],
    },
    sourceReferenceIdentifier: 'SRC-AHA-ACC-ACS-2021',
  },
  {
    flagCode: 'RF-RESP-FAILURE',
    title: 'Acute Hypoxemic Respiratory Failure Alert',
    urgencyLevel: 'IMMEDIATE',
    clinicalAction:
      'Immediate respiratory compromise: Administer supplemental high-flow oxygen, maintain airway, assess for tension pneumothorax or acute bronchospasm, and prepare for immediate emergency transfer.',
    ruleAst: {
      operator: 'ALL',
      predicates: [
        {
          type: 'CONCEPT_STATUS',
          canonicalTerm: 'Breathlessness',
          expectedStatus: 'PRESENT',
        },
        {
          type: 'NUMERIC_PARAM',
          parameter: 'VITAL_SPO2',
          operator: 'LESS_THAN',
          value: 90,
        },
      ],
    },
    sourceReferenceIdentifier: 'SRC-ICMR-CAP-2022',
  },
  {
    flagCode: 'RF-HYPERTENSIVE-CRISIS',
    title: 'Severe Hypertensive Emergency / Urgency Alert',
    urgencyLevel: 'IMMEDIATE',
    clinicalAction:
      'Critical blood pressure elevation: Check for acute target organ damage (encephalopathy, acute pulmonary edema, acute aortic dissection, acute kidney injury). Do not precipitously lower BP outpatient; arrange immediate emergency department referral.',
    ruleAst: {
      operator: 'ANY',
      predicates: [
        {
          type: 'NUMERIC_PARAM',
          parameter: 'VITAL_BP_SYSTOLIC',
          operator: 'GREATER_THAN_OR_EQUAL',
          value: 180,
        },
        {
          type: 'NUMERIC_PARAM',
          parameter: 'VITAL_BP_DIASTOLIC',
          operator: 'GREATER_THAN_OR_EQUAL',
          value: 120,
        },
      ],
    },
    sourceReferenceIdentifier: 'SRC-IGH-IV-HYPERTENSION-2019',
  },
];

