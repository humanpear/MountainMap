import { describe, expect, it } from 'vitest';
import { mountains } from '../data/mountains';
import type { Mountain, MountainDifficultySummary } from '../types';
import {
  MountainDiscoveryContractError,
  createDefaultMountainFilters,
  createInitialDiscoveryState,
  discoveryReducer,
  filterMountains,
  getDifficultyFromAverage,
  normalizeFiltersForAuthentication,
  sortMountains,
  type DifficultySummaryState,
  type MountainFilters,
  type MountainSort,
} from './mountainDiscovery';

function createSummary(
  mountain: Mountain,
  averageScore: number,
  reviewCount = 1,
): MountainDifficultySummary {
  return {
    mountainId: mountain.id,
    reviewCount,
    averageScore,
  };
}

function createReadyState(
  summaries: MountainDifficultySummary[] = [],
): DifficultySummaryState {
  return {
    status: 'ready',
    summaries: new Map(summaries.map((summary) => [summary.mountainId, summary])),
  };
}

function runFilter({
  source = mountains,
  filters = createDefaultMountainFilters(),
  difficultySummaryState = createReadyState(),
  completedIds = new Set<string>(),
  isAuthenticated = true,
}: {
  source?: readonly Mountain[];
  filters?: MountainFilters;
  difficultySummaryState?: DifficultySummaryState;
  completedIds?: ReadonlySet<string>;
  isAuthenticated?: boolean;
} = {}) {
  return filterMountains({
    mountains: source,
    filters,
    difficultySummaryState,
    completedIds,
    isAuthenticated,
  });
}

describe('getDifficultyFromAverage', () => {
  it.each([
    [1, '쉬움'],
    [1.49, '쉬움'],
    [1.5, '보통'],
    [2.49, '보통'],
    [2.5, '약간 어려움'],
    [3.49, '약간 어려움'],
    [3.5, '어려움'],
    [4.49, '어려움'],
    [4.5, '매우 어려움'],
    [5, '매우 어려움'],
  ])('maps %s to %s', (averageScore, expected) => {
    expect(getDifficultyFromAverage(averageScore)).toBe(expected);
  });

  it.each([0.99, 5.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid average %s instead of clamping it',
    (averageScore) => {
      expect(() => getDifficultyFromAverage(averageScore)).toThrow(
        MountainDiscoveryContractError,
      );
    },
  );
});

describe('filterMountains', () => {
  it('returns all 100 mountains for the default filters without requiring difficulty data', () => {
    const result = runFilter({
      difficultySummaryState: { status: 'error', message: 'RPC failed' },
      isAuthenticated: false,
    });

    expect(result).toHaveLength(100);
    expect(result).not.toBe(mountains);
  });

  it('filters a single region and includes a boundary mountain in every matching region', () => {
    const gaya = mountains.find((mountain) => mountain.name === '가야산');
    expect(gaya).toBeDefined();

    const gyeongbuk = runFilter({
      filters: { ...createDefaultMountainFilters(), region: 'gyeongbuk' },
    });
    const gyeongnam = runFilter({
      filters: { ...createDefaultMountainFilters(), region: 'gyeongnam' },
    });

    expect(gyeongbuk.every((mountain) => mountain.regionCodes.includes('gyeongbuk'))).toBe(
      true,
    );
    expect(gyeongnam.every((mountain) => mountain.regionCodes.includes('gyeongnam'))).toBe(
      true,
    );
    expect(gyeongbuk).toContainEqual(gaya);
    expect(gyeongnam).toContainEqual(gaya);
  });

  it.each([
    ['쉬움', 0],
    ['보통', 1],
    ['약간 어려움', 2],
    ['어려움', 3],
    ['매우 어려움', 4],
  ] as const)('filters the %s average step', (difficulty, expectedIndex) => {
    const source = mountains.slice(0, 6);
    const difficultySummaryState = createReadyState(
      source.slice(0, 5).map((mountain, index) => createSummary(mountain, index + 1)),
    );

    expect(
      runFilter({
        source,
        filters: { ...createDefaultMountainFilters(), difficulty },
        difficultySummaryState,
      }).map((mountain) => mountain.id),
    ).toEqual([source[expectedIndex].id]);
  });

  it('includes only mountains with no summary in the unrated filter', () => {
    const source = mountains.slice(0, 3);
    const difficultySummaryState = createReadyState([
      createSummary(source[0], 2),
      createSummary(source[1], 4),
    ]);

    expect(
      runFilter({
        source,
        filters: { ...createDefaultMountainFilters(), difficulty: 'unrated' },
        difficultySummaryState,
      }),
    ).toEqual([source[2]]);
  });

  it.each([
    { status: 'idle' } as const,
    { status: 'loading' } as const,
    { status: 'error', message: 'RPC failed' } as const,
  ])('does not interpret $status difficulty data as unrated', (difficultySummaryState) => {
    expect(() =>
      runFilter({
        filters: { ...createDefaultMountainFilters(), difficulty: 'unrated' },
        difficultySummaryState,
      }),
    ).toThrow(MountainDiscoveryContractError);
  });

  it('rejects a zero-review summary instead of interpreting it as unrated', () => {
    const mountain = mountains[0];

    expect(() =>
      runFilter({
        source: [mountain],
        filters: { ...createDefaultMountainFilters(), difficulty: '보통' },
        difficultySummaryState: createReadyState([createSummary(mountain, 2, 0)]),
      }),
    ).toThrow('Invalid review count');
  });

  it('filters completed and incomplete mountains for an authenticated user', () => {
    const source = mountains.slice(0, 3);
    const completedIds = new Set([source[0].id, source[2].id]);

    expect(
      runFilter({
        source,
        filters: { ...createDefaultMountainFilters(), completion: 'completed' },
        completedIds,
      }),
    ).toEqual([source[0], source[2]]);
    expect(
      runFilter({
        source,
        filters: { ...createDefaultMountainFilters(), completion: 'incomplete' },
        completedIds,
      }),
    ).toEqual([source[1]]);
  });

  it('does not classify logged-out users as incomplete', () => {
    expect(() =>
      runFilter({
        filters: { ...createDefaultMountainFilters(), completion: 'incomplete' },
        isAuthenticated: false,
      }),
    ).toThrow('Completion filter requires an authenticated user');

    expect(
      normalizeFiltersForAuthentication(
        { ...createDefaultMountainFilters(), completion: 'incomplete' },
        false,
      ).completion,
    ).toBe('all');
  });

  it('combines region, difficulty, and completion filters with AND', () => {
    const source = mountains.slice(0, 4);
    const target = source[0];
    const sameRegion = source[1];
    const differentRegion: Mountain = {
      ...source[2],
      id: 'different-region',
      regionCodes: ['jeju'],
    };
    const candidates = [target, sameRegion, differentRegion, source[3]];
    const difficultySummaryState = createReadyState([
      createSummary(target, 1.2),
      createSummary(sameRegion, 2.1),
      createSummary(differentRegion, 1.2),
      createSummary(source[3], 1.2),
    ]);

    expect(
      runFilter({
        source: candidates,
        filters: {
          region: target.regionCodes[0],
          difficulty: '쉬움',
          completion: 'completed',
        },
        difficultySummaryState,
        completedIds: new Set([target.id, differentRegion.id]),
      }),
    ).toEqual([target]);
  });

  it('returns an empty array when no mountain matches all conditions', () => {
    expect(
      runFilter({
        filters: {
          region: 'jeju',
          difficulty: '매우 어려움',
          completion: 'all',
        },
        difficultySummaryState: createReadyState(),
      }),
    ).toEqual([]);
  });
});

describe('sortMountains', () => {
  const source: Mountain[] = [
    { ...mountains[0], id: 'mountain-c', name: '다산', elevationMeters: 500 },
    { ...mountains[0], id: 'mountain-b', name: '나산', elevationMeters: 300 },
    { ...mountains[0], id: 'mountain-a', name: '가산', elevationMeters: 500 },
  ];

  it.each([
    ['name', ['가산', '나산', '다산']],
    ['elevation-asc', ['나산', '가산', '다산']],
    ['elevation-desc', ['가산', '다산', '나산']],
  ] as Array<[MountainSort, string[]]>)('sorts by %s with name tie-breakers', (sort, expected) => {
    const originalOrder = source.map((mountain) => mountain.id);

    expect(sortMountains(source, sort).map((mountain) => mountain.name)).toEqual(expected);
    expect(source.map((mountain) => mountain.id)).toEqual(originalOrder);
  });
});

describe('discoveryReducer', () => {
  it('discards draft edits when filters are cancelled', () => {
    const initial = createInitialDiscoveryState();
    const opened = discoveryReducer(initial, { type: 'OPEN_FILTERS' });
    const edited = discoveryReducer(opened, {
      type: 'UPDATE_DRAFT_FILTERS',
      filters: { region: 'gangwon', completion: 'incomplete' },
    });
    const cancelled = discoveryReducer(edited, { type: 'CANCEL_FILTERS' });

    expect(cancelled.view).toEqual({ kind: 'closed' });
    expect(cancelled.draftFilters).toEqual(initial.appliedFilters);
    expect(cancelled.appliedFilters).toEqual(initial.appliedFilters);
  });

  it('applies draft filters and increments the map revision on every explicit apply', () => {
    const opened = discoveryReducer(createInitialDiscoveryState(), { type: 'OPEN_FILTERS' });
    const edited = discoveryReducer(opened, {
      type: 'UPDATE_DRAFT_FILTERS',
      filters: { region: 'gangwon', difficulty: '보통' },
    });
    const firstApply = discoveryReducer(edited, { type: 'APPLY_FILTERS' });
    const secondApply = discoveryReducer(firstApply, { type: 'APPLY_FILTERS' });

    expect(firstApply.appliedFilters).toEqual(edited.draftFilters);
    expect(firstApply.view).toEqual({ kind: 'results' });
    expect(firstApply.appliedRevision).toBe(1);
    expect(secondApply.appliedRevision).toBe(2);
  });

  it('clears only unavailable or unauthenticated filter dimensions', () => {
    const state = {
      ...createInitialDiscoveryState(),
      draftFilters: {
        region: 'gangwon',
        difficulty: '어려움',
        completion: 'incomplete',
      } as MountainFilters,
      appliedFilters: {
        region: 'gangwon',
        difficulty: '어려움',
        completion: 'incomplete',
      } as MountainFilters,
    };
    const withoutDifficulty = discoveryReducer(state, {
      type: 'DIFFICULTY_SUMMARIES_UNAVAILABLE',
    });
    const loggedOut = discoveryReducer(withoutDifficulty, {
      type: 'AUTHENTICATION_CHANGED',
      isAuthenticated: false,
    });

    expect(loggedOut.appliedFilters).toEqual({
      region: 'gangwon',
      difficulty: 'all',
      completion: 'all',
    });
    expect(loggedOut.appliedRevision).toBe(0);
  });

  it('changes list sorting without issuing a result-fit revision', () => {
    const state = {
      ...createInitialDiscoveryState(),
      appliedRevision: 4,
      resultScrollTop: 120,
    };
    const sorted = discoveryReducer(state, { type: 'SET_SORT', sort: 'elevation-desc' });

    expect(sorted.sort).toBe('elevation-desc');
    expect(sorted.resultScrollTop).toBe(0);
    expect(sorted.appliedRevision).toBe(4);
  });

  it('preserves result scroll position across detail and result views', () => {
    const withScroll = discoveryReducer(createInitialDiscoveryState(), {
      type: 'SET_RESULT_SCROLL_TOP',
      scrollTop: 240,
    });
    const detail = discoveryReducer(withScroll, {
      type: 'SELECT_MOUNTAIN',
      mountainId: mountains[0].id,
    });
    const results = discoveryReducer(detail, { type: 'BACK_TO_RESULTS' });

    expect(detail.resultScrollTop).toBe(240);
    expect(results.view).toEqual({ kind: 'results' });
    expect(results.resultScrollTop).toBe(240);
  });
});
