import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Flag,
  ListFilter,
  MapPin,
  Mountain as MountainIcon,
  RotateCcw,
  Search,
  Shuffle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
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

const completionFilterOptions = [
  ['all', '전체'],
  ['completed', '등정 완료'],
  ['incomplete', '미등정'],
] as const;

type DiscoveryFilterSection = 'region' | 'difficulty' | 'completion';

type FilterAccordionCardProps = {
  section: DiscoveryFilterSection;
  label: string;
  summary: string;
  icon: ReactNode;
  isExpanded: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function FilterAccordionCard({
  section,
  label,
  summary,
  icon,
  isExpanded,
  isDisabled = false,
  onToggle,
  children,
}: FilterAccordionCardProps) {
  const contentId = `mountain-discovery-${section}-options`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-[0_7px_20px_rgba(24,34,29,0.07)] transition-[border-color,background-color] duration-200 motion-reduce:transition-none',
        isExpanded ? 'border-[#a6d2b4] bg-[#f2f8f4]' : 'border-[#e1e8e3]',
      )}
      data-filter-card={section}
    >
      <button
        className="grid min-h-[76px] w-full cursor-pointer grid-cols-[42px_minmax(0,1fr)_24px] items-center gap-3 border-0 bg-transparent p-3 text-left disabled:cursor-default"
        type="button"
        aria-label={`${label} 필터, 현재 ${summary}`}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        disabled={isDisabled}
        onClick={onToggle}
      >
        {icon}
        <span className="min-w-0">
          <span className="block text-sm font-black text-[#18221d]">{label}</span>
          <span className="mt-0.5 block truncate text-base font-medium text-[#4f5d55]">
            {summary}
          </span>
        </span>
        {!isDisabled ? (
          <ChevronDown
            className={cn(
              'text-[#4f5d55] transition-transform duration-200 motion-reduce:transition-none',
              isExpanded && 'rotate-180 text-[#245c46]',
            )}
            size={18}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {isExpanded ? (
        <div
          id={contentId}
          className="border-t border-[#d8e5dc] bg-white px-3 py-1 animate-[filter-content-reveal_150ms_ease-out_both] motion-reduce:animate-none"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type FilterRadioOptionProps = {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
};

function FilterRadioOption({
  name,
  value,
  label,
  checked,
  disabled = false,
  onChange,
}: FilterRadioOptionProps) {
  return (
    <label
      className={cn(
        'grid min-h-11 cursor-pointer grid-cols-[20px_minmax(0,1fr)_20px] items-center gap-3 border-b border-[#edf1ee] px-1 text-base text-[#34423a] last:border-b-0',
        checked && 'font-bold text-[#245c46]',
        disabled && 'cursor-not-allowed text-[#98a39c]',
      )}
    >
      <input
        className="m-0 h-5 w-5 cursor-pointer appearance-none rounded-full border-2 border-[#aab7af] bg-white checked:border-[6px] checked:border-[#2e7d4f] disabled:cursor-not-allowed disabled:bg-[#eef1ef]"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span>{label}</span>
      {checked ? <Check className="text-[#2e7d4f]" size={18} aria-hidden="true" /> : null}
    </label>
  );
}

const confettiPieces = Array.from({ length: 34 }, (_, index) => index);

function getConfettiStyle(index: number) {
  return {
    '--x': `${(index % 11 - 5) * 34}px`,
    '--delay': `${(index % 7) * 34}ms`,
    '--duration': `${760 + (index % 5) * 120}ms`,
    '--hue': `${38 + (index % 5) * 42}`,
  } as CSSProperties;
}

function getMountainImage(mountain: Mountain) {
  return getMountainGuide(mountain).heroImage?.src ?? `/mountain-images/${mountain.id}/hero.png`;
}

function hasAppliedFilters(state: DiscoveryState) {
  return Object.values(state.appliedFilters).some((value) => value !== 'all');
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

export const mobileDiscoveryHistoryKey = '__mountainMapDiscoverySheet';
export type MobileDiscoveryHistoryLayer = 'filters' | 'panel';

export function getMobileDiscoveryHistoryLayer(state: unknown = window.history.state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const layer = (state as Record<string, unknown>)[mobileDiscoveryHistoryKey];
  return layer === 'filters' || layer === 'panel' ? layer : null;
}

export function isMobileDiscoveryHistoryState(state: unknown) {
  return getMobileDiscoveryHistoryLayer(state) !== null;
}

function pushMobileDiscoveryHistoryEntry(
  layer: MobileDiscoveryHistoryLayer,
  forceLayer = false,
) {
  const currentLayer = getMobileDiscoveryHistoryLayer();
  if (currentLayer === layer || (currentLayer && !forceLayer)) {
    return;
  }

  window.history.pushState(
    { ...window.history.state, [mobileDiscoveryHistoryKey]: layer },
    '',
    window.location.href,
  );
}

function replaceMobileDiscoveryHistoryLayer(layer: MobileDiscoveryHistoryLayer) {
  window.history.replaceState(
    { ...window.history.state, [mobileDiscoveryHistoryKey]: layer },
    '',
    window.location.href,
  );
}

function dismissMobileDiscoveryHistoryEntry(layer: MobileDiscoveryHistoryLayer) {
  if (getMobileDiscoveryHistoryLayer() === layer) {
    window.history.back();
  }
}

type CompletionDataStatus = 'signed-out' | 'loading' | 'ready' | 'error';

type MountainDiscoveryControlsProps = {
  state: DiscoveryState;
  draftResultCount: number;
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
  difficultySummaryState,
  isAuthenticated,
  completionDataStatus,
  triggerRef,
  onAction,
  onRetryDifficultySummaries,
  onRequestLogin,
}: MountainDiscoveryControlsProps) {
  const filterPanelRef = useRef<HTMLElement | null>(null);
  const pendingMobileFilterActionRef = useRef<DiscoveryAction | null>(null);
  const [expandedFilterSection, setExpandedFilterSection] = useState<DiscoveryFilterSection | null>(null);
  const isMobile = useMobileDiscoveryLayout();
  const isFilterOpen = state.view.kind === 'filters';
  const filterReturnViewKind = state.view.kind === 'filters' ? state.view.returnView.kind : 'closed';
  const regionSummary = state.draftFilters.region === 'all'
    ? '전체 지역'
    : regionLabels[state.draftFilters.region];
  const difficultySummary = difficultyFilterLabels.find(
    (option) => option.value === state.draftFilters.difficulty,
  )?.label ?? '전체';
  const completionSummary = completionFilterOptions.find(
    ([value]) => value === state.draftFilters.completion,
  )?.[1] ?? '전체';

  const toggleFilterSection = (section: DiscoveryFilterSection) => {
    setExpandedFilterSection((current) => current === section ? null : section);
  };

  useEffect(() => {
    if (!isFilterOpen) {
      setExpandedFilterSection(null);
    }
  }, [isFilterOpen]);

  useEffect(() => {
    if (!isFilterOpen || !isMobile) {
      return;
    }

    pushMobileDiscoveryHistoryEntry('filters', filterReturnViewKind !== 'closed');
    const handlePopState = () => {
      const pendingAction = pendingMobileFilterActionRef.current;
      pendingMobileFilterActionRef.current = null;
      onAction(pendingAction ?? { type: 'CANCEL_FILTERS' });
      if (filterReturnViewKind === 'closed') {
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [filterReturnViewKind, isFilterOpen, isMobile, onAction, triggerRef]);

  const dismissFilters = useCallback(() => {
    if (isMobile && getMobileDiscoveryHistoryLayer() === 'filters') {
      pendingMobileFilterActionRef.current = { type: 'CANCEL_FILTERS' };
      window.history.back();
      return;
    }

    onAction({ type: 'CANCEL_FILTERS' });
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [isMobile, onAction, triggerRef]);

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
    if (!isMobile) {
      onAction({ type: 'APPLY_FILTERS' });
      return;
    }

    if (filterReturnViewKind === 'closed') {
      replaceMobileDiscoveryHistoryLayer('panel');
      onAction({ type: 'APPLY_FILTERS' });
      return;
    }

    if (getMobileDiscoveryHistoryLayer() === 'filters') {
      pendingMobileFilterActionRef.current = { type: 'APPLY_FILTERS' };
      window.history.back();
      return;
    }

    onAction({ type: 'APPLY_FILTERS' });
  };

  return (
    <>
      {isFilterOpen ? (
        <button
          className="fixed inset-0 z-[5] hidden cursor-default border-0 bg-black/85 p-0 max-[900px]:block max-[900px]:animate-[filter-backdrop-in_180ms_ease-out_both] motion-reduce:animate-none"
          type="button"
          aria-label="조건으로 찾기 닫기"
          onClick={closeFilters}
        />
      ) : null}

      <section
        ref={filterPanelRef}
        className={cn(
          'absolute left-5 top-5 origin-top-left overflow-hidden border-0 transition-[width,max-height,border-radius,box-shadow,padding,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none max-[560px]:left-3 max-[560px]:top-3',
          isFilterOpen
            ? 'z-[6] max-h-[calc(100%-40px)] w-[min(388px,calc(100%-40px))] overflow-y-auto rounded-xl bg-[#f5f7f4] p-0 shadow-[0_18px_56px_rgba(24,34,29,0.18)] max-[560px]:max-h-[calc(100%-24px)] max-[560px]:w-[min(388px,calc(100%-24px))]'
            : 'z-[3] h-11 max-h-11 w-[81px] rounded-lg bg-[#245c46] p-0 shadow-[0_4px_14px_rgba(24,34,29,0.12)]',
        )}
        data-filter-shell={isFilterOpen ? 'open' : 'closed'}
        role={isFilterOpen ? 'dialog' : undefined}
        aria-modal={isFilterOpen && isMobile ? true : undefined}
        aria-labelledby={isFilterOpen ? 'mountain-discovery-filter-title' : undefined}
      >
        <div
          className={cn(
            'sticky left-0 top-0 z-[3] flex items-center bg-[#245c46] transition-[height,border-radius] duration-300 motion-reduce:transition-none',
            isFilterOpen ? 'h-16 w-full rounded-t-xl' : 'h-11 w-[81px] rounded-lg',
          )}
          data-filter-header={isFilterOpen ? 'expanded' : 'compact'}
        >
          <button
            ref={triggerRef}
            className={cn(
              'inline-flex h-full min-w-0 items-center border-0 bg-transparent text-white disabled:opacity-100',
              isFilterOpen
                ? 'flex-1 cursor-default justify-start gap-3 px-4 text-left'
                : 'w-full cursor-pointer justify-center gap-2 px-3.5 text-sm font-bold',
            )}
            type="button"
            onClick={() => onAction({ type: 'OPEN_FILTERS' })}
            aria-label="필터"
            aria-expanded={isFilterOpen}
            aria-controls="mountain-discovery-filters"
            disabled={isFilterOpen}
          >
            <SlidersHorizontal size={isFilterOpen ? 21 : 18} aria-hidden="true" />
            <span className={isFilterOpen ? 'truncate text-base font-black' : undefined}>
              {isFilterOpen ? '조건으로 산 찾기' : '필터'}
            </span>
          </button>

          {isFilterOpen ? (
            <button
              className="inline-flex h-11 w-11 flex-none items-center justify-center border-0 bg-transparent text-white"
              type="button"
              aria-label="필터 닫기"
              onClick={closeFilters}
            >
              <X size={21} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {isFilterOpen ? (
          <div
            id="mountain-discovery-filters"
            className="w-full animate-[filter-content-reveal_180ms_ease-out_100ms_both] motion-reduce:animate-none"
          >
            <h2 id="mountain-discovery-filter-title" className="sr-only">
              조건으로 찾기
            </h2>

            <p className="m-0 px-4 pb-3 pt-4 text-base leading-6 text-[#4f5d55]">
              조건을 선택하고 원하는 산을 찾아보세요.
            </p>

            <form className="grid gap-3 px-3 pb-3" onSubmit={applyFilters}>
              <FilterAccordionCard
                section="region"
                label="지역"
                summary={regionSummary}
                icon={(
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf5ee] text-[#2f7a58]" aria-hidden="true">
                    <MapPin size={23} strokeWidth={2.1} />
                  </span>
                )}
                isExpanded={expandedFilterSection === 'region'}
                onToggle={() => toggleFilterSection('region')}
              >
                <div role="radiogroup" aria-label="지역">
                  <FilterRadioOption
                    name="mountain-discovery-region"
                    value="all"
                    label="전체 지역"
                    checked={state.draftFilters.region === 'all'}
                    onChange={() => onAction({
                      type: 'UPDATE_DRAFT_FILTERS',
                      filters: { region: 'all' },
                    })}
                  />
                  {mountainRegionCodes.map((region) => (
                    <FilterRadioOption
                      key={region}
                      name="mountain-discovery-region"
                      value={region}
                      label={regionLabels[region]}
                      checked={state.draftFilters.region === region}
                      onChange={() => onAction({
                        type: 'UPDATE_DRAFT_FILTERS',
                        filters: { region },
                      })}
                    />
                  ))}
                </div>
              </FilterAccordionCard>

              <FilterAccordionCard
                section="difficulty"
                label="체감 난이도"
                summary={
                  difficultySummaryState.status === 'loading' || difficultySummaryState.status === 'idle'
                    ? '불러오는 중'
                    : difficultySummaryState.status === 'error'
                      ? '정보를 불러오지 못함'
                      : difficultySummary
                }
                icon={(
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff2df] text-[#e38322]" aria-hidden="true">
                    <MountainIcon size={23} strokeWidth={2.1} />
                  </span>
                )}
                isExpanded={expandedFilterSection === 'difficulty'}
                isDisabled={difficultySummaryState.status === 'loading' || difficultySummaryState.status === 'idle'}
                onToggle={() => toggleFilterSection('difficulty')}
              >
                {difficultySummaryState.status === 'error' ? (
                  <div className="flex min-h-14 items-center justify-between gap-3 py-1 text-base text-[#8c382e]" role="alert">
                    <span>난이도 정보를 불러오지 못했습니다.</span>
                    <button
                      className="min-h-11 flex-none rounded-lg border border-[#d7aaa2] bg-white px-3 text-sm font-bold text-[#8c382e]"
                      type="button"
                      onClick={onRetryDifficultySummaries}
                    >
                      다시 시도
                    </button>
                  </div>
                ) : difficultySummaryState.status === 'ready' ? (
                  <div role="radiogroup" aria-label="체감 난이도">
                    {difficultyFilterLabels.map((option) => (
                      <FilterRadioOption
                        key={option.value}
                        name="mountain-discovery-difficulty"
                        value={option.value}
                        label={option.label}
                        checked={state.draftFilters.difficulty === option.value}
                        onChange={() => onAction({
                          type: 'UPDATE_DRAFT_FILTERS',
                          filters: { difficulty: option.value },
                        })}
                      />
                    ))}
                  </div>
                ) : null}
              </FilterAccordionCard>

              <FilterAccordionCard
                section="completion"
                label="등정 상태"
                summary={completionSummary}
                icon={(
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#edf3ff] text-[#3d78d4]" aria-hidden="true">
                    <Flag size={22} fill="currentColor" strokeWidth={1.8} />
                  </span>
                )}
                isExpanded={expandedFilterSection === 'completion'}
                onToggle={() => toggleFilterSection('completion')}
              >
                <div role="radiogroup" aria-label="등정 상태">
                  {completionFilterOptions.map(([value, label]) => {
                    const requiresLogin = value !== 'all' && !isAuthenticated;
                    const completionDataUnavailable =
                      value !== 'all' && (requiresLogin || completionDataStatus !== 'ready');
                    return (
                      <FilterRadioOption
                        key={value}
                        name="mountain-discovery-completion"
                        value={value}
                        label={label}
                        checked={state.draftFilters.completion === value}
                        disabled={completionDataUnavailable}
                        onChange={() => onAction({
                          type: 'UPDATE_DRAFT_FILTERS',
                          filters: { completion: value },
                        })}
                      />
                    );
                  })}
                </div>

                {!isAuthenticated ? (
                  <div className="flex items-center justify-between gap-2 border-t border-[#edf1ee] py-2 text-base text-[#5d6a62]">
                    <span>등정 기록 필터는 로그인이 필요합니다.</span>
                    <button
                      className="min-h-11 flex-none rounded-lg border border-[#245c46] bg-white px-2.5 text-sm font-bold text-[#245c46]"
                      type="button"
                      onClick={onRequestLogin}
                    >
                      로그인
                    </button>
                  </div>
                ) : completionDataStatus === 'loading' ? (
                  <p className="m-0 border-t border-[#edf1ee] py-3 text-base font-bold text-[#5d6a62]" role="status">
                    등정 기록을 불러오는 중입니다.
                  </p>
                ) : completionDataStatus === 'error' ? (
                  <p className="m-0 border-t border-[#e7c8c1] py-3 text-base font-bold text-[#6d3028]" role="alert">
                    등정 기록을 불러오지 못해 완료·미등정 필터를 사용할 수 없습니다.
                  </p>
                ) : null}
              </FilterAccordionCard>

              <div className="sticky bottom-0 grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 bg-[#f5f7f4] pt-1">
                <button
                  className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-sm font-bold text-[#18221d]"
                  type="button"
                  onClick={closeFilters}
                >
                  취소
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-sm font-bold text-white shadow-[0_7px_18px_rgba(36,92,70,0.2)]"
                  type="submit"
                >
                  <Search size={18} />
                  {draftResultCount.toLocaleString()}개 산 보기
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      {hasAppliedFilters(state) && !isFilterOpen ? (
        <button
          className="absolute left-[107px] top-5 z-[3] inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] max-[560px]:left-[99px] max-[560px]:top-3"
          type="button"
          onClick={() => onAction({ type: 'RESET_DISCOVERY' })}
        >
          <RotateCcw size={16} />
          <span className="max-[560px]:sr-only">필터 </span>초기화
        </button>
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
  const randomView = state.view.kind === 'random-running' ? state.view : null;
  const isRandomRunning = randomView !== null;
  const isRandomWinner = randomView?.phase === 'winner';
  const randomWinner = randomView
    ? resultMountains.find((mountain) => mountain.id === randomView.winnerId)
    : undefined;
  const isOpen = isResults || isDetail || isRandomRunning;

  useEffect(() => {
    if (!isOpen || !isMobile) {
      return;
    }

    pushMobileDiscoveryHistoryEntry('panel');
    const handlePopState = (event: PopStateEvent) => {
      const nextLayer = getMobileDiscoveryHistoryLayer(event.state);
      if (nextLayer === 'filters') {
        onAction({ type: 'OPEN_FILTERS' });
        return;
      }
      if (nextLayer === 'panel') {
        return;
      }

      onAction({ type: 'CLOSE_DISCOVERY' });
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile, isOpen, onAction, triggerRef]);

  const dismissPanel = useCallback(() => {
    onAction({ type: 'CLOSE_DISCOVERY' });
    if (isMobile) {
      dismissMobileDiscoveryHistoryEntry('panel');
    }
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [isMobile, onAction, triggerRef]);

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
        aria-label={isResults ? '산 찾기 결과' : isRandomWinner ? '랜덤 추천 당첨 결과' : isRandomRunning ? '랜덤 추천 진행 상태' : '선택한 산 정보'}
      >
        {isResults ? (
          <>
            <header className="flex flex-none items-start justify-between gap-3 border-b border-[#d8e0da] p-3.5">
              <div>
                <p className="m-0 text-sm font-black text-[#245c46]">조건으로 찾은 산</p>
                <h2 className="m-0 mt-0.5 text-lg font-black text-[#18221d]">
                  결과 <span className="font-numeric">{resultMountains.length.toLocaleString()}</span>개
                </h2>
              </div>
              <button
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border-0 bg-transparent transition-colors hover:bg-[#eef3f0]"
                type="button"
                onClick={closePanel}
                aria-label="산 찾기 결과 닫기"
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-none border-b border-[#d8e0da] p-3">
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-[#8a9790] disabled:bg-[#8a9790]"
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
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d]"
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
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d]"
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
                  <h3 className="m-0 mt-3 text-lg font-black text-[#18221d]">조건에 맞는 산이 없어요</h3>
                  <p className="m-0 mt-2 text-base leading-7 text-[#5d6a62]">조건을 조금 넓혀 다시 찾아보세요.</p>
                  <div className="mt-5 grid gap-2">
                    <button
                      className="min-h-11 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-sm font-bold text-white"
                      type="button"
                      onClick={() => onAction({ type: 'OPEN_FILTERS' })}
                    >
                      필터 수정
                    </button>
                    <button
                      className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-sm font-bold text-[#18221d]"
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
          isRandomWinner && randomWinner ? (
            <div className="relative grid min-h-60 flex-1 place-items-center content-center gap-3 overflow-hidden p-5 text-center" role="status" aria-live="assertive">
              <div
                className="pointer-events-none absolute left-1/2 top-5 h-px w-px motion-reduce:hidden [&_span]:absolute [&_span]:h-3 [&_span]:w-[7px] [&_span]:rounded-sm [&_span]:bg-[hsl(var(--hue),78%,52%)] [&_span]:opacity-0 [&_span]:animate-[confetti-fall_var(--duration)_ease-out_var(--delay)_both]"
                data-confetti="winner"
                aria-hidden="true"
              >
                {confettiPieces.map((piece) => (
                  <span key={piece} style={getConfettiStyle(piece)} />
                ))}
              </div>
              <p className="m-0 text-sm font-black text-[#245c46]">랜덤 추천 결과</p>
              <h2 className="m-0 text-[19px] font-black leading-6 text-[#18221d]">
                {randomWinner.name} 당첨!
              </h2>
              <p className="m-0 text-base text-[#5d6a62]">선택한 산의 상세 정보를 열어드릴게요.</p>
            </div>
          ) : (
            <div className="grid min-h-60 flex-1 place-items-center content-center gap-3 p-5 text-center text-[#245c46]" role="status" aria-live="polite">
              <Shuffle size={26} />
              <div>
                <h2 className="m-0 text-lg font-black text-[#18221d]">랜덤 추천 중</h2>
                <p className="m-0 mt-1.5 text-base font-bold text-[#5d6a62]">현재 결과 안에서 산을 고르고 있습니다.</p>
              </div>
              <button
                className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-sm font-bold text-[#18221d]"
                type="button"
                onClick={() => onAction({ type: 'CANCEL_RANDOM' })}
              >
                추천 취소
              </button>
            </div>
          )
        ) : (
          <>
            <header className="flex flex-none items-center justify-between gap-3 border-b border-[#d8e0da] p-3">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-3 text-sm font-bold text-[#18221d] transition-colors hover:text-[#245c46]"
                type="button"
                onClick={() => onAction({ type: 'BACK_TO_RESULTS' })}
              >
                <ArrowLeft size={18} />
                목록
              </button>
              <button
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border-0 bg-transparent text-[#18221d] transition-colors hover:text-[#245c46]"
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
