import { describe, expect, it } from 'vitest';
import { getRandomTickDelay } from './random';

describe('random recommendation duration regression', () => {
  // Regression: FINDING-005 - 정적인 랜덤 추천 대기 화면이 약 10.5초 동안 사용자 흐름을 막음
  // Found by /design-review on 2026-07-19
  // Report: .gstack/design-reports/design-audit-127-0-0-1-2026-07-19.md
  it('keeps the longest 42-step recommendation sequence within 2.5 seconds', () => {
    const totalDuration = Array.from({ length: 42 }, (_, index) => getRandomTickDelay(index))
      .reduce((total, delay) => total + delay, 0);

    expect(totalDuration).toBe(2_310);
    expect(totalDuration).toBeLessThanOrEqual(2_500);
  });
});
