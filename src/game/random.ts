import type { Mountain, RandomResult } from '../types';

type RandomOptions = {
  mountains: readonly Mountain[];
  random?: () => number;
};

export const randomRouletteDurationMs = 5_000;

export function getRandomTickDelays(sequenceLength: number) {
  const safeLength = Math.max(1, Math.floor(sequenceLength));
  const weights = Array.from(
    { length: safeLength },
    (_, index) => Math.min(50 + index, 72),
  );
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const delays = weights.map((weight) =>
    Math.round((randomRouletteDurationMs * weight) / totalWeight),
  );
  const roundedTotal = delays.reduce((total, delay) => total + delay, 0);
  delays[delays.length - 1] += randomRouletteDurationMs - roundedTotal;

  return delays;
}

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
