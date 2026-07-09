import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn()
}));

const profileMocks = vi.hoisted(() => ({
  fetchOrCreateUserProfile: vi.fn()
}));

const myPageMocks = vi.hoisted(() => ({
  fetchUserReviews: vi.fn()
}));

vi.mock('./components/MountainMap', () => ({
  MountainMap: () => <div aria-label="mock-map" />
}));

vi.mock('./components/MountainDetailPage', () => ({
  MountainDetailPage: () => <div>산 상세</div>
}));

vi.mock('./components/MyPage', () => ({
  MyPage: ({ activeTab }: { activeTab: string }) => <div>마이페이지 탭 {activeTab}</div>
}));

vi.mock('./services/env', () => ({
  isSupabaseConfigured: true
}));

vi.mock('./services/profiles', () => ({
  fetchOrCreateUserProfile: profileMocks.fetchOrCreateUserProfile,
  getDefaultAvatarUrl: () => '/profile-avatars/avatar-1.svg'
}));

vi.mock('./services/myPage', () => ({
  fetchUserReviews: myPageMocks.fetchUserReviews
}));

vi.mock('./services/mountainReviews', () => ({
  fetchMountainReviews: vi.fn(() => Promise.resolve([]))
}));

vi.mock('./services/appFeedback', () => ({
  createAppFeedback: vi.fn()
}));

vi.mock('./services/authRedirect', () => ({
  getOAuthRedirectUrl: () => 'http://localhost/'
}));

vi.mock('./services/randomSounds', () => ({
  playFanfare: vi.fn(),
  playRouletteTick: vi.fn()
}));

vi.mock('./services/supabase', () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signInWithOAuth: supabaseMocks.signInWithOAuth,
      signOut: supabaseMocks.signOut
    },
    from: supabaseMocks.from
  }
}));

function createSession() {
  return {
    access_token: 'token',
    expires_at: 4_102_444_800,
    expires_in: 3600,
    refresh_token: 'refresh',
    token_type: 'bearer',
    user: {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
      email: 'user-1@example.com',
      id: 'user-1',
      user_metadata: { full_name: '테스트 등산객' }
    }
  } as Session;
}

function mockCompletedMountainsQuery() {
  supabaseMocks.from.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            { id: 'completion-1', mountain_id: '0000000001', completed_at: '2026-06-01T00:00:00.000Z' },
            { id: 'completion-2', mountain_id: '0000000002', completed_at: '2026-06-02T00:00:00.000Z' },
            { id: 'completion-3', mountain_id: '0000000001', completed_at: '2026-05-20T00:00:00.000Z' }
          ],
          error: null
        })
      )
    }))
  });
}

describe('App account menu', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    supabaseMocks.getSession.mockReset();
    supabaseMocks.onAuthStateChange.mockReset();
    supabaseMocks.signInWithOAuth.mockReset();
    supabaseMocks.signOut.mockReset();
    supabaseMocks.from.mockReset();
    profileMocks.fetchOrCreateUserProfile.mockReset();
    myPageMocks.fetchUserReviews.mockReset();

    const session = createSession();
    supabaseMocks.getSession.mockResolvedValue({ data: { session } });
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });
    profileMocks.fetchOrCreateUserProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user-1@example.com',
      displayName: '테스트 등산객',
      displayNameNormalized: '테스트 등산객',
      avatarUrl: '/profile-avatars/avatar-1.svg',
      avatarKind: 'default-1'
    });
    myPageMocks.fetchUserReviews.mockResolvedValue([{ id: 'review-1' }, { id: 'review-2' }]);
    mockCompletedMountainsQuery();
  });

  it('opens the account menu and navigates to MyPage tabs from menu actions', async () => {
    render(<App />);

    const myPageButton = await screen.findByRole('button', { name: '마이페이지' });
    fireEvent.click(myPageButton);

    expect(await screen.findByRole('menu', { name: '마이페이지 메뉴' })).toBeInTheDocument();
    expect(screen.getByText('테스트 등산객')).toBeInTheDocument();
    expect(screen.queryByText('100대 명산 도전 중')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 100')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
    expect(screen.getByText('전체 산 중 2% 완료')).toBeInTheDocument();
    expect(screen.getByText('가리산')).toBeInTheDocument();
    expect(screen.getByText('2026.06.02 산행 완료')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '가리산 대표 이미지' })).toHaveAttribute(
      'src',
      expect.stringContaining('/mountain-images/0000000002/hero.png')
    );
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /프로필 편집/ }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-page');
      expect(window.location.search).toBe('?tab=profile');
    });
    expect(screen.getByText('마이페이지 탭 profile')).toBeInTheDocument();
  });

  it('navigates to completed and reviews tabs from account menu actions', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '마이페이지' }));
    expect(await screen.findByRole('menu', { name: '마이페이지 메뉴' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /완료한 산/ }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-page');
      expect(window.location.search).toBe('?tab=completed');
    });
    expect(screen.getByText('마이페이지 탭 completed')).toBeInTheDocument();

    window.history.replaceState(null, '', '/');
    fireEvent.click(await screen.findByRole('button', { name: '마이페이지' }));
    expect(await screen.findByRole('menu', { name: '마이페이지 메뉴' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /내 한줄평/ }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-page');
      expect(window.location.search).toBe('?tab=reviews');
    });
    expect(screen.getByText('마이페이지 탭 reviews')).toBeInTheDocument();
  });

  it('closes the account menu with Escape', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '마이페이지' }));
    expect(await screen.findByRole('menu', { name: '마이페이지 메뉴' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: '마이페이지 메뉴' })).not.toBeInTheDocument();
    });
  });
});
