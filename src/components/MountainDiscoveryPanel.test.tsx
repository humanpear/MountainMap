import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useCallback, useMemo, useReducer, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialDiscoveryState,
  discoveryReducer,
  filterMountains,
  sortMountains,
  type DifficultySummaryState,
  type DiscoveryAction,
} from '../domain/mountainDiscovery';
import type { Mountain } from '../types';
import {
  MobileMountainInfoBar,
  MountainDiscoveryControls,
  MountainDiscoveryPanel,
  classifyInfoBarSwipe,
} from './MountainDiscoveryPanel';

const testMountains: Mountain[] = [
  {
    id: 'gangwon-mountain',
    name: '강원산',
    province: '강원도',
    regionCodes: ['gangwon'],
    city: '춘천시',
    latitude: 37.8,
    longitude: 127.7,
    elevationMeters: 900,
    address: '강원도 춘천시',
    shortDescription: '강원의 산',
    selectionReason: '테스트',
  },
  {
    id: 'gyeonggi-mountain',
    name: '경기산',
    province: '서울특별시',
    regionCodes: ['seoul-gyeonggi'],
    city: '관악구, 경기도',
    latitude: 37.7,
    longitude: 127.4,
    elevationMeters: 700,
    address: '서울특별시 관악구',
    shortDescription: '경기의 산',
    selectionReason: '테스트',
  },
];

const readyDifficultyState: DifficultySummaryState = {
  status: 'ready',
  summaries: new Map([
    ['gangwon-mountain', { mountainId: 'gangwon-mountain', reviewCount: 10, averageScore: 2 }],
  ]),
};

function DiscoveryHarness({
  difficultySummaryState = readyDifficultyState,
  isAuthenticated = true,
  completionDataStatus = isAuthenticated ? 'ready' : 'signed-out',
  onRetryDifficultySummaries = vi.fn(),
  onRandomRecommend = vi.fn(),
  onActionObserved,
  mountains = testMountains,
}: {
  difficultySummaryState?: DifficultySummaryState;
  isAuthenticated?: boolean;
  completionDataStatus?: 'signed-out' | 'loading' | 'ready' | 'error';
  onRetryDifficultySummaries?: () => void;
  onRandomRecommend?: () => void;
  onActionObserved?: (action: DiscoveryAction) => void;
  mountains?: Mountain[];
}) {
  const [state, dispatch] = useReducer(discoveryReducer, undefined, createInitialDiscoveryState);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const completedIds = useMemo(() => new Set(['gangwon-mountain']), []);
  const usableDifficultyState: DifficultySummaryState =
    difficultySummaryState.status === 'ready'
      ? difficultySummaryState
      : { status: 'ready', summaries: new Map() };
  const draftResultCount = filterMountains({
    mountains,
    filters:
      difficultySummaryState.status === 'ready'
        ? state.draftFilters
        : { ...state.draftFilters, difficulty: [] },
    difficultySummaryState: usableDifficultyState,
    completedIds,
    isAuthenticated,
  }).length;
  const results = sortMountains(
    filterMountains({
      mountains,
      filters: state.appliedFilters,
      difficultySummaryState:
        state.appliedFilters.difficulty.length === 0
          ? difficultySummaryState
          : usableDifficultyState,
      completedIds,
      isAuthenticated,
    }),
    state.sort,
  );
  const onAction = useCallback((action: DiscoveryAction) => {
    onActionObserved?.(action);
    dispatch(action);
  }, [onActionObserved]);

  return (
    <div>
      <MountainDiscoveryControls
        state={state}
        draftResultCount={draftResultCount}
        difficultySummaryState={difficultySummaryState}
        isAuthenticated={isAuthenticated}
        completionDataStatus={completionDataStatus}
        triggerRef={triggerRef}
        onAction={onAction}
        onRetryDifficultySummaries={onRetryDifficultySummaries}
        onRequestLogin={vi.fn()}
      />
      <MountainDiscoveryPanel
        state={state}
        resultMountains={results}
        difficultySummaryState={difficultySummaryState}
        completedIds={completedIds}
        isAuthenticated={isAuthenticated}
        completionDataStatus={completionDataStatus}
        triggerRef={triggerRef}
        detailContent={<div>선택한 산 상세정보</div>}
        onAction={onAction}
        onSelectMountain={(mountain) =>
          dispatch({ type: 'SELECT_FROM_LIST', mountainId: mountain.id })
        }
        onRandomRecommend={onRandomRecommend}
      />
    </div>
  );
}

function selectFilterOption(section: '지역' | '체감 난이도' | '등정 상태', option: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${section} 필터`) }));
  fireEvent.click(screen.getByRole(section === '등정 상태' ? 'radio' : 'checkbox', { name: option }));
}

describe('MountainDiscoveryPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('shows the complete mountain list by default on desktop', () => {
    render(<DiscoveryHarness />);

    expect(screen.getByRole('complementary', { name: '산 찾기 결과' })).toBeInTheDocument();
    expect(screen.queryByText('100대 명산')).not.toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: '전체 2개' });
    expect(heading).toHaveClass('text-sm', 'font-normal', 'text-[#18221d]');
    expect(within(heading).getByText('2개')).toHaveClass('text-xl', 'font-semibold', 'text-[#245c46]');
    const randomButton = screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' });
    expect(randomButton.closest('header')).toBeInTheDocument();
    expect(randomButton).toHaveClass('min-h-9', 'flex-none', 'px-2');
    expect(randomButton).not.toHaveClass('flex-1');
    const mountainButton = screen.getByRole('button', { name: /강원산/ });
    expect(mountainButton).toHaveTextContent('강원도 춘천시');
    expect(within(mountainButton).getByText('900m')).toHaveClass('text-[#245c46]');
    expect(screen.getByText('등반 완료')).toBeInTheDocument();
    expect(screen.getByText('미등반')).toBeInTheDocument();
    expect(within(mountainButton).getByText('보통')).toHaveClass(
      'rounded-full',
      'border-[#cfe4d4]',
      'bg-[#edf7f0]',
    );
    expect(within(mountainButton).queryByText('난이도 보통')).not.toBeInTheDocument();
    const mountainImage = mountainButton.querySelector('img');
    expect(mountainImage).toHaveClass('h-24', 'w-auto', 'object-contain');
    expect(mountainImage).toHaveAttribute(
      'src',
      '/mountain-images/gangwon-mountain/list.jpg',
    );
    expect(mountainImage).toHaveAttribute('width', '384');
    expect(mountainImage).toHaveAttribute('height', '216');
    expect(mountainImage).toHaveAttribute('decoding', 'async');
    expect(screen.getByRole('button', { name: /경기산/ })).toHaveTextContent('서울특별시 관악구');
    expect(screen.queryByRole('button', { name: '산 찾기 결과 닫기' })).not.toBeInTheDocument();
  });

  it('keeps the mobile map clear without rendering a list shortcut', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);

    expect(screen.queryByRole('dialog', { name: '산 찾기 결과' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /목록 2/ })).not.toBeInTheDocument();
  });

  it('keeps draft filters separate until they are applied', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    selectFilterOption('지역', '강원도');

    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));

    expect(screen.getByRole('heading', { name: '결과 1개' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /강원산/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /경기산/ })).not.toBeInTheDocument();
    expect(screen.queryByText('강원도 · 1개')).not.toBeInTheDocument();
  });

  it('keeps multiple values selected inside one filter category', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: /지역 필터/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: '강원도' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '서울/경기' }));

    expect(screen.getByRole('checkbox', { name: '강원도' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '서울/경기' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '전체 지역' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: '지역 필터, 현재 2개 선택' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: '전체 지역' }));
    expect(screen.getByRole('checkbox', { name: '전체 지역' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '강원도' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '서울/경기' })).not.toBeChecked();
  });

  it('renders multi-select region and difficulty cards with a single-select completion card', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));

    const dialog = screen.getByRole('dialog', { name: '조건으로 찾기' });
    expect(dialog).toHaveClass('w-[min(388px,calc(100%-40px))]');
    expect(dialog).toHaveClass('overflow-hidden');
    expect(dialog).not.toHaveClass('overflow-y-auto');
    expect(screen.getByText('조건으로 산 찾기')).toBeInTheDocument();
    expect(screen.queryByText(/선택 \d+/)).not.toBeInTheDocument();
    const expandedHeader = dialog.querySelector('[data-filter-header="expanded"]');
    expect(expandedHeader).toHaveClass('h-11', 'rounded-none');
    expect(expandedHeader?.querySelector('button')).toHaveClass('text-sm', 'font-bold');
    expect(dialog.querySelector('#mountain-discovery-filters')).toHaveClass(
      'filter-scroll-region',
      'flex-auto',
      'overflow-y-auto',
      'opacity-0',
      'animate-[filter-content-fade_120ms_ease-out_160ms_forwards]',
    );
    expect(dialog.querySelector('[data-filter-intro]')).toHaveClass('bg-white');
    expect(dialog.querySelector('[data-filter-actions]')).toHaveClass(
      'border-t',
      'border-[#d8e0da]',
    );
    expect(screen.getByRole('button', { name: '2개 산 보기' })).toHaveClass('border-0');

    const regionCard = screen.getByRole('button', { name: /지역 필터/ });
    const difficultyCard = screen.getByRole('button', { name: /체감 난이도 필터/ });
    const completionCard = screen.getByRole('button', { name: /등정 상태 필터/ });
    expect(regionCard.closest('[data-filter-card]')).toHaveAttribute(
      'data-filter-card',
      'region',
    );
    expect(difficultyCard.closest('[data-filter-card]')).toHaveAttribute(
      'data-filter-card',
      'difficulty',
    );
    expect(completionCard.closest('[data-filter-card]')).toHaveAttribute(
      'data-filter-card',
      'completion',
    );
    expect(screen.queryByRole('radiogroup', { name: '등정 상태' })).not.toBeInTheDocument();

    fireEvent.click(completionCard);
    expect(screen.getByRole('radiogroup', { name: '등정 상태' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '전체' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '등정 완료' }));
    expect(screen.getByRole('radio', { name: '등정 완료' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '미등정' }));
    expect(screen.getByRole('radio', { name: '등정 완료' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '미등정' })).toBeChecked();

    fireEvent.click(regionCard);
    expect(screen.queryByRole('radiogroup', { name: '등정 상태' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '지역' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '강원도' }));
    expect(screen.getByRole('button', { name: '지역 필터, 현재 강원도' })).toBeInTheDocument();
    expect(screen.queryByText(/선택 \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText('전체 산 · 2개')).not.toBeInTheDocument();
  });

  it('shows the approved empty state and can reset all filters', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    selectFilterOption('지역', '제주도');
    fireEvent.click(screen.getByRole('button', { name: '0개 산 보기' }));

    expect(screen.getByRole('heading', { name: '조건에 맞는 산이 없어요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추천할 산이 없어요' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '전체 초기화' }));
    expect(screen.getByRole('heading', { name: '전체 2개' })).toBeInTheDocument();
  });

  it('starts random recommendation with the current result count', () => {
    const onRandomRecommend = vi.fn();
    render(<DiscoveryHarness onRandomRecommend={onRandomRecommend} />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    selectFilterOption('지역', '강원도');
    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' }));

    expect(onRandomRecommend).toHaveBeenCalledTimes(1);
  });

  it('does not disguise a difficulty error as an unrated state and supports retry', () => {
    const onRetry = vi.fn();
    render(
      <DiscoveryHarness
        difficultySummaryState={{ status: 'error', message: 'network error' }}
        onRetryDifficultySummaries={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: /체감 난이도 필터/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('난이도 정보를 불러오지 못했습니다.');
    expect(screen.queryByRole('checkbox', { name: '평가 전' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables completion filters for signed-out users', () => {
    render(<DiscoveryHarness isAuthenticated={false} />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: /등정 상태 필터/ }));

    expect(screen.getByRole('radio', { name: '등정 완료' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '미등정' })).toBeDisabled();
    expect(screen.getByText('등정 기록 필터는 로그인이 필요합니다.')).toBeInTheDocument();
  });

  it('disables completion filters until authenticated completion data is ready', () => {
    const { rerender } = render(
      <DiscoveryHarness isAuthenticated completionDataStatus="loading" />,
    );

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: /등정 상태 필터/ }));
    expect(screen.getByRole('radio', { name: '등정 완료' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '미등정' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('등정 기록을 불러오는 중입니다.');

    rerender(<DiscoveryHarness isAuthenticated completionDataStatus="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '등정 기록을 불러오지 못해 완료·미등정 필터를 사용할 수 없습니다.',
    );
    expect(screen.getByRole('radio', { name: '등정 완료' })).toBeDisabled();
  });

  it('returns from detail to the same result list and restores its scroll position', async () => {
    const onActionObserved = vi.fn();
    render(<DiscoveryHarness onActionObserved={onActionObserved} />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    const resultButton = screen.getByRole('button', { name: /강원산/ });
    const list = resultButton.closest('[data-result-list]') as HTMLDivElement;
    Object.defineProperty(list, 'scrollTop', { value: 120, writable: true });
    onActionObserved.mockClear();
    fireEvent.scroll(list);
    expect(onActionObserved).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_RESULT_SCROLL_TOP' }),
    );
    fireEvent.click(resultButton);
    expect(onActionObserved).toHaveBeenCalledWith({
      type: 'SET_RESULT_SCROLL_TOP',
      scrollTop: 120,
    });

    expect(screen.getByText('선택한 산 상세정보')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '목록' }));

    await waitFor(() => {
      const restoredList = screen.getByRole('button', { name: /강원산/ }).closest('[data-result-list]') as HTMLDivElement;
      expect(restoredList.scrollTop).toBe(120);
    });
  });

  it('batches virtual list updates into one animation frame without dispatching every scroll event', () => {
    const manyMountains = Array.from({ length: 40 }, (_, index): Mountain => ({
      ...testMountains[0],
      id: `mountain-${index}`,
      name: `${index}산`,
      elevationMeters: 500 + index,
    }));
    const onActionObserved = vi.fn();
    let scheduledFrame: FrameRequestCallback | undefined;
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrame = callback;
      return 1;
    });

    render(
      <DiscoveryHarness
        mountains={manyMountains}
        onActionObserved={onActionObserved}
      />,
    );

    const firstResult = screen.getByRole('button', { name: /^0산/ });
    const list = firstResult.closest('[data-result-list]') as HTMLDivElement;
    Object.defineProperty(list, 'scrollTop', { value: 1_200, writable: true });
    onActionObserved.mockClear();
    fireEvent.scroll(list);
    list.scrollTop = 1_320;
    fireEvent.scroll(list);

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(onActionObserved).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_RESULT_SCROLL_TOP' }),
    );
    expect(screen.getByRole('button', { name: /^0산/ })).toBeInTheDocument();

    act(() => scheduledFrame?.(0));

    expect(screen.queryByRole('button', { name: /^0산/ })).not.toBeInTheDocument();
  });

  it('closes filters with Escape and returns focus to the trigger', async () => {
    render(<DiscoveryHarness />);
    const trigger = screen.getByRole('button', { name: '필터' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '조건으로 찾기' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('wraps focus inside the mobile filter dialog and closes from the backdrop', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);
    const trigger = screen.getByRole('button', { name: '필터' });

    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: '조건으로 찾기' });
    const backdrop = screen.getByRole('button', { name: '조건으로 찾기 닫기' });
    const firstFilter = screen.getByRole('button', { name: '필터 닫기' });
    const applyButton = screen.getByRole('button', { name: '2개 산 보기' });

    firstFilter.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(applyButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstFilter).toHaveFocus();

    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '조건으로 찾기' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('does not treat browser Back as a command to close the mobile filter dialog', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();
    fireEvent.popState(window);
    expect(screen.getByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();
  });

  it('keeps focus on the mobile filter control while its value changes', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(await screen.findByRole('button', { name: /지역 필터/ }));
    const regionSelect = screen.getByRole('checkbox', { name: '강원도' });
    regionSelect.focus();
    fireEvent.click(regionSelect);

    expect(regionSelect).toHaveFocus();
  });

  it('returns to mobile results when nested filter editing is cancelled', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    const resultDialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    expect(resultDialog).toHaveAttribute('data-mobile-sheet-motion', 'opening');
    expect(resultDialog.querySelector('[data-results-sheet-header]')).toHaveClass(
      'max-[900px]:h-[50px]',
      'max-[900px]:py-0',
    );
    expect(resultDialog.querySelector('[data-results-toolbar]')).toHaveClass(
      'max-[900px]:py-2',
    );
    expect(resultDialog.querySelector('[data-results-filter-button]')).toHaveClass(
      'max-[900px]:min-h-9',
    );
    expect(within(resultDialog).getByLabelText('결과 정렬')).toHaveClass(
      'max-[900px]:min-h-9',
    );
    expect(resultDialog).toHaveClass(
      'max-[900px]:animate-[discovery-sheet-in_280ms_cubic-bezier(0.22,1,0.36,1)_both]',
    );
    const randomButton = screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' });
    const closeButton = screen.getByRole('button', { name: '산 찾기 결과 닫기' });
    expect(randomButton.parentElement).toBe(closeButton.parentElement);
    expect(randomButton.parentElement).toHaveClass('ml-auto', 'justify-end');

    fireEvent.click(screen.getByRole('button', { name: '필터 수정' }));
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '산 찾기 결과' })).not.toBeInTheDocument();
    const hiddenResultSheet = document.querySelector('[data-mobile-sheet-motion="closing"]');
    expect(hiddenResultSheet).toHaveAttribute('aria-hidden', 'true');
    expect(hiddenResultSheet).toHaveClass(
      'max-[900px]:animate-[discovery-sheet-out_240ms_cubic-bezier(0.4,0,1,1)_both]',
    );
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toHaveAttribute(
      'data-mobile-sheet-motion',
      'opening',
    );
  });

  it('does not add discovery sheet entries to browser history', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const pushState = vi.spyOn(window.history, 'pushState');
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '필터 수정' }));
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();

    expect(pushState).not.toHaveBeenCalled();
  });

  it('treats the mobile result sheet as a modal and closes it with Escape', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));

    const dialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '산 찾기 결과' })).not.toBeInTheDocument();
    });
  });

  it('wraps focus inside the mobile result sheet and closes from the backdrop', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    const randomButton = screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' });
    const lastResult = screen.getByRole('button', { name: /경기산/ });

    randomButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastResult).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(randomButton).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '산 찾기 패널 닫기' }));
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });

  it('does not treat browser Back as a command to close the mobile result sheet', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 900px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<DiscoveryHarness />);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();
    fireEvent.popState(window);
    expect(screen.getByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();
  });
});

describe('MobileMountainInfoBar', () => {
  it.each([
    [0, -48, 'open-detail'],
    [32, -48, 'open-detail'],
    [0, 48, 'clear-selection'],
    [0, -47, null],
    [33, -48, null],
    [60, -48, null],
  ] as const)('classifies swipe delta (%s, %s)', (deltaX, deltaY, expected) => {
    expect(classifyInfoBarSwipe(deltaX, deltaY)).toBe(expected);
  });

  it('renders the approved action order and keeps every action independently usable', () => {
    const onOpenDetail = vi.fn();
    const onOpenResults = vi.fn();
    const onClearSelection = vi.fn();
    const { container } = render(
      <MobileMountainInfoBar
        mountain={{ ...testMountains[0], province: '강원특별자치도' }}
        obscured={false}
        onFocusHandled={vi.fn()}
        onHeightChange={vi.fn()}
        onOpenDetail={onOpenDetail}
        onOpenResults={onOpenResults}
        onClearSelection={onClearSelection}
      />,
    );

    const bar = container.querySelector('[data-map-occluder="persistent"]');
    expect(bar).toHaveClass('rounded-full');
    expect(bar).toHaveTextContent('강원산강원도900m상세목록');
    expect(screen.getByLabelText('위치 강원도')).toBeInTheDocument();
    expect(screen.getByLabelText('높이 900미터')).toBeInTheDocument();
    expect(container.querySelector('[data-info-summary]')).toHaveClass('justify-center', 'gap-4');
    expect(container.querySelector('[data-info-divider]')).toHaveClass('mr-2');
    fireEvent.click(screen.getByRole('button', { name: '상세' }));
    fireEvent.click(screen.getByRole('button', { name: '목록' }));
    fireEvent.click(screen.getByRole('button', { name: '강원산 선택 해제' }));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenResults).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('uses native inert and aria-hidden while a full sheet obscures the mounted bar', () => {
    const { container } = render(
      <MobileMountainInfoBar
        mountain={testMountains[0]}
        obscured
        onFocusHandled={vi.fn()}
        onHeightChange={vi.fn()}
        onOpenDetail={vi.fn()}
        onOpenResults={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    const bar = container.querySelector<HTMLElement>('[data-map-occluder="persistent"]');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar?.inert).toBe(true);
    expect(bar).toHaveClass('pointer-events-none', 'invisible');
  });

  it('coalesces fractional ResizeObserver heights and ignores an identical visual height', () => {
    let observerCallback: ResizeObserverCallback | null = null;
    const disconnect = vi.fn();
    class InfoBarResizeObserver implements ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }
    }
    let scheduledFrame: FrameRequestCallback | null = null;
    vi.stubGlobal('ResizeObserver', InfoBarResizeObserver);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scheduledFrame = callback;
      return 1;
    });
    const onHeightChange = vi.fn();
    const { container, unmount } = render(
      <MobileMountainInfoBar
        mountain={testMountains[0]}
        obscured={false}
        onFocusHandled={vi.fn()}
        onHeightChange={onHeightChange}
        onOpenDetail={vi.fn()}
        onOpenResults={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    const bar = container.querySelector<HTMLElement>('[data-map-occluder="persistent"]')!;
    let height = 55.1;
    bar.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: height,
      width: 320,
      height,
      toJSON: () => ({}),
    }));

    act(() => {
      observerCallback?.([], {} as ResizeObserver);
      height = 55.9;
      observerCallback?.([], {} as ResizeObserver);
      scheduledFrame?.(0);
    });
    expect(onHeightChange).toHaveBeenCalledTimes(1);
    expect(onHeightChange).toHaveBeenLastCalledWith(56);

    act(() => {
      observerCallback?.([], {} as ResizeObserver);
      scheduledFrame?.(16);
    });
    expect(onHeightChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });

  it('restores focus only after the mounted bar is no longer obscured', async () => {
    const onFocusHandled = vi.fn();
    const onHeightChange = vi.fn();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { rerender } = render(
      <MobileMountainInfoBar
        mountain={testMountains[0]}
        obscured
        focusRequest={{ target: 'info-detail-button', revision: 4 }}
        onFocusHandled={onFocusHandled}
        onHeightChange={onHeightChange}
        onOpenDetail={vi.fn()}
        onOpenResults={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(onFocusHandled).not.toHaveBeenCalled();

    rerender(
      <MobileMountainInfoBar
        mountain={testMountains[0]}
        obscured={false}
        focusRequest={{ target: 'info-detail-button', revision: 4 }}
        onFocusHandled={onFocusHandled}
        onHeightChange={onHeightChange}
        onOpenDetail={vi.fn()}
        onOpenResults={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onFocusHandled).toHaveBeenCalledWith(4);
    });
    expect(focus).toHaveBeenCalled();
    expect(focus.mock.instances.at(-1)).toBe(screen.getByRole('button', { name: '상세' }));
  });

  it('opens detail on an upward bar swipe and clears selection on a downward swipe', () => {
    const onOpenDetail = vi.fn();
    const onClearSelection = vi.fn();
    const { container } = render(
      <MobileMountainInfoBar
        mountain={testMountains[0]}
        obscured={false}
        onFocusHandled={vi.fn()}
        onHeightChange={vi.fn()}
        onOpenDetail={onOpenDetail}
        onOpenResults={vi.fn()}
        onClearSelection={onClearSelection}
      />,
    );
    const bar = container.querySelector<HTMLElement>('[data-map-occluder="persistent"]')!;

    fireEvent.pointerDown(bar, { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(bar, { pointerId: 1, isPrimary: true, clientX: 100, clientY: 40 });
    fireEvent.pointerDown(bar, { pointerId: 2, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(bar, { pointerId: 2, isPrimary: true, clientX: 100, clientY: 160 });

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
