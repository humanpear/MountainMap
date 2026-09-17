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

  it('gives every candidate an equal share of the random input range', () => {
    const sampleCount = mountains.length * 100;
    const counts = new Map(mountains.map((mountain) => [mountain.id, 0]));

    for (let sample = 0; sample < sampleCount; sample += 1) {
      const result = pickRandomMountain({
        mountains,
        random: () => (sample + 0.5) / sampleCount,
      });

      expect(result).not.toBeNull();
      counts.set(result!.winner.id, counts.get(result!.winner.id)! + 1);
    }

    expect([...counts.values()]).toEqual(mountains.map(() => 100));
  });

  it('draws animation frames from all candidates without changing the chosen winner', () => {
    let drawCount = 0;
    const result = pickRandomMountain({
      mountains,
      // Choose the first mountain as winner, then show the last mountain while spinning.
      random: () => drawCount++ === 0 ? 0 : 0.999,
    });

    expect(result?.winner).toBe(mountains[0]);
    expect(result?.sequence.slice(0, -1)).toEqual(
      Array.from({ length: result!.sequence.length - 1 }, () => mountains.at(-1)),
    );
    expect(result?.sequence.at(-1)).toBe(result?.winner);
  });

  it('allows the same winner on separate draws', () => {
    const options = { mountains, random: () => 0.75 };
    const first = pickRandomMountain(options);
    const second = pickRandomMountain(options);

    expect(first?.winner).toBe(mountains[75]);
    expect(second?.winner).toBe(first?.winner);
  });

  it('keeps a single filtered candidate as the winner and every animation frame', () => {
    const candidates = [mountains[75]];
    const result = pickRandomMountain({ mountains: candidates });

    expect(result?.winner).toBe(candidates[0]);
    expect(result?.sequence.every((mountain) => mountain === candidates[0])).toBe(true);
  });
});
