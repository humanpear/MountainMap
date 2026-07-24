import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type UIEvent,
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
import {
  getDifficultyFromAverage,
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
  ...mountainReviewDifficulties.map((difficulty) => ({
    value: difficulty,
    label: difficulty,
  })),
];

const completionFilterOptions = [
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
          <span className="block text-sm font-semibold text-[#18221d]">{label}</span>
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

type FilterOptionProps = {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  selectionMode?: 'multiple' | 'single';
  disabled?: boolean;
  onChange: () => void;
};

function FilterOption({
  name,
  value,
  label,
  checked,
  selectionMode = 'multiple',
  disabled = false,
  onChange,
}: FilterOptionProps) {
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
        type={selectionMode === 'single' ? 'radio' : 'checkbox'}
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

function toggleSelectedValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function getSelectionSummary<T>(
  values: readonly T[],
  emptyLabel: string,
  getLabel: (value: T) => string,
) {
  if (values.length === 0) {
    return emptyLabel;
  }
  if (values.length === 1) {
    return getLabel(values[0]);
  }
  return `${values.length}개 선택`;
}

const confettiPieces = Array.from({ length: 34 }, (_, index) => index);
const mobileVirtualResultItemHeight = 120;
const desktopVirtualResultItemHeight = 132;
const virtualResultOverscan = 4;
const virtualResultThreshold = 30;
const defaultResultListViewportHeight = 704;
const mobileDiscoverySheetAnimationDuration = 240;

function getConfettiStyle(index: number) {
  return {
    '--x': `${(index % 11 - 5) * 34}px`,
    '--delay': `${(index % 7) * 34}ms`,
    '--duration': `${760 + (index % 5) * 120}ms`,
    '--hue': `${38 + (index % 5) * 42}`,
  } as CSSProperties;
}

function getMountainImage(mountain: Mountain) {
  return `/mountain-images/${mountain.id}/list.jpg`;
}

function getVirtualResultStart(scrollTop: number, itemHeight: number) {
  return Math.max(
    0,
    Math.floor(Math.max(0, scrollTop) / itemHeight) - virtualResultOverscan,
  );
}

function hasAppliedFilters(state: DiscoveryState) {
  return Object.values(state.appliedFilters).some((value) => value.length > 0);
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

function useLargeDesktopDiscoveryLayout() {
  const [isLargeDesktop, setIsLargeDesktop] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1360px)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1360px)');
    const update = () => setIsLargeDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return isLargeDesktop;
}

export type InfoBarSwipeAction = 'open-detail' | 'clear-selection';

export function classifyInfoBarSwipe(deltaX: number, deltaY: number): InfoBarSwipeAction | null {
  const verticalDistance = Math.abs(deltaY);
  if (verticalDistance < 48 || verticalDistance < Math.abs(deltaX) * 1.5) {
    return null;
  }

  return deltaY < 0 ? 'open-detail' : 'clear-selection';
}

function getCompactMountainLocation(mountain: Mountain) {
  const provinceAliases: Record<string, string> = {
    '강원특별자치도': '강원도',
    '전북특별자치도': '전라북도',
    '제주특별자치도': '제주도',
  };

  return provinceAliases[mountain.province] || mountain.province;
}

type MobileMountainInfoBarProps = {
  mountain: Mountain;
  obscured: boolean;
  focusRequest?: DiscoveryState['focusRequest'];
  onFocusHandled: (revision: number) => void;
  onHeightChange: (height: number) => void;
  onOpenDetail: () => void;
  onOpenResults: () => void;
  onClearSelection: () => void;
};

export function MobileMountainInfoBar({
  mountain,
  obscured,
  focusRequest,
  onFocusHandled,
  onHeightChange,
  onOpenDetail,
  onOpenResults,
  onClearSelection,
}: MobileMountainInfoBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const detailButtonRef = useRef<HTMLButtonElement | null>(null);
  const listButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastHeightRef = useRef(0);
  const animateOnMountRef = useRef(!obscured);
  const compactLocation = getCompactMountainLocation(mountain);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    root.inert = obscured;
    return () => {
      root.inert = false;
    };
  }, [obscured]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    let frameId: number | null = null;
    let nextHeight = 0;
    const scheduleHeight = () => {
      nextHeight = Math.ceil(root.getBoundingClientRect().height);
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (nextHeight === lastHeightRef.current) {
          return;
        }
        lastHeightRef.current = nextHeight;
        onHeightChange(nextHeight);
      });
    };

    scheduleHeight();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleHeight);
    observer?.observe(root);

    return () => {
      observer?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      lastHeightRef.current = 0;
      onHeightChange(0);
    };
  }, [onHeightChange]);

  useEffect(() => {
    if (obscured || !focusRequest) {
      return;
    }

    const target = focusRequest.target === 'info-detail-button'
      ? detailButtonRef.current
      : focusRequest.target === 'info-list-button'
        ? listButtonRef.current
        : null;
    if (!target) {
      return;
    }

    target.focus();
    onFocusHandled(focusRequest.revision);
  }, [focusRequest, obscured, onFocusHandled]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !event.isPrimary
      || (event.target as Element).closest('button,a,input,select,textarea,[role="button"]')
    ) {
      pointerRef.current = null;
      return;
    }

    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start || start.id !== event.pointerId) {
      return;
    }

    const action = classifyInfoBarSwipe(event.clientX - start.x, event.clientY - start.y);
    if (action === 'open-detail') {
      onOpenDetail();
    } else if (action === 'clear-selection') {
      onClearSelection();
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute bottom-3 left-1/2 z-[4] hidden min-h-12 w-[calc(100%-24px)] max-w-[520px] -translate-x-1/2 items-center overflow-hidden rounded-full border border-[#d8e0da] bg-white px-1 shadow-[0_8px_24px_rgba(24,34,29,0.12)] max-[900px]:flex motion-reduce:animate-none',
        animateOnMountRef.current && 'max-[900px]:animate-[mobile-info-bar-in_180ms_ease-out]',
        obscured && 'pointer-events-none invisible opacity-0',
      )}
      data-map-occluder="persistent"
      aria-label="선택한 산 정보"
      aria-hidden={obscured || undefined}
      style={{ touchAction: 'pan-x' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={() => {
        pointerRef.current = null;
      }}
    >
      <div
        className="flex min-w-0 flex-1 items-center justify-center gap-4 overflow-hidden px-2"
        data-info-summary
      >
        <strong className="max-w-[72px] flex-none truncate text-base font-semibold text-[#18221d]">
          {mountain.name}
        </strong>
        <span
          className="min-w-0 truncate text-sm text-[#5d6a62]"
          aria-label={`위치 ${compactLocation}`}
        >
          {compactLocation}
        </span>
        <span
          className="flex-none text-sm font-semibold tabular-nums text-[#245c46]"
          style={{ fontFamily: 'Geist, sans-serif' }}
          aria-label={`높이 ${mountain.elevationMeters.toLocaleString()}미터`}
        >
          {mountain.elevationMeters.toLocaleString()}m
        </span>
      </div>
      <span
        className="mr-2 h-5 w-px flex-none bg-[#d8e0da]"
        data-info-divider
        aria-hidden="true"
      />
      <button
        ref={detailButtonRef}
        className="inline-flex h-11 w-11 flex-none items-center justify-center border-0 bg-transparent p-0 text-sm font-semibold text-[#245c46]"
        type="button"
        onClick={onOpenDetail}
      >
        상세
      </button>
      <button
        ref={listButtonRef}
        className="inline-flex h-11 w-11 flex-none items-center justify-center border-0 bg-transparent p-0 text-sm font-semibold text-[#18221d]"
        type="button"
        onClick={onOpenResults}
      >
        목록
      </button>
      <button
        className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#5d6a62]"
        type="button"
        aria-label={`${mountain.name} 선택 해제`}
        onClick={onClearSelection}
      >
        <X size={18} />
      </button>
    </div>
  );
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
  const [expandedFilterSection, setExpandedFilterSection] = useState<DiscoveryFilterSection | null>(null);
  const isMobile = useMobileDiscoveryLayout();
  const isFilterOpen = state.view.kind === 'filters';
  const regionSummary = getSelectionSummary(
    state.draftFilters.region,
    '전체 지역',
    (region) => regionLabels[region],
  );
  const difficultySummary = getSelectionSummary(
    state.draftFilters.difficulty,
    '전체',
    (difficulty) => difficulty,
  );
  const completionSummary = getSelectionSummary(
    state.draftFilters.completion,
    '전체',
    (completion) => completion === 'completed' ? '등정 완료' : '미등정',
  );

  const toggleFilterSection = (section: DiscoveryFilterSection) => {
    setExpandedFilterSection((current) => current === section ? null : section);
  };

  useEffect(() => {
    if (!isFilterOpen) {
      setExpandedFilterSection(null);
    }
  }, [isFilterOpen]);

  const dismissFilters = useCallback(() => {
    onAction({ type: 'CANCEL_FILTERS' });
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onAction, triggerRef]);

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
      {isFilterOpen ? (
        <button
          className="fixed inset-0 z-[5] hidden cursor-default border-0 bg-black/60 p-0 max-[900px]:block max-[900px]:animate-[filter-backdrop-in_180ms_ease-out_both] motion-reduce:animate-none"
          type="button"
          aria-label="조건으로 찾기 닫기"
          onClick={closeFilters}
        />
      ) : null}

      <section
        ref={filterPanelRef}
        className={cn(
          'filter-panel-shell absolute left-5 top-5 flex origin-top-left flex-col overflow-hidden border-0 shadow-[0_8px_28px_rgba(24,34,29,0.16)] transition-[width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none max-[560px]:left-3 max-[560px]:top-3',
          isFilterOpen
            ? 'z-[6] max-h-[calc(100%-40px)] w-[min(388px,calc(100%-40px))] rounded-xl bg-[#f5f7f4] p-0 max-[560px]:max-h-[calc(100%-24px)] max-[560px]:w-[min(388px,calc(100%-24px))]'
            : 'z-[3] h-11 max-h-11 w-[81px] rounded-lg bg-[#245c46] p-0',
        )}
        data-filter-shell={isFilterOpen ? 'open' : 'closed'}
        role={isFilterOpen ? 'dialog' : undefined}
        aria-modal={isFilterOpen && isMobile ? true : undefined}
        aria-labelledby={isFilterOpen ? 'mountain-discovery-filter-title' : undefined}
      >
        <div
          className={cn(
            'sticky left-0 top-0 z-[3] flex h-11 flex-none items-center rounded-none bg-[#245c46]',
            isFilterOpen ? 'w-full' : 'w-[81px]',
          )}
          data-filter-header={isFilterOpen ? 'expanded' : 'compact'}
        >
          <button
            ref={triggerRef}
            className={cn(
              'inline-flex h-full w-full min-w-0 items-center gap-2 border-0 bg-transparent px-3.5 text-sm font-bold text-white disabled:opacity-100',
              isFilterOpen
                ? 'cursor-default justify-start pr-12 text-left'
                : 'cursor-pointer justify-center',
            )}
            type="button"
            onClick={() => onAction({ type: 'OPEN_FILTERS' })}
            aria-label="필터"
            aria-expanded={isFilterOpen}
            aria-controls="mountain-discovery-filters"
            disabled={isFilterOpen}
          >
            <SlidersHorizontal className="flex-none" size={18} aria-hidden="true" />
            <span className={isFilterOpen ? 'min-w-0 flex-1 truncate' : undefined}>
              {isFilterOpen ? '조건으로 산 찾기' : '필터'}
            </span>
          </button>

          <button
            className={cn(
              'absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center border-0 bg-transparent text-white transition-opacity duration-100 ease-out motion-reduce:transition-none',
              isFilterOpen
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0',
            )}
            type="button"
            aria-label="필터 닫기"
            aria-hidden={!isFilterOpen}
            tabIndex={isFilterOpen ? 0 : -1}
            onClick={closeFilters}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>

        <div
          id="mountain-discovery-filters"
          className={cn(
            'filter-scroll-region min-h-0 w-full flex-auto overflow-y-auto opacity-0',
            isFilterOpen
              ? 'visible animate-[filter-content-fade_120ms_ease-out_160ms_forwards]'
              : 'invisible',
            'motion-reduce:animate-none motion-reduce:opacity-100',
          )}
          aria-hidden={!isFilterOpen}
          inert={!isFilterOpen}
        >
            <h2 id="mountain-discovery-filter-title" className="sr-only">
              조건으로 찾기
            </h2>

            <div
              className="relative isolate min-h-[82px] overflow-hidden bg-white"
              data-filter-intro
            >
              <div
                className="pointer-events-none absolute inset-0 z-0 bg-[url('/my-page/completed-progress-bg-desktop.png')] bg-cover bg-center bg-no-repeat opacity-[0.65] max-[560px]:bg-[url('/my-page/completed-progress-bg-mobile.png')]"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(245,247,244,0.28)_0%,rgba(255,255,255,0.98)_100%)]"
                aria-hidden="true"
              />
              <p className="relative z-[2] m-0 w-[58%] px-4 pb-4 pt-4 text-base leading-6 text-[#4f5d55]">
                조건을 선택하고 원하는 산을 찾아보세요.
              </p>
            </div>

            <form className="grid gap-3 bg-white px-3 pb-3" onSubmit={applyFilters}>
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
                <div role="group" aria-label="지역">
                  <FilterOption
                    name="mountain-discovery-region"
                    value="all"
                    label="전체 지역"
                    checked={state.draftFilters.region.length === 0}
                    onChange={() => onAction({
                      type: 'UPDATE_DRAFT_FILTERS',
                      filters: { region: [] },
                    })}
                  />
                  {mountainRegionCodes.map((region) => (
                    <FilterOption
                      key={region}
                      name="mountain-discovery-region"
                      value={region}
                      label={regionLabels[region]}
                      checked={state.draftFilters.region.includes(region)}
                      onChange={() => onAction({
                        type: 'UPDATE_DRAFT_FILTERS',
                        filters: {
                          region: toggleSelectedValue(state.draftFilters.region, region),
                        },
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
                  <div role="group" aria-label="체감 난이도">
                    <FilterOption
                      name="mountain-discovery-difficulty"
                      value="all"
                      label="전체"
                      checked={state.draftFilters.difficulty.length === 0}
                      onChange={() => onAction({
                        type: 'UPDATE_DRAFT_FILTERS',
                        filters: { difficulty: [] },
                      })}
                    />
                    {difficultyFilterLabels.map((option) => (
                      <FilterOption
                        key={option.value}
                        name="mountain-discovery-difficulty"
                        value={option.value}
                        label={option.label}
                        checked={state.draftFilters.difficulty.includes(option.value)}
                        onChange={() => onAction({
                          type: 'UPDATE_DRAFT_FILTERS',
                          filters: {
                            difficulty: toggleSelectedValue(
                              state.draftFilters.difficulty,
                              option.value,
                            ),
                          },
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
                  <FilterOption
                    name="mountain-discovery-completion"
                    value="all"
                    label="전체"
                    selectionMode="single"
                    checked={state.draftFilters.completion.length === 0}
                    onChange={() => onAction({
                      type: 'UPDATE_DRAFT_FILTERS',
                      filters: { completion: [] },
                    })}
                  />
                  {completionFilterOptions.map(([value, label]) => {
                    const requiresLogin = !isAuthenticated;
                    const completionDataUnavailable =
                      requiresLogin || completionDataStatus !== 'ready';
                    return (
                      <FilterOption
                        key={value}
                        name="mountain-discovery-completion"
                        value={value}
                        label={label}
                        selectionMode="single"
                        checked={state.draftFilters.completion.includes(value)}
                        disabled={completionDataUnavailable}
                        onChange={() => onAction({
                          type: 'UPDATE_DRAFT_FILTERS',
                          filters: {
                            completion: [value],
                          },
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

              <div
                className="sticky bottom-0 -mx-3 border-t border-[#d8e0da] bg-white px-3 pt-3"
                data-filter-actions
              >
                <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5">
                  <button
                    className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-sm font-bold text-[#18221d]"
                    type="button"
                    onClick={closeFilters}
                  >
                    취소
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-0 bg-[#245c46] px-4 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245c46]"
                    type="submit"
                  >
                    <Search size={18} />
                    {draftResultCount.toLocaleString()}개 산 보기
                  </button>
                </div>
              </div>
            </form>
        </div>
      </section>

      {state.view.kind === 'closed' && hasAppliedFilters(state) ? (
        <button
          className="absolute left-[109px] top-5 z-[3] hidden h-11 w-11 items-center justify-center rounded-lg border border-[#d8e0da] bg-white text-[#18221d] shadow-[0_8px_24px_rgba(24,34,29,0.12)] max-[900px]:inline-flex max-[560px]:left-[99px] max-[560px]:top-3"
          type="button"
          onClick={() => onAction({ type: 'RESET_DISCOVERY' })}
          aria-label="필터 초기화"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      ) : null}

      {hasAppliedFilters(state) && !isFilterOpen ? (
        <button
          className="absolute left-[107px] top-5 z-[3] inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] max-[900px]:hidden"
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

function getReviewDifficultyBadgeClass(difficultyLabel: string) {
  if (difficultyLabel === '쉬움') {
    return 'border-[#dceec8] bg-[#f2f9e8]';
  }
  if (difficultyLabel === '보통') {
    return 'border-[#cfe4d4] bg-[#edf7f0]';
  }
  if (difficultyLabel === '약간 어려움') {
    return 'border-[#f0dfaa] bg-[#fff7dc]';
  }
  if (difficultyLabel === '어려움') {
    return 'border-[#f3d1b4] bg-[#fff0e3]';
  }
  if (difficultyLabel === '매우 어려움') {
    return 'border-[#efc9c5] bg-[#fdecea]';
  }
  return 'border-[#d8e0da] bg-[#eef3f0]';
}

function getMountainLocationLabel(mountain: Mountain) {
  const primaryCity = mountain.city
    .split(',')[0]
    .split(/[\sㆍ·]+/)
    .map((part) => part.trim())
    .find((part) =>
      /(?:시|군|구)$/.test(part)
      && !/(?:특별시|광역시|특별자치시)$/.test(part)
      && part !== mountain.province,
    );

  return primaryCity ? `${mountain.province} ${primaryCity}` : mountain.province;
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
  const isMobile = useMobileDiscoveryLayout();
  const isLargeDesktop = useLargeDesktopDiscoveryLayout();
  const resultItemHeight = isLargeDesktop
    ? desktopVirtualResultItemHeight
    : mobileVirtualResultItemHeight;
  const listRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const resultScrollTopRef = useRef(state.resultScrollTop);
  const resultScrollFrameRef = useRef<number | null>(null);
  const mobilePanelCloseTimerRef = useRef<number | null>(null);
  const [resultListViewportHeight, setResultListViewportHeight] = useState(defaultResultListViewportHeight);
  const [virtualResultStart, setVirtualResultStart] = useState(() =>
    getVirtualResultStart(state.resultScrollTop, resultItemHeight),
  );
  const [isMobilePanelClosing, setIsMobilePanelClosing] = useState(false);
  const panelView = state.view.kind === 'filters' ? state.view.returnView : state.view;
  const isDesktopDefaultResults = !isMobile
    && panelView.kind === 'closed'
    && !state.selectedMountainId;
  const isDesktopSelectedDetail = !isMobile
    && panelView.kind === 'closed'
    && Boolean(state.selectedMountainId);
  const isResults = panelView.kind === 'results' || isDesktopDefaultResults;
  const isDetail = panelView.kind === 'detail' || isDesktopSelectedDetail;
  const randomView = state.view.kind === 'random-running' ? state.view : null;
  const isRandomRunning = randomView !== null;
  const isRandomWinner = randomView?.phase === 'winner';
  const randomWinner = randomView
    ? resultMountains.find((mountain) => mountain.id === randomView.winnerId)
    : undefined;
  const isOpen = isResults || isDetail || isRandomRunning;
  const isMobilePanelSuppressedByFilters = isMobile && state.view.kind === 'filters';
  const isMobilePanelHidden = isMobilePanelSuppressedByFilters || isMobilePanelClosing;
  const hasFilters = hasAppliedFilters(state);
  const shouldVirtualizeResults = resultMountains.length > virtualResultThreshold;
  const renderedVirtualResultStart = shouldVirtualizeResults ? virtualResultStart : 0;
  const virtualResultEnd = shouldVirtualizeResults
    ? Math.min(
        resultMountains.length,
        renderedVirtualResultStart
          + Math.ceil(resultListViewportHeight / resultItemHeight)
          + virtualResultOverscan * 2,
      )
    : resultMountains.length;
  const visibleResultMountains = resultMountains.slice(renderedVirtualResultStart, virtualResultEnd);

  const persistResultScrollPosition = useCallback(() => {
    onAction({
      type: 'SET_RESULT_SCROLL_TOP',
      scrollTop: resultScrollTopRef.current,
    });
  }, [onAction]);

  const beginMobilePanelClose = useCallback(() => {
    if (mobilePanelCloseTimerRef.current !== null) {
      return;
    }

    setIsMobilePanelClosing(true);
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    mobilePanelCloseTimerRef.current = window.setTimeout(() => {
      mobilePanelCloseTimerRef.current = null;
      setIsMobilePanelClosing(false);
      onAction({ type: 'CLOSE_MOBILE_SURFACE' });
    }, prefersReducedMotion ? 0 : mobileDiscoverySheetAnimationDuration);
  }, [onAction]);

  const handleResultScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    resultScrollTopRef.current = event.currentTarget.scrollTop;
    if (resultScrollFrameRef.current !== null) {
      return;
    }

    resultScrollFrameRef.current = window.requestAnimationFrame(() => {
      resultScrollFrameRef.current = null;
      const nextStart = getVirtualResultStart(resultScrollTopRef.current, resultItemHeight);
      setVirtualResultStart((currentStart) =>
        currentStart === nextStart ? currentStart : nextStart,
      );
    });
  }, [resultItemHeight]);

  useEffect(() => () => {
    if (resultScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(resultScrollFrameRef.current);
    }
    if (mobilePanelCloseTimerRef.current !== null) {
      window.clearTimeout(mobilePanelCloseTimerRef.current);
    }
  }, []);

  const dismissPanel = useCallback(() => {
    persistResultScrollPosition();
    if (isMobile) {
      beginMobilePanelClose();
      return;
    }
  }, [beginMobilePanelClose, isMobile, persistResultScrollPosition]);

  useEffect(() => {
    if (isResults && listRef.current) {
      const restoredScrollTop = state.resultScrollTop;
      resultScrollTopRef.current = restoredScrollTop;
      setVirtualResultStart(getVirtualResultStart(restoredScrollTop, resultItemHeight));
      listRef.current.scrollTop = restoredScrollTop;
    }
  }, [isResults, resultItemHeight, resultMountains, state.resultScrollTop]);

  useEffect(() => {
    const request = state.resultRevealRequest;
    const list = listRef.current;
    if (!request || !isResults || !list) {
      return;
    }

    const targetIndex = resultMountains.findIndex(
      (mountain) => mountain.id === request.mountainId,
    );
    if (targetIndex < 0) {
      onAction({ type: 'RESULT_REVEAL_HANDLED', revision: request.revision });
      return;
    }

    /*
     * target index -> scrollTop -> virtual start -> next-frame card verification
     */
    if (shouldVirtualizeResults) {
      const nextScrollTop = Math.max(0, targetIndex * resultItemHeight);
      resultScrollTopRef.current = nextScrollTop;
      list.scrollTop = nextScrollTop;
      setVirtualResultStart(getVirtualResultStart(nextScrollTop, resultItemHeight));
    }

    let retryFrameId: number | null = null;
    const verifyFrameId = window.requestAnimationFrame(() => {
      const target = Array.from(
        list.querySelectorAll<HTMLElement>('[data-result-mountain-id]'),
      ).find((element) => element.dataset.resultMountainId === request.mountainId);
      if (target) {
        if (!shouldVirtualizeResults) {
          target.scrollIntoView?.({ block: 'nearest' });
        }
        onAction({ type: 'RESULT_REVEAL_HANDLED', revision: request.revision });
        return;
      }

      retryFrameId = window.requestAnimationFrame(() => {
        onAction({ type: 'RESULT_REVEAL_HANDLED', revision: request.revision });
      });
    });

    return () => {
      window.cancelAnimationFrame(verifyFrameId);
      if (retryFrameId !== null) {
        window.cancelAnimationFrame(retryFrameId);
      }
    };
  }, [
    isResults,
    onAction,
    resultItemHeight,
    resultMountains,
    shouldVirtualizeResults,
    state.resultRevealRequest,
  ]);

  useEffect(() => {
    const request = state.focusRequest;
    if (!request || !isOpen || isMobilePanelHidden) {
      return;
    }
    if (request.target !== 'detail-heading' && request.target !== 'results-heading') {
      return;
    }

    const selector = request.target === 'detail-heading'
      ? '[data-discovery-focus="detail-heading"]'
      : '[data-discovery-focus="results-heading"]';
    const revision = request.revision;
    const frameId = window.requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(selector)
        ?? document.querySelector<HTMLElement>('[data-discovery-map]');
      target?.focus();
      onAction({ type: 'FOCUS_REQUEST_HANDLED', revision });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isMobilePanelHidden, isOpen, onAction, state.focusRequest]);

  useEffect(() => {
    if (!isResults || !listRef.current) {
      return;
    }

    const list = listRef.current;
    const updateViewportHeight = () => {
      if (list.clientHeight > 0) {
        setResultListViewportHeight(list.clientHeight);
      }
    };
    updateViewportHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(list);
    return () => observer.disconnect();
  }, [isResults]);

  useEffect(() => {
    if (!isOpen || !isMobile || isMobilePanelHidden) {
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
  }, [dismissPanel, isMobile, isMobilePanelHidden, isOpen, state.view.kind, triggerRef]);

  const closePanel = () => {
    dismissPanel();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {!isMobilePanelSuppressedByFilters ? (
        <button
          className={cn(
            'fixed inset-0 z-[5] hidden cursor-default border-0 p-0 transition-colors duration-700 ease-in-out max-[900px]:block motion-reduce:transition-none',
            isRandomRunning && !isRandomWinner ? 'bg-black/15' : 'bg-black/85',
            isMobilePanelClosing
              ? 'pointer-events-none max-[900px]:animate-[discovery-backdrop-out_240ms_ease-in_both]'
              : 'max-[900px]:animate-[discovery-backdrop-in_220ms_ease-out_both]',
          )}
          data-discovery-backdrop={isRandomRunning && !isRandomWinner ? 'random-spinning' : 'dimmed'}
          type="button"
          aria-label="산 찾기 패널 닫기"
          onClick={closePanel}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={cn(
          'z-[6] flex min-h-0 flex-col overflow-hidden border-l border-[#d8e0da] bg-white max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:max-h-[78vh] max-[900px]:transform-gpu max-[900px]:rounded-t-2xl max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:shadow-[0_-18px_60px_rgba(0,0,0,0.24)] max-[900px]:will-change-transform',
          isMobilePanelHidden
            ? 'pointer-events-none max-[900px]:z-[4] max-[900px]:animate-[discovery-sheet-out_240ms_cubic-bezier(0.4,0,1,1)_both]'
            : 'max-[900px]:animate-[discovery-sheet-in_280ms_cubic-bezier(0.22,1,0.36,1)_both]',
          'motion-reduce:animate-none',
        )}
        data-mobile-sheet-motion={isMobilePanelHidden ? 'closing' : 'opening'}
        role={isMobile && !isMobilePanelHidden ? 'dialog' : undefined}
        aria-modal={isMobile && !isMobilePanelHidden ? true : undefined}
        aria-hidden={isMobilePanelHidden || undefined}
        aria-label={isResults ? '산 찾기 결과' : isRandomWinner ? '랜덤 추천 당첨 결과' : isRandomRunning ? '랜덤 추천 진행 상태' : '선택한 산 정보'}
      >
        {isResults ? (
          <>
            <header
              className="flex flex-none items-center gap-2 border-b border-[#d8e0da] p-3.5 max-[900px]:h-[50px] max-[900px]:px-3 max-[900px]:py-0"
              data-results-sheet-header
            >
              <h2
                className="m-0 ml-2.5 flex min-w-0 flex-none items-baseline gap-1.5 text-sm font-normal text-[#18221d] max-[900px]:ml-3"
                aria-label={`${hasFilters ? '결과' : '전체'} ${resultMountains.length.toLocaleString()}개`}
                data-discovery-focus="results-heading"
                tabIndex={-1}
              >
                <span>{hasFilters ? '결과' : '전체'}</span>
                <strong className="font-numeric text-xl font-semibold leading-6 text-[#245c46]">
                  {resultMountains.length.toLocaleString()}개
                </strong>
              </h2>
              {isMobile ? (
                <button
                  className="ml-auto inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border-0 bg-transparent transition-colors hover:bg-[#eef3f0]"
                  type="button"
                  onClick={closePanel}
                  aria-label="산 찾기 결과 닫기"
                >
                  <X size={19} />
                </button>
              ) : null}
            </header>

            <div
              className="flex flex-none items-center gap-2 border-b border-[#d8e0da] p-3 max-[900px]:px-3 max-[900px]:py-2"
              data-results-toolbar
            >
              <button
                className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-semibold text-[#18221d]"
                data-results-filter-button
                type="button"
                onClick={() => {
                  persistResultScrollPosition();
                  onAction({ type: 'OPEN_FILTERS' });
                }}
              >
                <ListFilter size={18} />
                필터 수정
              </button>
              <label className="sr-only" htmlFor="mountain-result-sort">
                결과 정렬
              </label>
              <select
                id="mountain-result-sort"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm font-semibold text-[#18221d]"
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
              <span
                className="h-7 w-px flex-none bg-[#d8e0da]"
                data-results-random-divider
                aria-hidden="true"
              />
              <button
                className="ml-auto inline-flex min-h-11 min-w-0 flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#245c46] bg-[#245c46] px-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:border-[#8a9790] disabled:bg-[#8a9790]"
                type="button"
                onClick={() => {
                  persistResultScrollPosition();
                  onRandomRecommend();
                }}
                disabled={resultMountains.length === 0}
                aria-label={resultMountains.length > 0
                  ? '등반할 산 랜덤 돌리기'
                  : '추천할 산이 없어요'}
              >
                <Shuffle className="flex-none" size={16} />
                {resultMountains.length > 0 ? '등반할 산 랜덤 돌리기' : '추천 불가'}
              </button>
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
                data-result-list
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-[900px]:pb-[env(safe-area-inset-bottom)]"
                onScroll={handleResultScroll}
              >
                <div
                  className={shouldVirtualizeResults ? 'relative w-full' : undefined}
                  style={shouldVirtualizeResults
                    ? { height: `${resultMountains.length * resultItemHeight}px` }
                    : undefined}
                >
                  {visibleResultMountains.map((mountain, visibleIndex) => {
                    const resultIndex = renderedVirtualResultStart + visibleIndex;
                    const difficultyLabel = getMountainDifficultyLabel(
                      mountain.id,
                      difficultySummaryState,
                    );
                    return (
                      <button
                        key={mountain.id}
                        className={cn(
                          'grid min-h-[120px] w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-0 border-b border-[#d8e0da] bg-white p-3 text-left text-[#18221d] transition hover:bg-[#f5f7f4] focus-visible:bg-[#eef3f0] min-[1360px]:min-h-[132px] min-[1360px]:gap-4 min-[1360px]:p-4',
                          state.selectedMountainId === mountain.id
                            && 'bg-[#f5f7f4] shadow-[inset_5px_0_0_#245c46]',
                          shouldVirtualizeResults && 'absolute left-0 top-0',
                        )}
                        style={shouldVirtualizeResults
                          ? {
                              transform: `translateY(${resultIndex * resultItemHeight}px)`,
                              height: `${resultItemHeight}px`,
                            }
                          : undefined}
                        type="button"
                        data-result-mountain-id={mountain.id}
                        aria-current={state.selectedMountainId === mountain.id ? 'true' : undefined}
                        onClick={() => {
                          persistResultScrollPosition();
                          onSelectMountain(mountain);
                        }}
                      >
                        <img
                          className="h-24 w-auto max-w-[192px] rounded-lg bg-[#eef3f0] object-contain min-[1360px]:h-[104px] min-[1360px]:w-[184px] min-[1360px]:max-w-none min-[1360px]:object-cover"
                          src={getMountainImage(mountain)}
                          alt=""
                          width={384}
                          height={216}
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="grid min-w-0 content-center gap-1.5">
                          <span className="flex items-baseline justify-between gap-3">
                            <strong className="truncate text-[17px] font-black leading-6 min-[1360px]:text-lg min-[1360px]:font-semibold">{mountain.name}</strong>
                            <span className="font-numeric flex-none text-base font-black text-[#245c46] min-[1360px]:text-[17px] min-[1360px]:font-semibold">
                              {mountain.elevationMeters.toLocaleString()}m
                            </span>
                          </span>
                          <span className="truncate text-sm font-medium text-[#5d6a62] min-[1360px]:text-base">
                            {getMountainLocationLabel(mountain)}
                          </span>
                          <span className="flex items-center justify-between gap-2 text-sm font-bold text-[#5d6a62] min-[1360px]:font-semibold">
                            <span
                              className={cn(
                                'inline-flex min-h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold text-[#2d3932] min-[1360px]:text-sm',
                                getReviewDifficultyBadgeClass(difficultyLabel),
                              )}
                            >
                              {difficultyLabel}
                            </span>
                            {isAuthenticated && completionDataStatus === 'ready' ? (
                              <span className={completedIds.has(mountain.id) ? 'text-[#237a1f]' : undefined}>
                                {completedIds.has(mountain.id) ? (
                                  <span className="inline-flex items-center gap-1"><Check size={14} />등반 완료</span>
                                ) : (
                                  '미등반'
                                )}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
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
            <header
              className="flex flex-none items-center justify-between gap-3 border-b border-[#d8e0da] p-3 max-[900px]:h-[50px] max-[900px]:px-3 max-[900px]:py-0"
              data-detail-sheet-header
            >
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-3 text-base font-semibold text-[#18221d] transition-colors hover:text-[#245c46]"
                type="button"
                onClick={() => onAction({ type: 'RETURN_TO_RESULTS' })}
              >
                <ArrowLeft size={18} />
                목록
              </button>
              {isMobile ? (
                <button
                  className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border-0 bg-transparent text-[#18221d] transition-colors hover:text-[#245c46]"
                  type="button"
                  onClick={closePanel}
                  aria-label="선택한 산 정보 닫기"
                >
                  <X size={19} />
                </button>
              ) : null}
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
