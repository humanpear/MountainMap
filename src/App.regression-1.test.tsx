import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { mountains } from './data/mountains';

const appRegressionMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  fetchMountainDifficultySummaries: vi.fn(),
  playFanfare: vi.fn(),
  playRouletteTick: vi.fn(),
}));

vi.mock('./components/MountainMap', () => ({
  MountainMap: ({ selectedMountainId }: { selectedMountainId?: string }) => (
    <div aria-label="mock-map" data-selected-mountain-id={selectedMountainId ?? ''} />
  ),
}));

vi.mock('./components/MountainDetailPage', () => ({
  MountainDetailPage: () => <div>산 상세</div>,
}));

vi.mock('./components/MyPage', () => ({
  MyPage: () => <div>마이페이지</div>,
}));

vi.mock('./services/env', () => ({ isSupabaseConfigured: true }));
vi.mock('./services/profiles', () => ({
  fetchOrCreateUserProfile: vi.fn(),
  getDefaultAvatarUrl: () => '/profile-avatars/avatar-1.svg',
}));
vi.mock('./services/myPage', () => ({ fetchUserReviews: vi.fn() }));
vi.mock('./services/mountainReviews', () => ({
  fetchMountainDifficultySummaries: appRegressionMocks.fetchMountainDifficultySummaries,
  fetchMountainReviews: vi.fn(() => Promise.resolve([])),
}));
vi.mock('./services/appFeedback', () => ({ createAppFeedback: vi.fn() }));
vi.mock('./services/authRedirect', () => ({ getOAuthRedirectUrl: () => 'http://localhost/' }));
vi.mock('./services/randomSounds', () => ({
  playFanfare: appRegressionMocks.playFanfare,
  playRouletteTick: appRegressionMocks.playRouletteTick,
}));
vi.mock('./services/supabase', () => ({
  supabase: {
    auth: {
      getSession: appRegressionMocks.getSession,
      onAuthStateChange: appRegressionMocks.onAuthStateChange,
      signInWithOAuth: appRegressionMocks.signInWithOAuth,
      signOut: appRegressionMocks.signOut,
    },
    from: appRegressionMocks.from,
  },
}));

describe('App random recommendation duration regression', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    appRegressionMocks.getSession.mockResolvedValue({ data: { session: null } });
    appRegressionMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    appRegressionMocks.fetchMountainDifficultySummaries.mockResolvedValue([]);
    appRegressionMocks.playFanfare.mockReset();
    appRegressionMocks.playRouletteTick.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Regression: FINDING-005 - 정적인 랜덤 추천 대기 화면이 약 10.5초 동안 사용자 흐름을 막음
  // Found by /design-review on 2026-07-19
  // Report: .gstack/design-reports/design-audit-127-0-0-1-2026-07-19.md
  it('finishes the longest random recommendation sequence within 2.5 seconds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '산 찾기' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: `이 결과 ${mountains.length}개 중 랜덤 추천` }));
    expect(screen.getByRole('complementary', { name: '랜덤 추천 진행 상태' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_500));

    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
    expect(screen.getByLabelText('mock-map')).toHaveAttribute('data-selected-mountain-id', mountains[0].id);
    expect(appRegressionMocks.playFanfare).toHaveBeenCalledTimes(1);
  });
});
