import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MutableRefObject, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Camera,
  Check,
  ChevronRight,
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
  completionRecords: CompletionRecord[];
  onCompletionRecordsChange: (records: CompletionRecord[]) => void;
  onBackToMap: () => void;
  onOpenMountain: (mountain: Mountain) => void;
  onSignOut: () => void;
};

type LoadState = "loading" | "ready" | "error";

const manualCourseRouteName = "코스 직접 입력";
const difficultyEvaluationOptions = ["쉬움", "보통", "약간 어려움", "어려움", "매우 어려움"];
const difficultyDefaultIndex: Record<MountainGuideDifficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 3,
  extreme: 4,
  unknown: 2,
};

const pageClass = {
  shell: "min-h-[calc(100vh-68px)] bg-[#f5f7f4]",
  inner: "mx-auto grid w-[1180px] max-w-[calc(100%-40px)] gap-6 py-8 max-[760px]:w-full max-[760px]:max-w-none max-[760px]:px-4 max-[760px]:py-5",
  hero:
    "grid gap-5 rounded-lg border border-[#d8e0da] bg-white p-6 shadow-[0_16px_50px_rgba(24,34,29,0.08)] max-[760px]:p-4",
  heroTop: "flex items-start justify-between gap-4 max-[760px]:grid",
  profileSummary: "flex min-w-0 items-center gap-4",
  avatar:
    "h-20 w-20 flex-none rounded-full border-4 border-[#eef3f0] object-cover shadow-[0_10px_28px_rgba(24,34,29,0.16)]",
  eyebrow: "m-0 text-sm font-black text-[#5d6a62]",
  title: "m-0 text-[30px] font-black leading-tight text-[#18221d] max-[760px]:text-2xl",
  muted: "m-0 leading-7 text-[#5d6a62]",
  heroActions: "flex flex-wrap justify-end gap-2 max-[760px]:justify-start",
  secondaryButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#d8e0da] bg-white px-4 font-extrabold text-[#18221d] transition hover:bg-[#eef3f0]",
  dangerButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#b14a3d] bg-white px-4 font-extrabold text-[#b14a3d] transition hover:bg-[#fff1ee]",
  metrics: "grid grid-cols-3 gap-3 max-[760px]:grid-cols-1",
  metric:
    "rounded-lg border border-[#d8e0da] bg-[#f7faf8] p-4 [&_dd]:m-0 [&_dd]:font-numeric [&_dd]:text-2xl [&_dd]:font-black [&_dt]:text-sm [&_dt]:font-black [&_dt]:text-[#5d6a62]",
  progressTrack: "h-3 overflow-hidden rounded-full bg-[#d8e0da]",
  progressValue: "h-full rounded-full bg-[#245c46] transition-[width]",
  contentGrid: "grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 max-[980px]:grid-cols-1",
  section: "rounded-lg border border-[#d8e0da] bg-white p-5 shadow-[0_16px_50px_rgba(24,34,29,0.06)] max-[760px]:p-4",
  sectionHeader: "mb-4 flex items-start justify-between gap-3",
  sectionTitle: "m-0 text-[22px] font-black leading-tight text-[#18221d]",
  field: "grid gap-2 [&_label]:text-sm [&_label]:font-black [&_label]:text-[#18221d]",
  input:
    "min-h-11 rounded-lg border border-[#d8e0da] bg-white px-3 text-base text-[#18221d] outline-none focus:border-[#245c46]",
  primaryButton:
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#245c46] bg-[#245c46] px-4 font-extrabold text-white transition hover:bg-[#1f4e39] disabled:cursor-not-allowed disabled:border-[#8aa699] disabled:bg-[#8aa699]",
  avatarGrid: "grid grid-cols-5 gap-2",
  avatarChoice:
    "relative h-14 w-14 cursor-pointer overflow-hidden rounded-full border-2 bg-[#eef3f0] p-0 transition focus:outline-none focus:ring-2 focus:ring-[#245c46]",
  list: "grid gap-3",
  listItem:
    "grid gap-3 rounded-lg border border-[#d8e0da] bg-[#fbfdfb] p-4 transition hover:border-[#9fb2a7] max-[560px]:p-3",
  itemTop: "flex items-start justify-between gap-3",
  itemTitle: "m-0 text-lg font-black leading-6 text-[#18221d]",
  completedItem: "grid grid-cols-[132px_minmax(0,1fr)] gap-4 max-[560px]:grid-cols-1",
  completedImage:
    "h-full min-h-28 w-full rounded-md object-cover shadow-[0_10px_24px_rgba(24,34,29,0.12)] max-[560px]:aspect-[16/9] max-[560px]:min-h-0",
  tag: "inline-flex min-h-8 items-center rounded-full bg-[#eef3f0] px-3 text-sm font-black text-[#245c46]",
  iconButton:
    "inline-flex h-11 min-h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-lg border border-[#d8e0da] bg-white text-[#18221d] transition hover:bg-[#eef3f0]",
  empty:
    "grid min-h-36 place-items-center rounded-lg border border-dashed border-[#d8e0da] bg-[#f7faf8] px-4 text-center font-bold leading-7 text-[#5d6a62]",
  status:
    "rounded-lg border border-[#d8e0da] bg-[#f7faf8] px-4 py-3 text-sm font-bold leading-6 text-[#5d6a62]",
};

export function MyPage({
  session,
  completionRecords,
  onCompletionRecordsChange,
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
        currentReviews.map((review) => ({ ...review, authorName: nextProfile.displayName })),
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

  return (
    <section className={pageClass.shell} aria-label="마이페이지">
      <div className={pageClass.inner}>
        <header className={pageClass.hero}>
          <div className={pageClass.heroTop}>
            <div className={pageClass.profileSummary}>
              <img className={pageClass.avatar} src={primaryAvatarUrl} alt="" aria-hidden="true" />
              <div className="min-w-0">
                <p className={pageClass.eyebrow}>마이페이지</p>
                <h1 className={pageClass.title}>{profile?.displayName || "내 산행 기록"}</h1>
                <p className={pageClass.muted}>{session.user.email}</p>
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
              <dt>완료한 산</dt>
              <dd>{completedMountainCount}</dd>
              <p className={cn(pageClass.muted, "mt-2 text-sm")}>100대 명산 중 {completionProgressPercent}%</p>
              <div className={pageClass.progressTrack} aria-hidden="true">
                <div className={pageClass.progressValue} style={{ width: `${completionProgressPercent}%` }} />
              </div>
            </div>
            <div className={pageClass.metric}>
              <dt>작성 리뷰</dt>
              <dd>{reviews.length}</dd>
            </div>
            <div className={pageClass.metric}>
              <dt>최근 산행</dt>
              <dd className="truncate text-[20px]">{completedSummary[0]?.mountain?.name ?? "없음"}</dd>
            </div>
          </dl>
        </header>

        {message ? (
          <div className={pageClass.status} role="status">
            {message}
          </div>
        ) : null}

        {loadState === "loading" ? (
          <div className={pageClass.empty}>마이페이지 정보를 불러오는 중입니다.</div>
        ) : loadState === "error" ? (
          <div className={pageClass.empty}>
            <span>정보를 불러오지 못했습니다.</span>
          </div>
        ) : (
          <div className={pageClass.contentGrid}>
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

            <div className="grid gap-6">
              <CompletedMountainsPanel
                completedMountains={completedSummary}
                removingMountainId={removingMountainId}
                onOpenMountain={onOpenMountain}
                onRemoveCompleted={(mountainId) => void removeCompleted(mountainId)}
              />
              <EditableUserReviewsPanel
                reviews={reviews}
                currentUserId={session.user.id}
                onReviewsChange={setReviews}
                onOpenMountain={onOpenMountain}
                onStatusMessage={setMessage}
              />
            </div>
          </div>
        )}
      </div>
    </section>
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
            닉네임과 사진
          </h2>
        </div>
        <UserRound size={24} className="text-[#245c46]" aria-hidden="true" />
      </div>

      <div className="grid gap-5">
        <div className="flex items-center gap-4">
          <img className={pageClass.avatar} src={avatarUrl} alt="" aria-hidden="true" />
          <button className={pageClass.secondaryButton} type="button" onClick={onUploadClick} disabled={isUploadingAvatar}>
            <ImagePlus size={18} />
            {isUploadingAvatar ? "업로드 중" : "사진 추가"}
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

        <div className={pageClass.avatarGrid} aria-label="기본 프로필 이미지 선택">
          {defaultProfileAvatars.map((avatar) => (
            <button
              key={avatar.id}
              className={cn(
                pageClass.avatarChoice,
                avatarKind === avatar.id ? "border-[#245c46]" : "border-[#d8e0da]",
              )}
              type="button"
              title={avatar.label}
              aria-label={`${avatar.label} 선택`}
              onClick={() => onAvatarSelect(avatar.id, avatar.url)}
            >
              <img className="h-full w-full object-cover" src={avatar.url} alt="" aria-hidden="true" />
              {avatarKind === avatar.id ? (
                <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-[#245c46] text-white">
                  <Check size={13} />
                </span>
              ) : null}
            </button>
          ))}
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
          <p className={cn(pageClass.muted, "text-sm")}>닉네임은 2~20자로 저장할 수 있습니다.</p>
        </div>

        <button className={pageClass.primaryButton} type="button" onClick={onSave} disabled={isSaving}>
          <Save size={18} />
          {isSaving ? "저장 중" : "프로필 저장"}
        </button>
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
                    <h3 className={pageClass.itemTitle}>{review.mountainName}</h3>
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
                    산 상세 보기
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
                  pageClass.listItem,
                  isEditing && "border-[#245c46] ring-2 ring-[#245c46]/15",
                )}
              >
                <div className={pageClass.itemTop}>
                  <div className="min-w-0">
                    <h3 className={pageClass.itemTitle}>{review.mountainName}</h3>
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
                <p className="m-0 whitespace-pre-line leading-7 text-[#18221d]">{review.body}</p>
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
                <div className="flex flex-wrap gap-2">
                  {mountain ? (
                    <button className={pageClass.secondaryButton} type="button" onClick={() => onOpenMountain(mountain)}>
                      산 상세 보기
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
