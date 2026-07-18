import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useMemo, useReducer, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
  onRetryDifficultySummaries = vi.fn(),
  onRandomRecommend = vi.fn(),
}: {
  difficultySummaryState?: DifficultySummaryState;
  isAuthenticated?: boolean;
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
  const onAction = (action: DiscoveryAction) => dispatch(action);

  return (
    <div>
      <MountainDiscoveryControls
        state={state}
        draftResultCount={draftResultCount}
        appliedResultCount={results.length}
        difficultySummaryState={difficultySummaryState}
        isAuthenticated={isAuthenticated}
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
  it('keeps draft filters separate until they are applied', () => {
    render(<DiscoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));
    fireEvent.change(screen.getByLabelText('지역'), { target: { value: 'gangwon' } });

    expect(screen.getByText('전체 산 · 2개')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));

    expect(screen.getByRole('heading', { name: '결과 1개' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /강원산/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /경기산/ })).not.toBeInTheDocument();
    expect(screen.getByText('강원도 · 1개')).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: '평가 전' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables completion filters for signed-out users', () => {
    render(<DiscoveryHarness isAuthenticated={false} />);

    fireEvent.click(screen.getByRole('button', { name: '산 찾기' }));

    expect(screen.getByRole('button', { name: '등정 완료' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '미등정' })).toBeDisabled();
    expect(screen.getByText('등정 기록 필터는 로그인이 필요합니다.')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '결과 목록' }));

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
});
