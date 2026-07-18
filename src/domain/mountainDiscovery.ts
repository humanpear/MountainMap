import {
  mountainReviewDifficulties,
  type Mountain,
  type MountainDifficultySummary,
  type MountainRegionCode,
  type MountainReviewDifficulty,
} from '../types';

export const unratedDifficultyFilter = 'unrated' as const;

export type MountainDifficultyFilter =
  | 'all'
  | MountainReviewDifficulty
  | typeof unratedDifficultyFilter;

export type MountainCompletionFilter = 'all' | 'completed' | 'incomplete';
export type MountainSort = 'name' | 'elevation-asc' | 'elevation-desc';

export type MountainFilters = {
  region: 'all' | MountainRegionCode;
  difficulty: MountainDifficultyFilter;
  completion: MountainCompletionFilter;
};

export type DifficultySummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready';
      summaries: ReadonlyMap<string, MountainDifficultySummary>;
    }
  | { status: 'error'; message: string };

export class MountainDiscoveryContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MountainDiscoveryContractError';
  }
}

export function createDefaultMountainFilters(): MountainFilters {
  return {
    region: 'all',
    difficulty: 'all',
    completion: 'all',
  };
}

export function getDifficultyFromAverage(
  averageScore: number,
): MountainReviewDifficulty {
  if (!Number.isFinite(averageScore) || averageScore < 1 || averageScore > 5) {
    throw new MountainDiscoveryContractError(
      `Invalid mountain difficulty average: ${String(averageScore)}`,
    );
  }

  const roundedScore = Math.round(averageScore);
  const difficulty = mountainReviewDifficulties[roundedScore - 1];

  if (!difficulty) {
    throw new MountainDiscoveryContractError(
      `Unable to map mountain difficulty average: ${averageScore}`,
    );
  }

  return difficulty;
}

function getDifficultyFromSummary(
  summary: MountainDifficultySummary,
): MountainReviewDifficulty {
  if (!Number.isSafeInteger(summary.reviewCount) || summary.reviewCount < 1) {
    throw new MountainDiscoveryContractError(
      `Invalid review count for mountain ${summary.mountainId}: ${String(summary.reviewCount)}`,
    );
  }

  return getDifficultyFromAverage(summary.averageScore);
}

type FilterMountainsOptions = {
  mountains: readonly Mountain[];
  filters: MountainFilters;
  difficultySummaryState: DifficultySummaryState;
  completedIds: ReadonlySet<string>;
  isAuthenticated: boolean;
};

export function filterMountains({
  mountains,
  filters,
  difficultySummaryState,
  completedIds,
  isAuthenticated,
}: FilterMountainsOptions): Mountain[] {
  if (filters.difficulty !== 'all' && difficultySummaryState.status !== 'ready') {
    throw new MountainDiscoveryContractError(
      `Difficulty filter requires ready summaries, received ${difficultySummaryState.status}`,
    );
  }

  if (filters.completion !== 'all' && !isAuthenticated) {
    throw new MountainDiscoveryContractError(
      'Completion filter requires an authenticated user',
    );
  }

  return mountains.filter((mountain) => {
    if (filters.region !== 'all' && !mountain.regionCodes.includes(filters.region)) {
      return false;
    }

    if (filters.difficulty !== 'all') {
      if (difficultySummaryState.status !== 'ready') {
        return false;
      }

      const summary = difficultySummaryState.summaries.get(mountain.id);

      if (filters.difficulty === unratedDifficultyFilter) {
        if (summary) {
          getDifficultyFromSummary(summary);
          return false;
        }
      } else {
        if (!summary || getDifficultyFromSummary(summary) !== filters.difficulty) {
          return false;
        }
      }
    }

    if (filters.completion !== 'all') {
      const isCompleted = completedIds.has(mountain.id);
      if (filters.completion === 'completed' && !isCompleted) {
        return false;
      }
      if (filters.completion === 'incomplete' && isCompleted) {
        return false;
      }
    }

    return true;
  });
}

const koreanMountainNameCollator = new Intl.Collator('ko-KR');

function compareMountainNames(left: Mountain, right: Mountain) {
  return (
    koreanMountainNameCollator.compare(left.name, right.name) ||
    left.id.localeCompare(right.id)
  );
}

export function sortMountains(
  mountains: readonly Mountain[],
  sort: MountainSort,
): Mountain[] {
  return [...mountains].sort((left, right) => {
    if (sort === 'elevation-asc') {
      return left.elevationMeters - right.elevationMeters || compareMountainNames(left, right);
    }

    if (sort === 'elevation-desc') {
      return right.elevationMeters - left.elevationMeters || compareMountainNames(left, right);
    }

    return compareMountainNames(left, right);
  });
}

export function normalizeFiltersForAuthentication(
  filters: MountainFilters,
  isAuthenticated: boolean,
): MountainFilters {
  return isAuthenticated || filters.completion === 'all'
    ? { ...filters }
    : { ...filters, completion: 'all' };
}

type RestorableDiscoveryView =
  | { kind: 'closed' }
  | { kind: 'results' }
  | { kind: 'detail'; mountainId: string };

export type DiscoveryView =
  | RestorableDiscoveryView
  | { kind: 'filters'; returnView: RestorableDiscoveryView }
  | {
      kind: 'random-running';
      winnerId: string;
      highlightedId: string;
      sequenceIds: readonly string[];
    };

export type DiscoveryState = {
  view: DiscoveryView;
  draftFilters: MountainFilters;
  appliedFilters: MountainFilters;
  sort: MountainSort;
  resultScrollTop: number;
  appliedRevision: number;
};

export type DiscoveryAction =
  | { type: 'OPEN_FILTERS' }
  | { type: 'UPDATE_DRAFT_FILTERS'; filters: Partial<MountainFilters> }
  | { type: 'CANCEL_FILTERS' }
  | { type: 'APPLY_FILTERS' }
  | { type: 'RESET_FILTERS' }
  | { type: 'DIFFICULTY_SUMMARIES_UNAVAILABLE' }
  | { type: 'AUTHENTICATION_CHANGED'; isAuthenticated: boolean }
  | { type: 'SET_SORT'; sort: MountainSort }
  | { type: 'SET_RESULT_SCROLL_TOP'; scrollTop: number }
  | { type: 'SELECT_MOUNTAIN'; mountainId: string }
  | { type: 'BACK_TO_RESULTS' }
  | { type: 'CLOSE_DISCOVERY' }
  | {
      type: 'START_RANDOM';
      winnerId: string;
      highlightedId: string;
      sequenceIds: readonly string[];
    }
  | { type: 'RANDOM_TICK'; highlightedId: string }
  | { type: 'FINISH_RANDOM' }
  | { type: 'CANCEL_RANDOM' };

export function createInitialDiscoveryState(): DiscoveryState {
  const filters = createDefaultMountainFilters();
  return {
    view: { kind: 'closed' },
    draftFilters: { ...filters },
    appliedFilters: { ...filters },
    sort: 'name',
    resultScrollTop: 0,
    appliedRevision: 0,
  };
}

function getFilterReturnView(view: DiscoveryView): RestorableDiscoveryView {
  if (view.kind === 'filters') {
    return view.returnView;
  }
  if (view.kind === 'random-running') {
    return { kind: 'results' };
  }
  return view;
}

export function discoveryReducer(
  state: DiscoveryState,
  action: DiscoveryAction,
): DiscoveryState {
  switch (action.type) {
    case 'OPEN_FILTERS':
      return {
        ...state,
        view: { kind: 'filters', returnView: getFilterReturnView(state.view) },
        draftFilters: { ...state.appliedFilters },
      };
    case 'UPDATE_DRAFT_FILTERS':
      return {
        ...state,
        draftFilters: { ...state.draftFilters, ...action.filters },
      };
    case 'CANCEL_FILTERS':
      return {
        ...state,
        view: state.view.kind === 'filters' ? state.view.returnView : state.view,
        draftFilters: { ...state.appliedFilters },
      };
    case 'APPLY_FILTERS':
      return {
        ...state,
        view: { kind: 'results' },
        appliedFilters: { ...state.draftFilters },
        resultScrollTop: 0,
        appliedRevision: state.appliedRevision + 1,
      };
    case 'RESET_FILTERS': {
      const filters = createDefaultMountainFilters();
      return {
        ...state,
        view: { kind: 'results' },
        draftFilters: { ...filters },
        appliedFilters: { ...filters },
        resultScrollTop: 0,
        appliedRevision: state.appliedRevision + 1,
      };
    }
    case 'DIFFICULTY_SUMMARIES_UNAVAILABLE':
      return {
        ...state,
        draftFilters: { ...state.draftFilters, difficulty: 'all' },
        appliedFilters: { ...state.appliedFilters, difficulty: 'all' },
      };
    case 'AUTHENTICATION_CHANGED':
      return {
        ...state,
        draftFilters: normalizeFiltersForAuthentication(
          state.draftFilters,
          action.isAuthenticated,
        ),
        appliedFilters: normalizeFiltersForAuthentication(
          state.appliedFilters,
          action.isAuthenticated,
        ),
      };
    case 'SET_SORT':
      return {
        ...state,
        sort: action.sort,
        resultScrollTop: 0,
      };
    case 'SET_RESULT_SCROLL_TOP':
      return {
        ...state,
        resultScrollTop:
          Number.isFinite(action.scrollTop) && action.scrollTop > 0 ? action.scrollTop : 0,
      };
    case 'SELECT_MOUNTAIN':
      return { ...state, view: { kind: 'detail', mountainId: action.mountainId } };
    case 'BACK_TO_RESULTS':
    case 'CANCEL_RANDOM':
      return { ...state, view: { kind: 'results' } };
    case 'CLOSE_DISCOVERY':
      return { ...state, view: { kind: 'closed' } };
    case 'START_RANDOM':
      return {
        ...state,
        view: {
          kind: 'random-running',
          winnerId: action.winnerId,
          highlightedId: action.highlightedId,
          sequenceIds: [...action.sequenceIds],
        },
      };
    case 'RANDOM_TICK':
      return state.view.kind === 'random-running'
        ? { ...state, view: { ...state.view, highlightedId: action.highlightedId } }
        : state;
    case 'FINISH_RANDOM':
      return state.view.kind === 'random-running'
        ? { ...state, view: { kind: 'detail', mountainId: state.view.winnerId } }
        : state;
    default:
      return state;
  }
}
