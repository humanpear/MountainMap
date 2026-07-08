import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Camera, Check, LogIn, MapPin, MessageCircle, Search, Shuffle, UserRound, X } from 'lucide-react';
import { MountainDetailPage } from './components/MountainDetailPage';
import { MountainMap } from './components/MountainMap';
import { MountainNameWithHanja } from './components/MountainNameWithHanja';
import { MyPage } from './components/MyPage';
import { mountains } from './data/mountains';
import { getCandidateIdsForRandomMode, getRandomCandidates, pickRandomMountain } from './game/random';
import { cn } from './lib/classNames';
import { createAppFeedback } from './services/appFeedback';
import { getOAuthRedirectUrl } from './services/authRedirect';
import { getCompletionErrorMessage } from './services/completionErrors';
import { isSupabaseConfigured } from './services/env';
import { fetchMountainReviews, type MountainReview } from './services/mountainReviews';
import { playFanfare, playRouletteTick } from './services/randomSounds';
import { supabase } from './services/supabase';
import type { CompletionRecord, Mountain, RandomMode } from './types';

type RandomState =
  | { status: 'idle' }
  | { status: 'running'; highlightedId: string; sequence: Mountain[]; winner: Mountain }
  | { status: 'result'; winner: Mountain };

type SidebarReviewPhoto = {
  url: string;
  routeName: string;
  createdAt: string;
  index: number;
};

const confettiPieces = Array.from({ length: 34 }, (_, index) => index);

function getConfettiStyle(index: number) {
  return {
    '--x': `${(index % 11 - 5) * 34}px`,
    '--delay': `${(index % 7) * 34}ms`,
    '--duration': `${760 + (index % 5) * 120}ms`,
    '--hue': `${38 + (index % 5) * 42}`
  } as CSSProperties;
}

function getLatestReviewPhotos(reviews: MountainReview[]) {
  return reviews
    .flatMap((review) =>
      review.imageUrls.map((url, index) => ({
        url,
        routeName: review.routeName,
        createdAt: review.createdAt,
        index
      }))
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 3);
}

const randomModeLabels: Record<RandomMode, string> = {
  all: '전체',
  incomplete: '완료 산 제외',
  selected: '직접 선택'
};

function getMountainDetailRouteId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const match = window.location.pathname.match(/^\/mountains\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getIsMyPageRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname === '/my-page';
}

function setBrowserPath(path: string) {
  if (typeof window === 'undefined' || window.location.pathname === path) {
    return;
  }

  window.history.pushState(null, '', path);
}

const appClass = {
  shell: 'grid min-h-screen grid-rows-[auto_1fr] bg-[#f4f7f5] text-[#18221d]',
  topbar:
    'z-[4] bg-[#00172b] text-white',
  topbarInner:
    'mx-auto grid h-[68px] w-[1180px] max-w-[calc(100%-60px)] grid-cols-[minmax(230px,1fr)_auto] items-center gap-4 max-[900px]:h-auto max-[900px]:w-full max-[900px]:max-w-none max-[900px]:grid-cols-[minmax(0,1fr)_auto] max-[900px]:gap-x-3 max-[900px]:gap-y-2 max-[900px]:px-4 max-[900px]:py-2.5',
  topbarActions:
    'flex min-w-0 items-center justify-end gap-2.5 max-[900px]:contents',
  brand:
    'inline-flex min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent text-[20px] font-black text-white max-[900px]:col-start-1 max-[900px]:row-start-1 max-[900px]:justify-start max-[900px]:text-[18px] [&_span]:truncate [&_svg]:text-white',
  search:
    'grid min-h-9 w-[252px] grid-cols-[minmax(0,1fr)_40px] overflow-hidden rounded-[9px] bg-white max-[900px]:col-span-2 max-[900px]:row-start-2 max-[900px]:w-full',
  searchInput: 'min-w-0 border-0 px-3 text-[13px] text-[#18221d] outline-none placeholder:text-[#627168]',
  searchButton: 'inline-flex cursor-pointer items-center justify-center border-0 bg-white text-[#00172b]',
  authButton:
    'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3.5 text-sm font-extrabold text-white transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-55 max-[900px]:col-start-2 max-[900px]:row-start-1 max-[900px]:min-h-9 max-[900px]:px-3 max-[900px]:text-[13px]',
  workspace:
    'relative grid min-h-[calc(100vh-68px)] overflow-hidden transition-[grid-template-columns] duration-200 ease-out max-[900px]:grid-cols-1',
  mapStage: 'relative min-h-[calc(100vh-68px)] overflow-visible',
  mapControls:
    'absolute left-5 top-5 z-[2] grid justify-items-start gap-3 max-[560px]:left-3 max-[560px]:right-auto max-[560px]:gap-2',
  filterBar:
    'flex w-fit gap-1.5 rounded-[10px] border border-[#d8e0da] bg-white/95 p-1.5 shadow-[0_16px_50px_rgba(24,34,29,0.14)] max-[560px]:max-w-[calc(100vw-24px)] max-[560px]:gap-1 max-[560px]:overflow-x-auto max-[560px]:p-1',
  filterButton:
    'inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 font-bold max-[560px]:min-h-8 max-[560px]:px-2.5 max-[560px]:text-[13px]',
  filterButtonIdle: 'border-[#d8e0da] bg-transparent text-[#627168]',
  filterButtonActive: 'border-[#2f6b4f] bg-[#2f6b4f] text-white',
  randomControl:
    'flex w-fit items-center gap-2.5 rounded-xl border border-[#d8e0da] bg-white/95 p-2 shadow-[0_16px_50px_rgba(24,34,29,0.14)] max-[560px]:max-w-[calc(100vw-24px)] max-[560px]:gap-1.5 max-[560px]:p-1.5',
  candidateCount:
    'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#d8e0da] bg-[#eef2ef] px-3 font-numeric font-bold max-[560px]:min-h-9 max-[560px]:px-2.5 max-[560px]:text-[13px]',
  randomButton:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#2f6b4f] bg-[#2f6b4f] px-[18px] font-extrabold text-white disabled:cursor-progress disabled:bg-[#1f4e39] max-[560px]:min-h-9 max-[560px]:px-3 max-[560px]:text-[13px]',
  detailPanel:
    'z-[3] overflow-auto border-l border-[#d8e0da] bg-white p-5 transition-[transform,opacity] duration-200 ease-out max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-[6] max-[900px]:max-h-[min(78vh,calc(100dvh-104px))] max-[900px]:overflow-y-auto max-[900px]:rounded-t-2xl max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:p-4 max-[900px]:pb-[calc(1rem+env(safe-area-inset-bottom))] max-[900px]:shadow-[0_-18px_60px_rgba(0,0,0,0.24)] max-[900px]:transition-transform max-[900px]:duration-200 max-[900px]:ease-out',
  detailHeader: 'flex items-start justify-between gap-4',
  detailPanelClose:
    'hidden h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef2ef] text-[#18221d] max-[900px]:inline-flex',
  eyebrow: 'm-0 mb-[3px] text-xs font-bold leading-4 text-[#627168]',
  completeButton:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 font-extrabold',
  completeButtonIdle: 'border-[#d8e0da] bg-white text-[#18221d]',
  completeButtonActive: 'border-[#1f8a5b] bg-[#1f8a5b] text-white',
  meta:
    'my-5 grid gap-3 rounded-lg border border-[#d8e0da] bg-[#f7faf8] p-4 [&_dd]:m-0 [&_dd]:font-bold [&_dt]:text-xs [&_dt]:font-black [&_dt]:text-[#627168]',
  primaryAction:
    'mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2f6b4f] bg-[#2f6b4f] px-4 font-extrabold text-white',
  secondaryAction:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-4 font-extrabold text-[#18221d]',
  sidebarPhotos: 'mt-5',
  sidebarPhotoGrid:
    'mt-2 grid grid-cols-3 gap-2 [&>*]:block [&_img]:aspect-square [&_img]:w-full [&_img]:rounded-md [&_img]:object-cover',
  sidebarPhotoEmpty:
    'mt-2 grid min-h-[94px] place-items-center rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] px-3 text-center text-sm font-bold leading-5 text-[#5d6a62]',
  randomPending: 'grid min-h-60 place-items-center content-center gap-3 text-center text-[#2f6b4f] [&_h2]:text-2xl',
  loadingDots:
    'inline-flex gap-1.5 [&_span]:h-[7px] [&_span]:w-[7px] [&_span]:rounded-full [&_span]:bg-[#d7922b] [&_span]:animate-[loading-dot_900ms_ease-in-out_infinite] [&_span:nth-child(2)]:[animation-delay:120ms] [&_span:nth-child(3)]:[animation-delay:240ms]',
  toast:
    'fixed bottom-5 left-5 z-[5] flex max-w-[min(420px,calc(100vw-40px))] items-center gap-2.5 rounded-lg border border-[#d8e0da] bg-white py-2.5 pl-3.5 pr-2.5 shadow-[0_16px_50px_rgba(24,34,29,0.14)]',
  toastButton:
    'inline-flex h-8 min-h-8 w-8 items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef2ef]',
  setupNote:
    'fixed bottom-[92px] right-5 z-[5] max-w-[360px] rounded-lg border border-[#d8e0da] bg-white px-3.5 py-3 text-[13px] text-[#627168] shadow-[0_16px_50px_rgba(24,34,29,0.14)] max-[560px]:left-5 max-[560px]:max-w-none',
  feedbackButton:
    'fixed bottom-5 right-5 z-[6] inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#245c46] bg-[#245c46] px-4 font-extrabold text-white shadow-[0_16px_50px_rgba(24,34,29,0.2)] transition hover:bg-[#1f4e39] max-[900px]:z-[4] max-[560px]:bottom-3 max-[560px]:right-3 max-[560px]:h-12 max-[560px]:w-12 max-[560px]:rounded-full max-[560px]:px-0',
  feedbackModal:
    'relative grid w-[min(520px,100%)] gap-4 rounded-xl border border-[#d8e0da] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-[modal-pop_180ms_ease-out] max-[560px]:gap-3 max-[560px]:p-4',
  feedbackClose:
    'absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef2ef] max-[560px]:right-3 max-[560px]:top-3 max-[560px]:h-8 max-[560px]:w-8',
  feedbackField:
    'grid gap-2 [&_label]:text-sm [&_label]:font-black [&_label]:text-[#18221d] max-[560px]:gap-1.5 max-[560px]:[&_label]:text-[13px] max-[560px]:[&_label]:leading-5',
  feedbackInput:
    'min-h-11 rounded-lg border border-[#d8e0da] bg-white px-3 text-base text-[#18221d] outline-none focus:border-[#245c46] max-[560px]:min-h-10 max-[560px]:text-sm',
  feedbackTextarea:
    'min-h-32 resize-y rounded-lg border border-[#d8e0da] bg-white px-3 py-2.5 text-base leading-7 text-[#18221d] outline-none focus:border-[#245c46] max-[560px]:min-h-28 max-[560px]:py-2 max-[560px]:text-sm max-[560px]:leading-6',
  feedbackActions: 'flex justify-end gap-2 max-[560px]:grid',
  feedbackCancel:
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[#d8e0da] bg-white px-4 font-extrabold text-[#18221d] max-[560px]:min-h-10 max-[560px]:text-sm',
  feedbackSubmit:
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[#245c46] bg-[#245c46] px-4 font-extrabold text-white disabled:cursor-progress disabled:bg-[#5d6a62] max-[560px]:min-h-10 max-[560px]:text-sm',
  modalBackdrop: 'fixed inset-0 z-10 grid place-items-center bg-black/45 p-5',
  resultModal:
    'relative w-[min(520px,100%)] overflow-hidden rounded-xl border border-[#d8e0da] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-[modal-pop_180ms_ease-out] [&>p]:text-[#627168]',
  resultClose:
    'absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef2ef]',
  resultMeta:
    'my-4 grid grid-cols-2 gap-3 rounded-lg bg-[#f7faf8] p-3 [&_dd]:m-0 [&_dd]:font-bold [&_dt]:text-xs [&_dt]:font-black [&_dt]:text-[#627168]',
  resultActions: 'mt-5 flex gap-2.5 max-[560px]:grid',
  confetti:
    'pointer-events-none absolute left-1/2 top-[18px] h-px w-px [&_span]:absolute [&_span]:h-3 [&_span]:w-[7px] [&_span]:rounded-sm [&_span]:bg-[hsl(var(--hue),78%,52%)] [&_span]:opacity-0 [&_span]:animate-[confetti-fall_var(--duration)_ease-out_var(--delay)_both]'
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [selectedMountainId, setSelectedMountainId] = useState('');
  const [detailMountainId, setDetailMountainId] = useState<string | null>(() => getMountainDetailRouteId());
  const [isMyPageOpen, setIsMyPageOpen] = useState(() => getIsMyPageRoute());
  const [focusedMountainId, setFocusedMountainId] = useState<string | undefined>();
  const [completionRecords, setCompletionRecords] = useState<CompletionRecord[]>([]);
  const [randomMode, setRandomMode] = useState<RandomMode>('incomplete');
  const [candidateIds, setCandidateIds] = useState<Set<string>>(new Set());
  const [randomState, setRandomState] = useState<RandomState>({ status: 'idle' });
  const [resultModalMountain, setResultModalMountain] = useState<Mountain | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [sidebarReviewPhotos, setSidebarReviewPhotos] = useState<SidebarReviewPhoto[]>([]);
  const [sidebarPhotoState, setSidebarPhotoState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isMobileDetailSheetOpen, setIsMobileDetailSheetOpen] = useState(false);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  const selectedMountain = mountains.find((mountain) => mountain.id === selectedMountainId);
  const detailMountain = mountains.find((mountain) => mountain.id === detailMountainId);
  const completedIds = useMemo(() => new Set(completionRecords.map((record) => record.mountainId)), [completionRecords]);
  const completionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of completionRecords) {
      counts.set(record.mountainId, (counts.get(record.mountainId) ?? 0) + 1);
    }
    return counts;
  }, [completionRecords]);
  const candidates = useMemo(
    () => getRandomCandidates({ mountains, completedIds, selectedIds: candidateIds, mode: randomMode }),
    [candidateIds, completedIds, randomMode]
  );
  const isDetailPanelOpen = randomState.status === 'running' || Boolean(selectedMountain);

  useEffect(() => {
    const syncDetailRoute = () => {
      setDetailMountainId(getMountainDetailRouteId());
      setIsMyPageOpen(getIsMyPageRoute());
      setIsMobileDetailSheetOpen(false);
    };

    window.addEventListener('popstate', syncDetailRoute);
    return () => window.removeEventListener('popstate', syncDetailRoute);
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!selectedMountain || !isSupabaseConfigured) {
      setSidebarReviewPhotos([]);
      setSidebarPhotoState('ready');
      return () => {
        isActive = false;
      };
    }

    setSidebarPhotoState('loading');
    fetchMountainReviews(selectedMountain.id)
      .then((reviews) => {
        if (!isActive) {
          return;
        }

        setSidebarReviewPhotos(getLatestReviewPhotos(reviews));
        setSidebarPhotoState('ready');
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setSidebarReviewPhotos([]);
        setSidebarPhotoState('error');
      });

    return () => {
      isActive = false;
    };
  }, [selectedMountain?.id]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setCompletionRecords([]);
      return;
    }

    supabase
      .from('completed_mountains')
      .select('id, mountain_id, completed_at')
      .eq('user_id', session.user.id)
      .then(({ data, error }) => {
        if (error) {
          setMessage(getCompletionErrorMessage(error, 'load'));
          return;
        }

        setCompletionRecords(
          (data ?? []).map((row) => ({
            id: row.id,
            mountainId: row.mountain_id,
            completedAt: row.completed_at
          }))
        );
      });
  }, [session?.user.id]);

  const toggleCompleted = async (mountain: Mountain) => {
    if (!session?.user.id || !supabase) {
      setMessage('등반 기록을 저장하려면 Google로 로그인하세요.');
      return;
    }

    const previousRecords = completionRecords;
    const isCompleted = completedIds.has(mountain.id);

    if (isCompleted) {
      setCompletionRecords((records) => records.filter((record) => record.mountainId !== mountain.id));
      const { error } = await supabase
        .from('completed_mountains')
        .delete()
        .eq('user_id', session.user.id)
        .eq('mountain_id', mountain.id);

      if (error) {
        setCompletionRecords(previousRecords);
        setMessage(getCompletionErrorMessage(error, 'delete'));
      }
      return;
    }

    const nextRecord = { mountainId: mountain.id, completedAt: new Date().toISOString() };
    setCompletionRecords((records) => [...records, nextRecord]);
    const { error } = await supabase.from('completed_mountains').insert({
      user_id: session.user.id,
      mountain_id: mountain.id,
      completed_at: nextRecord.completedAt
    });

    if (error) {
      setCompletionRecords(previousRecords);
      setMessage(getCompletionErrorMessage(error, 'save'));
    }
  };

  const toggleCandidate = (mountain: Mountain) => {
    setCandidateIds((ids) => {
      const next = new Set(ids);
      if (next.has(mountain.id)) {
        next.delete(mountain.id);
      } else {
        next.add(mountain.id);
      }
      return next;
    });
  };

  const changeRandomMode = (mode: RandomMode) => {
    setRandomMode(mode);
    setCandidateIds((ids) => getCandidateIdsForRandomMode(mode, ids));
  };

  const selectMountain = (mountain: Mountain) => {
    setSelectedMountainId(mountain.id);
    setIsMobileDetailSheetOpen(true);
    setResultModalMountain(null);
    if (randomState.status === 'result') {
      setRandomState({ status: 'idle' });
    }
  };

  const openMountainDetail = (mountain: Mountain) => {
    setBrowserPath(`/mountains/${encodeURIComponent(mountain.id)}`);
    setDetailMountainId(mountain.id);
    setIsMyPageOpen(false);
    setIsMobileDetailSheetOpen(false);
    setResultModalMountain(null);
  };

  const closeMountainDetail = () => {
    setBrowserPath('/');
    setDetailMountainId(null);
    setIsMyPageOpen(false);
  };

  const navigateHome = () => {
    setBrowserPath('/');
    setDetailMountainId(null);
    setIsMyPageOpen(false);
    setSelectedMountainId('');
    setFocusedMountainId(undefined);
    setIsMobileDetailSheetOpen(false);
    setResultModalMountain(null);
    setMapRefreshKey((key) => key + 1);
  };

  const submitMountainSearch = () => {
    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    const match =
      mountains.find((mountain) => mountain.name === query) ??
      mountains.find((mountain) => mountain.name.includes(query) || query.includes(mountain.name));

    if (!match) {
      setMessage('검색한 산을 찾지 못했습니다.');
      return;
    }

    setSelectedMountainId(match.id);
    setFocusedMountainId(match.id);
    openMountainDetail(match);
    setResultModalMountain(null);
  };

  const submitFeedback = async () => {
    const trimmedFeedback = feedbackText.trim();

    if (!trimmedFeedback) {
      setMessage('보내실 피드백을 입력해 주세요.');
      return;
    }

    const pageContext = detailMountain?.name ?? selectedMountain?.name ?? '지도 화면';
    setIsFeedbackSubmitting(true);

    try {
      await createAppFeedback({
        body: trimmedFeedback,
        contact: feedbackContact,
        pageContext,
        pageUrl: window.location.href,
        userId: session?.user.id,
        userEmail: session?.user.email
      });
      setIsFeedbackOpen(false);
      setFeedbackText('');
      setFeedbackContact('');
      setMessage('피드백을 보냈습니다. 감사합니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '피드백 전송에 실패했습니다.');
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const showMountainOnMap = (mountain: Mountain) => {
    setBrowserPath('/');
    setDetailMountainId(null);
    setIsMyPageOpen(false);
    setSelectedMountainId(mountain.id);
    setFocusedMountainId(mountain.id);
    setIsMobileDetailSheetOpen(true);
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setMessage('Google 로그인을 사용하려면 Supabase 설정이 필요합니다.');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirectUrl()
      }
    });

    if (error) {
      setMessage(error.message);
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }

    navigateHome();
  };

  const handleAuthClick = () => {
    if (session) {
      setBrowserPath('/my-page');
      setIsMyPageOpen(true);
      setDetailMountainId(null);
      setSelectedMountainId('');
      setFocusedMountainId(undefined);
      setIsMobileDetailSheetOpen(false);
      setResultModalMountain(null);
      return;
    }

    void signInWithGoogle();
  };

  const runRandomPick = () => {
    const result = pickRandomMountain({ mountains, completedIds, selectedIds: candidateIds, mode: randomMode });

    if (!result) {
      setMessage('현재 조건에 맞는 산이 없습니다. 필터를 바꿔보세요.');
      return;
    }

    setRandomState({
      status: 'running',
      highlightedId: result.sequence[0].id,
      sequence: result.sequence,
      winner: result.winner
    });
    setSelectedMountainId('');
    setResultModalMountain(null);
    playRouletteTick(0);

    let index = 0;
    let delay = 34;

    const tick = () => {
      index += 1;
      const nextMountain = result.sequence[index];

      if (!nextMountain) {
        setSelectedMountainId(result.winner.id);
        setIsMobileDetailSheetOpen(true);
        setFocusedMountainId(result.winner.id);
        setRandomState({ status: 'result', winner: result.winner });
        setResultModalMountain(result.winner);
        playFanfare();
        return;
      }

      playRouletteTick(index);
      setRandomState({
        status: 'running',
        highlightedId: nextMountain.id,
        sequence: result.sequence,
        winner: result.winner
      });
      delay = Math.min(delay + 10 + Math.floor(index * 0.45), 310);
      window.setTimeout(tick, delay);
    };

    window.setTimeout(tick, delay);
  };

  const highlightedId =
    randomState.status === 'running'
      ? randomState.highlightedId
      : randomState.status === 'result'
        ? randomState.winner.id
        : selectedMountain?.id;

  return (
    <main className={appClass.shell}>
      <header className={appClass.topbar}>
        <div className={appClass.topbarInner}>
          <button className={appClass.brand} type="button" onClick={navigateHome} aria-label="지도로 이동">
            <img className="h-9 w-auto object-contain brightness-0 invert" src="/logo-mountain.png" alt="" aria-hidden="true" />
            <span>대한민국 100대 명산</span>
          </button>
          <div className={appClass.topbarActions}>
            <form
              className={appClass.search}
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                submitMountainSearch();
              }}
            >
              <label className="sr-only" htmlFor="mountain-search-input">
                산 이름 검색
              </label>
              <input
                className={appClass.searchInput}
                id="mountain-search-input"
                list="mountain-search-options"
                type="search"
                placeholder="산 이름을 검색하세요"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <datalist id="mountain-search-options">
                {mountains.map((mountain) => (
                  <option key={mountain.id} value={mountain.name} />
                ))}
              </datalist>
              <button className={appClass.searchButton} type="submit" aria-label="산 검색">
                <Search size={22} />
              </button>
            </form>
            <button className={appClass.authButton} type="button" onClick={handleAuthClick}>
              {session ? <UserRound size={17} /> : <LogIn size={17} />}
              {session ? '마이페이지' : '로그인'}
            </button>
          </div>
        </div>
      </header>

      {isMyPageOpen && session ? (
        <MyPage
          session={session}
          completionRecords={completionRecords}
          onCompletionRecordsChange={setCompletionRecords}
          onBackToMap={navigateHome}
          onOpenMountain={openMountainDetail}
          onSignOut={() => void signOut()}
        />
      ) : detailMountain ? (
        <MountainDetailPage
          mountain={detailMountain}
          isCompleted={completedIds.has(detailMountain.id)}
          session={session}
          onBack={closeMountainDetail}
          onShowOnMap={showMountainOnMap}
          onToggleCompleted={toggleCompleted}
        />
      ) : (
        <section
          className={cn(
            appClass.workspace,
            isDetailPanelOpen ? 'grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-[minmax(0,1fr)_0px]'
          )}
          aria-label="100대 명산 지도"
        >
          <div className={appClass.mapStage}>
            <MountainMap
              mountains={mountains}
              selectedMountainId={selectedMountain?.id}
              focusedMountainId={focusedMountainId}
              layoutKey={isDetailPanelOpen ? 'with-detail-panel' : 'full-map'}
              refreshKey={mapRefreshKey}
              completedIds={completedIds}
              completionCounts={completionCounts}
              candidateIds={candidateIds}
              highlightedId={highlightedId}
              selectionMode={randomMode === 'selected'}
              onMountainSelect={selectMountain}
              onCandidateToggle={toggleCandidate}
            />

            <div className={appClass.mapControls}>
              <div className={appClass.filterBar} aria-label="랜덤 후보 필터">
                {(Object.keys(randomModeLabels) as RandomMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      appClass.filterButton,
                      mode === randomMode ? appClass.filterButtonActive : appClass.filterButtonIdle
                    )}
                    onClick={() => changeRandomMode(mode)}
                  >
                    {randomModeLabels[mode]}
                  </button>
                ))}
              </div>

              <div className={appClass.randomControl} aria-label="랜덤 뽑기 컨트롤">
                <button className={appClass.randomButton} type="button" onClick={runRandomPick} disabled={randomState.status === 'running'}>
                  <Shuffle size={18} />
                  {randomState.status === 'running' ? '고르는 중' : `후보 ${candidates.length}개 랜덤 뽑기`}
                </button>
              </div>
            </div>
          </div>

          {isMobileDetailSheetOpen ? (
            <button
              className="fixed inset-0 z-[5] hidden cursor-default border-0 bg-black/20 p-0 max-[900px]:block"
              type="button"
              aria-label="선택한 산 정보 닫기"
              onClick={() => setIsMobileDetailSheetOpen(false)}
            />
          ) : null}

          <aside
            className={cn(
              appClass.detailPanel,
              isDetailPanelOpen
                ? 'opacity-100 min-[901px]:translate-x-0'
                : 'pointer-events-none opacity-0 min-[901px]:translate-x-full',
              isMobileDetailSheetOpen
                ? 'max-[900px]:translate-y-0'
                : 'max-[900px]:pointer-events-none max-[900px]:translate-y-full'
            )}
            aria-label="선택한 산 정보"
            aria-hidden={!isDetailPanelOpen}
          >
            {randomState.status === 'running' ? (
              <div className={appClass.randomPending} role="status" aria-live="polite">
                <Shuffle size={22} />
                <h2>랜덤 뽑기 중</h2>
                <div className={appClass.loadingDots} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : selectedMountain ? (
              <>
                <div className={appClass.detailHeader}>
                  <div>
                    <p className={appClass.eyebrow}>{selectedMountain.province}</p>
                    <h2 className="m-0 text-2xl font-extrabold leading-tight">
                      <MountainNameWithHanja
                        mountain={selectedMountain}
                        className="flex-wrap"
                        hanjaClassName="text-base text-[#627168]"
                      />
                    </h2>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <button
                      className={cn(
                        appClass.completeButton,
                        completedIds.has(selectedMountain.id) ? appClass.completeButtonActive : appClass.completeButtonIdle
                      )}
                      type="button"
                      onClick={() => toggleCompleted(selectedMountain)}
                      aria-label={`${selectedMountain.name} 등반 완료 표시`}
                    >
                      <Check size={18} />
                      <span>등반완료</span>
                    </button>
                    <button
                      className={appClass.detailPanelClose}
                      type="button"
                      onClick={() => setIsMobileDetailSheetOpen(false)}
                      aria-label="선택한 산 정보 닫기"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <dl className={appClass.meta}>
                  <div>
                    <dt>지역</dt>
                    <dd>{selectedMountain.city}</dd>
                  </div>
                  <div>
                    <dt>고도</dt>
                    <dd>{selectedMountain.elevationMeters.toLocaleString()}m</dd>
                  </div>
                  <div>
                    <dt>주소</dt>
                    <dd>{selectedMountain.address}</dd>
                  </div>
                </dl>
                <p className="mt-4 leading-7 text-[#627168]">{selectedMountain.shortDescription}</p>
                <section className={appClass.sidebarPhotos} aria-label="최신 한줄평 사진">
                  <h3 className="text-lg font-extrabold">최신 한줄평 사진</h3>
                  {sidebarPhotoState === 'loading' ? (
                    <div className={appClass.sidebarPhotoEmpty}>사진을 불러오는 중입니다.</div>
                  ) : sidebarReviewPhotos.length > 0 ? (
                    <div className={appClass.sidebarPhotoGrid}>
                      {sidebarReviewPhotos.map((photo) => (
                        <div
                          key={`${photo.url}-${photo.index}`}
                        >
                          <img src={photo.url} alt={`${photo.routeName} 한줄평 사진 ${photo.index + 1}`} loading="lazy" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={appClass.sidebarPhotoEmpty}>
                      <span className="inline-flex items-center gap-1.5">
                        <Camera size={15} />
                        등록된 한줄평 사진이 없습니다.
                      </span>
                    </div>
                  )}
                </section>
                <button className={appClass.primaryAction} type="button" onClick={() => openMountainDetail(selectedMountain)}>
                  <MapPin size={18} />
                  정보 상세페이지
                </button>
              </>
            ) : null}
          </aside>
        </section>
      )}

      {message ? (
        <div className={appClass.toast} role="status">
          <span>{message}</span>
          <button className={appClass.toastButton} type="button" onClick={() => setMessage(null)} aria-label="메시지 닫기">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <button
        className={cn(
          appClass.feedbackButton,
          (isMyPageOpen || detailMountain) && 'hidden',
          isMobileDetailSheetOpen && !detailMountain && 'max-[900px]:hidden',
        )}
        type="button"
        onClick={() => setIsFeedbackOpen(true)}
        aria-label="앱 피드백 보내기"
      >
        <MessageCircle size={19} />
        <span className="max-[560px]:sr-only">피드백 보내기</span>
      </button>

      {isFeedbackOpen ? (
        <div className={appClass.modalBackdrop} role="presentation" onClick={() => setIsFeedbackOpen(false)}>
          <section
            className={appClass.feedbackModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className={appClass.feedbackClose} type="button" onClick={() => setIsFeedbackOpen(false)} aria-label="문의 창 닫기">
              <X size={18} />
            </button>
            <div>
              <p className={appClass.eyebrow}>앱 피드백</p>
              <h2 id="feedback-modal-title" className="m-0 pr-10 text-2xl font-black max-[560px]:pr-8 max-[560px]:text-xl max-[560px]:leading-7">
                무엇을 개선하면 좋을까요?
              </h2>
            </div>
            <div className={appClass.feedbackField}>
              <label htmlFor="feedback-message">문의 내용</label>
              <textarea
                className={appClass.feedbackTextarea}
                id="feedback-message"
                maxLength={2000}
                placeholder="잘못된 산 정보, 코스 오류, 필요한 기능 등을 알려주세요."
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
              />
            </div>
            <div className={appClass.feedbackField}>
              <label htmlFor="feedback-contact">답변 받을 연락처 (선택)</label>
              <input
                className={appClass.feedbackInput}
                id="feedback-contact"
                maxLength={200}
                type="text"
                placeholder="답변이 필요할 때만 이메일 또는 연락처를 남겨주세요."
                value={feedbackContact}
                onChange={(event) => setFeedbackContact(event.target.value)}
              />
            </div>
            <div className={appClass.feedbackActions}>
              <button className={appClass.feedbackCancel} type="button" onClick={() => setIsFeedbackOpen(false)} disabled={isFeedbackSubmitting}>
                닫기
              </button>
              <button className={appClass.feedbackSubmit} type="button" onClick={submitFeedback} disabled={isFeedbackSubmitting}>
                {isFeedbackSubmitting ? '보내는 중' : '보내기'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {!isSupabaseConfigured ? (
        <div className={appClass.setupNote}>
          `.env`에 Supabase와 Kakao Maps 키를 넣으면 실제 지도, Google 로그인, 피드백 저장이 활성화됩니다.
        </div>
      ) : null}

      {resultModalMountain ? (
        <div className={appClass.modalBackdrop} role="presentation" onClick={() => setResultModalMountain(null)}>
          <section
            className={appClass.resultModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={appClass.confetti} aria-hidden="true">
              {confettiPieces.map((piece) => (
                <span key={piece} style={getConfettiStyle(piece)} />
              ))}
            </div>
            <button className={appClass.resultClose} type="button" onClick={() => setResultModalMountain(null)} aria-label="결과 창 닫기">
              <X size={18} />
            </button>
            <p className={appClass.eyebrow}>랜덤 당첨</p>
            <h2 id="result-modal-title" className="m-0 text-3xl font-black">
              <MountainNameWithHanja
                mountain={resultModalMountain}
                className="flex-wrap"
                hanjaClassName="text-xl text-[#627168]"
              />
            </h2>
            <dl className={appClass.resultMeta}>
              <div>
                <dt>지역</dt>
                <dd>{resultModalMountain.city}</dd>
              </div>
              <div>
                <dt>고도</dt>
                <dd>{resultModalMountain.elevationMeters.toLocaleString()}m</dd>
              </div>
            </dl>
            <p>{resultModalMountain.shortDescription}</p>
            <div className={appClass.resultActions}>
              <button className={appClass.primaryAction} type="button" onClick={() => openMountainDetail(resultModalMountain)}>
                <MapPin size={18} />
                상세 보기
              </button>
              <button className={appClass.secondaryAction} type="button" onClick={runRandomPick}>
                <Shuffle size={18} />
                다시 뽑기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
