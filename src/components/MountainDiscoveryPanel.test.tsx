import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { MountainDiscoveryControls, MountainDiscoveryPanel } from './MountainDiscoveryPanel';

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
    province: '경기도',
    regionCodes: ['seoul-gyeonggi'],
    city: '가평군',
    latitude: 37.7,
    longitude: 127.4,
    elevationMeters: 700,
    address: '경기도 가평군',
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
}: {
  difficultySummaryState?: DifficultySummaryState;
  isAuthenticated?: boolean;
  completionDataStatus?: 'signed-out' | 'loading' | 'ready' | 'error';
  onRetryDifficultySummaries?: () => void;
  onRandomRecommend?: () => void;
}) {
  const [state, dispatch] = useReducer(discoveryReducer, undefined, createInitialDiscoveryState);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const completedIds = useMemo(() => new Set(['gangwon-mountain']), []);
  const usableDifficultyState: DifficultySummaryState =
    difficultySummaryState.status === 'ready'
      ? difficultySummaryState
      : { status: 'ready', summaries: new Map() };
  const draftResultCount = filterMountains({
    mountains: testMountains,
    filters:
      difficultySummaryState.status === 'ready'
        ? state.draftFilters
        : { ...state.draftFilters, difficulty: 'all' },
    difficultySummaryState: usableDifficultyState,
    completedIds,
    isAuthenticated,
  }).length;
  const results = sortMountains(
    filterMountains({
      mountains: testMountains,
      filters: state.appliedFilters,
      difficultySummaryState:
        state.appliedFilters.difficulty === 'all'
          ? difficultySummaryState
          : usableDifficultyState,
      completedIds,
      isAuthenticated,
    }),
    state.sort,
  );
  const onAction = useCallback((action: DiscoveryAction) => dispatch(action), []);

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
          dispatch({ type: 'SELECT_MOUNTAIN', mountainId: mountain.id })
        }
        onRandomRecommend={onRandomRecommend}
      />
    </div>
  );
}

describe('MountainDiscoveryPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('keeps draft filters separate until they are applied', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.change(screen.getByLabelText('지역'), { target: { value: 'gangwon' } });

    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));

    expect(screen.getByRole('heading', { name: '결과 1개' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /강원산/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /경기산/ })).not.toBeInTheDocument();
    expect(screen.queryByText('강원도 · 1개')).not.toBeInTheDocument();
  });

  it('lays out compact filter labels and dropdowns in matching rows', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));

    const dialog = screen.getByRole('dialog', { name: '조건으로 찾기' });
    expect(dialog).toHaveClass('w-[min(336px,calc(100%-40px))]');
    expect(screen.getByLabelText('지역').parentElement).toHaveClass(
      'grid-cols-[88px_minmax(0,1fr)]',
    );
    expect(screen.getByLabelText('체감 난이도').parentElement).toHaveClass(
      'grid-cols-[88px_minmax(0,1fr)]',
    );
    expect(screen.getByLabelText('등정 상태').parentElement).toHaveClass(
      'grid-cols-[88px_minmax(0,1fr)]',
    );
    expect(screen.queryByText('전체 산 · 2개')).not.toBeInTheDocument();
  });

  it('shows the approved empty state and can reset all filters', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.change(screen.getByLabelText('지역'), { target: { value: 'jeju' } });
    fireEvent.click(screen.getByRole('button', { name: '0개 산 보기' }));

    expect(screen.getByRole('heading', { name: '조건에 맞는 산이 없어요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추천할 산이 없어요' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '전체 초기화' }));
    expect(screen.getByRole('heading', { name: '결과 2개' })).toBeInTheDocument();
  });

  it('starts random recommendation with the current result count', () => {
    const onRandomRecommend = vi.fn();
    render(<DiscoveryHarness onRandomRecommend={onRandomRecommend} />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.change(screen.getByLabelText('지역'), { target: { value: 'gangwon' } });
    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '이 결과 1개 중 랜덤 추천' }));

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

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));

    expect(screen.getByRole('alert')).toHaveTextContent('난이도 정보를 불러오지 못했습니다.');
    expect(screen.queryByRole('option', { name: '평가 전' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables completion filters for signed-out users', () => {
    render(<DiscoveryHarness isAuthenticated={false} />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));

    expect(screen.getByRole('option', { name: '등정 완료' })).toBeDisabled();
    expect(screen.getByRole('option', { name: '미등정' })).toBeDisabled();
    expect(screen.getByText('등정 기록 필터는 로그인이 필요합니다.')).toBeInTheDocument();
  });

  it('disables completion filters until authenticated completion data is ready', () => {
    const { rerender } = render(
      <DiscoveryHarness isAuthenticated completionDataStatus="loading" />,
    );

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    expect(screen.getByRole('option', { name: '등정 완료' })).toBeDisabled();
    expect(screen.getByRole('option', { name: '미등정' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('등정 기록을 불러오는 중입니다.');

    rerender(<DiscoveryHarness isAuthenticated completionDataStatus="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '등정 기록을 불러오지 못해 완료·미등정 필터를 사용할 수 없습니다.',
    );
    expect(screen.getByRole('option', { name: '등정 완료' })).toBeDisabled();
  });

  it('returns from detail to the same result list and restores its scroll position', async () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    const resultButton = screen.getByRole('button', { name: /강원산/ });
    const list = resultButton.parentElement as HTMLDivElement;
    Object.defineProperty(list, 'scrollTop', { value: 120, writable: true });
    fireEvent.scroll(list);
    fireEvent.click(resultButton);

    expect(screen.getByText('선택한 산 상세정보')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '목록' }));

    await waitFor(() => {
      const restoredList = screen.getByRole('button', { name: /강원산/ }).parentElement as HTMLDivElement;
      expect(restoredList.scrollTop).toBe(120);
    });
  });

  it('closes filters with Escape and returns focus to the trigger', async () => {
    render(<DiscoveryHarness />);
    const trigger = screen.getByRole('button', { name: '산 찾기' });

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
    const trigger = screen.getByRole('button', { name: '산 찾기' });

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '조건으로 찾기' });
    const closeButtons = screen.getAllByRole('button', { name: '조건으로 찾기 닫기' });
    const backdrop = closeButtons[0];
    const closeButton = closeButtons[1];
    const applyButton = screen.getByRole('button', { name: '2개 산 보기' });

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(applyButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('closes the mobile filter dialog when browser Back emits popstate', async () => {
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
    const trigger = screen.getByRole('button', { name: '산 찾기' });

    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();
    fireEvent.popState(window);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '조건으로 찾기' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
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

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    const regionSelect = await screen.findByLabelText('지역');
    regionSelect.focus();
    fireEvent.change(regionSelect, { target: { value: 'gangwon' } });

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

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '필터 수정' }));
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();
  });

  it('restores nested mobile filters across Back, Forward, and Back', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '필터 수정' }));
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();

    window.history.replaceState({ __mountainMapDiscoverySheet: 'panel' }, '', '/');
    fireEvent.popState(window, { state: { __mountainMapDiscoverySheet: 'panel' } });
    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();

    window.history.replaceState({ __mountainMapDiscoverySheet: 'filters' }, '', '/');
    fireEvent.popState(window, { state: { __mountainMapDiscoverySheet: 'filters' } });
    expect(await screen.findByRole('dialog', { name: '조건으로 찾기' })).toBeInTheDocument();

    window.history.replaceState({ __mountainMapDiscoverySheet: 'panel' }, '', '/');
    fireEvent.popState(window, { state: { __mountainMapDiscoverySheet: 'panel' } });
    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();
  });

  it('treats the mobile result sheet as a modal and restores trigger focus', async () => {
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
    const trigger = screen.getByRole('button', { name: '산 찾기' });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));

    const dialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '산 찾기 결과' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
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
    const trigger = screen.getByRole('button', { name: '산 찾기' });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    const dialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    const closeButton = screen.getByRole('button', { name: '산 찾기 결과 닫기' });
    const lastResult = screen.getByRole('button', { name: /경기산/ });

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastResult).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: '산 찾기 패널 닫기' }));
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it('closes the mobile result sheet when browser Back emits popstate', async () => {
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
    const trigger = screen.getByRole('button', { name: '산 찾기' });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '2개 산 보기' }));
    expect(await screen.findByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();
    fireEvent.popState(window);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '산 찾기 결과' })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
