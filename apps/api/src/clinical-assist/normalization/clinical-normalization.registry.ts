import { Injectable } from '@nestjs/common';
import { CURATED_TERMINOLOGY_ENTRIES } from './clinical-normalization.constants';
import { TerminologyEntry } from './clinical-normalization.types';

export interface CompiledAlias {
  alias: string;
  canonicalTerm: string;
  defaultBodyLocation?: string;
  regex: RegExp;
  wordCount: number;
  charLength: number;
}

@Injectable()
export class ClinicalNormalizationRegistry {
  private readonly compiledAliases: CompiledAlias[] = [];
  private readonly canonicalMap: Map<string, TerminologyEntry> = new Map();

  constructor() {
    this.initializeRegistry();
  }

  private initializeRegistry(): void {
    for (const entry of CURATED_TERMINOLOGY_ENTRIES) {
      this.canonicalMap.set(entry.canonicalTerm.toLowerCase(), entry);

      for (const alias of entry.aliases) {
        const cleanAlias = alias.trim();
        if (!cleanAlias) continue;

        // Escape regex special characters safely
        const escaped = cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Unicode word-boundary matching:
        // Ensures no matching within substrings of unrelated words (e.g. "pain" in "paint")
        // and safely supports Devanagari script characters.
        const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
        const regex = new RegExp(pattern, 'gui');
        const wordCount = cleanAlias.split(/\s+/).length;

        this.compiledAliases.push({
          alias: cleanAlias,
          canonicalTerm: entry.canonicalTerm,
          defaultBodyLocation: entry.defaultBodyLocation,
          regex,
          wordCount,
          charLength: cleanAlias.length,
        });
      }
    }

    // Sort aliases: highest wordCount first, then longest character length first
    // This strictly prevents shorter sub-terms (e.g. "dard") from prematurely matching
    // inside compound terms (e.g. "pet dard" or "sir dard").
    this.compiledAliases.sort((a, b) => {
      if (b.wordCount !== a.wordCount) {
        return b.wordCount - a.wordCount;
      }
      return b.charLength - a.charLength;
    });
  }

  public getCompiledAliases(): CompiledAlias[] {
    return this.compiledAliases;
  }

  public getEntry(canonicalTerm: string): TerminologyEntry | undefined {
    return this.canonicalMap.get(canonicalTerm.toLowerCase());
  }

  public getAllCanonicalTerms(): string[] {
    return Array.from(this.canonicalMap.values()).map((e) => e.canonicalTerm);
  }
}
