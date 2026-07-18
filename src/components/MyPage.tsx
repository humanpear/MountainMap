import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MutableRefObject, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
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
import { mountainReviewDifficulties } from "../types";
import type { CompletionRecord, Mountain, MountainGuideDifficulty, MountainGuideRoute } from "../types";

type MyPageProps = {
  session: Session;
  activeTab?: MyPageTab;
  completionRecords: CompletionRecord[];
  onCompletionRecordsChange: (records: CompletionRecord[]) => void;
  onProfileChange?: (profile: UserProfile) => void;
  onReviewDataChange?: () => void;
  onTabChange?: (tab: MyPageTab) => void;
  onBackToMap: () => void;
  onOpenMountain: (mountain: Mountain) => void;
  onSignOut: () => void;
};

type LoadState = "loading" | "ready" | "error";
type MyPageTab = "profile" | "completed" | "reviews";

type MyPageReviewLightboxState = {
  review: UserReviewSummary;
  imageIndex: number;
};

const manualCourseRouteName = "코스 직접 입력";
const difficultyEvaluationOptions = mountainReviewDifficulties;
const difficultyEvaluationIconSrcs = [
  "/course-feedback-icons/difficulty/easy.png",
  "/course-feedback-icons/difficulty/normal.png",
  "/course-feedback-icons/difficulty/slightly-hard.png",
  "/course-feedback-icons/difficulty/hard.png",
  "/course-feedback-icons/difficulty/extreme.png",
];
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

function getReviewDifficultyBadgeClass(difficultyLabel: string) {
  if (difficultyLabel === "쉬움") {
    return "border-[#dceec8] bg-[#f2f9e8]";
  }
  if (difficultyLabel === "보통") {
    return "border-[#cfe4d4] bg-[#edf7f0]";
  }
  if (difficultyLabel === "약간 어려움") {
    return "border-[#f0dfaa] bg-[#fff7dc]";
  }
  if (difficultyLabel === "어려움") {
    return "border-[#f3d1b4] bg-[#fff0e3]";
  }
  if (difficultyLabel === "매우 어려움") {
    return "border-[#efc9c5] bg-[#fdecea]";
  }
  return "border-[#d8e0da] bg-[#eef3f0]";
}

const pageClass = {
  shell:
    "min-h-[calc(100vh-68px)] bg-[radial-gradient(circle_at_top_right,rgba(218,231,224,0.72),transparent_34%),linear-gradient(180deg,#fbfcfb_0%,#f5f7f4_42%,#f7faf7_100%)]",
  inner:
    "mx-auto grid w-[1040px] max-w-[calc(100%-40px)] gap-4 pb-8 pt-6 max-[1023px]:w-full max-[1023px]:max-w-none max-[1023px]:px-5 max-[767px]:gap-3 max-[767px]:px-4 max-[767px]:py-4",
  pageIntro: "relative isolate min-h-[92px] overflow-hidden rounded-xl border border-[#dfe7df] bg-white max-[767px]:min-h-[86px]",
  pageHeading: "relative flex min-h-[92px] items-end justify-between gap-4 p-4 max-[767px]:min-h-[86px] max-[767px]:p-3.5",
  pageTitle: "relative z-20 m-0 text-[24px] font-black leading-[30px] text-[#18221d] max-[767px]:text-[21px]",
  pageDescription: "relative z-20 m-0 mt-1 text-[13px] font-bold leading-[18px] text-[#5d6a62]",
  mountainBackdrop:
    "pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbf9_56%,#eef5f1_100%)] before:absolute before:inset-0 before:bg-[url('/my-page/completed-progress-bg-desktop.png')] before:bg-cover before:bg-center before:bg-no-repeat before:opacity-30 max-[767px]:before:bg-[url('/my-page/completed-progress-bg-mobile.png')]",
  hero:
    "relative isolate grid gap-4 overflow-hidden rounded-xl border border-[#dfe7df] bg-white p-5 shadow-[0_12px_36px_rgba(20,40,30,0.06)] max-[767px]:gap-4 max-[767px]:p-4",
  heroTop: "grid gap-4",
  profileSummary: "flex min-w-0 items-center gap-4 max-[767px]:gap-3 max-[420px]:gap-2.5",
  avatar:
    "h-16 w-16 flex-none rounded-full border-[3px] border-white bg-[#eef3f0] object-cover shadow-[0_8px_20px_rgba(24,34,29,0.12)] max-[767px]:h-14 max-[767px]:w-14",
  eyebrow: "m-0 text-[12px] font-black leading-4 text-[#5d6a62]",
  title: "m-0 text-[19px] font-black leading-[24px] text-[#18221d] max-[767px]:text-[17px]",
  muted: "m-0 text-[13px] leading-[18px] text-[#5d6a62]",
  heroActions:
    "grid w-full grid-cols-2 gap-3 max-[420px]:grid-cols-1",
  secondaryButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#d8e0da] bg-white px-3 text-[13px] font-extrabold leading-[18px] text-[#18221d] transition hover:bg-[#eef3f0]",
  dangerButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#b14a3d] bg-white px-3 text-[13px] font-extrabold leading-[18px] text-[#b14a3d] transition hover:bg-[#fff1ee]",
  compactButton:
    "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#d8e0da] bg-white px-2.5 text-[12px] font-extrabold leading-4 text-[#18221d] transition hover:bg-[#eef3f0]",
  compactDangerButton:
    "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#b14a3d] bg-white px-2.5 text-[12px] font-extrabold leading-4 text-[#b14a3d] transition hover:bg-[#fff1ee]",
  metrics: "grid grid-cols-3 gap-0 border-t border-[#d8e0da] pt-3 max-[767px]:grid-cols-1 max-[767px]:gap-0 max-[767px]:divide-y max-[767px]:divide-[#d8e0da] max-[767px]:pt-2",
  metric:
    "grid min-w-0 grid-cols-[52px_minmax(0,1fr)] content-center gap-x-3 gap-y-0.5 border-r border-[#d8e0da] px-3 py-1.5 last:border-r-0 max-[767px]:min-h-[44px] max-[767px]:grid-cols-[34px_auto_auto_minmax(0,1fr)] max-[767px]:items-center max-[767px]:gap-x-2 max-[767px]:gap-y-0 max-[767px]:border-r-0 max-[767px]:px-1 max-[767px]:py-2 [&_dd]:m-0 [&_dd]:font-numeric [&_dd]:text-[19px] [&_dd]:font-black [&_dd]:leading-[24px] max-[767px]:[&_dd]:self-center max-[767px]:[&_dd]:justify-self-start max-[767px]:[&_dd]:text-[17px] max-[767px]:[&_dd]:leading-5 [&_dt]:text-[12px] [&_dt]:font-black [&_dt]:leading-4 [&_dt]:text-[#245c46] max-[767px]:[&_dt]:self-center max-[767px]:[&_dt]:whitespace-nowrap max-[767px]:[&_p]:self-center",
  metricIcon:
    "row-span-4 grid h-11 w-11 place-items-center rounded-full bg-[#eef5f1] text-[#245c46] max-[767px]:row-span-1 max-[767px]:h-7 max-[767px]:w-7",
  progressTrack: "h-2 w-full min-w-[72px] justify-self-stretch overflow-hidden rounded-full bg-[#d8e0da] max-[767px]:col-span-2 max-[767px]:col-start-2 max-[767px]:row-start-2 max-[767px]:h-1.5 max-[767px]:min-w-0",
  progressValue: "h-full rounded-full bg-[#245c46] transition-[width]",
  sidePanel:
    "grid gap-4 rounded-xl border border-[#dfe7df] bg-white p-3.5 shadow-[0_10px_28px_rgba(20,40,30,0.05)] max-[1023px]:block max-[1023px]:border-0 max-[1023px]:bg-transparent max-[1023px]:p-0 max-[1023px]:shadow-none",
  sideTitle: "m-0 text-[14px] font-black leading-5 text-[#18221d] max-[1023px]:hidden",
  tabs:
    "grid gap-1.5 max-[1023px]:grid-cols-3 max-[1023px]:rounded-xl max-[1023px]:border max-[1023px]:border-[#dfe7df] max-[1023px]:bg-white max-[1023px]:p-1 max-[1023px]:shadow-[0_10px_28px_rgba(20,40,30,0.05)] max-[767px]:gap-0",
  tabButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-start gap-2 rounded-lg border px-3 text-left text-[13px] font-extrabold leading-[18px] transition max-[1023px]:justify-center max-[767px]:min-h-[35px] max-[767px]:gap-0 max-[767px]:px-2",
  tabButtonActive:
    "border-[#dce9e2] border-l-4 border-l-[#245c46] bg-[#eef5f1] text-[#245c46] shadow-none ring-0 max-[1023px]:border-l max-[1023px]:border-[#245c46] max-[1023px]:bg-[#245c46] max-[1023px]:text-white",
  tabButtonIdle: "border-transparent bg-transparent text-[#18221d] hover:bg-[#eef3f0] hover:text-[#245c46]",
  bodyGrid: "grid grid-cols-[220px_minmax(0,1fr)] items-start gap-4 max-[1023px]:grid-cols-1 max-[767px]:gap-3",
  section:
    "rounded-xl border border-[#dfe7df] bg-white p-4 shadow-[0_10px_28px_rgba(20,40,30,0.05)] max-[767px]:p-3.5",
  sectionHeader: "mb-3 flex items-start justify-between gap-3",
  sectionTitle: "m-0 text-[17px] font-black leading-[22px] text-[#18221d]",
  field: "grid gap-1.5 [&_label]:text-[13px] [&_label]:font-black [&_label]:leading-[18px] [&_label]:text-[#18221d]",
  input:
    "min-h-11 rounded-lg border border-[#d8e0da] bg-white px-3 text-[14px] leading-5 text-[#18221d] outline-none focus:border-[#245c46]",
  primaryButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#245c46] bg-[#245c46] px-3 text-[13px] font-extrabold leading-[18px] text-white transition hover:bg-[#1f4e39] disabled:cursor-not-allowed disabled:border-[#8aa699] disabled:bg-[#8aa699]",
  avatarGrid: "grid grid-cols-5 gap-2 max-[767px]:grid-cols-6 max-[767px]:gap-1.5",
  avatarChoice:
    "relative aspect-square min-h-12 cursor-pointer overflow-hidden rounded-lg border-2 bg-white p-0 transition focus:outline-none focus:ring-2 focus:ring-[#245c46]",
  list: "grid gap-2",
  listItem:
    "grid gap-2.5 rounded-lg border border-[#d8e0da] bg-[#fbfdfb] p-3 transition hover:border-[#9fb2a7] max-[560px]:p-2.5",
  itemTop: "flex items-start justify-between gap-2",
  itemTitle: "m-0 text-[15px] font-black leading-5 text-[#18221d]",
  completedItem: "grid grid-cols-[104px_minmax(0,1fr)] items-start gap-3 max-[560px]:grid-cols-1",
  completedImage:
    "block aspect-[4/3] h-auto min-h-0 w-full self-start rounded-lg object-cover shadow-[0_8px_18px_rgba(24,34,29,0.10)] max-[560px]:aspect-[16/9]",
  tag: "inline-flex min-h-6 items-center rounded-full bg-[#eef3f0] px-2 text-[12px] font-black leading-4 text-[#245c46]",
  iconButton:
    "inline-flex h-11 min-h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg border border-[#d8e0da] bg-white text-[#18221d] transition hover:bg-[#eef3f0]",
  empty:
    "grid min-h-28 place-items-center rounded-lg border border-dashed border-[#d8e0da] bg-[#f7faf8] px-3 text-center text-[13px] font-bold leading-[18px] text-[#5d6a62]",
  status:
    "rounded-lg border border-[#d8e0da] bg-[#f7faf8] px-3 py-2 text-[13px] font-bold leading-[18px] text-[#5d6a62]",
};

export function MyPage({
  session,
  activeTab = "profile",
  completionRecords,
  onCompletionRecordsChange,
  onProfileChange,
  onReviewDataChange,
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
        onProfileChange?.(nextProfile);
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
  }, [session.user.id, onProfileChange]);

  const completedSummary = useMemo(() => summarizeCompletedMountains(completedMountains), [completedMountains]);
  const completedMountainCount = completedSummary.length;
  const completionProgressPercent = Math.min(100, Math.round((completedMountainCount / mountains.length) * 100));
  const savedAvatarUrl = profile?.avatarUrl || getDefaultAvatarUrl(profile?.avatarKind);
  const editorAvatarUrl = avatarUrl || savedAvatarUrl;
  const displayNameLabel = profile?.displayName || "내 산행 기록";
  const recentMountainName = completedSummary[0]?.mountain?.name ?? "기록 없음";
  const recentMountainDescription = completedSummary[0]?.completedAt
    ? `${formatDate(completedSummary[0].completedAt)} 산행 완료`
    : "기록이 쌓이면 표시됩니다.";
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
        avatarUrl: editorAvatarUrl,
        avatarKind,
      });
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setAvatarUrl(nextProfile.avatarUrl);
      setAvatarKind(nextProfile.avatarKind);
      onProfileChange?.(nextProfile);
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
      avatarUrl={editorAvatarUrl}
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
      onReviewDataChange={onReviewDataChange}
      onOpenMountain={onOpenMountain}
      onStatusMessage={setMessage}
    />
  );

  return (
    <section className={pageClass.shell} aria-label="마이페이지">
      <div className={pageClass.inner}>
        <div className={pageClass.pageIntro}>
          <div className={pageClass.pageHeading}>
            <MountainPanorama />
            <div className="relative z-20">
              <h1 className={pageClass.pageTitle}>마이페이지</h1>
              <p className={pageClass.pageDescription}>나의 산행 기록과 활동을 관리해보세요.</p>
            </div>
          </div>
        </div>

        <header className={pageClass.hero}>
          <div className={pageClass.heroTop}>
            <div className={pageClass.profileSummary}>
              <img className={pageClass.avatar} src={savedAvatarUrl} alt="" aria-hidden="true" />
              <div className="grid min-w-0 gap-1">
                <h2 className={pageClass.title}>{displayNameLabel}</h2>
                <p className="m-0 text-[12px] font-black leading-4 text-[#245c46]">대한민국 100대 명산 도전 중</p>
              </div>
            </div>
            <div className={pageClass.heroActions}>
              <button className={cn(pageClass.secondaryButton, "w-full max-[767px]:min-h-[35px]")} type="button" onClick={onBackToMap}>
                <MapPin size={18} />
                지도 보기
              </button>
              <button className={cn(pageClass.dangerButton, "w-full max-[767px]:min-h-[35px]")} type="button" onClick={onSignOut}>
                <LogOut size={18} />
                로그아웃
              </button>
            </div>
          </div>

          <dl className={pageClass.metrics}>
            <div className={cn(pageClass.metric, "max-[767px]:grid-cols-[34px_auto_auto_minmax(88px,1fr)]")}>
              <div className={cn(pageClass.metricIcon, "max-[767px]:row-span-1")} aria-hidden="true">
                <MountainIcon size={22} className="max-[767px]:h-[18px] max-[767px]:w-[18px]" />
              </div>
              <dt>완료한 산</dt>
              <dd>{completedMountainCount} / {mountains.length}</dd>
              <p className={cn(pageClass.muted, "text-[12px] max-[767px]:hidden")}>
                100대 명산 중 {completionProgressPercent}% 완료
              </p>
              <div className={cn(pageClass.progressTrack, "max-[767px]:!col-span-1 max-[767px]:!col-start-4 max-[767px]:!row-start-1 max-[767px]:self-center")} aria-hidden="true">
                <div className={pageClass.progressValue} style={{ width: `${completionProgressPercent}%` }} />
              </div>
            </div>
            <div className={cn(pageClass.metric, "max-[767px]:grid-cols-[34px_auto_auto_minmax(0,1fr)]")}>
              <div className={pageClass.metricIcon} aria-hidden="true">
                <MessageCircle size={22} className="max-[767px]:h-[18px] max-[767px]:w-[18px]" />
              </div>
              <dt>작성 리뷰</dt>
              <dd>{reviews.length}개</dd>
              <p className={cn(pageClass.muted, "text-[12px] max-[767px]:hidden")}>내가 남긴 한줄평</p>
            </div>
            <div className={cn(pageClass.metric, "max-[767px]:grid-cols-[34px_auto_auto_minmax(0,1fr)]")}>
              <div className={cn(pageClass.metricIcon, "max-[767px]:row-span-1")} aria-hidden="true">
                <Clock size={22} className="max-[767px]:h-[18px] max-[767px]:w-[18px]" />
              </div>
              <dt>최근 산행</dt>
              <dd className="truncate text-[17px] max-[767px]:max-w-[88px] max-[767px]:text-[16px]">{recentMountainName}</dd>
              <p className={cn(pageClass.muted, "text-[12px] max-[767px]:col-start-4 max-[767px]:row-start-1 max-[767px]:min-w-0 max-[767px]:truncate max-[767px]:whitespace-nowrap max-[767px]:text-[13px] max-[767px]:leading-5")}>{recentMountainDescription}</p>
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
                  <span className="max-[767px]:hidden">{getMyPageTabIcon(tab.id)}</span>
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

function MountainPanorama() {
  return <div className={pageClass.mountainBackdrop} aria-hidden="true" />;
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
          <p className={cn(pageClass.muted, "mt-1 text-[12px]")}>프로필 정보를 관리하고 변경할 수 있습니다.</p>
        </div>
        <UserRound size={19} className="text-[#245c46] max-[767px]:hidden" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-5 border-t border-[#d8e0da] pt-4 max-[767px]:grid-cols-1 max-[767px]:gap-4">
        <div className="grid gap-3">
          <h3 className="m-0 text-[13px] font-black leading-[18px] text-[#18221d]">프로필 사진</h3>
          <div className="grid justify-items-center gap-2 rounded-xl bg-transparent p-0">
            <img className="h-20 w-20 rounded-full border-[3px] border-white object-cover shadow-[0_10px_24px_rgba(24,34,29,0.12)]" src={avatarUrl} alt="" aria-hidden="true" />
          </div>

          <div className={pageClass.avatarGrid} aria-label="기본 프로필 이미지 선택">
            {defaultProfileAvatars.map((avatar) => (
              <button
                key={avatar.id}
                className={cn(
                  pageClass.avatarChoice,
                  avatarKind === avatar.id ? "border-[#245c46] bg-white shadow-[0_8px_18px_rgba(36,92,70,0.16)]" : "border-[#d8e0da]",
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
                "col-span-full flex h-11 min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border-dashed text-[#245c46] max-[767px]:col-span-1 max-[767px]:aspect-square max-[767px]:h-auto max-[767px]:min-h-12 max-[767px]:flex-col max-[767px]:gap-0.5 max-[767px]:px-1",
                avatarKind === "custom"
                  ? "border-[#245c46] bg-white shadow-[0_8px_18px_rgba(36,92,70,0.16)]"
                  : "border-[#9fb2a7] bg-white",
              )}
              type="button"
              aria-label="사진 추가"
              onClick={onUploadClick}
              disabled={isUploadingAvatar}
            >
              <ImagePlus size={18} />
              <span className="text-[13px] font-black leading-[18px] max-[767px]:text-[11px] max-[767px]:leading-3">사진 추가</span>
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

        <div className="grid content-between gap-4 border-l border-[#d8e0da] pl-5 max-[767px]:border-l-0 max-[767px]:border-t max-[767px]:pl-0 max-[767px]:pt-4">
          <div className="grid gap-3">
            <div className={pageClass.field}>
              <label htmlFor="profile-display-name">닉네임</label>
              <input
                className={pageClass.input}
                id="profile-display-name"
                value={displayName}
                maxLength={20}
                onChange={(event) => onDisplayNameChange(event.target.value)}
              />
            </div>

            <ul className="m-0 grid list-disc gap-1.5 pl-4 text-[12px] font-bold leading-[18px] text-[#5d6a62]">
              <li>2자 이상, 20자 이하로 입력해주세요.</li>
              <li>닉네임은 중복 여부와 관계없이 저장할 수 있습니다.</li>
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
        <MountainIcon size={19} className="text-[#245c46] max-[767px]:hidden" aria-hidden="true" />
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
                <div className="grid min-w-0 gap-2.5">
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
                      <button className={pageClass.compactButton} type="button" onClick={() => onOpenMountain(record.mountain!)}>
                        상세 보기
                        <ChevronRight size={15} />
                      </button>
                    ) : null}
                    <button
                      className={pageClass.compactDangerButton}
                      type="button"
                      onClick={() => onRemoveCompleted(record.mountainId)}
                      disabled={removingMountainId === record.mountainId}
                    >
                      <Trash2 size={15} />
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
        <MessageCircle size={19} className="text-[#245c46] max-[767px]:hidden" aria-hidden="true" />
      </div>

      {reviews.length > 0 ? (
        <div className={pageClass.list}>
          {reviews.map((review) => {
            const mountain = findMountain(review.mountainId);
            return (
              <article key={review.id} className={pageClass.listItem}>
                <div className={pageClass.itemTop}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {review.authorAvatarUrl ? (
                        <img
                          className="h-9 w-9 shrink-0 rounded-full border border-[#d8e0da] bg-[#eef3f0] object-cover"
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
                      <p className={cn(pageClass.muted, "text-[12px] font-bold")}>
                        {formatRouteEndpoints(review.routeStartPoint, review.routeEndPoint)}
                      </p>
                    ) : null}
                  </div>
                  <span className={cn("inline-flex min-h-6 items-center rounded-full border px-2 text-[11px] font-semibold text-[#2d3932]", getReviewDifficultyBadgeClass(review.difficulty))}>{review.difficulty}</span>
                </div>
                <p className="m-0 text-[12px] font-medium leading-[18px] text-[#18221d]">{review.body}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#5d6a62]">
                  <span className="font-semibold">{review.durationLabel}</span>
                  <span>{review.authorName}</span>
                  {review.imageUrls.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Camera size={15} />
                      사진 {review.imageUrls.length}장
                    </span>
                  ) : null}
                </div>
                {mountain ? (
                  <button className={pageClass.compactButton} type="button" onClick={() => onOpenMountain(mountain)}>
                    {review.mountainName} 상세페이지
                    <ChevronRight size={15} />
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
  onReviewDataChange,
  onOpenMountain,
  onStatusMessage,
}: {
  reviews: UserReviewSummary[];
  currentUserId: string;
  onReviewsChange: (reviews: UserReviewSummary[]) => void;
  onReviewDataChange?: () => void;
  onOpenMountain: (mountain: Mountain) => void;
  onStatusMessage: (message: string | null) => void;
}) {
  const [editingReview, setEditingReview] = useState<UserReviewSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [mobileReviewStep, setMobileReviewStep] = useState<1 | 2>(1);
  const [isMobileReviewSheetMounted, setIsMobileReviewSheetMounted] = useState(false);
  const [isMobileReviewSheetVisible, setIsMobileReviewSheetVisible] = useState(false);
  const [lightboxState, setLightboxState] = useState<MyPageReviewLightboxState | null>(null);
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

  useEffect(() => {
    if (!usesMobileReviewSheet) {
      setIsMobileReviewSheetMounted(false);
      setIsMobileReviewSheetVisible(false);
    }
  }, [usesMobileReviewSheet]);

  const closeEditor = () => {
    resetDraft();
    setEditingReview(null);
    setFormMessage(null);
    setMobileReviewStep(1);
    setIsMobileReviewSheetMounted(false);
    setIsMobileReviewSheetVisible(false);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const closeMobileEditor = () => {
    setIsMobileReviewSheetVisible(false);
    window.setTimeout(closeEditor, 300);
  };

  const startEditingReview = (review: UserReviewSummary) => {
    setEditingReview(review);
    startEditingDraft(toMountainReview(review));
    setFormMessage(null);
    setMobileReviewStep(1);
    if (usesMobileReviewSheet) {
      setIsMobileReviewSheetMounted(true);
      setIsMobileReviewSheetVisible(false);
      window.setTimeout(() => setIsMobileReviewSheetVisible(true), 24);
    }
    onStatusMessage(null);
  };

  const openReviewLightbox = (review: UserReviewSummary, imageIndex: number) => {
    if (review.imageUrls.length === 0) {
      return;
    }

    setLightboxState({
      review,
      imageIndex: clampNumber(imageIndex, 0, review.imageUrls.length - 1),
    });
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
      onReviewDataChange?.();
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
      onReviewDataChange?.();
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
  const mobileEditorForm = editingReview ? (
    <MyPageReviewEditMobileForm
      review={editingReview}
      step={mobileReviewStep}
      difficultyIndex={difficultyIndex}
      durationMinutes={durationMinutes}
      reviewText={reviewText}
      trimmedReviewText={trimmedReviewText}
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
      onBack={() => setMobileReviewStep(1)}
      onNext={() => setMobileReviewStep(2)}
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
        <MessageCircle size={19} className="text-[#245c46] max-[767px]:hidden" aria-hidden="true" />
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
                  "relative grid rounded-md border border-[#d8e0da] bg-white p-3 shadow-[0_10px_24px_rgba(24,34,29,0.045)]",
                  "grid-cols-[minmax(0,0.92fr)_minmax(240px,1fr)] gap-x-8 gap-y-3 max-[840px]:grid-cols-1 max-[840px]:gap-x-0",
                  isEditing && "border-[#245c46] ring-2 ring-[#245c46]/15",
                )}
              >
                <div className="grid min-w-0 content-start gap-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    {review.authorAvatarUrl ? (
                      <img
                        className="h-9 w-9 shrink-0 rounded-full border border-[#d8e0da] bg-[#eef3f0] object-cover"
                        src={review.authorAvatarUrl}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d8e0da] bg-[#eef3f0] text-[#245c46]"
                        role="img"
                        aria-label="기본 프로필"
                      >
                        <UserRound size={19} aria-hidden="true" />
                      </span>
                    )}
                      <div className="grid min-w-0 flex-1 gap-1">
                        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <strong className="block max-w-full truncate text-[14px] font-extrabold leading-5 text-[#18221d]">
                              {review.authorName}
                            </strong>
                            <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#e7f3e4] px-2 py-0.5 text-xs font-medium text-[#237a1f]">
                              <span className="truncate">{review.mountainName}</span>
                            </span>
                            <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#eef3f0] px-2 py-0.5 text-xs font-medium text-[#245c46]">
                              <span className="truncate">{review.routeName}</span>
                            </span>
                          </div>
                          <time className="block shrink-0 text-right font-numeric text-xs font-bold leading-5 text-[#5d6a62]">
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

                  <p className="m-0 min-w-0 whitespace-pre-line break-words text-[13px] font-medium leading-5 text-[#18221d] [overflow-wrap:anywhere]">
                    {review.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex min-h-6 items-center rounded-full border px-2 text-[11px] font-semibold text-[#2d3932]", getReviewDifficultyBadgeClass(review.difficulty))}>
                      난이도 {review.difficulty}
                    </span>
                    <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-[#d8e0da] bg-[#f1f5f7] px-2 font-numeric text-[11px] font-semibold text-[#49524d]">
                      <Clock size={13} />
                      {review.durationLabel}
                    </span>
                  </div>
                </div>

                <MyPageReviewPhotoStrip review={review} onPhotoOpen={openReviewLightbox} />

                <div className="col-span-2 flex flex-wrap items-center gap-2 max-[840px]:col-span-1">
                  {mountain ? (
                    <button className={pageClass.compactButton} type="button" onClick={() => onOpenMountain(mountain)}>
                      {review.mountainName} 상세페이지
                      <ChevronRight size={15} />
                    </button>
                  ) : null}
                  <button
                    className={pageClass.compactButton}
                    type="button"
                    aria-label={`${review.mountainName} 한줄평 수정`}
                    onClick={() => startEditingReview(review)}
                  >
                    <Edit3 size={15} />
                    수정
                  </button>
                  <button
                    className={pageClass.compactDangerButton}
                    type="button"
                    aria-label={`${review.mountainName} 한줄평 삭제`}
                    disabled={deletingReviewId === review.id}
                    onClick={() => void removeReview(review)}
                  >
                    <Trash2 size={15} />
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

      {editingReview && usesMobileReviewSheet && isMobileReviewSheetMounted ? (
        <MyPageReviewEditSheet
          review={editingReview}
          step={mobileReviewStep}
          isSubmitting={isSubmitting}
          isVisible={isMobileReviewSheetVisible}
          onClose={closeMobileEditor}
        >
          {mobileEditorForm}
        </MyPageReviewEditSheet>
      ) : null}
      <MyPageReviewPhotoLightbox
        state={lightboxState}
        onClose={() => setLightboxState(null)}
        onNavigate={(imageIndex) =>
          setLightboxState((currentState) =>
            currentState
              ? {
                  ...currentState,
                  imageIndex,
                }
              : currentState,
          )
        }
      />
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
  const totalSelectedPhotoCount = existingImageUrls.length + uploadedPhotos.length;
  const routeLabel =
    review.routeStartPoint && review.routeEndPoint
      ? `${review.routeStartPoint} > ${review.routeEndPoint}`
      : review.routeName;
  const updateDurationFromParts = (hours: number, minutes: number) => {
    onDurationChange(clampNumber(Math.trunc(hours) * 60 + Math.trunc(minutes), 30, 600));
  };

  return (
    <div className="col-span-2 overflow-hidden rounded-md border border-[#d8e0da] bg-white shadow-[0_10px_28px_rgba(24,34,29,0.045)] max-[840px]:col-span-1">
      <h3 className="m-0 px-6 pt-6 text-[17px] font-black leading-[22px] text-[#18221d] max-[560px]:px-4 max-[560px]:pt-5">
        코스 평가
      </h3>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,1.08fr)] grid-rows-[auto_auto_auto] gap-3 px-5 pt-5 max-[1100px]:grid-cols-1 max-[1100px]:grid-rows-none max-[560px]:px-4 max-[560px]:pt-4">
        <div className="col-start-1 row-start-1 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[1100px]:col-auto max-[1100px]:row-auto">
          <label
            className="mb-3 block text-center text-base font-extrabold leading-6 text-[#18221d]"
            htmlFor={`course-feedback-route-${review.id}`}
          >
            코스를 선택해주세요
          </label>
          <div className="relative">
            <select
              id={`course-feedback-route-${review.id}`}
              className="h-11 w-full appearance-none rounded-md border border-[#d8e0da] bg-white px-3 pr-10 text-sm font-bold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
              value={review.routeName}
              disabled
              onChange={() => undefined}
            >
              <option value={review.routeName}>{routeLabel}</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#18221d]"
              size={18}
              aria-hidden="true"
            />
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 max-[560px]:grid-cols-1">
            <label className="grid min-w-0 gap-1.5 text-sm font-extrabold text-[#18221d]">
              출발지
              <input
                className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] outline-none transition placeholder:text-[#8a9690] read-only:bg-[#f4f8f6] read-only:text-[#5d6a62] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                value={review.routeStartPoint ?? ""}
                placeholder="출발지 입력"
                readOnly
                disabled
                onChange={() => undefined}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-extrabold text-[#18221d]">
              도착지
              <input
                className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] outline-none transition placeholder:text-[#8a9690] read-only:bg-[#f4f8f6] read-only:text-[#5d6a62] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                value={review.routeEndPoint ?? ""}
                placeholder="도착지 입력"
                readOnly
                disabled
                onChange={() => undefined}
              />
            </label>
          </div>
        </div>

        <MyPageEvaluationPicker
          className="col-start-1 row-start-2 max-[1100px]:col-auto max-[1100px]:row-auto"
          title="난이도는 어떠셨나요?"
          options={difficultyEvaluationOptions}
          activeIndex={difficultyIndex}
          onChange={(index) => {
            if (!isSubmitting) {
              onDifficultyChange(index);
            }
          }}
        />

        <div className="col-start-1 row-start-3 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[1100px]:col-auto max-[1100px]:row-auto">
          <strong className="block text-center text-[15px] font-extrabold leading-5 text-[#18221d]">
            소요시간은 얼마나 걸렸나요?
          </strong>
          <div className="mx-auto mt-4 grid max-w-[320px] grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="relative">
                <input
                  className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 pr-11 text-right font-numeric text-[17px] font-extrabold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                  type="number"
                  min={0}
                  max={10}
                  inputMode="numeric"
                  value={durationHours}
                  disabled={isSubmitting}
                  aria-label="소요시간 시간"
                  onChange={(event) =>
                    updateDurationFromParts(
                      clampNumber(Number(event.target.value) || 0, 0, 10),
                      durationRemainderMinutes,
                    )
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5d6a62]">
                  시간
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="relative">
                <input
                  className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 pr-8 text-right font-numeric text-[17px] font-extrabold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={durationRemainderMinutes}
                  disabled={isSubmitting}
                  aria-label="소요시간 분"
                  onChange={(event) =>
                    updateDurationFromParts(
                      durationHours,
                      clampNumber(Number(event.target.value) || 0, 0, 59),
                    )
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5d6a62]">
                  분
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-start-2 row-span-3 row-start-1 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[1100px]:col-auto max-[1100px]:row-auto max-[1100px]:row-span-1">
          <strong className="mb-3 block text-center text-[15px] font-extrabold leading-5 text-[#18221d]">
            한줄평을 남겨주세요!
          </strong>
          <textarea
            maxLength={100}
            value={reviewText}
            placeholder="코스에 대한 느낌을 자유롭게 남겨주세요."
            className="min-h-[108px] w-full resize-y rounded-md border border-[#d8e0da] p-3 text-[15px] font-medium leading-6 text-[#18221d] outline-none transition placeholder:text-[#8a9690] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
            disabled={isSubmitting}
            onChange={(event) => onReviewTextChange(event.target.value)}
          />
          <span className="mt-1 block text-right font-numeric text-sm font-bold text-[#5d6a62]">
            {reviewText.length}/100
          </span>

          <div className="mt-2.5">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <strong className="text-[15px] font-extrabold text-[#18221d]">
                사진을 추가해주세요!
              </strong>
              <span className="text-xs font-bold text-[#5d6a62]">
                (최대 5장)
              </span>
            </div>
            <input
              ref={photoInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              disabled={isSubmitting || totalSelectedPhotoCount >= 5}
              onChange={onPhotoSelect}
            />
            <div className="grid grid-cols-[92px_repeat(3,minmax(0,1fr))] gap-2 max-[560px]:grid-cols-2">
              <button
                className="grid min-h-[82px] place-items-center content-center gap-1 rounded-md border border-[#d8e0da] bg-white px-2 text-xs font-extrabold text-[#5d6a62] transition hover:bg-[#f7faf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={isSubmitting || totalSelectedPhotoCount >= 5}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera size={20} aria-hidden="true" />
                사진 추가
              </button>
              {existingImageUrls.map((imageUrl, index) => (
                <div
                  key={imageUrl}
                  className="relative min-h-[82px] overflow-hidden rounded-md bg-[#eef3f0]"
                >
                  <img
                    className="h-full min-h-[82px] w-full object-cover"
                    src={imageUrl}
                    alt={`기존 한줄평 사진 ${index + 1}`}
                  />
                  <button
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border-0 bg-black/70 text-white"
                    type="button"
                    aria-label={`기존 한줄평 사진 ${index + 1} 삭제`}
                    disabled={isSubmitting}
                    onClick={() => onRemoveExistingImage(imageUrl)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {uploadedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative min-h-[82px] overflow-hidden rounded-md bg-[#eef3f0]"
                >
                  <img
                    className="h-full min-h-[82px] w-full object-cover"
                    src={photo.url}
                    alt={photo.name}
                  />
                  <button
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border-0 bg-black/70 text-white"
                    type="button"
                    aria-label={`${photo.name} 사진 제거`}
                    disabled={isSubmitting}
                    onClick={() => onRemoveUploadedPhoto(photo.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs font-semibold leading-5 text-[#5d6a62]">
              <li>· JPG, PNG 파일만 가능 (최대 10MB)</li>
              <li>· 사진은 최대 5장까지 등록할 수 있습니다.</li>
            </ul>
          </div>

          {formMessage ? (
            <p className="m-0 mt-3 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
              {formMessage}
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="min-h-11 w-full rounded-md border-0 bg-[#166b3d] px-4 text-sm font-black text-white transition hover:bg-[#125b34] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!reviewText.trim() || isSubmitting}
              onClick={onSave}
            >
              {isSubmitting ? "수정 중..." : "수정 저장"}
            </button>
            <button
              className="min-h-10 w-full rounded-md border border-[#d8e0da] bg-white px-4 text-sm font-black text-[#18221d] transition hover:bg-[#f7faf8]"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              수정 취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyPageReviewEditMobileForm({
  review,
  step,
  difficultyIndex,
  durationMinutes,
  reviewText,
  trimmedReviewText,
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
  onBack,
  onNext,
  onSave,
}: {
  review: UserReviewSummary;
  step: 1 | 2;
  difficultyIndex: number;
  durationMinutes: number;
  reviewText: string;
  trimmedReviewText: string;
  existingImageUrls: string[];
  uploadedPhotos: Array<{ id: string; file: File; url: string; name: string }>;
  formMessage: string | null;
  isSubmitting: boolean;
  photoInputRef: MutableRefObject<HTMLInputElement | null>;
  onDifficultyChange: (index: number) => void;
  onDurationChange: (minutes: number) => void;
  onReviewTextChange: (value: string) => void;
  onPhotoSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveExistingImage: (imageUrl: string) => void;
  onRemoveUploadedPhoto: (photoId: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
}) {
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainderMinutes = durationMinutes % 60;
  const totalSelectedPhotoCount = existingImageUrls.length + uploadedPhotos.length;
  const routeLabel =
    review.routeStartPoint && review.routeEndPoint
      ? `${review.routeStartPoint} > ${review.routeEndPoint}`
      : review.routeName;
  const updateDurationFromParts = (hours: number, minutes: number) => {
    onDurationChange(clampNumber(Math.trunc(hours) * 60 + Math.trunc(minutes), 30, 600));
  };

  if (step === 1) {
    return (
      <div className="grid gap-3">
        <div className="rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-3">
          <label
            className="mb-2 block text-[14px] font-extrabold leading-5 text-[#18221d]"
            htmlFor={`course-feedback-route-mobile-${review.id}`}
          >
            코스 선택
          </label>
          <div className="relative">
            <select
              id={`course-feedback-route-mobile-${review.id}`}
              className="h-11 w-full appearance-none rounded-md border border-[#d8e0da] bg-white px-3 pr-10 text-sm font-bold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
              value={review.routeName}
              disabled
              onChange={() => undefined}
            >
              <option value={review.routeName}>{routeLabel}</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#18221d]"
              size={18}
              aria-hidden="true"
            />
          </div>
          <div className="mt-2.5 grid min-w-0 gap-2">
            <label className="grid min-w-0 gap-1.5 text-[13px] font-extrabold text-[#18221d]">
              출발지
              <input
                className="h-10 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] outline-none transition placeholder:text-[#8a9690] read-only:bg-[#f4f8f6] read-only:text-[#5d6a62] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                value={review.routeStartPoint ?? ""}
                placeholder="출발지 입력"
                readOnly
                disabled
                onChange={() => undefined}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-[13px] font-extrabold text-[#18221d]">
              도착지
              <input
                className="h-10 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] outline-none transition placeholder:text-[#8a9690] read-only:bg-[#f4f8f6] read-only:text-[#5d6a62] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                value={review.routeEndPoint ?? ""}
                placeholder="도착지 입력"
                readOnly
                disabled
                onChange={() => undefined}
              />
            </label>
          </div>
        </div>

        <MyPageEvaluationPicker
          title="난이도는 어떠셨나요?"
          options={difficultyEvaluationOptions}
          activeIndex={difficultyIndex}
          onChange={(index) => {
            if (!isSubmitting) {
              onDifficultyChange(index);
            }
          }}
        />

        <div className="rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-3">
          <strong className="block text-[14px] font-extrabold leading-5 text-[#18221d]">
            소요시간
          </strong>
          <p className="m-0 mt-1 break-keep text-[13px] font-semibold leading-5 text-[#2d3932]">
            산행 시작부터 하산 완료까지 걸린 전체 시간입니다.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="relative">
              <input
                className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 pr-11 text-right font-numeric text-[17px] font-extrabold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                type="number"
                min={0}
                max={10}
                inputMode="numeric"
                value={durationHours}
                disabled={isSubmitting}
                aria-label="소요시간 시간"
                onChange={(event) =>
                  updateDurationFromParts(
                    clampNumber(Number(event.target.value) || 0, 0, 10),
                    durationRemainderMinutes,
                  )
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5d6a62]">
                시간
              </span>
            </div>
            <div className="relative">
              <input
                className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 pr-8 text-right font-numeric text-[17px] font-extrabold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                value={durationRemainderMinutes}
                disabled={isSubmitting}
                aria-label="소요시간 분"
                onChange={(event) =>
                  updateDurationFromParts(
                    durationHours,
                    clampNumber(Number(event.target.value) || 0, 0, 59),
                  )
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5d6a62]">
                분
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white pt-1">
          <button
            className="min-h-11 w-full rounded-md border-0 bg-[#166b3d] px-3 text-[13px] font-black text-white transition hover:bg-[#125b34] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isSubmitting}
            onClick={onNext}
          >
            다음
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[190px] flex-[1.15] flex-col rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-3">
        <strong className="mb-2 block text-[14px] font-extrabold leading-5 text-[#18221d]">
          한줄평
        </strong>
        <textarea
          maxLength={100}
          value={reviewText}
          placeholder="코스에 대한 느낌을 자유롭게 남겨주세요."
          className="min-h-0 flex-1 resize-none rounded-md border border-[#d8e0da] p-2.5 text-sm font-medium leading-5 text-[#18221d] outline-none transition placeholder:text-[#8a9690] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
          disabled={isSubmitting}
          onChange={(event) => onReviewTextChange(event.target.value)}
        />
        <span className="mt-1 block text-right font-numeric text-sm font-bold text-[#5d6a62]">
          {reviewText.length}/100
        </span>
      </div>

      <div className="flex flex-col rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-3">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <strong className="text-[14px] font-extrabold text-[#18221d]">
            사진 추가
          </strong>
          <span className="text-xs font-bold text-[#5d6a62]">
            최대 5장
          </span>
        </div>
        <input
          ref={photoInputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={isSubmitting || totalSelectedPhotoCount >= 5}
          onChange={onPhotoSelect}
        />
        {totalSelectedPhotoCount === 0 ? (
          <button
            className="grid min-h-[92px] w-full place-items-center content-center gap-1 rounded-md border border-[#d8e0da] bg-white px-2 text-xs font-extrabold text-[#5d6a62] transition hover:bg-[#f7faf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25 disabled:cursor-not-allowed disabled:opacity-45"
            type="button"
            disabled={isSubmitting || totalSelectedPhotoCount >= 5}
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera size={18} aria-hidden="true" />
            사진 추가
          </button>
        ) : (
          <div className="relative">
            <div
              className={cn(
                "flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                totalSelectedPhotoCount >= 5 ? "pr-0" : "pr-11",
              )}
            >
              {existingImageUrls.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-mobile`}
                  className="relative h-[88px] w-[88px] flex-none overflow-hidden rounded-md bg-[#eef3f0]"
                >
                  <img
                    className="h-full w-full object-cover"
                    src={imageUrl}
                    alt={`기존 한줄평 사진 ${index + 1}`}
                  />
                  <button
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-0 bg-black/70 text-white"
                    type="button"
                    aria-label={`기존 한줄평 사진 ${index + 1} 삭제`}
                    disabled={isSubmitting}
                    onClick={() => onRemoveExistingImage(imageUrl)}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {uploadedPhotos.map((photo) => (
                <div
                  key={`${photo.id}-mobile`}
                  className="relative h-[88px] w-[88px] flex-none overflow-hidden rounded-md bg-[#eef3f0]"
                >
                  <img
                    className="h-full w-full object-cover"
                    src={photo.url}
                    alt={photo.name}
                  />
                  <button
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-0 bg-black/70 text-white"
                    type="button"
                    aria-label={`${photo.name} 사진 제거`}
                    disabled={isSubmitting}
                    onClick={() => onRemoveUploadedPhoto(photo.id)}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            {totalSelectedPhotoCount < 5 ? (
              <button
                className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full border border-[#d8e0da] bg-white text-[#5d6a62] shadow-[0_6px_16px_rgba(24,34,29,0.14)] transition hover:bg-[#f7faf8] disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                aria-label="사진 추가"
                disabled={isSubmitting}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}
        <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs font-semibold leading-5 text-[#5d6a62]">
          <li>· JPG, PNG 파일만 가능 (최대 10MB)</li>
          <li>· 사진은 최대 5장까지 등록할 수 있습니다.</li>
        </ul>
      </div>

      {formMessage ? (
        <p className="m-0 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
          {formMessage}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 mt-auto grid grid-cols-[auto_minmax(0,1fr)] gap-2 bg-white pt-2 shadow-[0_-10px_18px_rgba(255,255,255,0.92)]">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-[#d8e0da] bg-white px-3 text-[13px] font-black text-[#18221d] transition hover:bg-[#f7faf8]"
          type="button"
          disabled={isSubmitting}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          이전
        </button>
        <button
          className="min-h-11 rounded-md border-0 bg-[#166b3d] px-3 text-[13px] font-black text-white transition hover:bg-[#125b34] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!trimmedReviewText || isSubmitting}
          onClick={onSave}
        >
          {isSubmitting ? "수정 중..." : "수정 저장"}
        </button>
      </div>
    </div>
  );
}

function MyPageEvaluationPicker({
  className,
  title,
  options,
  activeIndex,
  onChange,
}: {
  className?: string;
  title: string;
  options: readonly string[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[560px]:p-3 [&>strong]:mb-5 [&>strong]:block [&>strong]:text-center [&>strong]:text-[15px] [&>strong]:font-extrabold [&>strong]:leading-5 max-[560px]:[&>strong]:mb-3 max-[560px]:[&>strong]:text-[14px] max-[560px]:[&>strong]:leading-5",
        className,
      )}
    >
      <strong>{title}</strong>
      <div className="grid grid-cols-5 gap-2 max-[560px]:gap-1">
        {options.map((option, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={option}
              className={cn(
                "grid min-w-0 cursor-pointer justify-items-center gap-2 rounded-md border-0 bg-transparent px-1 py-1 text-[#627168] transition hover:bg-[#f7f8f7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e10f07]/40 max-[560px]:gap-1",
                isActive && "text-[#e10f07]",
              )}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(index)}
            >
              <MyPageFeedbackEvaluationIcon index={index} isActive={isActive} />
              <span className="break-keep text-center text-[13px] font-semibold leading-[18px] max-[560px]:text-[11px] max-[560px]:leading-4">
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MyPageFeedbackEvaluationIcon({
  index,
  isActive,
}: {
  index: number;
  isActive: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const iconSrc = difficultyEvaluationIconSrcs[index];

  return (
    <span
      className={cn(
        "grid h-11 w-11 place-items-center overflow-hidden rounded-full border bg-[#f7f8f7] p-[7px] max-[560px]:h-9 max-[560px]:w-9 max-[560px]:p-1.5",
        isActive
          ? "border-[#e10f07] bg-[#fff1f1] text-[#e10f07]"
          : "border-[#d8e0da]",
      )}
      aria-hidden="true"
    >
      {!imageFailed && iconSrc ? (
        <img
          className="h-[120%] w-[120%] max-w-none object-contain -mt-[3px]"
          src={iconSrc}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <MyPageDifficultyEvaluationIcon level={index} />
      )}
    </span>
  );
}

function MyPageDifficultyEvaluationIcon({
  className,
  level,
}: {
  className?: string;
  level: number;
}) {
  const peakCount = Math.min(Math.max(level, 0), 3);
  const showFlag = level >= 4;

  if (level === 0) {
    return (
      <svg
        className={className}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 43c6.5-8.5 13-12.5 19.5-12.5S41 34.5 55 43"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 45h40"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {peakCount >= 1 ? (
        <path
          d="M8 45 20 23l12 22Z"
          fill="currentColor"
          opacity={peakCount === 1 ? "0.92" : "0.72"}
        />
      ) : null}
      {peakCount >= 2 ? (
        <path
          d="M22 45 34 18l13 27Z"
          fill="currentColor"
          opacity={peakCount === 2 ? "0.92" : "0.82"}
        />
      ) : null}
      {peakCount >= 3 ? (
        <path d="M36 45 47 24l11 21Z" fill="currentColor" opacity="0.92" />
      ) : null}
      <path
        d="M11 45h43"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {showFlag ? (
        <>
          <path
            d="M47 13v25"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M48 14h10l-3.2 4.8L58 24H48Z" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

function MyPageReviewPhotoStrip({
  review,
  onPhotoOpen,
}: {
  review: UserReviewSummary;
  onPhotoOpen: (review: UserReviewSummary, imageIndex: number) => void;
}) {
  if (review.imageUrls.length === 0) {
    return (
      <div className="grid min-h-[92px] place-items-center self-stretch rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] text-[12px] font-bold text-[#5d6a62] max-[767px]:hidden">
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
          <button
            key={`${imageUrl}-${index}`}
            className="relative h-[92px] overflow-hidden rounded-md border-0 bg-[#eef3f0] p-0 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/30"
            type="button"
            aria-label={`${review.routeName} 한줄평 사진 ${index + 1} 확대`}
            onClick={() => onPhotoOpen(review, index)}
          >
            <img
              className="h-full w-full object-cover"
              src={imageUrl}
              alt={`${review.routeName} 한줄평 사진 ${index + 1}`}
              loading="lazy"
            />
            {showImageCountOverlay ? (
              <span className="absolute inset-0 grid place-items-center bg-black/55 font-numeric text-[14px] font-black text-white">
                +{remainingImageCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MyPageReviewPhotoLightbox({
  state,
  onClose,
  onNavigate,
}: {
  state: MyPageReviewLightboxState | null;
  onClose: () => void;
  onNavigate: (imageIndex: number) => void;
}) {
  useEffect(() => {
    if (!state) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, state]);

  if (!state || state.review.imageUrls.length === 0) {
    return null;
  }

  const { review, imageIndex } = state;
  const imageUrls = review.imageUrls;
  const safeImageIndex = clampNumber(imageIndex, 0, imageUrls.length - 1);
  const currentImageUrl = imageUrls[safeImageIndex];
  const canNavigate = imageUrls.length > 1;
  const previousIndex =
    safeImageIndex === 0 ? imageUrls.length - 1 : safeImageIndex - 1;
  const nextIndex =
    safeImageIndex === imageUrls.length - 1 ? 0 : safeImageIndex + 1;

  return (
    <div
      className="fixed inset-0 z-[90] grid h-screen w-screen place-items-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${review.routeName} 한줄평 사진 확대`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-full max-h-[calc(100vh-32px)] w-full min-w-0 max-w-[calc(100vw-32px)] items-center justify-center">
        <div className="absolute left-0 right-0 top-0 z-10 flex min-h-11 items-center justify-between gap-3 px-2 pt-2 text-white">
          <div className="min-w-0">
            <strong className="block truncate text-base font-black">
              {review.routeName}
            </strong>
            <span className="font-numeric text-sm font-bold text-white/75">
              {safeImageIndex + 1} / {imageUrls.length}
            </span>
          </div>
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 bg-black/25 text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            type="button"
            aria-label="확대 사진 닫기"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>

        <img
          className="block max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] rounded-md object-contain shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
          src={currentImageUrl}
          alt={`${review.routeName} 한줄평 사진 ${safeImageIndex + 1}`}
        />

        {canNavigate ? (
          <>
            <button
              className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/35 text-white transition hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-[560px]:left-0"
              type="button"
              aria-label="이전 사진 보기"
              onClick={() => onNavigate(previousIndex)}
            >
              <ArrowLeft size={22} />
            </button>
            <button
              className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/35 text-white transition hover:bg-black/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-[560px]:right-0"
              type="button"
              aria-label="다음 사진 보기"
              onClick={() => onNavigate(nextIndex)}
            >
              <ArrowLeft className="rotate-180" size={22} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MyPageReviewEditSheet({
  review,
  step,
  children,
  isSubmitting,
  isVisible,
  onClose,
}: {
  review: UserReviewSummary;
  step: 1 | 2;
  children: ReactNode;
  isSubmitting: boolean;
  isVisible: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end bg-black/45 transition-opacity duration-300 ease-out",
        isVisible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      role="presentation"
    >
      <button className="absolute inset-0 h-full w-full cursor-default" type="button" aria-label="수정 닫기" onClick={onClose} />
      <section
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-t-[18px] bg-white shadow-[0_-18px_60px_rgba(0,0,0,0.28)] transition-[height,transform] duration-300 ease-out will-change-transform",
          isVisible ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          height:
            step === 1
              ? "min(476px, calc(70dvh - 12px))"
              : "min(406px, calc(70dvh - 12px))",
          maxHeight: "calc(100dvh - 16px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-page-mobile-review-sheet-title"
      >
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[13px] font-black leading-5 text-[#245c46]">
              {step}/2
            </span>
            <h3
              id="my-page-mobile-review-sheet-title"
              className="m-0 truncate text-[15px] font-black leading-5 text-[#18221d]"
            >
              {step === 1 ? "코스 평가" : "한줄평 작성"}
            </h3>
          </div>
          <button
            className="grid h-10 w-10 flex-none place-items-center rounded-md border-0 bg-transparent text-[#18221d]"
            type="button"
            aria-label={`${review.mountainName} 한줄평 수정 닫기`}
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
          {children}
        </div>
      </section>
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
