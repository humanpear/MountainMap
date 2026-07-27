import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { mountains } from './data/mountains';
import { getRandomTickDelays } from './game/random';

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn()
}));

const profileMocks = vi.hoisted(() => ({
  fetchOrCreateUserProfile: vi.fn()
}));

const myPageMocks = vi.hoisted(() => ({
  fetchUserReviews: vi.fn()
}));

const mountainReviewMocks = vi.hoisted(() => ({
  fetchMountainDifficultySummaries: vi.fn(),
  fetchMountainReviews: vi.fn(),
}));

const randomSoundMocks = vi.hoisted(() => ({
  playFanfare: vi.fn(),
  playRouletteTick: vi.fn()
}));

const completionRecordMocks = vi.hoisted(() => ({
  saveCompletionRecord: vi.fn(),
}));

vi.mock('./components/MountainMap', () => ({
  MountainMap: ({
    mountains: mapMountains,
    selectedMountainId,
    cameraRequest,
    fitResultsRevision,
    resetCameraRevision,
    onMountainSelect,
  }: {
    mountains: typeof mountains;
    selectedMountainId?: string;
    cameraRequest?: { mountainId: string; revision: number; reason: string };
    fitResultsRevision: number;
    resetCameraRevision: number;
    onMountainSelect: (mountain: (typeof mountains)[number]) => void;
  }) => (
    <div
      aria-label="mock-map"
      data-mountain-count={mapMountains.length}
      data-selected-mountain-id={selectedMountainId ?? ''}
      data-fit-results-revision={fitResultsRevision}
      data-reset-camera-revision={resetCameraRevision}
      data-camera-request-reason={cameraRequest?.reason ?? ''}
    >
      {mapMountains[0] ? (
        <button type="button" onClick={() => onMountainSelect(mapMountains[0])}>
          mock-map-select-first
        </button>
      ) : null}
    </div>
  )
}));

vi.mock('./components/MountainDetailPage', () => ({
  MountainDetailPage: ({
    mountain,
    isCompleted,
    isCompletionPending,
    onBack,
    onReviewDataChange,
    onShowOnMap,
    onRequestCompletion,
  }: {
    mountain: (typeof mountains)[number];
    isCompleted: boolean;
    isCompletionPending: boolean;
    onBack: () => void;
    onReviewDataChange?: () => void;
    onShowOnMap: (mountain: (typeof mountains)[number]) => void;
    onRequestCompletion: (mountain: (typeof mountains)[number]) => void;
  }) => (
    <div>
      산 상세
      <button type="button" onClick={onReviewDataChange}>한줄평 변경</button>
      <button type="button" onClick={onBack}>상세에서 지도 복귀</button>
      <button type="button" onClick={() => onShowOnMap(mountain)}>지도에서 보기</button>
      <button
        type="button"
        disabled={isCompleted || isCompletionPending}
        onClick={() => onRequestCompletion(mountain)}
      >
        {isCompleted ? '산 상세 등반 완료됨' : isCompletionPending ? '산 상세 저장 중' : '산 상세 등반 완료 표시'}
      </button>
    </div>
  )
}));

vi.mock('./components/GoogleSignInDialog', () => ({
  GoogleSignInDialog: ({
    isOpen,
    onClose,
    onSuccess,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
  }) => isOpen ? (
    <div role="dialog" aria-label="Google 로그인">
      <button type="button" onClick={onSuccess}>Google 로그인 성공</button>
      <button type="button" onClick={onClose}>로그인 창 닫기</button>
    </div>
  ) : null
}));

vi.mock('./components/MyPage', () => ({
  MyPage: ({ activeTab }: { activeTab: string }) => <div>마이페이지 탭 {activeTab}</div>
}));

vi.mock('./services/env', () => ({
  isSupabaseConfigured: true,
  isGoogleIdentityConfigured: true
}));

vi.mock('./services/profiles', () => ({
  fetchOrCreateUserProfile: profileMocks.fetchOrCreateUserProfile,
  getDefaultAvatarUrl: () => '/profile-avatars/avatar-1.svg'
}));

vi.mock('./services/myPage', () => ({
  fetchUserReviews: myPageMocks.fetchUserReviews
}));

vi.mock('./services/mountainReviews', () => ({
  fetchMountainDifficultySummaries: mountainReviewMocks.fetchMountainDifficultySummaries,
  fetchMountainReviews: mountainReviewMocks.fetchMountainReviews
}));

vi.mock('./services/appFeedback', () => ({
  createAppFeedback: vi.fn()
}));

vi.mock('./services/randomSounds', () => ({
  playFanfare: randomSoundMocks.playFanfare,
  playRouletteTick: randomSoundMocks.playRouletteTick
}));

vi.mock('./services/completionRecords', () => ({
  saveCompletionRecord: completionRecordMocks.saveCompletionRecord,
}));

vi.mock('./services/supabase', () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
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

function openDiscoveryFilterCard(section: '지역' | '체감 난이도' | '등정 상태') {
  const card = screen.getByRole('button', { name: new RegExp(`^${section} 필터`) });
  if (card.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(card);
  }
}

function selectDiscoveryFilter(section: '지역' | '체감 난이도' | '등정 상태', option: string) {
  openDiscoveryFilterCard(section);
  fireEvent.click(screen.getByRole(section === '등정 상태' ? 'radio' : 'checkbox', { name: option }));
}

describe('App account menu', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    supabaseMocks.getSession.mockReset();
    supabaseMocks.onAuthStateChange.mockReset();
    supabaseMocks.signOut.mockReset();
    supabaseMocks.from.mockReset();
    profileMocks.fetchOrCreateUserProfile.mockReset();
    myPageMocks.fetchUserReviews.mockReset();
    mountainReviewMocks.fetchMountainDifficultySummaries.mockReset();
    mountainReviewMocks.fetchMountainReviews.mockReset();
    randomSoundMocks.playFanfare.mockReset();
    randomSoundMocks.playRouletteTick.mockReset();
    completionRecordMocks.saveCompletionRecord.mockReset();

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
    mountainReviewMocks.fetchMountainDifficultySummaries.mockResolvedValue([]);
    mountainReviewMocks.fetchMountainReviews.mockResolvedValue([]);
    completionRecordMocks.saveCompletionRecord.mockResolvedValue({
      id: 'completion-new',
      mountainId: '0000000001',
      completedAt: '2026-07-23T00:00:00.000Z',
      climbedOn: '2026-07-20',
      photoUrl: 'https://example.com/completion.jpg',
    });
    mockCompletedMountainsQuery();
  });

  it('opens the Google sign-in dialog without starting an OAuth redirect', async () => {
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null } });
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '로그인' }));
    expect(screen.getByRole('dialog', { name: 'Google 로그인' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Google 로그인 성공' }));
    expect(screen.queryByRole('dialog', { name: 'Google 로그인' })).not.toBeInTheDocument();
  });

  it('opens the account menu and navigates to MyPage tabs from menu actions', async () => {
    render(<App />);

    const myPageButton = await screen.findByRole('button', { name: '마이페이지' });
    expect(document.documentElement).toHaveClass('app-document-scroll-locked');
    fireEvent.click(myPageButton);

    const accountMenu = await screen.findByRole('menu', { name: '마이페이지 메뉴' });
    expect(accountMenu).toHaveClass(
      'max-[900px]:overflow-y-auto',
      'max-[900px]:overscroll-contain',
      'max-[900px]:touch-pan-y',
    );
    expect(within(accountMenu).getByText('테스트 등산객')).toBeInTheDocument();
    expect(within(accountMenu).queryByText('100대 명산 도전 중')).not.toBeInTheDocument();
    expect(within(accountMenu).getByText('2 / 100')).toBeInTheDocument();
    expect(within(accountMenu).getByText('2%')).toBeInTheDocument();
    expect(within(accountMenu).getByText('전체 산 중 2% 완료')).toBeInTheDocument();
    expect(within(accountMenu).getByText('가리산')).toBeInTheDocument();
    expect(within(accountMenu).getByText('2026.06.02 산행 완료')).toBeInTheDocument();
    expect(within(accountMenu).getByRole('img', { name: '가리산 대표 이미지' })).toHaveAttribute(
      'src',
      expect.stringContaining('/mountain-images/0000000002/hero.png')
    );
    expect(within(accountMenu).getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /프로필 편집/ }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-page');
      expect(window.location.search).toBe('?tab=profile');
      expect(document.documentElement).not.toHaveClass('app-document-scroll-locked');
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

  it('keeps other filters usable after a difficulty summary error and retries the request', async () => {
    mountainReviewMocks.fetchMountainDifficultySummaries
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([
        { mountainId: '0000000001', reviewCount: 3, averageScore: 2 },
      ]);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(await screen.findByRole('button', { name: /체감 난이도 필터, 현재 정보를 불러오지 못함/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('난이도 정보를 불러오지 못했습니다.');
    expect(screen.getByRole('button', { name: /지역 필터/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: '전체' })).toBeEnabled();
    });
    expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(2);
  });

  it('reuses the cached difficulty summaries while filters and sorting change', async () => {
    render(<App />);
    await waitFor(() => {
      expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    selectDiscoveryFilter('지역', '강원도');
    fireEvent.click(screen.getByRole('button', { name: /개 산 보기/ }));
    fireEvent.change(screen.getByLabelText('결과 정렬'), { target: { value: 'elevation-desc' } });
    fireEvent.click(screen.getByRole('button', { name: '필터 수정' }));

    expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(1);
  });

  it('refreshes once after review changes and ignores an older pending response', async () => {
    let resolveFirst!: (value: Array<{ mountainId: string; reviewCount: number; averageScore: number }>) => void;
    let resolveSecond!: (value: Array<{ mountainId: string; reviewCount: number; averageScore: number }>) => void;
    mountainReviewMocks.fetchMountainDifficultySummaries
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    window.history.replaceState(null, '', `/mountains/${mountains[0].id}`);
    render(<App />);

    await waitFor(() => {
      expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: '한줄평 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '상세에서 지도 복귀' }));
    await waitFor(() => {
      expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveSecond([{ mountainId: mountains[0].id, reviewCount: 2, averageScore: 5 }]);
    });
    await act(async () => {
      resolveFirst([{ mountainId: mountains[0].id, reviewCount: 2, averageScore: 1 }]);
    });

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    selectDiscoveryFilter('체감 난이도', '매우 어려움');
    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));
    expect(screen.getByRole('heading', { name: '결과 1개' })).toBeInTheDocument();
  });

  it('keeps ready difficulty summaries usable when a background refresh fails', async () => {
    mountainReviewMocks.fetchMountainDifficultySummaries
      .mockResolvedValueOnce([
        { mountainId: mountains[0].id, reviewCount: 3, averageScore: 2 },
      ])
      .mockRejectedValueOnce(new Error('background refresh failed'))
      .mockResolvedValueOnce([
        { mountainId: mountains[0].id, reviewCount: 4, averageScore: 2 },
      ]);
    window.history.replaceState(null, '', `/mountains/${mountains[0].id}`);
    render(<App />);

    await waitFor(() => {
      expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: '한줄평 변경' }));
    fireEvent.click(screen.getByRole('button', { name: '상세에서 지도 복귀' }));
    await waitFor(() => {
      expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(2);
    });

    fireEvent.change(screen.getByLabelText('산 이름 검색'), { target: { value: mountains[1].name } });
    fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('산 상세')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '상세에서 지도 복귀' }));
    await waitFor(() => {
      expect(mountainReviewMocks.fetchMountainDifficultySummaries).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    selectDiscoveryFilter('체감 난이도', '보통');
    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));
    expect(screen.getByRole('heading', { name: '결과 1개' })).toBeInTheDocument();
  });

  it('keeps completion filters disabled when completion records fail to load', async () => {
    let resolveCompletionQuery!: (value: { data: null; error: { code: string } }) => void;
    supabaseMocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => new Promise((resolve) => { resolveCompletionQuery = resolve; })),
      })),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    openDiscoveryFilterCard('등정 상태');
    expect(await screen.findByText('등정 기록을 불러오는 중입니다.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '등정 완료' })).toBeDisabled();

    await act(async () => {
      resolveCompletionQuery({ data: null, error: { code: 'PGRST001' } });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '등정 기록을 불러오지 못해 완료·미등정 필터를 사용할 수 없습니다.',
    );
    expect(screen.getByRole('radio', { name: '미등정' })).toBeDisabled();
  });

  it('shares the applied result set with the map and selected detail', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    selectDiscoveryFilter('지역', '강원도');

    const gangwonMountains = mountains.filter((mountain) => mountain.regionCodes.includes('gangwon'));
    fireEvent.click(screen.getByRole('button', { name: `${gangwonMountains.length}개 산 보기` }));

    const map = screen.getByLabelText('mock-map');
    expect(map).toHaveAttribute('data-mountain-count', String(gangwonMountains.length));
    expect(map).toHaveAttribute('data-fit-results-revision', '2');

    const selected = gangwonMountains[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(selected.name) }));
    expect(map).toHaveAttribute('data-selected-mountain-id', selected.id);
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
  });

  it('keeps a mobile map selection in the compact info bar across list and detail surfaces', async () => {
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
    const { container } = render(<App />);
    const selected = mountains[0];
    const map = await screen.findByLabelText('mock-map');
    await screen.findByRole('button', { name: '마이페이지' });

    fireEvent.click(screen.getByRole('button', { name: 'mock-map-select-first' }));
    const infoBar = container.querySelector<HTMLElement>('[data-map-occluder="persistent"]')!;
    const feedbackButton = container.querySelector<HTMLElement>('.app-feedback-button')!;
    expect(map).toHaveAttribute('data-selected-mountain-id', selected.id);
    expect(map).toHaveAttribute('data-camera-request-reason', '');
    expect(infoBar).toHaveTextContent(selected.name);
    expect(infoBar).toHaveTextContent(`${selected.elevationMeters.toLocaleString()}m`);
    expect(within(infoBar).getByRole('button', { name: '상세' })).toBeInTheDocument();
    expect(within(infoBar).getByRole('button', { name: '목록' })).toBeInTheDocument();
    expect(infoBar).not.toHaveAttribute('aria-hidden');
    expect(feedbackButton).toHaveAttribute('data-mobile-info-visible', 'true');
    expect(screen.queryByRole('dialog', { name: '선택한 산 정보' })).not.toBeInTheDocument();

    fireEvent.click(within(infoBar).getByRole('button', { name: '상세' }));
    const directDetailDialog = await screen.findByRole('dialog', { name: '선택한 산 정보' });
    expect(directDetailDialog).toHaveAttribute('data-mobile-sheet-motion', 'opening');
    expect(directDetailDialog.querySelector('[data-detail-sheet-header]')).toHaveClass(
      'max-[900px]:h-[50px]',
      'max-[900px]:py-0',
    );
    expect(directDetailDialog).toHaveClass(
      'max-[900px]:animate-[discovery-sheet-in_280ms_cubic-bezier(0.22,1,0.36,1)_both]',
    );
    fireEvent.click(within(directDetailDialog).getByRole('button', { name: '선택한 산 정보 닫기' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '선택한 산 정보' })).not.toBeInTheDocument();
      expect(infoBar).not.toHaveAttribute('aria-hidden');
    });

    fireEvent.click(screen.getByRole('button', { name: '목록' }));
    const resultDialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    const mountedSheet = resultDialog;
    expect(screen.getByRole('button', { name: new RegExp(selected.name) })).toHaveAttribute(
      'aria-current',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: new RegExp(selected.name) }));
    const detailDialog = await screen.findByRole('dialog', { name: '선택한 산 정보' });
    expect(detailDialog).toBe(mountedSheet);
    expect(detailDialog).toHaveClass(
      'max-[900px]:animate-[discovery-sheet-in_280ms_cubic-bezier(0.22,1,0.36,1)_both]',
    );
    expect(map).toHaveAttribute('data-camera-request-reason', 'list-selection');
    expect(infoBar).toHaveAttribute('aria-hidden', 'true');
    expect(infoBar.inert).toBe(true);

    fireEvent.click(within(detailDialog).getByRole('button', { name: '목록' }));
    const returnedResultDialog = await screen.findByRole('dialog', { name: '산 찾기 결과' });
    expect(returnedResultDialog).toBe(mountedSheet);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(selected.name) }));
    const reopenedDetailDialog = await screen.findByRole('dialog', { name: '선택한 산 정보' });
    expect(reopenedDetailDialog).toBe(mountedSheet);

    fireEvent.click(within(reopenedDetailDialog).getByRole('button', { name: '선택한 산 정보 닫기' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '선택한 산 정보' })).not.toBeInTheDocument();
      expect(infoBar).not.toHaveAttribute('aria-hidden');
      expect(infoBar.inert).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: `${selected.name} 선택 해제` }));
    expect(map).toHaveAttribute('data-selected-mountain-id', '');
    expect(container.querySelector('[data-map-occluder="persistent"]')).not.toBeInTheDocument();
    expect(feedbackButton).not.toHaveAttribute('data-mobile-info-visible');
  });

  it('ignores stale sidebar photo responses after a faster mountain selection', async () => {
    let resolveFirst!: (reviews: Array<Record<string, unknown>>) => void;
    let resolveSecond!: (reviews: Array<Record<string, unknown>>) => void;
    mountainReviewMocks.fetchMountainReviews
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<App />);
    await screen.findByRole('button', { name: '마이페이지' });

    const first = mountains[0];
    const second = mountains[1];
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(first.name) }));
    fireEvent.click(screen.getByRole('button', { name: '목록' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(second.name) }));

    await act(async () => {
      resolveSecond([{
        imageUrls: ['/second.jpg'],
        routeName: '두 번째 코스',
        createdAt: '2026-07-22T02:00:00.000Z',
      }]);
    });
    expect(await screen.findByAltText('두 번째 코스 한줄평 사진 1')).toHaveAttribute(
      'src',
      '/second.jpg',
    );

    await act(async () => {
      resolveFirst([{
        imageUrls: ['/first.jpg'],
        routeName: '첫 번째 코스',
        createdAt: '2026-07-22T01:00:00.000Z',
      }]);
    });
    expect(screen.queryByAltText('첫 번째 코스 한줄평 사진 1')).not.toBeInTheDocument();
    expect(screen.getByAltText('두 번째 코스 한줄평 사진 1')).toBeInTheDocument();
  });

  it('shows a local sidebar photo error and retries only that mountain request', async () => {
    mountainReviewMocks.fetchMountainReviews
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([]);
    render(<App />);
    await screen.findByRole('button', { name: '마이페이지' });

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(mountains[0].name) }));
    expect(await screen.findByText('사진을 불러오지 못했습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('등록된 한줄평 사진이 없습니다.')).toBeInTheDocument();
    expect(mountainReviewMocks.fetchMountainReviews).toHaveBeenCalledTimes(2);
    expect(mountainReviewMocks.fetchMountainReviews).toHaveBeenLastCalledWith(mountains[0].id);
  });

  it('keeps selection for a same-user token refresh and clears it for a different user ID', async () => {
    let authStateChange!: (event: string, session: Session | null) => void;
    supabaseMocks.onAuthStateChange.mockImplementation((callback) => {
      authStateChange = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const initialSession = createSession();
    supabaseMocks.getSession.mockResolvedValue({ data: { session: initialSession } });
    render(<App />);
    await screen.findByRole('button', { name: '마이페이지' });

    const selected = mountains[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(selected.name) }));
    expect(screen.getByLabelText('mock-map')).toHaveAttribute(
      'data-selected-mountain-id',
      selected.id,
    );

    act(() => {
      authStateChange('TOKEN_REFRESHED', { ...initialSession, access_token: 'renewed-token' });
    });
    expect(screen.getByLabelText('mock-map')).toHaveAttribute(
      'data-selected-mountain-id',
      selected.id,
    );

    act(() => {
      authStateChange('SIGNED_IN', {
        ...initialSession,
        user: { ...initialSession.user, id: 'user-2', email: 'user-2@example.com' },
      });
    });
    await waitFor(() => {
      expect(screen.getByLabelText('mock-map')).toHaveAttribute('data-selected-mountain-id', '');
    });
  });

  it('keeps mobile discovery results open for a same-route popstate', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    expect(screen.getByRole('complementary', { name: '산 찾기 결과' })).toBeInTheDocument();

    fireEvent.popState(window, { state: null });

    expect(screen.getByRole('complementary', { name: '산 찾기 결과' })).toBeInTheDocument();
  });

  it('keeps the mobile result panel out of browser history handling', async () => {
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
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    expect(screen.getByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();

    window.history.replaceState(null, '', '/');
    fireEvent.popState(window, { state: null });
    expect(screen.getByRole('dialog', { name: '산 찾기 결과' })).toBeInTheDocument();
  });

  it('returns from a full detail route to the selected mobile discovery panel on Back', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(mountains[0].name) }));
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '정보 상세페이지' }));
    expect(await screen.findByText('산 상세')).toBeInTheDocument();

    window.history.replaceState(null, '', '/');
    fireEvent.popState(window, { state: null });

    expect(screen.queryByText('산 상세')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();

    window.history.replaceState(null, '', `/mountains/${mountains[0].id}`);
    fireEvent.popState(window, { state: null });
    expect(await screen.findByText('산 상세')).toBeInTheDocument();

    window.history.replaceState(null, '', '/');
    fireEvent.popState(window, { state: null });
    expect(screen.queryByText('산 상세')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
  });

  it('returns from a full detail route to the selected desktop discovery panel on Back', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(mountains[0].name) }));
    fireEvent.click(screen.getByRole('button', { name: '정보 상세페이지' }));
    expect(await screen.findByText('산 상세')).toBeInTheDocument();

    window.history.replaceState(null, '', '/');
    fireEvent.popState(window, { state: null });

    expect(screen.queryByText('산 상세')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
  });

  it('keeps the selected desktop detail and blocks completion removal outside My Page', async () => {
    const completedMountain = mountains.find((mountain) => mountain.id === '0000000001')!;
    const completionQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [
            { id: 'completion-1', mountain_id: completedMountain.id, completed_at: '2026-06-01T00:00:00.000Z' },
          ],
          error: null,
        })),
      })),
    };
    supabaseMocks.from.mockReturnValueOnce(completionQuery);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    openDiscoveryFilterCard('등정 상태');
    const completedFilter = screen.getByRole('radio', { name: '등정 완료' });
    await waitFor(() => expect(completedFilter).toBeEnabled());
    fireEvent.click(completedFilter);
    fireEvent.click(screen.getByRole('button', { name: '1개 산 보기' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(completedMountain.name) }));
    fireEvent.click(screen.getByRole('button', { name: '정보 상세페이지' }));
    expect(await screen.findByText('산 상세')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '산 상세 등반 완료됨' })).toBeDisabled();
    expect(supabaseMocks.from).toHaveBeenCalledTimes(1);

    window.history.replaceState(null, '', '/');
    fireEvent.popState(window, { state: null });

    expect(screen.queryByText('산 상세')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
    expect(screen.getByLabelText('mock-map')).toHaveAttribute(
      'data-selected-mountain-id',
      completedMountain.id,
    );
  });

  it('keeps selection when completion data changes the current result set', async () => {
    const completedMountain = mountains.find((mountain) => mountain.id === '0000000001')!;
    const completionQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [
            { id: 'completion-existing', mountain_id: '0000000002', completed_at: '2026-06-01T00:00:00.000Z' },
          ],
          error: null,
        })),
      })),
    };
    completionRecordMocks.saveCompletionRecord.mockResolvedValue({
      id: 'completion-new',
      mountainId: completedMountain.id,
      completedAt: '2026-06-03T00:00:00.000Z',
      climbedOn: '2026-05-28',
      photoUrl: 'https://example.com/completed-gari.jpg',
    });
    supabaseMocks.from.mockReturnValueOnce(completionQuery);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    openDiscoveryFilterCard('등정 상태');
    const incompleteFilter = screen.getByRole('radio', { name: '미등정' });
    await waitFor(() => expect(incompleteFilter).toBeEnabled());
    fireEvent.click(incompleteFilter);
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length - 1}개 산 보기` }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(completedMountain.name) }));
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: `${completedMountain.name} 등반 완료로 기록` })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: `${completedMountain.name} 등반 완료` })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '정보 상세페이지' }));
    fireEvent.click(await screen.findByRole('button', { name: '산 상세 등반 완료 표시' }));
    expect(screen.getByRole('dialog', { name: `${completedMountain.name}의 순간을 남겨주세요` })).toBeInTheDocument();
    const photo = new File(['photo'], 'summit.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(/등반 사진/), { target: { files: [photo] } });
    fireEvent.change(screen.getByLabelText('등반 날짜'), { target: { value: '2026-05-28' } });
    fireEvent.click(screen.getByRole('button', { name: '등반 완료' }));

    await waitFor(() => {
      expect(completionRecordMocks.saveCompletionRecord).toHaveBeenCalledWith({
        userId: 'user-1',
        mountainId: completedMountain.id,
        climbedOn: '2026-05-28',
        photoFile: photo,
      });
      expect(screen.getByRole('button', { name: '산 상세 등반 완료됨' })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '상세에서 지도 복귀' }));
    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
      expect(screen.getByLabelText('mock-map')).toHaveAttribute('data-selected-mountain-id', completedMountain.id);
      expect(screen.getByLabelText('mock-map')).toHaveAttribute('data-fit-results-revision', '3');
      expect(screen.getByRole('img', { name: `${completedMountain.name} 등반 완료` })).toBeInTheDocument();
      expect(screen.queryByText('등반 완료로 기록했어요.')).not.toBeInTheDocument();
    });
  });

  it('resets filters before showing a detail-page mountain on the map', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    selectDiscoveryFilter('지역', '강원도');
    const gangwonMountains = mountains.filter((mountain) => mountain.regionCodes.includes('gangwon'));
    fireEvent.click(screen.getByRole('button', { name: `${gangwonMountains.length}개 산 보기` }));

    const target = mountains.find((mountain) => mountain.regionCodes.includes('jeju'))!;
    fireEvent.change(screen.getByLabelText('산 이름 검색'), { target: { value: target.name } });
    fireEvent.submit(screen.getByRole('search'));
    expect(await screen.findByText('산 상세')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '지도에서 보기' }));

    const map = await screen.findByLabelText('mock-map');
    expect(map).toHaveAttribute('data-mountain-count', String(mountains.length));
    expect(map).toHaveAttribute('data-selected-mountain-id', target.id);
    expect(map).toHaveAttribute('data-reset-camera-revision', '2');
  });

  it('finishes a random recommendation inside the current filtered results', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    selectDiscoveryFilter('지역', '제주도');

    const jejuMountains = mountains.filter((mountain) => mountain.regionCodes.includes('jeju'));
    fireEvent.click(screen.getByRole('button', { name: `${jejuMountains.length}개 산 보기` }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' }));

    expect(screen.getByRole('complementary', { name: '랜덤 추천 진행 상태' })).toBeInTheDocument();
    const discoveryBackdrop = document.querySelector('[data-discovery-backdrop]');
    expect(discoveryBackdrop).toHaveAttribute('data-discovery-backdrop', 'random-spinning');
    expect(discoveryBackdrop).toHaveClass('bg-black/15', 'duration-700');
    const sequenceLength = Math.max(18, Math.min(42, jejuMountains.length * 4));
    const rouletteDuration = getRandomTickDelays(sequenceLength)
      .reduce((total, delay) => total + delay, 0);
    act(() => vi.advanceTimersByTime(rouletteDuration));

    expect(screen.getByRole('complementary', { name: '랜덤 추천 당첨 결과' })).toBeInTheDocument();
    expect(discoveryBackdrop).toHaveAttribute('data-discovery-backdrop', 'dimmed');
    expect(discoveryBackdrop).toHaveClass('bg-black/85', 'duration-700');
    expect(screen.getByRole('heading', { name: `${jejuMountains[0].name} 당첨!` })).toBeInTheDocument();
    expect(document.querySelector('[data-confetti="winner"]')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '선택한 산 정보' })).not.toBeInTheDocument();
    expect(randomSoundMocks.playFanfare).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1_600));

    const selectedId = screen.getByLabelText('mock-map').getAttribute('data-selected-mountain-id');
    expect(jejuMountains.some((mountain) => mountain.id === selectedId)).toBe(true);
    expect(screen.getByRole('complementary', { name: '선택한 산 정보' })).toBeInTheDocument();
    randomSpy.mockRestore();
  });

  it('cancels the random timer without opening a stale winner', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' }));
    fireEvent.click(screen.getByRole('button', { name: '추천 취소' }));
    act(() => vi.runAllTimers());

    expect(screen.getByRole('complementary', { name: '산 찾기 결과' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '선택한 산 정보' })).not.toBeInTheDocument();
  }, 10_000);

  it('ignores a duplicate random start while the first timer is running', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    fireEvent.click(screen.getByRole('button', { name: `${mountains.length}개 산 보기` }));
    vi.useFakeTimers();
    const randomButton = screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' });

    fireEvent.click(randomButton);
    fireEvent.click(randomButton);

    expect(randomSoundMocks.playRouletteTick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '추천 취소' }));
  }, 10_000);

  it('auto-cancels a running recommendation when authentication changes its candidates', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '필터' }));
    openDiscoveryFilterCard('등정 상태');
    const completedFilter = screen.getByRole('radio', { name: '등정 완료' });
    await waitFor(() => expect(completedFilter).toBeEnabled());
    fireEvent.click(completedFilter);
    fireEvent.click(await screen.findByRole('button', { name: '2개 산 보기' }));
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: '등반할 산 랜덤 돌리기' }));
    expect(screen.getByRole('complementary', { name: '랜덤 추천 진행 상태' })).toBeInTheDocument();

    const authChangeHandler = supabaseMocks.onAuthStateChange.mock.calls[0]?.[0] as (
      event: string,
      nextSession: Session | null,
    ) => void;
    act(() => authChangeHandler('SIGNED_OUT', null));

    expect(screen.getByRole('complementary', { name: '산 찾기 결과' })).toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(screen.queryByRole('complementary', { name: '선택한 산 정보' })).not.toBeInTheDocument();
    expect(randomSoundMocks.playFanfare).not.toHaveBeenCalled();
  });
});
