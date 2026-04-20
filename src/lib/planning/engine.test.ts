import { describe, it, expect } from 'vitest';
import { generateSuggestions } from './engine';

describe('planning engine', () => {
  it('fires high-priority rule when no supporter', () => {
    const all = {
      postpartum_concerns: { discharge_supporter: 'なし' },
    };
    const results = generateSuggestions(all);
    expect(results.find((r) => r.rule_id === 'timing_no_supporter')).toBeDefined();
  });

  it('fires allergy rule when any allergy field is filled', () => {
    const all = {
      family_mama: { mama_allergy: 'えび、かに' },
    };
    const results = generateSuggestions(all);
    expect(results.find((r) => r.rule_id === 'meal_allergy_alert')).toBeDefined();
  });

  it('sorts suggestions by priority', () => {
    const all = {
      postpartum_concerns: { concerns: '不安です', discharge_supporter: 'なし' },
      family_mama: { mama_allergy: 'えび' },
    };
    const results = generateSuggestions(all);
    const priorities = results.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => {
      const o: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return o[a] - o[b];
    }));
  });
});
