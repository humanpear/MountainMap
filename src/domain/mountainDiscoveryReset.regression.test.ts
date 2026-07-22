import { describe, expect, it } from 'vitest';
import {
  createInitialDiscoveryState,
  discoveryReducer,
} from './mountainDiscovery';

describe('discovery reset regression', () => {
  it('clears filters and returns to the initial closed map view', () => {
    const opened = discoveryReducer(createInitialDiscoveryState(), { type: 'OPEN_FILTERS' });
    const edited = discoveryReducer(opened, {
      type: 'UPDATE_DRAFT_FILTERS',
      filters: { region: ['gangwon'], difficulty: ['어려움'] },
    });
    const results = discoveryReducer(edited, { type: 'APPLY_FILTERS' });
    const reset = discoveryReducer(results, { type: 'RESET_DISCOVERY' });

    expect(reset.view).toEqual({ kind: 'closed' });
    expect(reset.draftFilters).toEqual({
      region: [],
      difficulty: [],
      completion: [],
    });
    expect(reset.appliedFilters).toEqual(reset.draftFilters);
    expect(reset.resultScrollTop).toBe(0);
    expect(reset.appliedRevision).toBe(results.appliedRevision);
    expect(reset.cameraResetRevision).toBe(results.cameraResetRevision + 1);
  });
});
