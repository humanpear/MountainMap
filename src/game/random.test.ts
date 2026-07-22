import { describe, expect, it } from 'vitest';
import { mountains } from '../data/mountains';
import { pickRandomMountain } from './random';

describe('random mountain selection', () => {
  it('returns a deterministic winner when random is injected', () => {
    const result = pickRandomMountain({
      mountains,
      random: () => 0
    });

    expect(result?.winner.id).toBe(mountains[0].id);
    expect(result?.sequence.at(-1)?.id).toBe(mountains[0].id);
  });

  it('returns null when the current filtered result has no candidates', () => {
    const result = pickRandomMountain({
      mountains: [],
      random: () => 0
    });

    expect(result).toBeNull();
  });

  it('never selects a mountain outside the supplied filtered results', () => {
    const filteredResults = [mountains[3], mountains[8], mountains[13]];
    const result = pickRandomMountain({ mountains: filteredResults, random: () => 0.99 });

    expect(filteredResults).toContain(result?.winner);
    expect(result?.sequence.every((mountain) => filteredResults.includes(mountain))).toBe(true);
  });
});
