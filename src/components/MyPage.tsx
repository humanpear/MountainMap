import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MutableRefObject, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Camera,
  Check,
  ChevronRight,
  Clock,
  Edit3,
  ImagePlus,
  LogOut,
  MapPin,
  MessageCircle,
  Mountain as MountainIcon,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "../lib/classNames";
import { getMountainGuide } from "../data/mountainDetails";
import { mountains } from "../data/mountains";
import { useReviewEditorDraft } from "./reviews/useReviewEditorDraft";
import {
  deleteProfileAvatar,
  defaultProfileAvatars,
  fetchOrCreateUserProfile,
  getDefaultAvatarUrl,
  isCustomProfileAvatarUrl,
  saveUserProfile,
  sanitizeDisplayName,
  uploadProfileAvatar,
  type UserProfile,
} from "../services/profiles";
import {
  deleteCompletedMountain,
  fetchUserCompletedMountains,
  fetchUserReviews,
  type UserCompletedMountain,
  type UserReviewSummary,
} from "../services/myPage";
import {
  deleteMountainReview,
  updateMountainReview,
  type MountainReview,
} from "../services/mountainReviews";
import type { CompletionRecord, Mountain, MountainGuideDifficulty, MountainGuideRoute } from "../types";

type MyPageProps = {
  session: Session;
  activeTab?: MyPageTab;
  completionRecords: CompletionRecord[];
  onCompletionRecordsChange: (records: CompletionRecord[]) => void;
  onTabChange?: (tab: MyPageTab) => void;
  onBackToMap: () => void;
  onOpenMountain: (mountain: Mountain) => void;
  onSignOut: () => void;
};

type LoadState = "loading" | "ready" | "error";
type MyPageTab = "profile" | "completed" | "reviews";

const manualCourseRouteName = "코스 직접 입력";
const difficultyEvaluationOptions = ["쉬움", "보통", "약간 어려움", "어려움", "매우 어려움"];
const myPageTabs: Array<{ id: MyPageTab; label: string }> = [
  { id: "profile", label: "프로필 편집" },
  { id: "completed", label: "완료한 산" },
  { id: "reviews", label: "내 한줄평" },
];
const difficultyDefaultIndex: Record<MountainGuideDifficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 3,
  extreme: 4,
  unknown: 2,
};

const pageClass = {
  shell:
    "min-h-[calc(100vh-68px)] bg-[radial-gradient(circle_at_top_right,rgba(218,231,224,0.72),transparent_34%),linear-gradient(180deg,#fbfcfb_0%,#f5f7f4_42%,#f7faf7_100%)]",
  inner:
    "mx-auto grid w-[1180px] max-w-[calc(100%-40px)] gap-6 pb-10 pt-9 max-[1023px]:w-full max-[1023px]:max-w-none max-[1023px]:px-6 max-[767px]:gap-4 max-[767px]:px-4 max-[767px]:py-5",
  pageIntro: "relative isolate min-h-[118px] overflow-hidden max-[767px]:min-h-0",
  pageHeading: "relative z-10 flex items-end justify-between gap-5 pt-2 max-[767px]:grid",
  pageTitle: "m-0 text-[34px] font-black leading-tight text-[#18221d] max-[767px]:text-[28px]",
  pageDescription: "m-0 mt-2 text-base font-bold leading-7 text-[#5d6a62]",
  mountainBackdrop: "pointer-events-none absolute inset-x-[34%] bottom-0 top-0 -z-10 max-[767px]:hidden",
  mountainLayer:
    "absolute bottom-0 h-24 w-56 bg-[#dceae3] opacity-80 [clip-path:polygon(0_100%,22%_50%,35%_68%,54%_20%,69%_62%,82%_36%,100%_100%)]",
  treeLayer:
    "absolute bottom-0 h-10 w-72 bg-[#b8d0c3] opacity-75 [clip-path:polygon(0_100%,4%_70%,8%_100%,12%_55%,16%_100%,21%_68%,25%_100%,30%_58%,34%_100%,39%_72%,43%_100%,48%_60%,52%_100%,58%_70%,62%_100%,68%_52%,72%_100%,78%_66%,82%_100%,88%_60%,92%_100%,100%_76%,100%_100%)]",
  hero:
    "relative isolate grid gap-7 overflow-hidden rounded-2xl border border-[#dfe7df] bg-white p-8 shadow-[0_18px_55px_rgba(20,40,30,0.07)] max-[767px]:gap-5 max-[767px]:p-5",
  heroDecoration:
    "pointer-events-none absolute -right-8 -top-8 -z-10 h-44 w-72 rounded-full bg-[#eef3f0] opacity-60 blur-2xl max-[767px]:hidden",
  heroTop: "flex items-start justify-between gap-8 max-[767px]:grid",
  profileSummary: "flex min-w-0 items-center gap-8 max-[767px]:gap-4 max-[420px]:grid max-[420px]:justify-items-start",
  avatar:
    "h-28 w-28 flex-none rounded-full border-4 border-white bg-[#eef3f0] object-cover shadow-[0_12px_30px_rgba(24,34,29,0.14)] max-[767px]:h-20 max-[767px]:w-20",
  eyebrow: "m-0 text-sm font-black text-[#5d6a62]",
  title: "m-0 text-[30px] font-black leading-tight text-[#18221d] max-[767px]:text-2xl",
  muted: "m-0 leading-7 text-[#5d6a62]",
  heroActions:
    "flex flex-wrap justify-end gap-2 max-[767px]:grid max-[767px]:grid-cols-2 max-[767px]:justify-stretch max-[420px]:grid-cols-1",
  secondaryButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#d8e0da] bg-white px-4 font-extrabold text-[#18221d] transition hover:bg-[#eef3f0] max-[767px]:min-h-12",
  dangerButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#b14a3d] bg-white px-4 font-extrabold text-[#b14a3d] transition hover:bg-[#fff1ee] max-[767px]:min-h-12",
  metrics: "grid grid-cols-3 gap-0 border-t border-[#d8e0da] pt-5 max-[767px]:pt-4",
  metric:
    "grid min-w-0 grid-cols-[74px_minmax(0,1fr)] content-center gap-x-4 gap-y-1 border-r border-[#d8e0da] px-5 py-2 last:border-r-0 max-[767px]:grid-cols-1 max-[767px]:justify-items-start max-[767px]:gap-1 max-[767px]:px-2 [&_dd]:m-0 [&_dd]:font-numeric [&_dd]:text-[28px] [&_dd]:font-black [&_dd]:leading-tight max-[767px]:[&_dd]:text-xl [&_dt]:text-sm [&_dt]:font-black [&_dt]:text-[#245c46]",
  metricIcon:
    "row-span-4 grid h-16 w-16 place-items-center rounded-full bg-[#eef5f1] text-[#245c46] max-[767px]:h-9 max-[767px]:w-9",
  progressTrack: "h-2.5 overflow-hidden rounded-full bg-[#d8e0da]",
  progressValue: "h-full rounded-full bg-[#245c46] transition-[width]",
  sidePanel:
    "grid gap-6 rounded-2xl border border-[#dfe7df] bg-white p-5 shadow-[0_16px_44px_rgba(20,40,30,0.06)] max-[1023px]:block max-[1023px]:border-0 max-[1023px]:bg-transparent max-[1023px]:p-0 max-[1023px]:shadow-none",
  sideTitle: "m-0 text-lg font-black text-[#18221d] max-[1023px]:hidden",
  tabs:
    "grid gap-2 max-[1023px]:grid-cols-3 max-[1023px]:rounded-2xl max-[1023px]:border max-[1023px]:border-[#dfe7df] max-[1023px]:bg-white max-[1023px]:p-1.5 max-[1023px]:shadow-[0_12px_32px_rgba(20,40,30,0.05)]",
  tabButton:
    "inline-flex min-h-14 cursor-pointer items-center justify-start gap-3 rounded-xl border px-4 text-left font-extrabold transition max-[1023px]:min-h-11 max-[1023px]:justify-center max-[767px]:gap-1.5 max-[767px]:px-2 max-[767px]:text-sm",
  tabButtonActive:
    "border-[#dce9e2] border-l-4 border-l-[#245c46] bg-[#eef5f1] text-[#245c46] shadow-none ring-0 max-[1023px]:border-l max-[1023px]:border-[#245c46] max-[1023px]:bg-[#245c46] max-[1023px]:text-white",
  tabButtonIdle: "border-transparent bg-transparent text-[#18221d] hover:bg-[#eef3f0] hover:text-[#245c46]",
  bodyGrid: "grid grid-cols-[280px_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1 max-[767px]:gap-4",
  section:
    "rounded-2xl border border-[#dfe7df] bg-white p-7 shadow-[0_16px_44px_rgba(20,40,30,0.06)] max-[767px]:p-5",
  sectionHeader: "mb-5 flex items-start justify-between gap-3",
  sectionTitle: "m-0 text-[22px] font-black leading-tight text-[#18221d]",
  field: "grid gap-2 [&_label]:text-sm [&_label]:font-black [&_label]:text-[#18221d]",
  input:
    "min-h-12 rounded-xl border border-[#d8e0da] bg-white px-4 text-base text-[#18221d] outline-none focus:border-[#245c46]",
  primaryButton:
    "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#245c46] bg-[#245c46] px-4 font-extrabold text-white transition hover:bg-[#1f4e39] disabled:cursor-not-allowed disabled:border-[#8aa699] disabled:bg-[#8aa699]",
  avatarGrid: "grid grid-cols-5 gap-3 max-[767px]:grid-cols-3",
  avatarChoice:
    "relative aspect-square min-h-16 cursor-pointer overflow-hidden rounded-2xl border-2 bg-[#eef3f0] p-0 transition focus:outline-none focus:ring-2 focus:ring-[#245c46]",
  list: "grid gap-3",
  listItem:
    "grid gap-3 rounded-2xl border border-[#d8e0da] bg-[#fbfdfb] p-4 transition hover:border-[#9fb2a7] max-[560px]:p-3",
  itemTop: "flex items-start justify-between gap-3",
  itemTitle: "m-0 text-lg font-black leading-6 text-[#18221d]",
  completedItem: "grid grid-cols-[132px_minmax(0,1fr)] gap-4 max-[560px]:grid-cols-1",
  completedImage:
    "h-full min-h-28 w-full rounded-xl object-cover shadow-[0_10px_24px_rgba(24,34,29,0.12)] max-[560px]:aspect-[16/9] max-[560px]:min-h-0",
  tag: "inline-flex min-h-8 items-center rounded-full bg-[#eef3f0] px-3 text-sm font-black text-[#245c46]",
  iconButton:
    "inline-flex h-11 min-h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-[#d8e0da] bg-white text-[#18221d] transition hover:bg-[#eef3f0]",
  empty:
    "grid min-h-36 place-items-center rounded-2xl border border-dashed border-[#d8e0da] bg-[#f7faf8] px-4 text-center font-bold leading-7 text-[#5d6a62]",
  status:
    "rounded-2xl border border-[#d8e0da] bg-[#f7faf8] px-4 py-3 text-sm font-bold leading-6 text-[#5d6a62]",
};

export function MyPage({
  session,
  activeTab = "profile",
  completionRecords,
  onCompletionRecordsChange,
  onTabChange,
  onBackToMap,
  onOpenMountain,
  onSignOut,
}: MyPageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>(getDefaultAvatarUrl());
  const [avatarKind, setAvatarKind] = useState("default-1");
  const [completedMountains, setCompletedMountains] = useState<UserCompletedMountain[]>([]);
  const [reviews, setReviews] = useState<UserReviewSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [removingMountainId, setRemovingMountainId] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMyPage() {
      setLoadState("loading");
      setMessage(null);

      try {
        const [nextProfile, nextCompletedMountains, nextReviews] = await Promise.all([
          fetchOrCreateUserProfile(session.user),
          fetchUserCompletedMountains(session.user.id),
          fetchUserReviews(session.user.id),
        ]);

        if (!isActive) {
          return;
        }

        setProfile(nextProfile);
        setDisplayName(nextProfile.displayName);
        setAvatarUrl(nextProfile.avatarUrl);
        setAvatarKind(nextProfile.avatarKind);
        setCompletedMountains(nextCompletedMountains);
        setReviews(nextReviews);
        setLoadState("ready");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setMessage(error instanceof Error ? error.message : "마이페이지 정보를 불러오지 못했습니다.");
        setLoadState("error");
      }
    }

    void loadMyPage();

    return () => {
      isActive = false;
    };
  }, [session.user]);

  const completedSummary = useMemo(() => summarizeCompletedMountains(completedMountains), [completedMountains]);
  const completedMountainCount = completedSummary.length;
  const completionProgressPercent = Math.min(100, Math.round((completedMountainCount / mountains.length) * 100));
  const primaryAvatarUrl = avatarUrl || profile?.avatarUrl || getDefaultAvatarUrl(avatarKind);
  const displayNameLabel = profile?.displayName || "내 산행 기록";
  const recentMountainName = completedSummary[0]?.mountain?.name ?? "기록 없음";
  const recentMountainDescription = completedSummary[0]?.completedAt
    ? `${formatDate(completedSummary[0].completedAt)} 산행 완료`
    : "기록이 쌓이면 표시됩니다.";
  const levelLabel = `Lv.${getProfileLevel(completedMountainCount)}`;
  const openTab = (tab: MyPageTab) => {
    onTabChange?.(tab);
  };

  const saveProfile = async () => {
    if (!profile) {
      return;
    }

    const nextDisplayName = sanitizeDisplayName(displayName);
    const previousProfile = profile;
    setIsSaving(true);
    setMessage(null);

    try {
      let didCleanupFail = false;
      const nextProfile = await saveUserProfile({
        id: profile.id,
        email: profile.email,
        displayName: nextDisplayName,
        avatarUrl: primaryAvatarUrl,
        avatarKind,
      });
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setAvatarUrl(nextProfile.avatarUrl);
      setAvatarKind(nextProfile.avatarKind);
      setReviews((currentReviews) =>
        currentReviews.map((review) => ({
          ...review,
          authorName: nextProfile.displayName,
          authorAvatarUrl: nextProfile.avatarUrl,
        })),
      );
      if (shouldDeletePreviousAvatar(previousProfile, nextProfile.avatarUrl)) {
        try {
          await deleteProfileAvatar(previousProfile.id, previousProfile.avatarUrl);
        } catch {
          didCleanupFail = true;
        }
      }
      setMessage(didCleanupFail ? "프로필은 저장했지만 이전 프로필 사진 삭제에 실패했습니다." : "프로필을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) {
      return;
    }

    setIsUploadingAvatar(true);
    setMessage(null);

    try {
      const pendingAvatarUrl = avatarKind === "custom" && avatarUrl !== profile.avatarUrl ? avatarUrl : null;
      const nextAvatarUrl = await uploadProfileAvatar(profile.id, file);
      if (pendingAvatarUrl) {
        try {
          await deleteProfileAvatar(profile.id, pendingAvatarUrl);
        } catch {
          // The newly selected avatar should remain usable even if cleaning up an unsaved preview fails.
        }
      }
      setAvatarUrl(nextAvatarUrl);
      setAvatarKind("custom");
      setMessage("새 프로필 사진을 선택했습니다. 저장을 눌러 반영해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필 사진 업로드에 실패했습니다.");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeCompleted = async (mountainId: string) => {
    setRemovingMountainId(mountainId);
    setMessage(null);

    try {
      await deleteCompletedMountain(session.user.id, mountainId);
      setCompletedMountains((currentMountains) =>
        currentMountains.filter((record) => record.mountainId !== mountainId),
      );
      onCompletionRecordsChange(completionRecords.filter((record) => record.mountainId !== mountainId));
      setMessage("등반 완료 기록을 해제했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "등반 기록 삭제에 실패했습니다.");
    } finally {
      setRemovingMountainId(null);
    }
  };

  const profileEditor = (
    <ProfileEditor
      displayName={displayName}
      avatarUrl={primaryAvatarUrl}
      avatarKind={avatarKind}
      isSaving={isSaving}
      isUploadingAvatar={isUploadingAvatar}
      fileInputRef={fileInputRef}
      onDisplayNameChange={setDisplayName}
      onAvatarSelect={(nextAvatarKind, nextAvatarUrl) => {
        setAvatarKind(nextAvatarKind);
        setAvatarUrl(nextAvatarUrl);
      }}
      onUploadClick={() => fileInputRef.current?.click()}
      onFileChange={(file) => void uploadAvatar(file)}
      onSave={() => void saveProfile()}
    />
  );

  const completedPanel = (
    <CompletedMountainsPanel
      completedMountains={completedSummary}
      removingMountainId={removingMountainId}
      onOpenMountain={onOpenMountain}
      onRemoveCompleted={(mountainId) => void removeCompleted(mountainId)}
    />
  );

  const reviewsPanel = (
    <EditableUserReviewsPanel
      reviews={reviews}
      currentUserId={session.user.id}
      onReviewsChange={setReviews}
      onOpenMountain={onOpenMountain}
      onStatusMessage={setMessage}
    />
  );

  return (
    <section className={pageClass.shell} aria-label="마이페이지">
      <div className={pageClass.inner}>
        <div className={pageClass.pageIntro}>
          <div className={pageClass.pageHeading}>
            <div>
              <h1 className={pageClass.pageTitle}>마이페이지</h1>
              <p className={pageClass.pageDescription}>나의 산행 기록과 활동을 관리해보세요.</p>
            </div>
            <MountainPanorama />
          </div>
        </div>

        <header className={pageClass.hero}>
          <div className={pageClass.heroDecoration} aria-hidden="true" />
          <div className={pageClass.heroTop}>
            <div className={pageClass.profileSummary}>
              <img className={pageClass.avatar} src={primaryAvatarUrl} alt="" aria-hidden="true" />
              <div className="grid min-w-0 gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className={pageClass.title}>{displayNameLabel}</h2>
                  <span className="inline-flex min-h-8 items-center rounded-full bg-[#e7f3e4] px-3 font-numeric text-sm font-black text-[#245c46]">
                    {levelLabel}
                  </span>
                </div>
                <p className={pageClass.muted}>{session.user.email}</p>
                <p className="m-0 text-sm font-black text-[#245c46]">대한민국 100대 명산 도전 중</p>
              </div>
            </div>
            <div className={pageClass.heroActions}>
              <button className={pageClass.secondaryButton} type="button" onClick={onBackToMap}>
                <MapPin size={18} />
                지도 보기
              </button>
              <button className={pageClass.dangerButton} type="button" onClick={onSignOut}>
                <LogOut size={18} />
                로그아웃
              </button>
            </div>
          </div>

          <dl className={pageClass.metrics}>
            <div className={pageClass.metric}>
              <div className={pageClass.metricIcon} aria-hidden="true">
                <MountainIcon size={18} />
              </div>
              <dt>완료한 산</dt>
              <dd>{completedMountainCount} / {mountains.length}</dd>
              <p className={cn(pageClass.muted, "text-sm max-[767px]:text-xs")}>100대 명산 중 {completionProgressPercent}% 완료</p>
              <div className={pageClass.progressTrack} aria-hidden="true">
                <div className={pageClass.progressValue} style={{ width: `${completionProgressPercent}%` }} />
              </div>
            </div>
            <div className={pageClass.metric}>
              <div className={pageClass.metricIcon} aria-hidden="true">
                <MessageCircle size={18} />
              </div>
              <dt>작성 리뷰</dt>
              <dd>{reviews.length}개</dd>
              <p className={cn(pageClass.muted, "text-sm max-[767px]:text-xs")}>내가 남긴 한줄평</p>
            </div>
            <div className={pageClass.metric}>
              <div className={pageClass.metricIcon} aria-hidden="true">
                <Clock size={18} />
              </div>
              <dt>최근 산행</dt>
              <dd className="truncate text-[20px]">{recentMountainName}</dd>
              <p className={cn(pageClass.muted, "text-sm max-[767px]:text-xs")}>{recentMountainDescription}</p>
            </div>
          </dl>
        </header>

        {message ? (
          <div className={pageClass.status} role="status">
            {message}
          </div>
        ) : null}

        <div className={pageClass.bodyGrid}>
          <aside className={pageClass.sidePanel}>
            <h2 className={pageClass.sideTitle}>마이페이지 메뉴</h2>
            <nav className={pageClass.tabs} aria-label="마이페이지 섹션">
              {myPageTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={cn(
                    pageClass.tabButton,
                    activeTab === tab.id ? pageClass.tabButtonActive : pageClass.tabButtonIdle,
                  )}
                  type="button"
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  onClick={() => openTab(tab.id)}
                >
                  {getMyPageTabIcon(tab.id)}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            {loadState === "loading" ? (
              <div className={pageClass.empty}>마이페이지 정보를 불러오는 중입니다.</div>
            ) : loadState === "error" ? (
              <div className={pageClass.empty}>
                <span>정보를 불러오지 못했습니다.</span>
              </div>
            ) : (
              <>
                {activeTab === "profile" ? (
                  profileEditor
                ) : activeTab === "completed" ? (
                  completedPanel
                ) : (
                  reviewsPanel
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function getMyPageTabIcon(tab: MyPageTab) {
  if (tab === "profile") {
    return <UserRound size={18} aria-hidden="true" />;
  }

  if (tab === "completed") {
    return <MountainIcon size={18} aria-hidden="true" />;
  }

  return <MessageCircle size={18} aria-hidden="true" />;
}

function getProfileLevel(completedMountainCount: number) {
  return Math.min(10, Math.floor(completedMountainCount / 3) + 1);
}

function MountainPanorama() {
  return (
    <div className={pageClass.mountainBackdrop} aria-hidden="true">
      <span className={cn(pageClass.mountainLayer, "right-32 bottom-1 scale-110 bg-[#e5eee9]")} />
      <span className={cn(pageClass.mountainLayer, "right-8 bottom-0 h-28 w-72 bg-[#d6e6dd]")} />
      <span className={cn(pageClass.mountainLayer, "right-0 bottom-0 h-24 w-52 bg-[#c7dccf] opacity-70")} />
      <span className={cn(pageClass.treeLayer, "right-0")} />
    </div>
  );
}

function ProfileEditor({
  displayName,
  avatarUrl,
  avatarKind,
  isSaving,
  isUploadingAvatar,
  fileInputRef,
  onDisplayNameChange,
  onAvatarSelect,
  onUploadClick,
  onFileChange,
  onSave,
}: {
  displayName: string;
  avatarUrl: string;
  avatarKind: string;
  isSaving: boolean;
  isUploadingAvatar: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onDisplayNameChange: (value: string) => void;
  onAvatarSelect: (avatarKind: string, avatarUrl: string) => void;
  onUploadClick: () => void;
  onFileChange: (file: File) => void;
  onSave: () => void;
}) {
  return (
    <section className={pageClass.section} aria-labelledby="profile-editor-title">
      <div className={pageClass.sectionHeader}>
        <div>
          <p className={pageClass.eyebrow}>프로필</p>
          <h2 id="profile-editor-title" className={pageClass.sectionTitle}>
            프로필 편집
          </h2>
          <p className={cn(pageClass.muted, "mt-1 text-sm")}>프로필 정보를 관리하고 변경할 수 있습니다.</p>
        </div>
        <UserRound size={24} className="text-[#245c46]" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-7 border-t border-[#d8e0da] pt-6 max-[767px]:grid-cols-1 max-[767px]:gap-6">
        <div className="grid gap-5">
          <div className="grid justify-items-center gap-3 rounded-2xl bg-[#f7faf8] p-5">
            <img className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-[0_14px_34px_rgba(24,34,29,0.14)]" src={avatarUrl} alt="" aria-hidden="true" />
            <div className="text-center">
              <h3 className="m-0 text-lg font-black text-[#18221d]">프로필 사진</h3>
              <p className={cn(pageClass.muted, "text-sm")}>권장 이미지: 정사각형, 2MB 이하</p>
            </div>
          </div>

          <div className={pageClass.avatarGrid} aria-label="기본 프로필 이미지 선택">
            {defaultProfileAvatars.map((avatar) => (
              <button
                key={avatar.id}
                className={cn(
                  pageClass.avatarChoice,
                  avatarKind === avatar.id
                    ? "border-[#245c46] bg-[#e7f3e4] shadow-[0_8px_18px_rgba(36,92,70,0.16)]"
                    : "border-[#d8e0da]",
                )}
                type="button"
                title={avatar.label}
                aria-label={`${avatar.label} 선택`}
                onClick={() => onAvatarSelect(avatar.id, avatar.url)}
              >
                <img className="h-full w-full object-cover" src={avatar.url} alt="" aria-hidden="true" />
                {avatarKind === avatar.id ? (
                  <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-[#245c46] text-white shadow">
                    <Check size={14} />
                  </span>
                ) : null}
              </button>
            ))}
            <button
              className={cn(
                pageClass.avatarChoice,
                "col-span-2 flex aspect-auto min-h-14 items-center justify-center gap-2 rounded-xl border-dashed text-[#245c46] max-[767px]:col-span-3",
                avatarKind === "custom"
                  ? "border-[#245c46] bg-[#e7f3e4] shadow-[0_8px_18px_rgba(36,92,70,0.16)]"
                  : "border-[#9fb2a7] bg-white",
              )}
              type="button"
              aria-label="사진 추가"
              onClick={onUploadClick}
              disabled={isUploadingAvatar}
            >
              <ImagePlus size={22} />
              <span className="text-sm font-black">사진 추가</span>
              {avatarKind === "custom" ? (
                <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-[#245c46] text-white shadow">
                  <Check size={14} />
                </span>
              ) : null}
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onFileChange(file);
                }
              }}
            />
          </div>
        </div>

        <div className="grid content-between gap-6 border-l border-[#d8e0da] pl-7 max-[767px]:border-l-0 max-[767px]:border-t max-[767px]:pl-0 max-[767px]:pt-6">
          <div className="grid gap-4">
            <div>
              <h3 className="m-0 text-lg font-black text-[#18221d]">닉네임 변경</h3>
              <p className={cn(pageClass.muted, "mt-1 text-sm")}>닉네임은 중복 여부와 관계없이 저장할 수 있습니다.</p>
            </div>

            <div className={pageClass.field}>
              <label htmlFor="profile-display-name">닉네임</label>
              <input
                className={pageClass.input}
                id="profile-display-name"
                value={displayName}
                maxLength={20}
                onChange={(event) => onDisplayNameChange(event.target.value)}
              />
              <p className="m-0 text-sm font-black text-[#237a1f]">저장 가능한 닉네임입니다.</p>
            </div>

            <ul className="m-0 grid gap-2 pl-5 text-sm font-bold leading-6 text-[#5d6a62]">
              <li>2자 이상, 20자 이하로 입력해주세요.</li>
              <li>공백은 한 칸으로 정리되어 저장됩니다.</li>
              <li>닉네임은 언제든지 변경할 수 있습니다.</li>
            </ul>
          </div>

          <button className={pageClass.primaryButton} type="button" onClick={onSave} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? "저장 중" : "프로필 저장"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CompletedMountainsPanel({
  completedMountains,
  removingMountainId,
  onOpenMountain,
  onRemoveCompleted,
}: {
  completedMountains: CompletedMountainSummary[];
  removingMountainId: string | null;
  onOpenMountain: (mountain: Mountain) => void;
  onRemoveCompleted: (mountainId: string) => void;
}) {
  return (
    <section className={pageClass.section} aria-labelledby="completed-mountains-title">
      <div className={pageClass.sectionHeader}>
        <div>
          <p className={pageClass.eyebrow}>등반 완료한 산</p>
          <h2 id="completed-mountains-title" className={pageClass.sectionTitle}>
            완료 기록 관리
          </h2>
        </div>
        <MountainIcon size={24} className="text-[#245c46]" aria-hidden="true" />
      </div>

      {completedMountains.length > 0 ? (
        <div className={pageClass.list}>
          {completedMountains.map((record) => (
            <article key={record.mountainId} className={pageClass.listItem}>
              <div className={pageClass.completedItem}>
                {record.mountain ? (
                  <img
                    className={pageClass.completedImage}
                    src={getCompletedMountainHeroImage(record.mountain)}
                    alt={`${record.mountain.name} 대표 이미지`}
                  />
                ) : null}
                <div className="grid min-w-0 gap-3">
                  <div className={pageClass.itemTop}>
                    <div className="min-w-0">
                      <h3 className={pageClass.itemTitle}>{record.mountain?.name ?? record.mountainId}</h3>
                      <p className={pageClass.muted}>
                        {record.mountain ? `${record.mountain.province} ${record.mountain.city}` : "산 정보 없음"}
                      </p>
                    </div>
                    <span className={pageClass.tag}>등산 완료</span>
                  </div>
                  <p className={cn(pageClass.muted, "font-bold")}>완료 날짜 {formatDate(record.completedAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    {record.mountain ? (
                      <button className={pageClass.secondaryButton} type="button" onClick={() => onOpenMountain(record.mountain!)}>
                        상세 보기
                        <ChevronRight size={17} />
                      </button>
                    ) : null}
                    <button
                      className={pageClass.dangerButton}
                      type="button"
                      onClick={() => onRemoveCompleted(record.mountainId)}
                      disabled={removingMountainId === record.mountainId}
                    >
                      <Trash2 size={17} />
                      {removingMountainId === record.mountainId ? "해제 중" : "완료 해제"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={pageClass.empty}>아직 등반 완료한 산이 없습니다.</div>
      )}
    </section>
  );
}

function UserReviewsPanel({
  reviews,
  onOpenMountain,
}: {
  reviews: UserReviewSummary[];
  onOpenMountain: (mountain: Mountain) => void;
}) {
  return (
    <section className={pageClass.section} aria-labelledby="user-reviews-title">
      <div className={pageClass.sectionHeader}>
        <div>
          <p className={pageClass.eyebrow}>내 리뷰</p>
          <h2 id="user-reviews-title" className={pageClass.sectionTitle}>
            내가 남긴 한줄평
          </h2>
        </div>
        <MessageCircle size={24} className="text-[#245c46]" aria-hidden="true" />
      </div>

      {reviews.length > 0 ? (
        <div className={pageClass.list}>
          {reviews.map((review) => {
            const mountain = findMountain(review.mountainId);
            return (
              <article key={review.id} className={pageClass.listItem}>
                <div className={pageClass.itemTop}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {review.authorAvatarUrl ? (
                        <img
                          className="h-10 w-10 shrink-0 rounded-full border border-[#d8e0da] bg-[#eef3f0] object-cover"
                          src={review.authorAvatarUrl}
                          alt=""
                          aria-hidden="true"
                        />
                      ) : null}
                      <h3 className={pageClass.itemTitle}>{review.mountainName}</h3>
                    </div>
                    <p className={pageClass.muted}>
                      {review.routeName} · {formatDate(review.createdAt)}
                    </p>
                    {review.routeStartPoint || review.routeEndPoint ? (
                      <p className={cn(pageClass.muted, "text-sm font-bold")}>
                        {formatRouteEndpoints(review.routeStartPoint, review.routeEndPoint)}
                      </p>
                    ) : null}
                  </div>
                  <span className={pageClass.tag}>{review.difficulty}</span>
                </div>
                <p className="m-0 leading-7 text-[#18221d]">“{review.body}”</p>
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#5d6a62]">
                  <span>{review.durationLabel}</span>
                  <span>{review.authorName}</span>
                  {review.imageUrls.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Camera size={15} />
                      사진 {review.imageUrls.length}장
                    </span>
                  ) : null}
                </div>
                {mountain ? (
                  <button className={pageClass.secondaryButton} type="button" onClick={() => onOpenMountain(mountain)}>
                    {review.mountainName} 상세페이지
                    <ChevronRight size={17} />
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={pageClass.empty}>아직 작성한 한줄평이 없습니다.</div>
      )}
    </section>
  );
}

function EditableUserReviewsPanel({
  reviews,
  currentUserId,
  onReviewsChange,
  onOpenMountain,
  onStatusMessage,
}: {
  reviews: UserReviewSummary[];
  currentUserId: string;
  onReviewsChange: (reviews: UserReviewSummary[]) => void;
  onOpenMountain: (mountain: Mountain) => void;
  onStatusMessage: (message: string | null) => void;
}) {
  const [editingReview, setEditingReview] = useState<UserReviewSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const usesMobileReviewSheet = useMediaQuery("(max-width: 560px)");
  const {
    difficultyIndex,
    setDifficultyIndex,
    durationMinutes,
    setDurationMinutes,
    reviewText,
    setReviewText,
    trimmedReviewText,
    uploadedPhotos,
    editingExistingImageUrls,
    resetDraft,
    addSelectedPhotos,
    removeUploadedPhoto,
    removeExistingImageUrl,
    startEditingDraft,
  } = useReviewEditorDraft({
    routes: [],
    defaultRouteName: manualCourseRouteName,
    manualRouteName: manualCourseRouteName,
    difficultyOptions: difficultyEvaluationOptions,
    difficultyDefaultIndex,
    getDefaultDurationMinutes,
    getRouteDisplayName,
    getRouteEndpointNames,
  });

  const closeEditor = () => {
    resetDraft();
    setEditingReview(null);
    setFormMessage(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const startEditingReview = (review: UserReviewSummary) => {
    setEditingReview(review);
    startEditingDraft(toMountainReview(review));
    setFormMessage(null);
    onStatusMessage(null);
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    const message = addSelectedPhotos(selectedFiles);
    if (message) {
      setFormMessage(message);
    }
  };

  const saveEditingReview = async () => {
    if (!editingReview || isSubmitting) {
      return;
    }

    if (!trimmedReviewText) {
      setFormMessage("한줄평 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);
    onStatusMessage(null);

    try {
      const updatedReview = await updateMountainReview({
        id: editingReview.id,
        userId: currentUserId,
        mountainId: editingReview.mountainId,
        difficulty: difficultyEvaluationOptions[difficultyIndex] ?? difficultyEvaluationOptions[0],
        durationMinutes,
        durationLabel: formatDurationMinutes(durationMinutes),
        body: trimmedReviewText,
        existingImageUrls: editingExistingImageUrls,
        imageFiles: uploadedPhotos.map((photo) => photo.file),
      });
      const nextReview = toUserReviewSummary(updatedReview, editingReview);

      onReviewsChange(reviews.map((review) => (review.id === nextReview.id ? nextReview : review)));
      closeEditor();
      onStatusMessage("한줄평을 수정했습니다.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "한줄평 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeReview = async (review: UserReviewSummary) => {
    if (deletingReviewId) {
      return;
    }

    const shouldDelete = window.confirm("한줄평을 삭제하시겠습니까?");
    if (!shouldDelete) {
      return;
    }

    setDeletingReviewId(review.id);
    onStatusMessage(null);

    try {
      await deleteMountainReview(toMountainReview(review));
      onReviewsChange(reviews.filter((currentReview) => currentReview.id !== review.id));
      if (editingReview?.id === review.id) {
        closeEditor();
      }
      onStatusMessage("한줄평을 삭제했습니다.");
    } catch (error) {
      onStatusMessage(error instanceof Error ? error.message : "한줄평 삭제에 실패했습니다.");
    } finally {
      setDeletingReviewId(null);
    }
  };

  const editorForm = editingReview ? (
    <MyPageReviewEditForm
      review={editingReview}
      difficultyIndex={difficultyIndex}
      durationMinutes={durationMinutes}
      reviewText={reviewText}
      existingImageUrls={editingExistingImageUrls}
      uploadedPhotos={uploadedPhotos}
      formMessage={formMessage}
      isSubmitting={isSubmitting}
      photoInputRef={photoInputRef}
      onDifficultyChange={setDifficultyIndex}
      onDurationChange={setDurationMinutes}
      onReviewTextChange={setReviewText}
      onPhotoSelect={handlePhotoSelect}
      onRemoveExistingImage={removeExistingImageUrl}
      onRemoveUploadedPhoto={removeUploadedPhoto}
      onCancel={closeEditor}
      onSave={() => void saveEditingReview()}
    />
  ) : null;

  return (
    <section className={pageClass.section} aria-labelledby="user-reviews-title">
      <div className={pageClass.sectionHeader}>
        <div>
          <p className={pageClass.eyebrow}>내 리뷰</p>
          <h2 id="user-reviews-title" className={pageClass.sectionTitle}>
            내가 남긴 한줄평
          </h2>
        </div>
        <MessageCircle size={24} className="text-[#245c46]" aria-hidden="true" />
      </div>

      {reviews.length > 0 ? (
        <div className={pageClass.list}>
          {reviews.map((review) => {
            const mountain = findMountain(review.mountainId);
            const isEditing = editingReview?.id === review.id;
            return (
              <article
                key={review.id}
                className={cn(
                  "relative grid rounded-md border border-[#d8e0da] bg-white p-4 shadow-[0_10px_24px_rgba(24,34,29,0.045)]",
                  "grid-cols-[minmax(0,0.92fr)_minmax(280px,1fr)] gap-x-12 gap-y-4 max-[840px]:grid-cols-1 max-[840px]:gap-x-0",
                  isEditing && "border-[#245c46] ring-2 ring-[#245c46]/15",
                )}
              >
                <div className="grid min-w-0 content-start gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    {review.authorAvatarUrl ? (
                      <img
                        className="h-11 w-11 shrink-0 rounded-full border border-[#d8e0da] bg-[#eef3f0] object-cover"
                        src={review.authorAvatarUrl}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8e0da] bg-[#eef3f0] text-[#245c46]"
                        role="img"
                        aria-label="기본 프로필"
                      >
                        <UserRound size={19} aria-hidden="true" />
                      </span>
                    )}
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-8">
                        <strong className="block max-w-full truncate text-[15px] font-black leading-5 text-[#18221d]">
                          {review.authorName}
                        </strong>
                        <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#e7f3e4] px-2 py-0.5 text-xs font-medium text-[#237a1f]">
                          <span className="truncate">{review.mountainName}</span>
                        </span>
                        <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#eef3f0] px-2 py-0.5 text-xs font-medium text-[#245c46]">
                          <span className="truncate">{review.routeName}</span>
                        </span>
                        <time className="ml-auto block shrink-0 text-right font-numeric text-xs font-bold leading-5 text-[#5d6a62]">
                          {formatDate(review.createdAt)}
                        </time>
                      </div>
                      {review.routeStartPoint || review.routeEndPoint ? (
                        <span className="block min-w-0 truncate whitespace-nowrap text-xs font-medium leading-5 text-[#49524d]">
                          {formatRouteEndpoints(review.routeStartPoint, review.routeEndPoint)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="m-0 min-w-0 whitespace-pre-line break-words text-base font-extrabold leading-7 text-[#18221d] [overflow-wrap:anywhere]">
                    “{review.body}”
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-8 items-center rounded-full border border-[#d7e4ba] bg-[#f0f7e4] px-3.5 text-sm font-black text-[#237a1f]">
                      난이도 {review.difficulty}
                    </span>
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[#d8e0da] bg-[#f1f5f7] px-3.5 font-numeric text-sm font-black text-[#49524d]">
                      <Clock size={14} />
                      {review.durationLabel}
                    </span>
                  </div>
                </div>

                <MyPageReviewPhotoStrip review={review} />

                <div className="col-span-2 flex flex-wrap gap-2 max-[840px]:col-span-1">
                  {mountain ? (
                    <button className={pageClass.secondaryButton} type="button" onClick={() => onOpenMountain(mountain)}>
                      {review.mountainName} 상세페이지
                      <ChevronRight size={17} />
                    </button>
                  ) : null}
                  <button
                    className={pageClass.secondaryButton}
                    type="button"
                    aria-label={`${review.mountainName} 한줄평 수정`}
                    onClick={() => startEditingReview(review)}
                  >
                    <Edit3 size={17} />
                    수정
                  </button>
                  <button
                    className={pageClass.dangerButton}
                    type="button"
                    aria-label={`${review.mountainName} 한줄평 삭제`}
                    disabled={deletingReviewId === review.id}
                    onClick={() => void removeReview(review)}
                  >
                    <Trash2 size={17} />
                    {deletingReviewId === review.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
                {isEditing && !usesMobileReviewSheet ? editorForm : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={pageClass.empty}>아직 작성한 한줄평이 없습니다.</div>
      )}

      {editingReview && usesMobileReviewSheet ? (
        <MyPageReviewEditSheet review={editingReview} onClose={closeEditor}>
          {editorForm}
        </MyPageReviewEditSheet>
      ) : null}
    </section>
  );
}

function MyPageReviewEditForm({
  review,
  difficultyIndex,
  durationMinutes,
  reviewText,
  existingImageUrls,
  uploadedPhotos,
  formMessage,
  isSubmitting,
  photoInputRef,
  onDifficultyChange,
  onDurationChange,
  onReviewTextChange,
  onPhotoSelect,
  onRemoveExistingImage,
  onRemoveUploadedPhoto,
  onCancel,
  onSave,
}: {
  review: UserReviewSummary;
  difficultyIndex: number;
  durationMinutes: number;
  reviewText: string;
  existingImageUrls: string[];
  uploadedPhotos: Array<{ id: string; name: string; url: string }>;
  formMessage: string | null;
  isSubmitting: boolean;
  photoInputRef: MutableRefObject<HTMLInputElement | null>;
  onDifficultyChange: (index: number) => void;
  onDurationChange: (minutes: number) => void;
  onReviewTextChange: (value: string) => void;
  onPhotoSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveExistingImage: (imageUrl: string) => void;
  onRemoveUploadedPhoto: (photoId: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainderMinutes = durationMinutes % 60;
  const updateDurationFromParts = (hours: number, minutes: number) => {
    onDurationChange(clampNumber(Math.trunc(hours) * 60 + Math.trunc(minutes), 30, 600));
  };

  return (
    <div className="grid gap-4 rounded-lg border border-[#d8e0da] bg-white p-4 shadow-[0_10px_28px_rgba(24,34,29,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-lg font-black leading-6 text-[#18221d]">한줄평 수정</h3>
          <p className={cn(pageClass.muted, "text-sm")}>
            {review.mountainName} · {review.routeName}
          </p>
        </div>
        <button className={pageClass.iconButton} type="button" aria-label="수정 닫기" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>

      {review.routeStartPoint || review.routeEndPoint ? (
        <p className="m-0 rounded-md bg-[#f7faf8] px-3 py-2 text-sm font-bold leading-6 text-[#49524d]">
          {formatRouteEndpoints(review.routeStartPoint, review.routeEndPoint)}
        </p>
      ) : null}

      <div className="grid gap-2">
        <span className="text-sm font-black text-[#18221d]">체감 난이도</span>
        <div className="grid grid-cols-5 gap-2 max-[560px]:grid-cols-2">
          {difficultyEvaluationOptions.map((option, index) => (
            <button
              key={option}
              className={cn(
                "min-h-11 rounded-lg border px-2 text-sm font-black transition",
                difficultyIndex === index
                  ? "border-[#245c46] bg-[#245c46] text-white"
                  : "border-[#d8e0da] bg-white text-[#18221d] hover:bg-[#eef3f0]",
              )}
              type="button"
              disabled={isSubmitting}
              onClick={() => onDifficultyChange(index)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-black text-[#18221d]">소요시간</span>
        <div className="grid grid-cols-2 gap-2">
          <select
            className={pageClass.input}
            value={durationHours}
            aria-label="소요시간"
            disabled={isSubmitting}
            onChange={(event) => updateDurationFromParts(Number(event.target.value), durationRemainderMinutes)}
          >
            {Array.from({ length: 11 }, (_, index) => (
              <option key={index} value={index}>
                {index}시간
              </option>
            ))}
          </select>
          <select
            className={pageClass.input}
            value={durationRemainderMinutes}
            aria-label="소요분"
            disabled={isSubmitting}
            onChange={(event) => updateDurationFromParts(durationHours, Number(event.target.value))}
          >
            {[0, 10, 20, 30, 40, 50].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes}분
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className={pageClass.field}>
        <span>한줄평</span>
        <textarea
          className="min-h-32 resize-y rounded-lg border border-[#d8e0da] bg-white px-3 py-3 text-base leading-7 text-[#18221d] outline-none focus:border-[#245c46]"
          value={reviewText}
          maxLength={500}
          disabled={isSubmitting}
          onChange={(event) => onReviewTextChange(event.target.value)}
        />
      </label>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-black text-[#18221d]">사진</span>
          <button
            className={pageClass.secondaryButton}
            type="button"
            disabled={isSubmitting}
            onClick={() => photoInputRef.current?.click()}
          >
            <ImagePlus size={17} />
            사진 추가
          </button>
          <input
            ref={photoInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={onPhotoSelect}
          />
        </div>
        {[...existingImageUrls.map((url, index) => ({ id: url, url, name: `기존 사진 ${index + 1}`, isExisting: true })), ...uploadedPhotos.map((photo) => ({ id: photo.id, url: photo.url, name: photo.name, isExisting: false }))].length > 0 ? (
          <div className="grid grid-cols-5 gap-2 max-[760px]:grid-cols-3">
            {[
              ...existingImageUrls.map((url, index) => ({
                id: url,
                url,
                name: `기존 사진 ${index + 1}`,
                isExisting: true,
              })),
              ...uploadedPhotos.map((photo) => ({
                id: photo.id,
                url: photo.url,
                name: photo.name,
                isExisting: false,
              })),
            ].map((photo) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-md border border-[#d8e0da] bg-[#eef3f0]">
                <img className="h-full w-full object-cover" src={photo.url} alt={photo.name} />
                <button
                  className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/95 text-[#b14a3d] shadow"
                  type="button"
                  aria-label={`${photo.name} 삭제`}
                  disabled={isSubmitting}
                  onClick={() => (photo.isExisting ? onRemoveExistingImage(photo.url) : onRemoveUploadedPhoto(photo.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn(pageClass.muted, "m-0 text-sm")}>등록된 사진이 없습니다.</p>
        )}
      </div>

      {formMessage ? (
        <p className="m-0 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
          {formMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button className={pageClass.secondaryButton} type="button" disabled={isSubmitting} onClick={onCancel}>
          취소
        </button>
        <button className={pageClass.primaryButton} type="button" disabled={isSubmitting || !reviewText.trim()} onClick={onSave}>
          <Save size={18} />
          {isSubmitting ? "수정 중" : "수정 저장"}
        </button>
      </div>
    </div>
  );
}

function MyPageReviewPhotoStrip({ review }: { review: UserReviewSummary }) {
  if (review.imageUrls.length === 0) {
    return (
      <div className="grid min-h-[112px] place-items-center self-stretch rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] text-sm font-bold text-[#5d6a62]">
        <span className="inline-flex items-center gap-1.5">
          <Camera size={15} />
          사진 없음
        </span>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-3 gap-2 self-stretch">
      {review.imageUrls.slice(0, 3).map((imageUrl, index) => {
        const remainingImageCount = review.imageUrls.length - 3;
        const showImageCountOverlay = index === 2 && remainingImageCount > 0;

        return (
          <div
            key={`${imageUrl}-${index}`}
            className="relative h-[112px] overflow-hidden rounded-md border-0 bg-[#eef3f0]"
          >
            <img
              className="h-full w-full object-cover"
              src={imageUrl}
              alt={`${review.routeName} 한줄평 사진 ${index + 1}`}
              loading="lazy"
            />
            {showImageCountOverlay ? (
              <span className="absolute inset-0 grid place-items-center bg-black/55 font-numeric text-lg font-black text-white">
                +{remainingImageCount}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MyPageReviewEditSheet({
  review,
  children,
  onClose,
}: {
  review: UserReviewSummary;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45" role="dialog" aria-modal="true" aria-label={`${review.mountainName} 한줄평 수정`}>
      <button className="absolute inset-0 h-full w-full cursor-default" type="button" aria-label="수정 닫기" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[#f5f7f4] p-4 shadow-[0_-16px_50px_rgba(0,0,0,0.22)]">
        {children}
      </div>
    </div>
  );
}

type CompletedMountainSummary = {
  mountainId: string;
  mountain: Mountain | null;
  completedAt: string;
};

function summarizeCompletedMountains(records: UserCompletedMountain[]): CompletedMountainSummary[] {
  const summaryMap = new Map<string, CompletedMountainSummary>();

  for (const record of records) {
    const existing = summaryMap.get(record.mountainId);

    if (!existing) {
      summaryMap.set(record.mountainId, {
        mountainId: record.mountainId,
        mountain: record.mountain,
        completedAt: record.completedAt,
      });
      continue;
    }

    if (new Date(record.completedAt).getTime() > new Date(existing.completedAt).getTime()) {
      existing.completedAt = record.completedAt;
    }
  }

  return Array.from(summaryMap.values()).sort(
    (left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );
}

function findMountain(mountainId: string) {
  return mountains.find((mountain) => mountain.id === mountainId) ?? null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQueryList.matches);

    updateMatches();
    mediaQueryList.addEventListener("change", updateMatches);
    return () => mediaQueryList.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function getDefaultDurationMinutes(estimatedTime: string) {
  const hourMatch = estimatedTime.match(/(\d+(?:\.\d+)?)/);
  const hours = hourMatch ? Number(hourMatch[1]) : Number.NaN;

  if (!Number.isFinite(hours)) {
    return 180;
  }

  const minuteMatch = estimatedTime.match(/(\d+)\s*분/);
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  return clampNumber(Math.round(hours * 60 + minutes), 30, 600);
}

function formatDurationMinutes(minutes: number) {
  const safeMinutes = clampNumber(Math.round(minutes), 0, 600);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours <= 0) {
    return `${remainder}분`;
  }
  if (remainder === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${remainder}분`;
}

function getRouteDisplayName(route: MountainGuideRoute) {
  return route.name;
}

function getRouteEndpointNames(route: MountainGuideRoute) {
  return {
    startPoint: route.startPoint,
    endPoint: route.path,
  };
}

function toMountainReview(review: UserReviewSummary): MountainReview {
  return {
    id: review.id,
    userId: review.userId,
    mountainId: review.mountainId,
    routeName: review.routeName,
    routeStartPoint: review.routeStartPoint,
    routeEndPoint: review.routeEndPoint,
    authorName: review.authorName,
    authorAvatarUrl: review.authorAvatarUrl,
    difficulty: review.difficulty,
    durationMinutes: review.durationMinutes,
    durationLabel: review.durationLabel,
    body: review.body,
    imageUrls: review.imageUrls,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function toUserReviewSummary(review: MountainReview, previousReview: UserReviewSummary): UserReviewSummary {
  return {
    id: review.id,
    userId: review.userId,
    mountainId: review.mountainId,
    mountainName: previousReview.mountainName,
    routeName: review.routeName,
    routeStartPoint: review.routeStartPoint ?? previousReview.routeStartPoint,
    routeEndPoint: review.routeEndPoint ?? previousReview.routeEndPoint,
    authorName: review.authorName,
    authorAvatarUrl: review.authorAvatarUrl ?? previousReview.authorAvatarUrl,
    difficulty: review.difficulty,
    durationMinutes: review.durationMinutes,
    durationLabel: review.durationLabel,
    body: review.body,
    imageUrls: review.imageUrls,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function shouldDeletePreviousAvatar(previousProfile: UserProfile, nextAvatarUrl: string) {
  return previousProfile.avatarUrl !== nextAvatarUrl && isCustomProfileAvatarUrl(previousProfile.id, previousProfile.avatarUrl);
}

function getCompletedMountainHeroImage(mountain: Mountain) {
  return getMountainGuide(mountain).heroImage?.src ?? `/mountain-images/${mountain.id}/hero.png`;
}

function formatRouteEndpoints(startPoint: string | null, endPoint: string | null) {
  if (startPoint && endPoint) {
    return `${startPoint} → ${endPoint}`;
  }

  return startPoint ?? endPoint ?? "";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
