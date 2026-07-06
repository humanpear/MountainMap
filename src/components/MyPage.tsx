import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  LogOut,
  MapPin,
  MessageCircle,
  Mountain as MountainIcon,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "../lib/classNames";
import { mountains } from "../data/mountains";
import {
  defaultProfileAvatars,
  fetchOrCreateUserProfile,
  getDefaultAvatarUrl,
  isDisplayNameAvailable,
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
import type { CompletionRecord, Mountain } from "../types";

type MyPageProps = {
  session: Session;
  completionRecords: CompletionRecord[];
  onCompletionRecordsChange: (records: CompletionRecord[]) => void;
  onBackToMap: () => void;
  onOpenMountain: (mountain: Mountain) => void;
  onSignOut: () => void;
};

type LoadState = "loading" | "ready" | "error";
type AvailabilityState = "idle" | "checking" | "available" | "duplicate" | "error";

const pageClass = {
  shell: "min-h-[calc(100vh-68px)] bg-[#f5f7f4]",
  inner: "mx-auto grid w-[1180px] max-w-[calc(100%-40px)] gap-6 py-8 max-[760px]:max-w-none max-[760px]:px-4 max-[760px]:py-5",
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
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
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
  const completedMountainCount = completedSummary.length || new Set(completionRecords.map((record) => record.mountainId)).size;
  const primaryAvatarUrl = avatarUrl || profile?.avatarUrl || getDefaultAvatarUrl(avatarKind);

  const checkDisplayName = async () => {
    const nextDisplayName = sanitizeDisplayName(displayName);
    setDisplayName(nextDisplayName);

    if (!nextDisplayName || !profile) {
      setAvailabilityState("idle");
      return;
    }

    if (nextDisplayName.length < 2 || nextDisplayName.length > 20) {
      setAvailabilityState("error");
      setMessage("닉네임은 2~20자로 입력해 주세요.");
      return;
    }

    setAvailabilityState("checking");
    setMessage(null);

    try {
      const isAvailable = await isDisplayNameAvailable(nextDisplayName, profile.id);
      setAvailabilityState(isAvailable ? "available" : "duplicate");
      setMessage(isAvailable ? "사용할 수 있는 닉네임입니다." : "이미 사용 중인 닉네임입니다.");
    } catch (error) {
      setAvailabilityState("error");
      setMessage(error instanceof Error ? error.message : "닉네임 중복 확인에 실패했습니다.");
    }
  };

  const saveProfile = async () => {
    if (!profile) {
      return;
    }

    const nextDisplayName = sanitizeDisplayName(displayName);
    setIsSaving(true);
    setMessage(null);

    try {
      const isAvailable =
        nextDisplayName === profile.displayName || availabilityState === "available"
          ? true
          : await isDisplayNameAvailable(nextDisplayName, profile.id);

      if (!isAvailable) {
        setAvailabilityState("duplicate");
        setMessage("이미 사용 중인 닉네임입니다.");
        return;
      }

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
      setAvailabilityState("idle");
      setReviews((currentReviews) =>
        currentReviews.map((review) => ({ ...review, authorName: nextProfile.displayName })),
      );
      setMessage("프로필을 저장했습니다.");
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
      const nextAvatarUrl = await uploadProfileAvatar(profile.id, file);
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
              availabilityState={availabilityState}
              isSaving={isSaving}
              isUploadingAvatar={isUploadingAvatar}
              fileInputRef={fileInputRef}
              onDisplayNameChange={(value) => {
                setDisplayName(value);
                setAvailabilityState("idle");
              }}
              onAvatarSelect={(nextAvatarKind, nextAvatarUrl) => {
                setAvatarKind(nextAvatarKind);
                setAvatarUrl(nextAvatarUrl);
              }}
              onUploadClick={() => fileInputRef.current?.click()}
              onFileChange={(file) => void uploadAvatar(file)}
              onCheckDisplayName={() => void checkDisplayName()}
              onSave={() => void saveProfile()}
            />

            <div className="grid gap-6">
              <CompletedMountainsPanel
                completedMountains={completedSummary}
                removingMountainId={removingMountainId}
                onOpenMountain={onOpenMountain}
                onRemoveCompleted={(mountainId) => void removeCompleted(mountainId)}
              />
              <UserReviewsPanel reviews={reviews} onOpenMountain={onOpenMountain} />
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
  availabilityState,
  isSaving,
  isUploadingAvatar,
  fileInputRef,
  onDisplayNameChange,
  onAvatarSelect,
  onUploadClick,
  onFileChange,
  onCheckDisplayName,
  onSave,
}: {
  displayName: string;
  avatarUrl: string;
  avatarKind: string;
  availabilityState: AvailabilityState;
  isSaving: boolean;
  isUploadingAvatar: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onDisplayNameChange: (value: string) => void;
  onAvatarSelect: (avatarKind: string, avatarUrl: string) => void;
  onUploadClick: () => void;
  onFileChange: (file: File) => void;
  onCheckDisplayName: () => void;
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
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[420px]:grid-cols-1">
            <input
              className={pageClass.input}
              id="profile-display-name"
              value={displayName}
              maxLength={20}
              onChange={(event) => onDisplayNameChange(event.target.value)}
            />
            <button className={pageClass.secondaryButton} type="button" onClick={onCheckDisplayName}>
              <RefreshCw size={17} />
              중복 확인
            </button>
          </div>
          <p className={cn(pageClass.muted, "text-sm")}>{getAvailabilityMessage(availabilityState)}</p>
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
              <div className={pageClass.itemTop}>
                <div className="min-w-0">
                  <h3 className={pageClass.itemTitle}>{record.mountain?.name ?? record.mountainId}</h3>
                  <p className={pageClass.muted}>
                    {record.mountain ? `${record.mountain.province} ${record.mountain.city}` : "산 정보 없음"} · 최근 완료{" "}
                    {formatDate(record.completedAt)}
                  </p>
                </div>
                <span className={pageClass.tag}>{record.count}회</span>
              </div>
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

type CompletedMountainSummary = {
  mountainId: string;
  mountain: Mountain | null;
  completedAt: string;
  count: number;
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
        count: 1,
      });
      continue;
    }

    existing.count += 1;
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

function getAvailabilityMessage(state: AvailabilityState) {
  const messages: Record<AvailabilityState, string> = {
    idle: "저장 전에 중복 확인을 하거나, 저장 시 자동으로 다시 확인합니다.",
    checking: "닉네임을 확인하는 중입니다.",
    available: "사용할 수 있는 닉네임입니다.",
    duplicate: "이미 사용 중인 닉네임입니다.",
    error: "닉네임을 다시 확인해 주세요.",
  };

  return messages[state];
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
