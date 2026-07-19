import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Camera,
  Check,
  ChevronRight,
  Edit3,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Mountain as MountainIcon,
  Power,
  Search,
  UserRound,
  X
} from 'lucide-react';
import { MountainDetailPage } from './components/MountainDetailPage';
import {
  getMobileDiscoveryHistoryLayer,
  MountainDiscoveryControls,
  MountainDiscoveryPanel,
} from './components/MountainDiscoveryPanel';
import { MountainMap } from './components/MountainMap';
import { MountainNameWithHanja } from './components/MountainNameWithHanja';
import { MyPage } from './components/MyPage';
import { getMountainGuide } from './data/mountainDetails';
import { mountains } from './data/mountains';
import {
  createInitialDiscoveryState,
  discoveryReducer,
  filterMountains,
  normalizeFiltersForAuthentication,
  sortMountains,
  type DifficultySummaryState,
  type DiscoveryAction
} from './domain/mountainDiscovery';
import { getRandomTickDelays, pickRandomMountain } from './game/random';
import { cn } from './lib/classNames';
import { createAppFeedback } from './services/appFeedback';
import { getOAuthRedirectUrl } from './services/authRedirect';
import { getCompletionErrorMessage } from './services/completionErrors';
import { isSupabaseConfigured } from './services/env';
import {
  fetchMountainDifficultySummaries,
  fetchMountainReviews,
  type MountainReview
} from './services/mountainReviews';
import { fetchUserReviews } from './services/myPage';
import { fetchOrCreateUserProfile, getDefaultAvatarUrl, type UserProfile } from './services/profiles';
import { playFanfare, playRouletteTick } from './services/randomSounds';
import { supabase } from './services/supabase';
import type { CompletionRecord, Mountain } from './types';

type SidebarReviewPhoto = {
  url: string;
  routeName: string;
  createdAt: string;
  index: number;
};

type MyPageTab = 'profile' | 'completed' | 'reviews';

type AccountSummaryState =
  | { status: 'idle'; profile: null; reviewCount: number }
  | { status: 'loading'; profile: UserProfile | null; reviewCount: number }
  | { status: 'ready'; profile: UserProfile; reviewCount: number }
  | { status: 'error'; profile: null; reviewCount: number };

type CompletionDataStatus = 'signed-out' | 'loading' | 'ready' | 'error';
type MobileDiscoveryRestoreView =
  | { kind: 'results' }
  | { kind: 'detail'; mountainId: string };

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

function getLatestCompletionRecord(records: CompletionRecord[]) {
  return records.reduce<CompletionRecord | null>((latestRecord, record) => {
    if (!latestRecord) {
      return record;
    }

    return new Date(record.completedAt).getTime() > new Date(latestRecord.completedAt).getTime() ? record : latestRecord;
  }, null);
}

function getMountainHeroImage(mountain: Mountain) {
  return getMountainGuide(mountain).heroImage?.src ?? `/mountain-images/${mountain.id}/hero.png`;
}

function formatAccountDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

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

function getMyPageTabRoute(): MyPageTab {
  if (typeof window === 'undefined' || window.location.pathname !== '/my-page') {
    return 'profile';
  }

  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab === 'completed' || tab === 'reviews' ? tab : 'profile';
}

function setBrowserPath(path: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath === path) {
    return;
  }

  window.history.pushState(null, '', path);
}

const hangulInitials = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ'
] as const;

const hangulInitialSet = new Set<string>(hangulInitials);
const hangulBaseCode = '가'.charCodeAt(0);
const hangulLastCode = '힣'.charCodeAt(0);
const hangulSyllableCountByInitial = 21 * 28;

function getHangulInitials(value: string) {
  return Array.from(value)
    .map((letter) => {
      const code = letter.charCodeAt(0);
      if (code < hangulBaseCode || code > hangulLastCode) {
        return letter;
      }

      return hangulInitials[Math.floor((code - hangulBaseCode) / hangulSyllableCountByInitial)];
    })
    .join('');
}

function isInitialOnlyQuery(query: string) {
  return Array.from(query).every((letter) => hangulInitialSet.has(letter));
}

function matchesMountainSearchSuggestion(mountain: Mountain, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return false;
  }

  const initialText = getHangulInitials(mountain.name);
  if (isInitialOnlyQuery(normalizedQuery)) {
    return normalizedQuery.length === 1
      ? initialText.startsWith(normalizedQuery)
      : initialText.includes(normalizedQuery);
  }

  return mountain.name.includes(normalizedQuery) || initialText.includes(normalizedQuery);
}

const appClass = {
  shell:
    'grid min-h-[var(--app-visible-height,100dvh)] grid-rows-[auto_minmax(0,1fr)] overflow-x-hidden bg-[#f4f7f5] text-[#18221d]',
  topbar:
    'z-[4] bg-[#00172b] text-white',
  topbarInner:
    'mx-auto grid h-[68px] w-[1180px] max-w-[calc(100%-60px)] grid-cols-[minmax(230px,1fr)_auto] items-center gap-4 max-[900px]:h-auto max-[900px]:w-full max-[900px]:max-w-none max-[900px]:grid-cols-[minmax(0,max-content)_minmax(72px,1fr)_44px_44px] max-[900px]:gap-x-1 max-[900px]:gap-y-2 max-[900px]:px-4 max-[900px]:py-1.5',
  topbarActions:
    'flex min-w-0 items-center justify-end gap-2.5 max-[900px]:contents',
  brand:
    'inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent text-[19px] font-black text-white max-[900px]:col-start-1 max-[900px]:row-start-1 max-[900px]:justify-start max-[900px]:gap-1.5 max-[900px]:text-[15px] [&_span]:truncate [&_svg]:text-white',
  search:
    'relative grid min-h-11 w-[252px] grid-cols-[minmax(0,1fr)_44px] rounded-[9px] bg-white transition-[opacity,transform] duration-200 ease-out max-[900px]:col-start-2 max-[900px]:row-start-1 max-[900px]:ml-1 max-[900px]:min-h-11 max-[900px]:w-full max-[900px]:origin-right max-[900px]:grid-cols-1',
  searchInput:
    'min-w-0 rounded-l-[9px] border-0 px-4 text-[13px] text-[#18221d] outline-none placeholder:text-[#627168] max-[900px]:rounded-[9px] max-[900px]:text-base',
  searchButton: 'inline-flex cursor-pointer items-center justify-center rounded-r-[9px] border-0 bg-white text-[#00172b]',
  searchSuggestions:
    'absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[min(360px,calc(100vh-96px))] overflow-y-auto rounded-lg border border-[#d8e0da] bg-white py-1.5 text-[#18221d] shadow-[0_18px_48px_rgba(0,0,0,0.18)] max-[900px]:max-h-[min(320px,calc(100dvh-86px))]',
  searchSuggestionButton:
    'grid w-full cursor-pointer grid-cols-[max-content_minmax(0,1fr)] items-center gap-2 border-0 bg-white px-3 py-2.5 text-left transition hover:bg-[#f4f8f6] focus:bg-[#f4f8f6] focus:outline-none',
  searchSuggestionName: 'whitespace-nowrap text-[12px] font-semibold leading-4 text-[#18221d] max-[900px]:text-[13px]',
  searchSuggestionMeta: 'truncate text-[12px] font-bold leading-4 text-[#627168] max-[900px]:text-[13px]',
  mobileSearchToggle:
    'hidden h-11 min-h-11 w-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-white transition hover:bg-transparent max-[900px]:col-start-3 max-[900px]:row-start-1 max-[900px]:inline-flex',
  authButton:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3.5 text-sm font-extrabold text-white transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-55 max-[900px]:w-11 max-[900px]:border-0 max-[900px]:bg-transparent max-[900px]:px-0 max-[900px]:text-[13px] max-[900px]:hover:bg-transparent',
  accountMenuWrap: 'relative max-[900px]:col-start-4 max-[900px]:row-start-1',
  accountMenu:
    'absolute right-0 top-[calc(100%+10px)] z-20 grid w-[344px] max-w-[calc(100vw-24px)] origin-top-right gap-2.5 rounded-xl border border-[#d8e0da] bg-[#fbfcfb] p-2.5 text-[#18221d] shadow-[0_18px_56px_rgba(0,0,0,0.16)] max-[560px]:right-[-4px] max-[560px]:w-[min(70vw,256px)] max-[560px]:gap-1.5 max-[560px]:p-1.5',
  accountMenuProfile: 'flex min-w-0 items-center gap-3 px-1.5 pb-1.5 pt-1 max-[560px]:gap-2.5 max-[560px]:px-1 max-[560px]:pb-1 max-[560px]:pt-0.5',
  accountMenuAvatar:
    'h-16 w-16 flex-none rounded-full border-[3px] border-white bg-[#eef3f0] object-cover shadow-[0_0_0_2px_#d8e0da,0_8px_20px_rgba(24,34,29,0.12)] max-[560px]:h-11 max-[560px]:w-11',
  accountMenuName: 'm-0 truncate text-[17px] font-black leading-[22px] text-[#18221d] max-[560px]:text-[14px] max-[560px]:leading-[18px]',
  accountMenuMeta: 'm-0 mt-0.5 truncate text-[13px] font-bold leading-[18px] text-[#5d6a62] max-[560px]:text-[11px] max-[560px]:leading-4',
  accountProgressCard:
    "relative isolate overflow-hidden rounded-lg border border-[#d8e0da] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbf9_58%,#eef5f1_100%)] p-3.5 shadow-[0_7px_20px_rgba(24,34,29,0.05)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[url('/my-page/completed-progress-bg-desktop.png')] before:bg-cover before:bg-center before:bg-no-repeat before:opacity-30 max-[560px]:p-2.5 max-[560px]:before:bg-[url('/my-page/completed-progress-bg-mobile.png')]",
  accountCardLabel: 'm-0 text-[13px] font-black leading-[18px] text-[#06442f] max-[560px]:text-[11px] max-[560px]:leading-4',
  accountProgressValue: 'm-0 mt-2 font-numeric text-[19px] font-black leading-[24px] text-[#092336] max-[560px]:mt-1 max-[560px]:text-[17px] max-[560px]:leading-5',
  accountProgressCaption: 'm-0 mt-3 text-[13px] font-bold leading-[18px] text-[#5d6a62] max-[560px]:mt-1 max-[560px]:text-[11px] max-[560px]:leading-4',
  accountProgressRow: 'mt-3 grid w-[80%] grid-cols-[minmax(0,1fr)_26px] items-center gap-2.5 max-[560px]:mt-1.5 max-[560px]:w-full',
  accountProgressTrack: 'h-2 overflow-hidden rounded-full bg-[#dfe8e2]',
  accountProgressFill: 'h-full rounded-full bg-[#006f43]',
  accountProgressPercent: 'font-numeric text-[13px] font-black leading-[18px] text-[#06442f] max-[560px]:text-[11px] max-[560px]:leading-4',
  accountRecentCard:
    'grid grid-cols-[minmax(0,1fr)_128px] gap-3 rounded-lg border border-[#d8e0da] bg-white p-3 shadow-[0_7px_20px_rgba(24,34,29,0.05)] max-[560px]:grid-cols-1 max-[560px]:gap-1.5 max-[560px]:p-2',
  accountRecentName: 'm-0 mt-1.5 truncate text-[17px] font-black leading-[22px] text-[#18221d] max-[560px]:mt-1 max-[560px]:text-[14px] max-[560px]:leading-[18px]',
  accountRecentMeta: 'm-0 mt-2.5 text-[13px] font-bold leading-[18px] text-[#5d6a62] max-[560px]:mt-1.5 max-[560px]:text-[11px] max-[560px]:leading-4',
  accountRecentImage:
    'h-[76px] w-full rounded-md object-cover shadow-[0_6px_16px_rgba(24,34,29,0.12)] max-[560px]:aspect-[16/9] max-[560px]:h-auto',
  accountMenuActions:
    'grid overflow-hidden rounded-lg border border-[#d8e0da] bg-white shadow-[0_7px_20px_rgba(24,34,29,0.05)]',
  accountMenuAction:
    'inline-flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 border-0 border-b border-[#e3e8e4] bg-white px-3 text-left text-[14px] font-semibold leading-5 text-[#18221d] transition last:border-b-0 hover:bg-[#f5f8f5] max-[560px]:min-h-10 max-[560px]:gap-2 max-[560px]:px-2.5 max-[560px]:text-[12px] max-[560px]:leading-4',
  accountMenuActionIcon: 'inline-flex h-6 w-6 items-center justify-center text-[#101820]',
  accountReviewBadge:
    'mr-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e7f2ec] px-1.5 font-numeric text-[13px] font-black leading-[18px] text-[#245c46] max-[560px]:mr-1 max-[560px]:text-[11px] max-[560px]:leading-4',
  accountMenuDanger:
    'inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-3 text-center text-[14px] font-semibold leading-5 text-[#d90d0d] shadow-[0_7px_20px_rgba(24,34,29,0.05)] transition hover:bg-[#fff1ee] max-[560px]:min-h-10 max-[560px]:px-2.5 max-[560px]:text-[12px] max-[560px]:leading-4',
  workspace:
    'relative grid h-[calc(var(--app-visible-height,100dvh)-var(--app-header-height,68px))] min-h-0 overflow-hidden transition-[grid-template-columns] duration-200 ease-out max-[900px]:grid-cols-1',
  mapStage: 'relative h-full min-h-0 min-w-0 overflow-hidden',
  detailHeader: 'flex items-start justify-between gap-4',
  eyebrow: 'm-0 mb-[3px] text-xs font-bold leading-4 text-[#627168]',
  completeButton:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 font-extrabold',
  completeButtonIdle: 'border-[#d8e0da] bg-white text-[#18221d]',
  completeButtonActive: 'border-[#1f8a5b] bg-[#1f8a5b] text-white',
  meta:
    'my-5 grid gap-3 rounded-lg border border-[#d8e0da] bg-[#f7faf8] p-4 [&_dd]:m-0 [&_dd]:font-bold [&_dt]:text-xs [&_dt]:font-black [&_dt]:text-[#627168]',
  primaryAction:
    'mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2f6b4f] bg-[#2f6b4f] px-4 font-extrabold text-white',
  sidebarPhotos: 'mt-5',
  sidebarPhotoGrid:
    'mt-2 grid grid-cols-3 gap-2 [&>*]:block [&_img]:aspect-square [&_img]:w-full [&_img]:rounded-md [&_img]:object-cover',
  sidebarPhotoEmpty:
    'mt-2 grid min-h-[94px] place-items-center rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] px-3 text-center text-sm font-bold leading-5 text-[#5d6a62]',
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
  modalBackdrop: 'fixed inset-0 z-10 grid place-items-center bg-black/45 p-5'
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [discoveryState, dispatchDiscovery] = useReducer(discoveryReducer, undefined, createInitialDiscoveryState);
  const [difficultySummaryState, setDifficultySummaryState] = useState<DifficultySummaryState>({ status: 'idle' });
  const [detailMountainId, setDetailMountainId] = useState<string | null>(() => getMountainDetailRouteId());
  const [isMyPageOpen, setIsMyPageOpen] = useState(() => getIsMyPageRoute());
  const [myPageTab, setMyPageTab] = useState<MyPageTab>(() => getMyPageTabRoute());
  const [completionRecords, setCompletionRecords] = useState<CompletionRecord[]>([]);
  const [completionDataStatus, setCompletionDataStatus] = useState<CompletionDataStatus>('signed-out');
  const [resultDataRevision, setResultDataRevision] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [sidebarReviewPhotos, setSidebarReviewPhotos] = useState<SidebarReviewPhoto[]>([]);
  const [sidebarPhotoState, setSidebarPhotoState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAccountMenuClosing, setIsAccountMenuClosing] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [accountSummary, setAccountSummary] = useState<AccountSummaryState>({
    status: 'idle',
    profile: null,
    reviewCount: 0
  });
  const accountMenuCloseTimerRef = useRef<number | null>(null);
  const detailMountainIdRef = useRef(detailMountainId);
  const discoveryDetailRouteMountainIdRef = useRef<string | null>(null);
  const discoveryStateRef = useRef(discoveryState);
  const mobileDiscoveryRestoreViewRef = useRef<MobileDiscoveryRestoreView | null>(null);
  const difficultyRequestIdRef = useRef(0);
  const completionRequestIdRef = useRef(0);
  const difficultySummaryStateRef = useRef<DifficultySummaryState>({ status: 'idle' });
  const reviewSummaryDirtyRef = useRef(false);
  const randomTimerRef = useRef<number | null>(null);
  const discoveryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  detailMountainIdRef.current = detailMountainId;
  discoveryStateRef.current = discoveryState;
  if (discoveryState.view.kind === 'results') {
    mobileDiscoveryRestoreViewRef.current = { kind: 'results' };
  } else if (discoveryState.view.kind === 'detail') {
    mobileDiscoveryRestoreViewRef.current = {
      kind: 'detail',
      mountainId: discoveryState.view.mountainId
    };
  } else if (discoveryState.view.kind === 'random-running') {
    mobileDiscoveryRestoreViewRef.current = { kind: 'results' };
  }

  const clearRandomTimer = useCallback(() => {
    if (randomTimerRef.current !== null) {
      window.clearTimeout(randomTimerRef.current);
      randomTimerRef.current = null;
    }
  }, []);

  const closeAccountMenu = useCallback((animated = true) => {
    if (accountMenuCloseTimerRef.current !== null) {
      window.clearTimeout(accountMenuCloseTimerRef.current);
      accountMenuCloseTimerRef.current = null;
    }

    setIsAccountMenuOpen((isOpen) => {
      if (isOpen && animated) {
        setIsAccountMenuClosing(true);
        accountMenuCloseTimerRef.current = window.setTimeout(() => {
          setIsAccountMenuClosing(false);
          accountMenuCloseTimerRef.current = null;
        }, 150);
      } else {
        setIsAccountMenuClosing(false);
      }

      return false;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (accountMenuCloseTimerRef.current !== null) {
        window.clearTimeout(accountMenuCloseTimerRef.current);
      }
      clearRandomTimer();
    };
  }, [clearRandomTimer]);

  useEffect(() => {
    const preventViewportZoom = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener('gesturestart', preventViewportZoom, { passive: false });
    document.addEventListener('gesturechange', preventViewportZoom, { passive: false });
    document.addEventListener('gestureend', preventViewportZoom, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventViewportZoom);
      document.removeEventListener('gesturechange', preventViewportZoom);
      document.removeEventListener('gestureend', preventViewportZoom);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let frameId: number | null = null;

    const syncViewportSize = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
        const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 68;

        root.style.setProperty('--app-visible-height', `${visibleHeight}px`);
        root.style.setProperty('--app-header-height', `${headerHeight}px`);
      });
    };

    syncViewportSize();

    window.addEventListener('resize', syncViewportSize);
    window.addEventListener('orientationchange', syncViewportSize);
    window.visualViewport?.addEventListener('resize', syncViewportSize);
    window.visualViewport?.addEventListener('scroll', syncViewportSize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      resizeObserver = new ResizeObserver(syncViewportSize);
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', syncViewportSize);
      window.removeEventListener('orientationchange', syncViewportSize);
      window.visualViewport?.removeEventListener('resize', syncViewportSize);
      window.visualViewport?.removeEventListener('scroll', syncViewportSize);
      resizeObserver?.disconnect();

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  const updateDifficultySummaryState = useCallback((nextState: DifficultySummaryState) => {
    difficultySummaryStateRef.current = nextState;
    setDifficultySummaryState(nextState);
  }, []);

  const loadDifficultySummaries = useCallback(async (preserveReadyState = false) => {
    const requestId = ++difficultyRequestIdRef.current;
    if (!(preserveReadyState && difficultySummaryStateRef.current.status === 'ready')) {
      updateDifficultySummaryState({ status: 'loading' });
    }

    try {
      const summaries = await fetchMountainDifficultySummaries();
      if (requestId !== difficultyRequestIdRef.current) {
        return false;
      }

      updateDifficultySummaryState({
        status: 'ready',
        summaries: new Map(summaries.map((summary) => [summary.mountainId, summary]))
      });
      return true;
    } catch (error) {
      if (requestId !== difficultyRequestIdRef.current) {
        return false;
      }

      if (preserveReadyState && difficultySummaryStateRef.current.status === 'ready') {
        return false;
      }

      dispatchDiscovery({ type: 'DIFFICULTY_SUMMARIES_UNAVAILABLE' });
      updateDifficultySummaryState({
        status: 'error',
        message: error instanceof Error ? error.message : '난이도 정보를 불러오지 못했습니다.'
      });
      return false;
    }
  }, [updateDifficultySummaryState]);

  const markReviewDataChanged = useCallback(() => {
    reviewSummaryDirtyRef.current = true;
  }, []);

  const refreshChangedReviewSummaries = useCallback(() => {
    if (!reviewSummaryDirtyRef.current) {
      return;
    }

    reviewSummaryDirtyRef.current = false;
    void loadDifficultySummaries(true).then((didRefresh) => {
      if (!didRefresh) {
        reviewSummaryDirtyRef.current = true;
      }
    });
  }, [loadDifficultySummaries]);

  useEffect(() => {
    void loadDifficultySummaries(false);
    return () => {
      difficultyRequestIdRef.current += 1;
    };
  }, [loadDifficultySummaries]);

  useEffect(() => {
    dispatchDiscovery({ type: 'AUTHENTICATION_CHANGED', isAuthenticated: Boolean(session?.user) });
  }, [session?.user]);

  const selectedMountainId = discoveryState.view.kind === 'detail' ? discoveryState.view.mountainId : undefined;
  const selectedMountain = mountains.find((mountain) => mountain.id === selectedMountainId);
  const detailMountain = mountains.find((mountain) => mountain.id === detailMountainId);
  const completedIds = useMemo(() => new Set(completionRecords.map((record) => record.mountainId)), [completionRecords]);
  const resultMountains = useMemo(
    () => {
      const isAuthenticated = Boolean(session?.user);
      return sortMountains(
        filterMountains({
          mountains,
          filters: normalizeFiltersForAuthentication(discoveryState.appliedFilters, isAuthenticated),
          difficultySummaryState,
          completedIds,
          isAuthenticated
        }),
        discoveryState.sort
      );
    },
    [completedIds, difficultySummaryState, discoveryState.appliedFilters, discoveryState.sort, session?.user]
  );
  const draftResultCount = useMemo(() => {
    const isAuthenticated = Boolean(session?.user);
    const filters =
      difficultySummaryState.status === 'ready'
        ? normalizeFiltersForAuthentication(discoveryState.draftFilters, isAuthenticated)
        : {
            ...normalizeFiltersForAuthentication(discoveryState.draftFilters, isAuthenticated),
            difficulty: 'all' as const
          };

    return filterMountains({
      mountains,
      filters,
      difficultySummaryState,
      completedIds,
      isAuthenticated
    }).length;
  }, [completedIds, difficultySummaryState, discoveryState.draftFilters, session?.user]);
  const completedMountainCount = completedIds.size;
  const totalChallengeMountains = 100;
  const completionProgressPercent = Math.min(
    100,
    Math.round((completedMountainCount / totalChallengeMountains) * 100)
  );
  const latestCompletionRecord = useMemo(() => getLatestCompletionRecord(completionRecords), [completionRecords]);
  const latestCompletedMountain = latestCompletionRecord
    ? mountains.find((mountain) => mountain.id === latestCompletionRecord.mountainId) ?? null
    : null;
  const latestCompletedDateLabel = latestCompletionRecord
    ? `${formatAccountDate(latestCompletionRecord.completedAt)} 산행 완료`
    : '완료한 산이 없습니다';
  const latestCompletedMountainName = latestCompletedMountain?.name ?? '기록 없음';
  const latestCompletedHeroImage = latestCompletedMountain ? getMountainHeroImage(latestCompletedMountain) : null;
  const completionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of completionRecords) {
      counts.set(record.mountainId, (counts.get(record.mountainId) ?? 0) + 1);
    }
    return counts;
  }, [completionRecords]);
  const resultMountainIdsKey = useMemo(
    () => resultMountains.map((mountain) => mountain.id).sort().join('|'),
    [resultMountains]
  );
  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      return [];
    }

    return mountains
      .filter((mountain) => matchesMountainSearchSuggestion(mountain, query))
      .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'))
      .slice(0, 8);
  }, [searchQuery]);
  const shouldShowSearchSuggestions = isSearchFocused && searchSuggestions.length > 0;
  const isDiscoveryPanelOpen =
    discoveryState.view.kind === 'results' ||
    discoveryState.view.kind === 'detail' ||
    discoveryState.view.kind === 'random-running';
  const isDetailPanelOpen = isDiscoveryPanelOpen;
  const accountProfile = accountSummary.profile;
  const accountDisplayName =
    accountProfile?.displayName || session?.user.user_metadata?.full_name || session?.user.email?.split('@')[0] || '내 계정';
  const accountAvatarUrl = accountProfile?.avatarUrl || getDefaultAvatarUrl(accountProfile?.avatarKind);
  const syncAccountProfile = useCallback((profile: UserProfile) => {
    setAccountSummary((current) => ({
      status: 'ready',
      profile,
      reviewCount: current.reviewCount
    }));
  }, []);

  useEffect(() => {
    if (!isMobileSearchOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 180);
    return () => window.clearTimeout(focusTimer);
  }, [isMobileSearchOpen]);

  useEffect(() => {
    const syncDetailRoute = (event: PopStateEvent) => {
      const nextDetailMountainId = getMountainDetailRouteId();
      const nextIsMyPageOpen = getIsMyPageRoute();
      const mobileDiscoveryHistoryLayer = getMobileDiscoveryHistoryLayer(event.state);
      const discoveryDetailRouteMountainId = discoveryDetailRouteMountainIdRef.current;
      const isDiscoveryDetailRouteTransition =
        discoveryDetailRouteMountainId !== null &&
        ((detailMountainIdRef.current === discoveryDetailRouteMountainId &&
          nextDetailMountainId === null &&
          !nextIsMyPageOpen) ||
          (detailMountainIdRef.current === null &&
            nextDetailMountainId === discoveryDetailRouteMountainId));

      if (mobileDiscoveryHistoryLayer !== null) {
        if (detailMountainIdRef.current !== nextDetailMountainId) {
          setDetailMountainId(nextDetailMountainId);
          setIsMyPageOpen(getIsMyPageRoute());
          setMyPageTab(getMyPageTabRoute());
          setIsAccountMenuOpen(false);
          setIsMobileSearchOpen(false);
          refreshChangedReviewSummaries();
        }

        if (discoveryStateRef.current.view.kind === 'closed') {
          if (mobileDiscoveryHistoryLayer === 'filters') {
            dispatchDiscovery({ type: 'OPEN_FILTERS' });
          } else {
            const restoreView = mobileDiscoveryRestoreViewRef.current;
            if (restoreView?.kind === 'detail') {
              dispatchDiscovery({ type: 'SELECT_MOUNTAIN', mountainId: restoreView.mountainId });
            } else if (restoreView?.kind === 'results') {
              dispatchDiscovery({ type: 'BACK_TO_RESULTS' });
            }
          }
        }
        return;
      }

      setDetailMountainId(nextDetailMountainId);
      setIsMyPageOpen(nextIsMyPageOpen);
      setMyPageTab(getMyPageTabRoute());
      setIsAccountMenuOpen(false);
      setIsMobileSearchOpen(false);
      if (!isDiscoveryDetailRouteTransition) {
        discoveryDetailRouteMountainIdRef.current = null;
        dispatchDiscovery({ type: 'CLOSE_DISCOVERY' });
      }
      refreshChangedReviewSummaries();
    };

    window.addEventListener('popstate', syncDetailRoute);
    return () => window.removeEventListener('popstate', syncDetailRoute);
  }, [refreshChangedReviewSummaries]);

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
    if (!session?.user) {
      setIsAccountMenuOpen(false);
      setAccountSummary({ status: 'idle', profile: null, reviewCount: 0 });
      return;
    }

    let isActive = true;
    setAccountSummary((current) => ({
      status: 'loading',
      profile: current.status === 'ready' ? current.profile : null,
      reviewCount: current.reviewCount
    }));

    Promise.all([fetchOrCreateUserProfile(session.user), fetchUserReviews(session.user.id)])
      .then(([profile, reviews]) => {
        if (!isActive) {
          return;
        }

        setAccountSummary({ status: 'ready', profile, reviewCount: reviews.length });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setAccountSummary({ status: 'error', profile: null, reviewCount: 0 });
      });

    return () => {
      isActive = false;
    };
  }, [session?.user]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const closeAccountMenuOnDocumentClick = () => closeAccountMenu();
    const closeAccountMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAccountMenu();
      }
    };

    window.addEventListener('click', closeAccountMenuOnDocumentClick);
    window.addEventListener('keydown', closeAccountMenuOnEscape);
    return () => {
      window.removeEventListener('click', closeAccountMenuOnDocumentClick);
      window.removeEventListener('keydown', closeAccountMenuOnEscape);
    };
  }, [closeAccountMenu, isAccountMenuOpen]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!supabase || !userId) {
      completionRequestIdRef.current += 1;
      setCompletionRecords([]);
      setCompletionDataStatus('signed-out');
      return;
    }

    const requestId = ++completionRequestIdRef.current;
    setCompletionRecords([]);
    setCompletionDataStatus('loading');
    dispatchDiscovery({ type: 'AUTHENTICATION_CHANGED', isAuthenticated: false });

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('completed_mountains')
          .select('id, mountain_id, completed_at')
          .eq('user_id', userId);

        if (requestId !== completionRequestIdRef.current) {
          return;
        }

        if (error) {
          setCompletionDataStatus('error');
          dispatchDiscovery({ type: 'AUTHENTICATION_CHANGED', isAuthenticated: false });
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
        setCompletionDataStatus('ready');
      } catch (error) {
        if (requestId !== completionRequestIdRef.current) {
          return;
        }

        setCompletionDataStatus('error');
        dispatchDiscovery({ type: 'AUTHENTICATION_CHANGED', isAuthenticated: false });
        setMessage(
          getCompletionErrorMessage(
            error instanceof Error ? { message: error.message } : {},
            'load'
          )
        );
      }
    })();

    return () => {
      completionRequestIdRef.current += 1;
    };
  }, [session?.user.id]);

  const toggleCompleted = async (mountain: Mountain) => {
    if (!session?.user.id || !supabase) {
      setMessage('등반 기록을 저장하려면 Google로 로그인하세요.');
      return;
    }

    if (completionDataStatus !== 'ready') {
      setMessage('등정 기록을 불러온 뒤 다시 시도해 주세요.');
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

  const handleDiscoveryAction = useCallback((action: DiscoveryAction) => {
    if (
      action.type === 'OPEN_FILTERS' ||
      action.type === 'APPLY_FILTERS' ||
      action.type === 'RESET_FILTERS' ||
      action.type === 'RESET_DISCOVERY' ||
      action.type === 'CLOSE_DISCOVERY' ||
      action.type === 'CANCEL_RANDOM'
    ) {
      clearRandomTimer();
    }

    dispatchDiscovery(action);
  }, [clearRandomTimer]);

  const selectMountain = (mountain: Mountain) => {
    clearRandomTimer();
    dispatchDiscovery({ type: 'SELECT_MOUNTAIN', mountainId: mountain.id });
  };

  const openMountainDetail = (mountain: Mountain, preserveDiscoveryContext = false) => {
    discoveryDetailRouteMountainIdRef.current = preserveDiscoveryContext ? mountain.id : null;
    setBrowserPath(`/mountains/${encodeURIComponent(mountain.id)}`);
    setDetailMountainId(mountain.id);
    setIsMyPageOpen(false);
    setMyPageTab('profile');
    setIsAccountMenuOpen(false);
    setIsMobileSearchOpen(false);
  };

  const closeMountainDetail = () => {
    setBrowserPath('/');
    setDetailMountainId(null);
    setIsMyPageOpen(false);
    setMyPageTab('profile');
    setIsAccountMenuOpen(false);
    setIsMobileSearchOpen(false);
    refreshChangedReviewSummaries();
  };

  const navigateHome = () => {
    discoveryDetailRouteMountainIdRef.current = null;
    setBrowserPath('/');
    setDetailMountainId(null);
    setIsMyPageOpen(false);
    setMyPageTab('profile');
    setIsAccountMenuOpen(false);
    setIsMobileSearchOpen(false);
    handleDiscoveryAction({ type: 'CLOSE_DISCOVERY' });
    refreshChangedReviewSummaries();
  };

  const openSearchMountain = (match: Mountain) => {
    handleDiscoveryAction({ type: 'CLOSE_DISCOVERY' });
    openMountainDetail(match);
    setIsMobileSearchOpen(false);
    setIsSearchFocused(false);
  };

  const submitMountainSearch = () => {
    const query = searchQuery.trim();
    if (!query) {
      return;
    }

    const match =
      mountains.find((mountain) => mountain.name === query) ??
      searchSuggestions[0] ??
      mountains.find((mountain) => mountain.name.includes(query) || query.includes(mountain.name));

    if (!match) {
      setMessage('검색한 산을 찾지 못했습니다.');
      return;
    }

    openSearchMountain(match);
  };

  const handleSearchInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    submitMountainSearch();
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
    setMyPageTab('profile');
    setIsAccountMenuOpen(false);
    setIsMobileSearchOpen(false);
    handleDiscoveryAction({ type: 'RESET_FILTERS' });
    dispatchDiscovery({ type: 'SELECT_MOUNTAIN', mountainId: mountain.id });
    refreshChangedReviewSummaries();
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

    setIsAccountMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }

    navigateHome();
  };

  const handleAuthClick = () => {
    setIsMobileSearchOpen(false);
    if (session) {
      if (isAccountMenuOpen) {
        closeAccountMenu();
        return;
      }

      if (accountMenuCloseTimerRef.current !== null) {
        window.clearTimeout(accountMenuCloseTimerRef.current);
        accountMenuCloseTimerRef.current = null;
      }

      setIsAccountMenuClosing(false);
      setIsAccountMenuOpen(true);
      return;
    }

    void signInWithGoogle();
  };

  const openMyPageTab = (tab: MyPageTab) => {
    const path = tab === 'profile' ? '/my-page?tab=profile' : `/my-page?tab=${tab}`;
    setBrowserPath(path);
    setIsMyPageOpen(true);
    setMyPageTab(tab);
    setDetailMountainId(null);
    handleDiscoveryAction({ type: 'CLOSE_DISCOVERY' });
    setIsAccountMenuOpen(false);
    setIsMobileSearchOpen(false);
  };

  const runRandomPick = () => {
    if (discoveryState.view.kind !== 'results' || randomTimerRef.current !== null) {
      return;
    }

    const result = pickRandomMountain({ mountains: resultMountains });

    if (!result) {
      setMessage('현재 조건에 맞는 산이 없습니다. 필터를 바꿔보세요.');
      return;
    }

    dispatchDiscovery({
      type: 'START_RANDOM',
      winnerId: result.winner.id,
      highlightedId: result.sequence[0].id,
      sequenceIds: result.sequence.map((mountain) => mountain.id)
    });
    playRouletteTick(0);
    const tickDelays = getRandomTickDelays(result.sequence.length);

    let index = 0;
    const tick = () => {
      index += 1;
      const nextMountain = result.sequence[index];

      if (!nextMountain) {
        dispatchDiscovery({ type: 'ANNOUNCE_RANDOM_WINNER' });
        playFanfare();
        randomTimerRef.current = window.setTimeout(() => {
          randomTimerRef.current = null;
          dispatchDiscovery({ type: 'FINISH_RANDOM' });
        }, 1_600);
        return;
      }

      playRouletteTick(index);
      dispatchDiscovery({ type: 'RANDOM_TICK', highlightedId: nextMountain.id });
      randomTimerRef.current = window.setTimeout(tick, tickDelays[index]);
    };

    randomTimerRef.current = window.setTimeout(tick, tickDelays[0]);
  };

  const highlightedId =
    discoveryState.view.kind === 'random-running'
      ? discoveryState.view.highlightedId
      : selectedMountain?.id;

  const previousResultMountainIdsKeyRef = useRef(resultMountainIdsKey);
  useEffect(() => {
    if (previousResultMountainIdsKeyRef.current === resultMountainIdsKey) {
      return;
    }

    previousResultMountainIdsKeyRef.current = resultMountainIdsKey;
    const currentView = discoveryState.view;
    if (currentView.kind !== 'closed') {
      setResultDataRevision((revision) => revision + 1);
    }
    if (currentView.kind === 'random-running') {
      clearRandomTimer();
      dispatchDiscovery({ type: 'CANCEL_RANDOM' });
      return;
    }

    if (
      currentView.kind === 'detail' &&
      !resultMountains.some((mountain) => mountain.id === currentView.mountainId)
    ) {
      dispatchDiscovery({ type: 'BACK_TO_RESULTS' });
    }
  }, [clearRandomTimer, discoveryState.view, resultMountainIdsKey, resultMountains]);

  return (
    <main className={appClass.shell}>
      <header ref={headerRef} className={appClass.topbar}>
        <div className={appClass.topbarInner}>
          <button className={appClass.brand} type="button" onClick={navigateHome} aria-label="지도로 이동">
            <img className="h-8 w-auto object-contain brightness-0 invert max-[900px]:h-7" src="/logo-mountain.png" alt="" aria-hidden="true" />
            <span className={cn(isMobileSearchOpen && 'max-[900px]:hidden')}>대한민국 100대 명산</span>
          </button>
          <div className={appClass.topbarActions}>
            <form
              className={cn(
                appClass.search,
                isMobileSearchOpen
                  ? 'max-[900px]:pointer-events-auto max-[900px]:scale-x-100 max-[900px]:opacity-100'
                  : 'max-[900px]:pointer-events-none max-[900px]:scale-x-0 max-[900px]:opacity-0'
              )}
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
                ref={searchInputRef}
                className={appClass.searchInput}
                id="mountain-search-input"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={shouldShowSearchSuggestions ? 'mountain-search-suggestions' : undefined}
                aria-expanded={shouldShowSearchSuggestions}
                placeholder="산 이름을 검색하세요"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onBlur={() => setIsSearchFocused(false)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchInputKeyDown}
              />
              {shouldShowSearchSuggestions ? (
                <div className={appClass.searchSuggestions} id="mountain-search-suggestions" role="listbox">
                  {searchSuggestions.map((mountain) => (
                    <button
                      key={mountain.id}
                      className={appClass.searchSuggestionButton}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setSearchQuery(mountain.name);
                        openSearchMountain(mountain);
                      }}
                    >
                      <span className={appClass.searchSuggestionName}>{mountain.name}</span>
                      <span className={appClass.searchSuggestionMeta}>
                        {mountain.province} {mountain.city}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <button className={cn(appClass.searchButton, 'max-[900px]:hidden')} type="submit" aria-label="산 검색">
                <Search size={22} />
              </button>
            </form>
            <button
              className={appClass.mobileSearchToggle}
              type="button"
              aria-label={isMobileSearchOpen ? '검색 닫기' : '산 검색'}
              aria-controls="mountain-search-input"
              aria-expanded={isMobileSearchOpen}
              onClick={() => {
                closeAccountMenu();
                setIsMobileSearchOpen((isOpen) => !isOpen);
              }}
            >
              {isMobileSearchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
            <div className={appClass.accountMenuWrap} onClick={(event) => event.stopPropagation()}>
              <button
                className={appClass.authButton}
                type="button"
                onClick={handleAuthClick}
                aria-expanded={session ? isAccountMenuOpen : undefined}
                aria-haspopup={session ? 'menu' : undefined}
              >
                {session ? (
                  <>
                    <UserRound className="max-[900px]:hidden" size={17} />
                    <Menu className="hidden max-[900px]:block" size={19} />
                  </>
                ) : (
                  <>
                    <LogIn className="max-[900px]:hidden" size={17} />
                    <Power className="hidden max-[900px]:block" size={20} strokeWidth={2.4} />
                  </>
                )}
                <span className="max-[900px]:sr-only">{session ? '마이페이지' : '로그인'}</span>
              </button>
              {session && (isAccountMenuOpen || isAccountMenuClosing) ? (
                <div
                  className={cn(
                    appClass.accountMenu,
                    isAccountMenuClosing
                      ? 'max-[900px]:animate-[account-menu-close_150ms_ease-in_both]'
                      : 'max-[900px]:animate-[account-menu-open_170ms_ease-out_both]'
                  )}
                  role="menu"
                  aria-label="마이페이지 메뉴"
                >
                  <div className={appClass.accountMenuProfile}>
                    <img className={appClass.accountMenuAvatar} src={accountAvatarUrl} alt="" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className={appClass.accountMenuName}>{accountDisplayName}</p>
                      <p className={appClass.accountMenuMeta}>{session.user.email}</p>
                    </div>
                  </div>
                  <section className={appClass.accountProgressCard} aria-label="완료한 산 진행률">
                    <p className={appClass.accountCardLabel}>완료한 산</p>
                    <p className={appClass.accountProgressValue}>
                      {completedMountainCount} / {totalChallengeMountains}
                    </p>
                    <p className={appClass.accountProgressCaption}>전체 산 중 {completionProgressPercent}% 완료</p>
                    <div className={appClass.accountProgressRow}>
                      <div className={appClass.accountProgressTrack} aria-hidden="true">
                        <div
                          className={appClass.accountProgressFill}
                          style={{ width: `${completionProgressPercent}%` }}
                        />
                      </div>
                      <span className={appClass.accountProgressPercent}>{completionProgressPercent}%</span>
                    </div>
                  </section>
                  <section className={appClass.accountRecentCard} aria-label="최근 완료한 산">
                    <div className="min-w-0">
                      <p className={appClass.accountCardLabel}>최근 완료한 산</p>
                      <p className={appClass.accountRecentName}>{latestCompletedMountainName}</p>
                      <p className={appClass.accountRecentMeta}>{latestCompletedDateLabel}</p>
                    </div>
                    {latestCompletedMountain && latestCompletedHeroImage ? (
                      <img
                        className={appClass.accountRecentImage}
                        src={latestCompletedHeroImage}
                        alt={`${latestCompletedMountain.name} 대표 이미지`}
                      />
                    ) : null}
                  </section>
                  {accountSummary.status === 'error' ? (
                    <p className="m-0 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
                      계정 요약을 불러오지 못했습니다.
                    </p>
                  ) : null}
                  <div className={appClass.accountMenuActions}>
                    <button className={appClass.accountMenuAction} type="button" role="menuitem" onClick={() => openMyPageTab('profile')}>
                      <span className="inline-flex items-center gap-3">
                        <span className={appClass.accountMenuActionIcon}>
                          <Edit3 size={18} strokeWidth={2.1} />
                        </span>
                        프로필 편집
                      </span>
                      <ChevronRight size={17} strokeWidth={2.2} />
                    </button>
                    <button className={appClass.accountMenuAction} type="button" role="menuitem" onClick={() => openMyPageTab('completed')}>
                      <span className="inline-flex items-center gap-3">
                        <span className={appClass.accountMenuActionIcon}>
                          <MountainIcon size={18} strokeWidth={2.1} />
                        </span>
                        완료한 산
                      </span>
                      <ChevronRight size={17} strokeWidth={2.2} />
                    </button>
                    <button className={appClass.accountMenuAction} type="button" role="menuitem" onClick={() => openMyPageTab('reviews')}>
                      <span className="inline-flex items-center gap-3">
                        <span className={appClass.accountMenuActionIcon}>
                          <MessageCircle size={18} strokeWidth={2.1} />
                        </span>
                        내 한줄평
                      </span>
                      <span className="inline-flex items-center">
                        <span className={appClass.accountReviewBadge}>
                          {accountSummary.status === 'loading' ? '-' : accountSummary.reviewCount}
                        </span>
                        <ChevronRight size={17} strokeWidth={2.2} />
                      </span>
                    </button>
                  </div>
                  <button className={appClass.accountMenuDanger} type="button" role="menuitem" onClick={() => void signOut()}>
                    <LogOut size={17} strokeWidth={2.1} />
                    로그아웃
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {isMyPageOpen && session ? (
        <MyPage
          session={session}
          activeTab={myPageTab}
          completionRecords={completionRecords}
          onCompletionRecordsChange={setCompletionRecords}
          onProfileChange={syncAccountProfile}
          onReviewDataChange={markReviewDataChanged}
          onTabChange={openMyPageTab}
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
          onReviewDataChange={markReviewDataChanged}
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
              mountains={resultMountains}
              selectedMountainId={selectedMountain?.id}
              focusedMountainId={selectedMountain?.id}
              fitResultsRevision={discoveryState.appliedRevision + resultDataRevision}
              resetCameraRevision={discoveryState.cameraResetRevision}
              layoutKey={isDetailPanelOpen ? 'with-detail-panel' : 'full-map'}
              completedIds={completedIds}
              completionCounts={completionCounts}
              highlightedId={highlightedId}
              onMountainSelect={selectMountain}
            />

            <MountainDiscoveryControls
              state={discoveryState}
              draftResultCount={draftResultCount}
              difficultySummaryState={difficultySummaryState}
              isAuthenticated={Boolean(session?.user)}
              completionDataStatus={completionDataStatus}
              triggerRef={discoveryTriggerRef}
              onAction={handleDiscoveryAction}
              onRetryDifficultySummaries={() => void loadDifficultySummaries(false)}
              onRequestLogin={() => void signInWithGoogle()}
            />
          </div>
          <MountainDiscoveryPanel
              state={discoveryState}
              resultMountains={resultMountains}
              difficultySummaryState={difficultySummaryState}
              completedIds={completedIds}
              isAuthenticated={Boolean(session?.user)}
              completionDataStatus={completionDataStatus}
              triggerRef={discoveryTriggerRef}
              onAction={handleDiscoveryAction}
              onSelectMountain={selectMountain}
              onRandomRecommend={runRandomPick}
              detailContent={selectedMountain ? (
                <>
                <div className={appClass.detailHeader}>
                  <div>
                    <p className={appClass.eyebrow}>{selectedMountain.province}</p>
                    <h2 className="m-0 text-[19px] font-black leading-[24px] max-[560px]:text-[17px] max-[560px]:leading-[22px]">
                      <MountainNameWithHanja
                        mountain={selectedMountain}
                        className="flex-wrap"
                        hanjaClassName="text-[13px] font-bold text-[#627168]"
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
                  <h3 className="text-[15px] font-black leading-5">최신 한줄평 사진</h3>
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
                <button className={appClass.primaryAction} type="button" onClick={() => openMountainDetail(selectedMountain, true)}>
                  <MapPin size={18} />
                  정보 상세페이지
                </button>
                </>
              ) : null}
            />
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
          (isMyPageOpen || detailMountain || isDiscoveryPanelOpen) && 'hidden',
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
              <h2 id="feedback-modal-title" className="m-0 pr-10 text-[19px] font-black leading-[24px] max-[560px]:pr-8 max-[560px]:text-[17px] max-[560px]:leading-[22px]">
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

    </main>
  );
}
