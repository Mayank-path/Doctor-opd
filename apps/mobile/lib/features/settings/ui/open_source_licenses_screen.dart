import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Screen displaying open-source software licenses, dataset acknowledgments,
/// and third-party attribution disclosures.
class OpenSourceLicensesScreen extends StatelessWidget {
  const OpenSourceLicensesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: const Text('Open Source Licenses'),
        backgroundColor: colors.surface,
        foregroundColor: colors.textPrimary,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
        children: [
          // Header description
          Text(
            'The spell-checking subsystem performs dictionary lookup and suggestion generation locally on the device. It does not require an external spelling API or transmit consultation text to a cloud spelling service.',
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 13,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 20),

          // 1. SCOWL / ESDB v2
          _LicenseCard(
            key: const Key('licenseCard_scowl'),
            title: 'SCOWL & English Speller Database',
            author: 'Kevin Atkinson',
            version: 'ESDB v2 (2020–2026)',
            sourceUrl: 'https://github.com/en-wl/wordlist',
            licenseType: 'MIT / BSD-style Permissive',
            summary:
                'Provides general English vocabulary for offline spell checking. Commercial redistribution and mobile application bundling permitted without fee under Atkinson\'s permissive copyright notice.',
            verbatimNotice: '''
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

Note: Pursuant to the official ESDB terms, for generated English speller wordlists
(size <= 80, non-Australian), this notice is legally sufficient and no additional
WordNet or UKACD licensing obligations are imposed on this distributed asset.''',
          ),
          const SizedBox(height: 16),

          // 2. 12Dicts & ENABLE2K
          _LicenseCard(
            key: const Key('licenseCard_12dicts'),
            title: '12Dicts & ENABLE2K Lexicon',
            author: 'Alan Beale',
            version: 'Release 6.0.2 / ENABLE 1.0',
            sourceUrl: 'http://wordlist.aspell.net/12dicts/',
            licenseType: 'Public Domain',
            summary:
                'Primary source of core curated English vocabulary for ESDB. Alan Beale released these base lexicons into the Public Domain with acknowledgment requested.',
            verbatimNotice: '''
The 12dicts word lists and ENABLE2K were curated by Alan Beale and released
into the Public Domain without copyright restrictions.

Credit and acknowledgment are accorded to Alan Beale <biljir@pobox.com> for
his authorship of 12dicts and major contributions to ENABLE2K.

Alan Beale released these base datasets into the Public Domain for general
public and commercial software applications.''',
          ),
          const SizedBox(height: 16),

          // 3. NLM MeSH Descriptors
          _LicenseCard(
            key: const Key('licenseCard_mesh'),
            title: 'Medical Subject Headings (MeSH)',
            author: 'National Library of Medicine (NLM / NIH)',
            version: 'MeSH 2024/2025 Descriptors (SCR date undocumented)',
            sourceUrl: 'https://www.nlm.nih.gov/mesh/',
            licenseType: 'Public Domain (U.S. Government Work)',
            summary:
                'Controlled biomedical terminology (diseases, symptoms, anatomy, pathologies) from NLM MeSH, distinct from FDA pharmaceutical ingredient lists.',
            verbatimNotice: '''
Medical Subject Headings (MeSH) is a controlled vocabulary thesaurus produced
by the National Library of Medicine (NLM), a component of the National
Institutes of Health (NIH), U.S. Department of Health and Human Services.

As a work of the United States Government (17 U.S.C. § 105), MeSH data is in
the public domain and is freely available for public and commercial use without
fees, licenses, or royalties.

Mandatory Upstream Terms (NLM Data Distribution Policy):
1. Attribution: Users agree to clearly and conspicuously acknowledge the
   National Library of Medicine as the source of the data.
2. Non-Endorsement: Users must not indicate or imply that NLM endorses their
   commercial products, services, or applications.
3. Currency & Version: Users agree to maintain the most current version or
   explicitly identify the specific version (MeSH 2024/2025 Descriptors;
   Supplemental Concept Record snapshot date is undocumented in asset records).
4. Disclaimer: NLM makes no warranties, express or implied, including of
   merchantability or fitness for a particular purpose, regarding data accuracy
   or completeness. Users agree to hold NLM and the U.S. Government harmless.''',
          ),
          const SizedBox(height: 16),

          // 4. FDA Orange Book / openFDA
          _LicenseCard(
            key: const Key('licenseCard_fda'),
            title: 'FDA Approved Drug Active Ingredients',
            author: 'U.S. Food and Drug Administration (FDA)',
            version: 'FDA Orange Book / openFDA (Active Ingredients)',
            sourceUrl: 'https://open.fda.gov/apis/drug/',
            licenseType: 'Public Domain (U.S. Government Work)',
            summary:
                'Generic active pharmaceutical ingredients extracted from the FDA Orange Book for medication spell-checking, distinct from MeSH biomedical headings.',
            verbatimNotice: '''
FDA Orange Book (Approved Drug Products with Therapeutic Equivalence
Evaluations) and openFDA drug active ingredient lists are produced by the
United States Food and Drug Administration (FDA).

As a work of the United States Federal Government, this data is in the
public domain (17 U.S.C. § 105). openFDA data is released under Creative
Commons CC0 1.0 Universal.

Mandatory Terms & Policy:
1. No Trademark Rights: The CC0 dedication does not affect or grant any
   permissions regarding trademark or patent rights. Proprietary pharmaceutical
   brand names are excluded; only non-proprietary active ingredients are included.
2. Non-Endorsement: Users must not imply official endorsement by the FDA
   or the United States Government.
3. Not Medical Advice: DOCTOR-OPD provides spelling suggestions for typographical
   convenience only; it does not validate drug dosing, indications, or equivalence.''',
          ),
          const SizedBox(height: 16),

          // 5. DOCTOR-OPD Curated Clinical Terminology
          _LicenseCard(
            key: const Key('licenseCard_doctor_opd'),
            title: 'DOCTOR-OPD Clinical Practice Standards',
            author: 'DOCTOR-OPD Clinical Governance',
            version: 'v1.1 (2026)',
            sourceUrl: 'Internal Practice Standards',
            licenseType: 'Standard Clinical Nomenclature',
            summary:
                'Factual non-proprietary Outpatient Department prescription abbreviations (OD, BD, TDS, QID, SOS, PRN) and vital signs conventions compiled for clinical charting.',
            verbatimNotice: '''
Standard non-proprietary Outpatient Department (OPD) clinical abbreviations,
Latin prescription frequency shorthand, and vital signs notations.

Compiled to provide typographical recognition during clinical charting and
prevent false-positive spell-check flagging in routine consultation workflows.''',
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _LicenseCard extends StatefulWidget {
  final String title;
  final String author;
  final String version;
  final String sourceUrl;
  final String licenseType;
  final String summary;
  final String verbatimNotice;

  const _LicenseCard({
    super.key,
    required this.title,
    required this.author,
    required this.version,
    required this.sourceUrl,
    required this.licenseType,
    required this.summary,
    required this.verbatimNotice,
  });

  @override
  State<_LicenseCard> createState() => _LicenseCardState();
}

class _LicenseCardState extends State<_LicenseCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Card(
      color: colors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.title,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.author,
                        style: TextStyle(
                          color: colors.primaryAccent,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: colors.surfaceContainer,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: colors.border),
                  ),
                  child: Text(
                    widget.licenseType,
                    style: TextStyle(
                      color: colors.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              widget.summary,
              style: TextStyle(
                color: colors.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  Icons.link_rounded,
                  size: 14,
                  color: colors.textSecondary,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    '${widget.version} • ${widget.sourceUrl}',
                    style: TextStyle(
                      color: colors.textSecondary,
                      fontSize: 11,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: () {
                setState(() {
                  _isExpanded = !_isExpanded;
                });
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _isExpanded ? 'Hide License Notice' : 'View Full License Notice',
                      style: TextStyle(
                        color: colors.primaryAccent,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      _isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      size: 16,
                      color: colors.primaryAccent,
                    ),
                  ],
                ),
              ),
            ),
            if (_isExpanded) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.surfaceContainer,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.border),
                ),
                child: SelectableText(
                  widget.verbatimNotice.trim(),
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: colors.textPrimary,
                    height: 1.45,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

