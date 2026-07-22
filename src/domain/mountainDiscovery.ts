import {
  mountainReviewDifficulties,
  type Mountain,
  type MountainDifficultySummary,
  type MountainRegionCode,
  type MountainReviewDifficulty,
} from '../types';

export const unratedDifficultyFilter = 'unrated' as const;

export type MountainDifficultyFilter =
  | MountainReviewDifficulty
  | typeof unratedDifficultyFilter;

export type MountainCompletionFilter = 'completed' | 'incomplete';
export type MountainSort = 'name' | 'elevation-asc' | 'elevation-desc';

export type MountainFilters = {
  region: MountainRegionCode[];
  difficulty: MountainDifficultyFilter[];
  completion: MountainCompletionFilter[];
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
    region: [],
    difficulty: [],
    completion: [],
  };
}

function cloneMountainFilters(filters: MountainFilters): MountainFilters {
  return {
    region: [...filters.region],
    difficulty: [...filters.difficulty],
    completion: [...filters.completion],
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
  if (filters.difficulty.length > 0 && difficultySummaryState.status !== 'ready') {
    throw new MountainDiscoveryContractError(
      `Difficulty filter requires ready summaries, received ${difficultySummaryState.status}`,
    );
  }

  if (filters.completion.length > 0 && !isAuthenticated) {
    throw new MountainDiscoveryContractError(
      'Completion filter requires an authenticated user',
    );
  }

  return mountains.filter((mountain) => {
    if (
      filters.region.length > 0
      && !filters.region.some((region) => mountain.regionCodes.includes(region))
    ) {
      return false;
    }

    if (filters.difficulty.length > 0) {
      if (difficultySummaryState.status !== 'ready') {
        return false;
      }

      const summary = difficultySummaryState.summaries.get(mountain.id);

      if (!summary) {
        if (!filters.difficulty.includes(unratedDifficultyFilter)) {
          return false;
        }
      } else if (!filters.difficulty.includes(getDifficultyFromSummary(summary))) {
        return false;
      }
    }

    if (filters.completion.length > 0) {
      const isCompleted = completedIds.has(mountain.id);
      const completion = isCompleted ? 'completed' : 'incomplete';
      if (!filters.completion.includes(completion)) {
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
  const normalized = cloneMountainFilters(filters);
  return isAuthenticated
    ? normalized
    : { ...normalized, completion: [] };
}

type RestorableDiscoveryView =
  | { kind: 'closed' }
  | { kind: 'results' }
  | { kind: 'detail' };

export type DiscoveryView =
  | RestorableDiscoveryView
  | { kind: 'filters'; returnView: RestorableDiscoveryView }
  | {
      kind: 'random-running';
      winnerId: string;
      highlightedId: string;
      sequenceIds: readonly string[];
      phase: 'spinning' | 'winner';
    };

/*
 * Selection is stable state; surfaces and one-shot effects are independent.
 *
 * selectedMountainId ──> marker + mobile info bar / desktop detail
 *          │
 *          ├───────────> view (filters, results, detail, random)
 *          └───────────> revisioned camera / reveal / focus requests ──> ACK
 */
export type DiscoveryState = {
  selectedMountainId?: string;
  view: DiscoveryView;
  cameraRequest?: {
    mountainId: string;
    revision: number;
    reason: 'list-selection' | 'random-winner';
  };
  resultRevealRequest?: {
    mountainId: string;
    revision: number;
    reason: 'info-bar' | 'detail-return';
  };
  focusRequest?: {
    target:
      | 'detail-heading'
      | 'results-heading'
      | 'info-detail-button'
      | 'info-list-button'
      | 'map';
    revision: number;
  };
  nextEffectRevision: number;
  draftFilters: MountainFilters;
  appliedFilters: MountainFilters;
  sort: MountainSort;
  resultScrollTop: number;
  appliedRevision: number;
  cameraResetRevision: number;
};

export type DiscoveryAction =
  | { type: 'OPEN_FILTERS' }
  | { type: 'UPDATE_DRAFT_FILTERS'; filters: Partial<MountainFilters> }
  | { type: 'CANCEL_FILTERS' }
  | { type: 'APPLY_FILTERS' }
  | { type: 'RESET_FILTERS' }
  | { type: 'RESET_DISCOVERY' }
  | { type: 'DIFFICULTY_SUMMARIES_UNAVAILABLE' }
  | { type: 'AUTH_IDENTITY_CHANGED'; isAuthenticated: boolean }
  | { type: 'COMPLETION_FILTER_AVAILABILITY_CHANGED'; available: boolean }
  | { type: 'SET_SORT'; sort: MountainSort }
  | { type: 'SET_RESULT_SCROLL_TOP'; scrollTop: number }
  | { type: 'SELECT_FROM_MAP'; mountainId: string }
  | { type: 'SELECT_FROM_LIST'; mountainId: string }
  | { type: 'OPEN_SELECTED_DETAIL' }
  | { type: 'OPEN_SELECTED_RESULTS' }
  | { type: 'RETURN_TO_RESULTS' }
  | { type: 'CLOSE_MOBILE_SURFACE' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CAMERA_REQUEST_HANDLED'; revision: number }
  | { type: 'RESULT_REVEAL_HANDLED'; revision: number }
  | { type: 'FOCUS_REQUEST_HANDLED'; revision: number }
  | {
      type: 'START_RANDOM';
      winnerId: string;
      highlightedId: string;
      sequenceIds: readonly string[];
    }
  | { type: 'RANDOM_TICK'; highlightedId: string }
  | { type: 'ANNOUNCE_RANDOM_WINNER' }
  | { type: 'FINISH_RANDOM' }
  | { type: 'CANCEL_RANDOM' };

export function createInitialDiscoveryState(): DiscoveryState {
  const filters = createDefaultMountainFilters();
  return {
    view: { kind: 'closed' },
    nextEffectRevision: 0,
    draftFilters: cloneMountainFilters(filters),
    appliedFilters: cloneMountainFilters(filters),
    sort: 'name',
    resultScrollTop: 0,
    appliedRevision: 0,
    cameraResetRevision: 0,
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

function areFilterValuesEqual<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export function areMountainFiltersEqual(left: MountainFilters, right: MountainFilters) {
  return (
    areFilterValuesEqual(left.region, right.region)
    && areFilterValuesEqual(left.difficulty, right.difficulty)
    && areFilterValuesEqual(left.completion, right.completion)
  );
}

function clearOneShotRequests() {
  return {
    cameraRequest: undefined,
    resultRevealRequest: undefined,
    focusRequest: undefined,
  };
}

function getViewWithoutSelection(view: DiscoveryView): DiscoveryView {
  if (view.kind === 'detail' || view.kind === 'random-running') {
    return { kind: 'closed' };
  }
  if (view.kind === 'filters' && view.returnView.kind === 'detail') {
    return { ...view, returnView: { kind: 'closed' } };
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
        draftFilters: cloneMountainFilters(state.appliedFilters),
      };
    case 'UPDATE_DRAFT_FILTERS':
      return {
        ...state,
        draftFilters: cloneMountainFilters({ ...state.draftFilters, ...action.filters }),
      };
    case 'CANCEL_FILTERS':
      return {
        ...state,
        view: state.view.kind === 'filters' ? state.view.returnView : state.view,
        draftFilters: cloneMountainFilters(state.appliedFilters),
      };
    case 'APPLY_FILTERS':
      {
        const filtersChanged = !areMountainFiltersEqual(
          state.appliedFilters,
          state.draftFilters,
        );
        return {
          ...state,
          ...(filtersChanged
            ? { selectedMountainId: undefined, ...clearOneShotRequests() }
            : {}),
          view: { kind: 'results' },
          appliedFilters: cloneMountainFilters(state.draftFilters),
          resultScrollTop: 0,
          appliedRevision: state.appliedRevision + 1,
        };
      }
    case 'RESET_FILTERS': {
      const filters = createDefaultMountainFilters();
      return {
        ...state,
        selectedMountainId: undefined,
        ...clearOneShotRequests(),
        view: { kind: 'closed' },
        draftFilters: cloneMountainFilters(filters),
        appliedFilters: cloneMountainFilters(filters),
        resultScrollTop: 0,
        cameraResetRevision: state.cameraResetRevision + 1,
      };
    }
    case 'RESET_DISCOVERY': {
      const filters = createDefaultMountainFilters();
      return {
        ...state,
        selectedMountainId: undefined,
        ...clearOneShotRequests(),
        view: { kind: 'closed' },
        draftFilters: cloneMountainFilters(filters),
        appliedFilters: cloneMountainFilters(filters),
        resultScrollTop: 0,
        cameraResetRevision: state.cameraResetRevision + 1,
      };
    }
    case 'DIFFICULTY_SUMMARIES_UNAVAILABLE':
      return {
        ...state,
        draftFilters: { ...cloneMountainFilters(state.draftFilters), difficulty: [] },
        appliedFilters: { ...cloneMountainFilters(state.appliedFilters), difficulty: [] },
      };
    case 'AUTH_IDENTITY_CHANGED':
      return {
        ...state,
        selectedMountainId: undefined,
        ...clearOneShotRequests(),
        view: getViewWithoutSelection(state.view),
        draftFilters: normalizeFiltersForAuthentication(
          state.draftFilters,
          action.isAuthenticated,
        ),
        appliedFilters: normalizeFiltersForAuthentication(
          state.appliedFilters,
          action.isAuthenticated,
        ),
      };
    case 'COMPLETION_FILTER_AVAILABILITY_CHANGED':
      return action.available
        ? state
        : {
            ...state,
            draftFilters: { ...cloneMountainFilters(state.draftFilters), completion: [] },
            appliedFilters: { ...cloneMountainFilters(state.appliedFilters), completion: [] },
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
    case 'SELECT_FROM_MAP':
      return {
        ...state,
        selectedMountainId: action.mountainId,
        view: { kind: 'closed' },
        ...clearOneShotRequests(),
      };
    case 'SELECT_FROM_LIST': {
      const revision = state.nextEffectRevision + 1;
      return {
        ...state,
        selectedMountainId: action.mountainId,
        view: { kind: 'detail' },
        cameraRequest: {
          mountainId: action.mountainId,
          revision,
          reason: 'list-selection',
        },
        resultRevealRequest: undefined,
        focusRequest: { target: 'detail-heading', revision },
        nextEffectRevision: revision,
      };
    }
    case 'OPEN_SELECTED_DETAIL': {
      if (!state.selectedMountainId) {
        return state;
      }
      const revision = state.nextEffectRevision + 1;
      return {
        ...state,
        view: { kind: 'detail' },
        focusRequest: { target: 'detail-heading', revision },
        nextEffectRevision: revision,
      };
    }
    case 'OPEN_SELECTED_RESULTS': {
      if (!state.selectedMountainId) {
        return state;
      }
      const revision = state.nextEffectRevision + 1;
      return {
        ...state,
        view: { kind: 'results' },
        resultRevealRequest: {
          mountainId: state.selectedMountainId,
          revision,
          reason: 'info-bar',
        },
        focusRequest: { target: 'results-heading', revision },
        nextEffectRevision: revision,
      };
    }
    case 'RETURN_TO_RESULTS': {
      const revision = state.nextEffectRevision + 1;
      return {
        ...state,
        view: { kind: 'results' },
        resultRevealRequest: state.selectedMountainId
          ? {
              mountainId: state.selectedMountainId,
              revision,
              reason: 'detail-return',
            }
          : undefined,
        focusRequest: { target: 'results-heading', revision },
        nextEffectRevision: revision,
      };
    }
    case 'CANCEL_RANDOM':
      return { ...state, view: { kind: 'results' } };
    case 'CLOSE_MOBILE_SURFACE': {
      const revision = state.nextEffectRevision + 1;
      return {
        ...state,
        view: { kind: 'closed' },
        focusRequest: {
          target: state.selectedMountainId ? 'info-detail-button' : 'map',
          revision,
        },
        nextEffectRevision: revision,
      };
    }
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedMountainId: undefined,
        view: getViewWithoutSelection(state.view),
        ...clearOneShotRequests(),
      };
    case 'CAMERA_REQUEST_HANDLED':
      return state.cameraRequest?.revision === action.revision
        ? { ...state, cameraRequest: undefined }
        : state;
    case 'RESULT_REVEAL_HANDLED':
      return state.resultRevealRequest?.revision === action.revision
        ? { ...state, resultRevealRequest: undefined }
        : state;
    case 'FOCUS_REQUEST_HANDLED':
      return state.focusRequest?.revision === action.revision
        ? { ...state, focusRequest: undefined }
        : state;
    case 'START_RANDOM':
      return {
        ...state,
        selectedMountainId: undefined,
        ...clearOneShotRequests(),
        view: {
          kind: 'random-running',
          winnerId: action.winnerId,
          highlightedId: action.highlightedId,
          sequenceIds: [...action.sequenceIds],
          phase: 'spinning',
        },
      };
    case 'RANDOM_TICK':
      return state.view.kind === 'random-running'
        ? { ...state, view: { ...state.view, highlightedId: action.highlightedId } }
        : state;
    case 'ANNOUNCE_RANDOM_WINNER':
      return state.view.kind === 'random-running'
        ? {
            ...state,
            view: {
              ...state.view,
              highlightedId: state.view.winnerId,
              phase: 'winner',
            },
          }
        : state;
    case 'FINISH_RANDOM':
      if (state.view.kind !== 'random-running') {
        return state;
      }
      {
        const mountainId = state.view.winnerId;
        const revision = state.nextEffectRevision + 1;
        return {
          ...state,
          selectedMountainId: mountainId,
          view: { kind: 'closed' },
          cameraRequest: { mountainId, revision, reason: 'random-winner' },
          resultRevealRequest: undefined,
          focusRequest: { target: 'map', revision },
          nextEffectRevision: revision,
        };
      }
    default: {
      const exhaustiveAction: never = action;
      void exhaustiveAction;
      return state;
    }
  }
}
