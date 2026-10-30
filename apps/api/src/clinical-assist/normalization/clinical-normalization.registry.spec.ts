import { ClinicalNormalizationRegistry } from './clinical-normalization.registry';

describe('ClinicalNormalizationRegistry', () => {
  let registry: ClinicalNormalizationRegistry;

  beforeEach(() => {
    registry = new ClinicalNormalizationRegistry();
  });

  it('should initialize curated terminology entries', () => {
    const terms = registry.getAllCanonicalTerms();
    expect(terms).toContain('Fever');
    expect(terms).toContain('Cough');
    expect(terms).toContain('Headache');
    expect(terms).toContain('Throat pain');
    expect(terms).toContain('Abdominal pain');
    expect(terms).toContain('Vomiting');
    expect(terms).toContain('Nausea');
    expect(terms).toContain('Breathlessness');
    expect(terms).toContain('Dizziness');
    expect(terms).toContain('Weakness');
    expect(terms).toContain('Diarrhea');
    expect(terms).toContain('Burning sensation');
    expect(terms).toContain('Chest pain');
  });

  it('should prioritize multi-word aliases over single-word subterms to prevent shadowing', () => {
    const compiled = registry.getCompiledAliases();
    const petDardIndex = compiled.findIndex((a) => a.alias === 'pet dard');
    const saansDikkatIndex = compiled.findIndex(
      (a) => a.alias === 'saans lene mein dikkat',
    );

    expect(petDardIndex).toBeGreaterThanOrEqual(0);
    expect(saansDikkatIndex).toBeGreaterThanOrEqual(0);

    // Multi-word alias must appear before shorter aliases
    const singleWordAliases = compiled.filter((a) => a.wordCount === 1);
    if (singleWordAliases.length > 0) {
      const firstSingleWordIndex = compiled.indexOf(singleWordAliases[0]);
      expect(saansDikkatIndex).toBeLessThan(firstSingleWordIndex);
      expect(petDardIndex).toBeLessThan(firstSingleWordIndex);
    }
  });

  it('should enforce word boundaries and not match substrings of unrelated words', () => {
    const compiled = registry.getCompiledAliases();
    const painAlias = compiled.find((a) => a.alias === 'pain');
    if (painAlias) {
      // Should not match "painting"
      expect(painAlias.regex.test('He was painting the room')).toBe(false);
      painAlias.regex.lastIndex = 0;
      // Should match isolated "pain"
      expect(painAlias.regex.test('He had chest pain')).toBe(true);
    }
  });

  it('should support Devanagari Hindi aliases with boundary checks', () => {
    const compiled = registry.getCompiledAliases();
    const bukharDevanagari = compiled.find((a) => a.alias === 'बुखार');
    expect(bukharDevanagari).toBeDefined();

    expect(bukharDevanagari!.regex.test('मरीज को बुखार है')).toBe(true);
  });
});
