# DOCTOR-OPD Bundled Dictionaries

## 1. Dictionaries Overview

This directory contains offline word lists bundled directly with the DOCTOR-OPD Flutter mobile application to support local, offline clinical spell-checking.

**Privacy & Local Processing Guarantee:**  
The spell-checking subsystem performs dictionary lookup and suggestion generation locally on the device. It does not require an external spelling API or transmit consultation text to a cloud spelling service.

### Bundled Asset Files

- `english_words.txt`: Curated English vocabulary (73,833 words) based on the English Speller Database (ESDB / SCOWL v2 by Kevin Atkinson) and Alan Beale's 12Dicts / ENABLE2K, ordered by frequency tier (common English words prioritized).
- `medical_words.txt`: Medical terminology vocabulary (19,183 words) containing two distinct non-proprietary subsets:
  1. **Biomedical Descriptors:** Clinical pathologies, symptoms, signs, and anatomical terminology derived from the National Library of Medicine (NLM) Medical Subject Headings (MeSH).
  2. **Generic Active Ingredients:** Non-proprietary approved active pharmaceutical ingredients derived from the U.S. FDA Orange Book.
- `clinical_abbreviations.txt`: Standard Outpatient Department (OPD) clinical abbreviations (219 terms covering vital signs, prescription frequencies, routes, lab investigations, examination shorthand, and diagnostic codes) representing standard non-proprietary medical nomenclature.

---

## 2. Medicine & Vocabulary Classification

To ensure full legal clarity and prevent trademark infringement or unsupported distribution claims, the bundled vocabulary adheres to the following evidence-based classification:

| Category | Classification Status | Provenance & Source | Curation Policy |
| :--- | :--- | :--- | :--- |
| **Biomedical Descriptors** | **CLEARED** | NLM MeSH (NIH) | Diseases, clinical signs, symptoms, anatomical structures, and pathological processes. |
| **Generic Active Ingredients** | **CLEARED** | U.S. FDA Orange Book Active Ingredients | Approved non-proprietary generic chemical substances (INN / active pharmaceutical ingredients). |
| **Medicine Brand Names** | **EXCLUDED** | Proprietary Pharmaceutical Trademarks | Excluded from bundled assets. Neither public domain status nor CC0 conveys trademark rights or permissions. |
| **Fixed-Dose Combinations** | **CLEARED (Generics)** | NLM MeSH & FDA Orange Book | Preserved strictly under generic active ingredient nomenclature (e.g. amoxicillin, clavulanate). |
| **Clinical Abbreviations** | **CLEARED** | Standard Clinical Practice Conventions | Factual, unadorned clinical acronyms (OD, BD, TDS, BP, ECG) representing standard medical conventions. |

*Note: The spelling dictionary recognizes valid clinical terminology for spelling assistance only. It does not evaluate drug safety, efficacy, marketing status, dosing appropriateness, or country-specific regulatory approvals.*

---

## 3. Licensing and Attribution Matrix

| Asset | Upstream Source | Known Version & Currency | Governing License / Framework | Commercial Redistribution Status | Required Disclosures |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `english_words.txt` | ESDB / SCOWL (Kevin Atkinson), 12Dicts & ENABLE2K (Alan Beale) | ESDB v2 (2020–2026) / 12Dicts 6.0.2 | Permissive Copyright Notice (Kevin Atkinson) / Public Domain Base Lists | Permitted without fee; proprietary mobile bundling allowed | Retain Kevin Atkinson copyright & permission notice; acknowledge Alan Beale |
| `medical_words.txt` (MeSH component) | U.S. National Library of Medicine (NLM / NIH) | MeSH 2024/2025 Descriptors (Supplemental Concept Record snapshot date: Undocumented) | U.S. Public Domain (17 U.S.C. § 105) + NLM Data Distribution Terms | Permitted without fee or royalties | Conspicuous NLM attribution, non-endorsement disclaimer, and MeSH version identification |
| `medical_words.txt` (FDA component) | U.S. Food & Drug Administration (FDA) Orange Book | FDA Orange Book / openFDA Active Ingredient Registry | U.S. Public Domain (17 U.S.C. § 105) + openFDA CC0 1.0 (No trademark waiver) | Permitted without fee or royalties | FDA attribution and disclaimer of endorsement/warranty |
| `clinical_abbreviations.txt` | Standard Clinical Practice Nomenclature | 1.1 (2026) | Standard Medical Reference Facts (Non-copyrightable factual acronyms) | Unrestricted | Factual OPD shorthand compilation |

---

## 4. Upstream Copyright, Permission Notices, and Terms

### A. ESDB / SCOWL (Kevin Atkinson)

**Official Verbatim Copyright Notice:**

```text
Copyright 2000-2026 by Kevin Atkinson

Permission to use, copy, modify, distribute, and sell any part of the English
Speller Database (ESDB, previously known as SCOWLv2), or word lists
created from it, is hereby granted without fee, provided that the above
copyright notice appears in all copies and that both the above copyright
notice and this notice appear in supporting documentation. Kevin Atkinson
makes no representations about the suitability of this database for any
purpose. It is provided "as is" without express or implied warranty.

The primary source of words for ESDB comes from 12dicts and ENABLE2K. Both
are in the Public Domain, but Alan Beale <biljir@pobox.com> deserves special
credit as he is the author of 12dicts and a major contributor to ENABLE2K.
```

*Note on Downstream Licensing Scope:*  
Per the official ESDB copyright documentation, when distributing an official speller dictionary (size <= 80, non-Australian) generated from ESDB, including the notice before the separator (`===`) is legally sufficient. No additional WordNet or UKACD licensing obligations are imposed on this distributed word list asset.

---

### B. 12Dicts & ENABLE2K Lexicon (Alan Beale)

**Author Acknowledgment & Public Domain Notice:**

```text
The 12dicts word lists and ENABLE2K were curated by Alan Beale and released
into the Public Domain without copyright restrictions.

Credit and acknowledgment are accorded to Alan Beale <biljir@pobox.com> for
his authorship of 12dicts and major contributions to ENABLE2K.
```

---

### C. U.S. National Library of Medicine (NLM) MeSH

**NLM Terms and Conditions (Official Clauses & Summary):**

Medical Subject Headings (MeSH) is produced by the National Library of Medicine (NLM), a component of the National Institutes of Health (NIH), U.S. Department of Health and Human Services.

As a work of the United States Government (17 U.S.C. § 105), MeSH data is in the public domain and is freely available for public and commercial use without fees or royalties.

**Mandatory Upstream Terms (Verbatim Clauses from NLM Data Distribution Policy):**
1. **Attribution:** *"Users agree to clearly and conspicuously acknowledge the National Library of Medicine as the source of the data."*
2. **Non-Endorsement:** *"Users must not indicate or imply that NLM endorses their commercial products, services, or applications."*
3. **Data Currency & Version Identification:** *"Users who republish or redistribute MeSH data (whether as raw data, products, or services) must agree to either: (1) Maintain the most current version of all distributed data, or (2) Make it clear in a conspicuous manner that their product/service/application does not reflect the most current or accurate data available from NLM, and/or explicitly identify the specific version of MeSH being utilized."*
4. **Warranties & Disclaimer:** *"MeSH data is produced with a reasonable standard of care, but NLM makes no warranties, express or implied—including no warranty of merchantability or fitness for a particular purpose—regarding the accuracy or completeness of the data. Users agree to hold NLM and the U.S. Government harmless from any liability resulting from errors or omissions in the data."*

**Dataset Version Identification:**  
- **MeSH Descriptors Release:** 2024/2025 Production Descriptors.  
- **Supplemental Concept Record (SCR) Snapshot Date:** Undocumented in asset build records.

---

### D. U.S. Food and Drug Administration (FDA) Active Ingredients

**openFDA & Orange Book Terms (Official Clauses & Summary):**

Generic active ingredient nomenclature in `medical_words.txt` is derived from the FDA Orange Book (Approved Drug Products with Therapeutic Equivalence Evaluations) and openFDA drug active ingredient registries.

As a work of the United States Government, factual active ingredient lists are in the public domain (17 U.S.C. § 105). openFDA data is released under Creative Commons CC0 1.0 Universal.

**Mandatory Upstream Terms (Verbatim Clauses from openFDA Terms of Service):**
1. **No Trademark Rights Conveyed:** *"The CC0 dedication does not affect or grant any permissions regarding the trademark or patent rights of any person or entity, nor does it affect privacy or publicity rights."* (Proprietary pharmaceutical brand names are excluded from this software; only non-proprietary active ingredients are included.)
2. **Non-Endorsement:** *"When citing or using openFDA data, users must not imply official endorsement by the FDA or the United States Government."*
3. **Disclaimer of Medical Advice:** DOCTOR-OPD provides spelling suggestions for typographical convenience only. The software does not provide medical advice or validate drug dosing, indications, contraindications, or therapeutic equivalence.

---

### E. DOCTOR-OPD Clinical Abbreviations

**Clinical Practice Shorthand Specification:**

Standard Outpatient Department abbreviations (e.g., OD, BD, TDS, QID, SOS, PRN, BP, HR, SpO2, ECG) represent standard non-proprietary medical nomenclature and Latin prescription conventions commonly utilized in clinical practice. They are compiled here solely to prevent false-positive spell-check flagging during clinical charting.

---

## 5. Bundled Size Impact & Runtime Characteristics

- `english_words.txt`: ~674 KB uncompressed (~150 KB compressed in APK).
- `medical_words.txt`: ~228 KB uncompressed (~50 KB compressed in APK).
- `clinical_abbreviations.txt`: ~1.4 KB uncompressed (< 1 KB in APK).
- **Total APK Impact:** < 210 KB compressed.
- **Runtime Startup Load Time:** < 50ms.
- **Lookup Latency:** < 0.01ms (in-memory HashSet O(1)).
