import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ArrowLeft, Check, ListFilter, RotateCcw, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import { getMountainGuide } from '../data/mountainDetails';
import {
  getDifficultyFromAverage,
  unratedDifficultyFilter,
  type DifficultySummaryState,
  type DiscoveryAction,
  type DiscoveryState,
  type MountainDifficultyFilter,
} from '../domain/mountainDiscovery';
import { cn } from '../lib/classNames';
import {
  mountainRegionCodes,
  mountainReviewDifficulties,
  type Mountain,
  type MountainRegionCode,
} from '../types';

const regionLabels: Record<MountainRegionCode, string> = {
  'seoul-gyeonggi': '서울/경기',
  gangwon: '강원도',
  chungnam: '충청남도',
  chungbuk: '충청북도',
  gyeongbuk: '경상북도',
  gyeongnam: '경상남도',
  jeonbuk: '전라북도',
  jeonnam: '전라남도',
  jeju: '제주도',
};

const difficultyFilterLabels: Array<{
  value: MountainDifficultyFilter;
  label: string;
}> = [
  { value: 'all', label: '전체' },
  ...mountainReviewDifficulties.map((difficulty) => ({
    value: difficulty,
    label: difficulty,
  })),
  { value: unratedDifficultyFilter, label: '평가 전' },
];

function getMountainImage(mountain: Mountain) {
  return getMountainGuide(mountain).heroImage?.src ?? `/mountain-images/${mountain.id}/hero.png`;
}

function hasAppliedFilters(state: DiscoveryState) {
  return Object.values(state.appliedFilters).some((value) => value !== 'all');
}

function getAppliedFilterSummary(state: DiscoveryState) {
  const labels: string[] = [];
  const { appliedFilters } = state;

  if (appliedFilters.region !== 'all') {
    labels.push(regionLabels[appliedFilters.region]);
  }
  if (appliedFilters.difficulty !== 'all') {
    labels.push(
      appliedFilters.difficulty === unratedDifficultyFilter
        ? '평가 전'
        : appliedFilters.difficulty,
    );
  }
  if (appliedFilters.completion !== 'all') {
    labels.push(appliedFilters.completion === 'completed' ? '등정 완료' : '미등정');
  }

  return labels.length > 0 ? labels.join(' · ') : '전체 산';
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function useMobileDiscoveryLayout() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 900px)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return isMobile;
}

const mobileDiscoveryHistoryKey = '__mountainMapDiscoverySheet';

function hasMobileDiscoveryHistoryEntry() {
  return Boolean(window.history.state?.[mobileDiscoveryHistoryKey]);
}

function pushMobileDiscoveryHistoryEntry() {
  if (hasMobileDiscoveryHistoryEntry()) {
    return;
  }

  window.history.pushState(
    { ...window.history.state, [mobileDiscoveryHistoryKey]: true },
    '',
    window.location.href,
  );
}

function dismissMobileDiscoveryHistoryEntry() {
  if (hasMobileDiscoveryHistoryEntry()) {
    window.history.back();
  }
}

type CompletionDataStatus = 'signed-out' | 'loading' | 'ready' | 'error';

type MountainDiscoveryControlsProps = {
  state: DiscoveryState;
  draftResultCount: number;
  appliedResultCount: number;
  difficultySummaryState: DifficultySummaryState;
  isAuthenticated: boolean;
  completionDataStatus: CompletionDataStatus;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onAction: (action: DiscoveryAction) => void;
  onRetryDifficultySummaries: () => void;
  onRequestLogin: () => void;
};

export function MountainDiscoveryControls({
  state,
  draftResultCount,
  appliedResultCount,
  difficultySummaryState,
  isAuthenticated,
  completionDataStatus,
  triggerRef,
  onAction,
  onRetryDifficultySummaries,
  onRequestLogin,
}: MountainDiscoveryControlsProps) {
  const filterPanelRef = useRef<HTMLElement | null>(null);
  const isMobile = useMobileDiscoveryLayout();
  const isFilterOpen = state.view.kind === 'filters';

  useEffect(() => {
    if (!isFilterOpen || !isMobile) {
      return;
    }

    pushMobileDiscoveryHistoryEntry();
    const handlePopState = () => {
      onAction({ type: 'CANCEL_FILTERS' });
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isFilterOpen, isMobile, onAction, triggerRef]);

  const dismissFilters = () => {
    onAction({ type: 'CANCEL_FILTERS' });
    if (isMobile) {
      dismissMobileDiscoveryHistoryEntry();
    }
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const panel = filterPanelRef.current;
    const firstFocusable = panel ? getFocusableElements(panel)[0] : null;
    firstFocusable?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel?.contains(target) && !triggerRef.current?.contains(target)) {
        dismissFilters();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissFilters();
        return;
      }

      if (
        event.key !== 'Tab' ||
        !window.matchMedia?.('(max-width: 900px)').matches ||
        !panel
      ) {
        return;
      }

      const focusable = getFocusableElements(panel);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissFilters, isFilterOpen, triggerRef]);

  const closeFilters = () => {
    dismissFilters();
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAction({ type: 'APPLY_FILTERS' });
  };

  return (
    <>
      <div className="absolute left-5 top-5 z-[3] flex max-w-[calc(100%-40px)] items-center gap-2 rounded-xl border border-[#d8e0da] bg-white/95 p-2 shadow-[0_16px_50px_rgba(24,34,29,0.14)] max-[560px]:left-3 max-[560px]:top-3 max-[560px]:max-w-[calc(100%-24px)] max-[560px]:p-1.5">
        <button
          ref={triggerRef}
          className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-base font-extrabold text-white"
          type="button"
          onClick={() => onAction({ type: 'OPEN_FILTERS' })}
          aria-expanded={isFilterOpen}
          aria-controls="mountain-discovery-filters"
        >
          <SlidersHorizontal size={18} />
          산 찾기
        </button>
        <span className="min-w-0 truncate px-1 text-base font-bold text-[#5d6a62]">
          {getAppliedFilterSummary(state)} · {appliedResultCount.toLocaleString()}개
        </span>
        {hasAppliedFilters(state) ? (
          <button
            className="inline-flex min-h-11 flex-none items-center justify-center gap-1.5 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-extrabold text-[#18221d]"
            type="button"
            onClick={() => onAction({ type: 'RESET_FILTERS' })}
          >
            <RotateCcw size={16} />
            <span className="max-[560px]:sr-only">필터 </span>초기화
          </button>
        ) : null}
      </div>

      {isFilterOpen ? (
        <>
          <button
            className="fixed inset-0 z-[5] hidden cursor-default border-0 bg-black/85 p-0 max-[900px]:block"
            type="button"
            aria-label="조건으로 찾기 닫기"
            onClick={closeFilters}
          />
          <section
            ref={filterPanelRef}
            id="mountain-discovery-filters"
            className="absolute left-5 top-[84px] z-[6] max-h-[calc(100%-104px)] w-[min(420px,calc(100%-40px))] overflow-y-auto rounded-xl border border-[#d8e0da] bg-white p-5 shadow-[0_20px_70px_rgba(24,34,29,0.2)] max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:top-auto max-[900px]:w-auto max-[900px]:max-h-[78vh] max-[900px]:rounded-b-none max-[900px]:rounded-t-2xl max-[900px]:border-x-0 max-[900px]:border-b-0 max-[900px]:p-4 max-[900px]:pb-[calc(1rem+env(safe-area-inset-bottom))]"
            role="dialog"
            aria-modal={isMobile || undefined}
            aria-labelledby="mountain-discovery-filter-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-sm font-black text-[#245c46]">100대 명산</p>
                <h2 id="mountain-discovery-filter-title" className="m-0 mt-1 text-xl font-black text-[#18221d]">
                  조건으로 찾기
                </h2>
              </div>
              <button
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef3f0] text-[#18221d]"
                type="button"
                onClick={closeFilters}
                aria-label="조건으로 찾기 닫기"
              >
                <X size={19} />
              </button>
            </div>

            <form className="mt-5 grid gap-5" onSubmit={applyFilters}>
              <label className="grid gap-2 text-base font-black text-[#18221d]">
                지역
                <select
                  className="min-h-11 w-full rounded-lg border border-[#d8e0da] bg-white px-3 text-base font-bold text-[#18221d]"
                  value={state.draftFilters.region}
                  onChange={(event) =>
                    onAction({
                      type: 'UPDATE_DRAFT_FILTERS',
                      filters: { region: event.target.value as 'all' | MountainRegionCode },
                    })
                  }
                >
                  <option value="all">전체 지역</option>
                  {mountainRegionCodes.map((region) => (
                    <option key={region} value={region}>
                      {regionLabels[region]}
                    </option>
                  ))}
                </select>
              </label>

              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-2 text-base font-black text-[#18221d]">체감 난이도</legend>
                {difficultySummaryState.status === 'loading' || difficultySummaryState.status === 'idle' ? (
                  <p className="m-0 rounded-lg bg-[#eef3f0] p-3 text-base font-bold text-[#5d6a62]" role="status">
                    난이도 정보를 불러오는 중입니다.
                  </p>
                ) : difficultySummaryState.status === 'error' ? (
                  <div className="rounded-lg border border-[#e7c8c1] bg-[#fff4f1] p-3 text-base text-[#6d3028]" role="alert">
                    <p className="m-0 font-bold">난이도 정보를 불러오지 못했습니다.</p>
                    <button
                      className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-[#b14a3d] bg-white px-4 font-extrabold text-[#8c382e]"
                      type="button"
                      onClick={onRetryDifficultySummaries}
                    >
                      다시 시도
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {difficultyFilterLabels.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          'inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-base font-bold',
                          state.draftFilters.difficulty === option.value
                            ? 'border-[#245c46] bg-[#245c46] text-white'
                            : 'border-[#d8e0da] bg-white text-[#18221d]',
                        )}
                        type="button"
                        onClick={() =>
                          onAction({
                            type: 'UPDATE_DRAFT_FILTERS',
                            filters: { difficulty: option.value },
                          })
                        }
                        aria-pressed={state.draftFilters.difficulty === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>

              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-2 text-base font-black text-[#18221d]">등정 상태</legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['all', '전체'],
                    ['completed', '등정 완료'],
                    ['incomplete', '미등정'],
                  ] as const).map(([value, label]) => {
                    const requiresLogin = value !== 'all' && !isAuthenticated;
                    const completionDataUnavailable =
                      value !== 'all' && (requiresLogin || completionDataStatus !== 'ready');
                    return (
                      <button
                        key={value}
                        className={cn(
                          'inline-flex min-h-11 items-center justify-center rounded-lg border px-2 text-sm font-bold',
                          state.draftFilters.completion === value
                            ? 'border-[#245c46] bg-[#245c46] text-white'
                            : 'border-[#d8e0da] bg-white text-[#18221d]',
                          completionDataUnavailable && 'cursor-not-allowed opacity-45',
                        )}
                        type="button"
                        disabled={completionDataUnavailable}
                        onClick={() =>
                          onAction({
                            type: 'UPDATE_DRAFT_FILTERS',
                            filters: { completion: value },
                          })
                        }
                        aria-pressed={state.draftFilters.completion === value}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {!isAuthenticated ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-[#eef3f0] p-3 text-base text-[#5d6a62]">
                    <span>등정 기록 필터는 로그인이 필요합니다.</span>
                    <button
                      className="min-h-11 flex-none rounded-lg border border-[#245c46] bg-white px-3 font-extrabold text-[#245c46]"
                      type="button"
                      onClick={onRequestLogin}
                    >
                      로그인
                    </button>
                  </div>
                ) : completionDataStatus === 'loading' ? (
                  <p className="m-0 rounded-lg bg-[#eef3f0] p-3 text-base font-bold text-[#5d6a62]" role="status">
                    등정 기록을 불러오는 중입니다.
                  </p>
                ) : completionDataStatus === 'error' ? (
                  <p className="m-0 rounded-lg border border-[#e7c8c1] bg-[#fff4f1] p-3 text-base font-bold text-[#6d3028]" role="alert">
                    등정 기록을 불러오지 못해 완료·미등정 필터를 사용할 수 없습니다.
                  </p>
                ) : null}
              </fieldset>

              <div className="sticky bottom-0 grid grid-cols-[minmax(0,1fr)_2fr] gap-2 bg-white pt-1">
                <button
                  className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-base font-extrabold text-[#18221d]"
                  type="button"
                  onClick={closeFilters}
                >
                  취소
                </button>
                <button
                  className="min-h-11 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-base font-extrabold text-white"
                  type="submit"
                >
                  {draftResultCount.toLocaleString()}개 산 보기
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </>
  );
}

type MountainDiscoveryPanelProps = {
  state: DiscoveryState;
  resultMountains: readonly Mountain[];
  difficultySummaryState: DifficultySummaryState;
  completedIds: ReadonlySet<string>;
  isAuthenticated: boolean;
  completionDataStatus: CompletionDataStatus;
  triggerRef: RefObject<HTMLButtonElement | null>;
  detailContent?: ReactNode;
  onAction: (action: DiscoveryAction) => void;
  onSelectMountain: (mountain: Mountain) => void;
  onRandomRecommend: () => void;
};

function getMountainDifficultyLabel(
  mountainId: string,
  difficultySummaryState: DifficultySummaryState,
) {
  if (difficultySummaryState.status === 'loading' || difficultySummaryState.status === 'idle') {
    return '불러오는 중';
  }
  if (difficultySummaryState.status === 'error') {
    return '정보를 불러오지 못함';
  }

  const summary = difficultySummaryState.summaries.get(mountainId);
  return summary ? getDifficultyFromAverage(summary.averageScore) : '평가 전';
}

export function MountainDiscoveryPanel({
  state,
  resultMountains,
  difficultySummaryState,
  completedIds,
  isAuthenticated,
  completionDataStatus,
  triggerRef,
  detailContent,
  onAction,
  onSelectMountain,
  onRandomRecommend,
}: MountainDiscoveryPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const isMobile = useMobileDiscoveryLayout();
  const isResults = state.view.kind === 'results';
  const isDetail = state.view.kind === 'detail';
  const isRandomRunning = state.view.kind === 'random-running';
  const isOpen = isResults || isDetail || isRandomRunning;

  useEffect(() => {
    if (!isOpen || !isMobile) {
      return;
    }

    pushMobileDiscoveryHistoryEntry();
    const handlePopState = () => {
      onAction({ type: 'CLOSE_DISCOVERY' });
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile, isOpen, onAction, triggerRef]);

  const dismissPanel = () => {
    onAction({ type: 'CLOSE_DISCOVERY' });
    if (isMobile) {
      dismissMobileDiscoveryHistoryEntry();
    }
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (isResults && listRef.current) {
      listRef.current.scrollTop = state.resultScrollTop;
    }
  }, [isResults, state.resultScrollTop]);

  useEffect(() => {
    if (!isOpen || !isMobile) {
      return;
    }

    const panel = panelRef.current;
    const frameId = window.requestAnimationFrame(() => {
      const currentPanel = panelRef.current;
      if (currentPanel) {
        getFocusableElements(currentPanel)[0]?.focus();
      }
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissPanel();
        return;
      }

      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const focusable = getFocusableElements(panel);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dismissPanel, isMobile, isOpen, state.view.kind, triggerRef]);

  const closePanel = () => {
    dismissPanel();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        className="fixed inset-0 z-[5] hidden cursor-default border-0 bg-black/85 p-0 max-[900px]:block"
        type="button"
        aria-label="산 찾기 패널 닫기"
        onClick={closePanel}
      />
      <aside
        ref={panelRef}
        className="z-[6] flex min-h-0 flex-col overflow-hidden border-l border-[#d8e0da] bg-white max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:max-h-[78vh] max-[900px]:rounded-t-2xl max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:shadow-[0_-18px_60px_rgba(0,0,0,0.24)]"
        role={isMobile ? 'dialog' : undefined}
        aria-modal={isMobile || undefined}
        aria-label={isResults ? '산 찾기 결과' : isRandomRunning ? '랜덤 추천 진행 상태' : '선택한 산 정보'}
      >
        {isResults ? (
          <>
            <header className="flex flex-none items-start justify-between gap-3 border-b border-[#d8e0da] p-4">
              <div>
                <p className="m-0 text-sm font-black text-[#245c46]">조건으로 찾은 산</p>
                <h2 className="m-0 mt-1 text-xl font-black text-[#18221d]">
                  결과 <span className="font-numeric">{resultMountains.length.toLocaleString()}</span>개
                </h2>
              </div>
              <button
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef3f0]"
                type="button"
                onClick={closePanel}
                aria-label="산 찾기 결과 닫기"
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-none border-b border-[#d8e0da] p-3">
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-base font-extrabold text-white disabled:cursor-not-allowed disabled:border-[#8a9790] disabled:bg-[#8a9790]"
                type="button"
                onClick={onRandomRecommend}
                disabled={resultMountains.length === 0}
              >
                <Shuffle size={18} />
                {resultMountains.length > 0
                  ? `이 결과 ${resultMountains.length.toLocaleString()}개 중 랜덤 추천`
                  : '추천할 산이 없어요'}
              </button>
            </div>

            <div className="flex flex-none items-center gap-2 border-b border-[#d8e0da] p-3">
              <button
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-3 text-base font-extrabold text-[#18221d]"
                type="button"
                onClick={() => onAction({ type: 'OPEN_FILTERS' })}
              >
                <ListFilter size={18} />
                필터 수정
              </button>
              <label className="sr-only" htmlFor="mountain-result-sort">
                결과 정렬
              </label>
              <select
                id="mountain-result-sort"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d8e0da] bg-white px-3 text-base font-bold text-[#18221d]"
                value={state.sort}
                onChange={(event) =>
                  onAction({
                    type: 'SET_SORT',
                    sort: event.target.value as DiscoveryState['sort'],
                  })
                }
              >
                <option value="name">가나다순</option>
                <option value="elevation-asc">낮은 산 순</option>
                <option value="elevation-desc">높은 산 순</option>
              </select>
            </div>

            {resultMountains.length === 0 ? (
              <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 text-center max-[900px]:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <div>
                  <SlidersHorizontal className="mx-auto text-[#5d6a62]" size={28} />
                  <h3 className="m-0 mt-3 text-xl font-black text-[#18221d]">조건에 맞는 산이 없어요</h3>
                  <p className="m-0 mt-2 text-base leading-7 text-[#5d6a62]">조건을 조금 넓혀 다시 찾아보세요.</p>
                  <div className="mt-5 grid gap-2">
                    <button
                      className="min-h-11 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-base font-extrabold text-white"
                      type="button"
                      onClick={() => onAction({ type: 'OPEN_FILTERS' })}
                    >
                      필터 수정
                    </button>
                    <button
                      className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-base font-extrabold text-[#18221d]"
                      type="button"
                      onClick={() => onAction({ type: 'RESET_FILTERS' })}
                    >
                      전체 초기화
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-[900px]:pb-[env(safe-area-inset-bottom)]"
                onScroll={(event) =>
                  onAction({
                    type: 'SET_RESULT_SCROLL_TOP',
                    scrollTop: event.currentTarget.scrollTop,
                  })
                }
              >
                {resultMountains.map((mountain) => (
                  <button
                    key={mountain.id}
                    className="grid min-h-[88px] w-full grid-cols-[64px_minmax(0,1fr)] items-center gap-3 border-0 border-b border-[#d8e0da] bg-white p-3 text-left text-[#18221d] transition hover:bg-[#f5f7f4] focus-visible:bg-[#eef3f0]"
                    type="button"
                    onClick={() => onSelectMountain(mountain)}
                  >
                    <img
                      className="h-16 w-16 rounded-lg bg-[#eef3f0] object-cover"
                      src={getMountainImage(mountain)}
                      alt=""
                      loading="lazy"
                    />
                    <span className="min-w-0">
                      <span className="flex items-baseline justify-between gap-3">
                        <strong className="truncate text-[17px] font-black leading-6">{mountain.name}</strong>
                        <span className="font-numeric flex-none text-base font-black">
                          {mountain.elevationMeters.toLocaleString()}m
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-[#5d6a62]">
                        <span>{mountain.province}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getMountainDifficultyLabel(mountain.id, difficultySummaryState)}</span>
                        {isAuthenticated && completionDataStatus === 'ready' ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={completedIds.has(mountain.id) ? 'text-[#237a1f]' : undefined}>
                              {completedIds.has(mountain.id) ? (
                                <span className="inline-flex items-center gap-1"><Check size={14} />등정 완료</span>
                              ) : (
                                '미등정'
                              )}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : isRandomRunning ? (
          <div className="grid min-h-60 flex-1 place-items-center content-center gap-4 p-6 text-center text-[#245c46]" role="status" aria-live="polite">
            <Shuffle className="animate-[spin_900ms_linear_infinite]" size={28} />
            <div>
              <h2 className="m-0 text-xl font-black text-[#18221d]">랜덤 추천 중</h2>
              <p className="m-0 mt-2 text-base font-bold text-[#5d6a62]">현재 결과 안에서 산을 고르고 있습니다.</p>
            </div>
            <button
              className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-base font-extrabold text-[#18221d]"
              type="button"
              onClick={() => onAction({ type: 'CANCEL_RANDOM' })}
            >
              추천 취소
            </button>
          </div>
        ) : (
          <>
            <header className="flex flex-none items-center justify-between gap-3 border-b border-[#d8e0da] p-3">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-3 text-base font-extrabold text-[#18221d]"
                type="button"
                onClick={() => onAction({ type: 'BACK_TO_RESULTS' })}
              >
                <ArrowLeft size={18} />
                결과 목록
              </button>
              <button
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef3f0]"
                type="button"
                onClick={closePanel}
                aria-label="선택한 산 정보 닫기"
              >
                <X size={19} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 max-[900px]:pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-[560px]:p-4 max-[560px]:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {detailContent}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
