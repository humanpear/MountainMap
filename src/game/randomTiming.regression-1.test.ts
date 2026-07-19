import { describe, expect, it } from 'vitest';
import { getRandomTickDelays, randomRouletteDurationMs } from './random';

describe('random recommendation duration regression', () => {
  // Regression: FINDING-005 - 정적인 랜덤 추천 대기 화면이 약 10.5초 동안 사용자 흐름을 막음
  // Found by /design-review on 2026-07-19
  // Report: .gstack/design-reports/design-audit-127-0-0-1-2026-07-19.md
  it.each([18, 20, 32, 42])(
    'keeps a %i-step recommendation sequence at exactly 5 seconds',
    (sequenceLength) => {
      const delays = getRandomTickDelays(sequenceLength);
      const totalDuration = delays.reduce((total, delay) => total + delay, 0);

      expect(delays).toHaveLength(sequenceLength);
      expect(totalDuration).toBe(randomRouletteDurationMs);
      expect(delays.at(-1)).toBeGreaterThan(delays[0]);
    },
  );
});
