import { describe, expect, it } from 'vitest';
import { mountainRegionCodes } from '../types';
import { mountains } from './mountains';

describe('mountain region metadata', () => {
  it('assigns at least one valid Forest Service region to all 100 mountains', () => {
    const validRegionCodes = new Set(mountainRegionCodes);

    expect(mountains).toHaveLength(100);
    expect(new Set(mountains.map((mountain) => mountain.id)).size).toBe(100);

    for (const mountain of mountains) {
      expect(mountain.regionCodes.length, mountain.name).toBeGreaterThan(0);
      expect(new Set(mountain.regionCodes).size, mountain.name).toBe(
        mountain.regionCodes.length,
      );
      expect(
        mountain.regionCodes.every((regionCode) => validRegionCodes.has(regionCode)),
        mountain.name,
      ).toBe(true);
    }
  });

  it('keeps boundary mountains discoverable from every matching region', () => {
    expect(mountains.find((mountain) => mountain.name === '지리산')?.regionCodes).toEqual([
      'gyeongnam',
      'jeonbuk',
      'jeonnam',
    ]);
    expect(mountains.find((mountain) => mountain.name === '가야산')?.regionCodes).toEqual([
      'gyeongbuk',
      'gyeongnam',
    ]);
    expect(mountains.find((mountain) => mountain.name === '한라산')?.regionCodes).toEqual([
      'jeju',
    ]);
  });
});
