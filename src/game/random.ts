import type { Mountain, RandomResult } from '../types';

type RandomOptions = {
  mountains: readonly Mountain[];
  random?: () => number;
};

export function pickRandomMountain(options: RandomOptions): RandomResult | null {
  const random = options.random ?? Math.random;
  const candidates = options.mountains;

  if (candidates.length === 0) {
    return null;
  }

  const winner = candidates[Math.floor(random() * candidates.length)] ?? candidates[0];
  const sequenceLength = Math.max(18, Math.min(42, candidates.length * 4));
  const sequence = Array.from({ length: sequenceLength }, (_, index) => {
    if (index === sequenceLength - 1) {
      return winner;
    }

    return candidates[index % candidates.length];
  });

  return { winner, sequence };
}
