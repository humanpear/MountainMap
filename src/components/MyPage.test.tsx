import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyPage } from "./MyPage";

const profileMocks = vi.hoisted(() => ({
  deleteProfileAvatar: vi.fn(),
  fetchOrCreateUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  uploadProfileAvatar: vi.fn(),
}));

const myPageMocks = vi.hoisted(() => ({
  deleteCompletedMountain: vi.fn(),
  fetchUserCompletedMountains: vi.fn(),
  fetchUserReviews: vi.fn(),
}));

const reviewServiceMocks = vi.hoisted(() => ({
  deleteMountainReview: vi.fn(),
  updateMountainReview: vi.fn(),
}));

vi.mock("../services/profiles", () => ({
  defaultProfileAvatars: [
    { id: "default-1", label: "기본 1", url: "/profile-avatars/avatar-1.svg" },
    { id: "default-2", label: "기본 2", url: "/profile-avatars/avatar-2.svg" },
    { id: "default-3", label: "기본 3", url: "/profile-avatars/avatar-3.svg" },
    { id: "default-4", label: "기본 4", url: "/profile-avatars/avatar-4.svg" },
    { id: "default-5", label: "기본 5", url: "/profile-avatars/avatar-5.svg" },
  ],
  deleteProfileAvatar: profileMocks.deleteProfileAvatar,
  fetchOrCreateUserProfile: profileMocks.fetchOrCreateUserProfile,
  getDefaultAvatarUrl: () => "/profile-avatars/avatar-1.svg",
  isCustomProfileAvatarUrl: vi.fn(() => false),
  sanitizeDisplayName: (name: string) => name.trim().replace(/\s+/g, " "),
  saveUserProfile: profileMocks.saveUserProfile,
  uploadProfileAvatar: profileMocks.uploadProfileAvatar,
}));

vi.mock("../services/myPage", () => ({
  deleteCompletedMountain: myPageMocks.deleteCompletedMountain,
  fetchUserCompletedMountains: myPageMocks.fetchUserCompletedMountains,
  fetchUserReviews: myPageMocks.fetchUserReviews,
}));

vi.mock("../services/mountainReviews", () => ({
  deleteMountainReview: reviewServiceMocks.deleteMountainReview,
  updateMountainReview: reviewServiceMocks.updateMountainReview,
}));

function createSession() {
  return {
    access_token: "token",
    expires_at: 4_102_444_800,
    expires_in: 3600,
    refresh_token: "refresh",
    token_type: "bearer",
    user: {
      app_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
      email: "user-1@example.com",
      id: "user-1",
      user_metadata: { full_name: "테스트 등산객" },
    },
  } as Session;
}

function renderMyPage(options: { activeTab?: "profile" | "completed" | "reviews"; onTabChange?: (tab: "profile" | "completed" | "reviews") => void } = {}) {
  return render(
    <MyPage
      session={createSession()}
      activeTab={options.activeTab}
      completionRecords={[]}
      onBackToMap={() => undefined}
      onCompletionRecordsChange={() => undefined}
      onTabChange={options.onTabChange}
      onOpenMountain={() => undefined}
      onSignOut={() => undefined}
    />,
  );
}

describe("MyPage", () => {
  beforeEach(() => {
    profileMocks.deleteProfileAvatar.mockReset();
    profileMocks.fetchOrCreateUserProfile.mockReset();
    profileMocks.saveUserProfile.mockReset();
    profileMocks.uploadProfileAvatar.mockReset();
    myPageMocks.deleteCompletedMountain.mockReset();
    myPageMocks.fetchUserCompletedMountains.mockReset();
    myPageMocks.fetchUserReviews.mockReset();
    reviewServiceMocks.deleteMountainReview.mockReset();
    reviewServiceMocks.updateMountainReview.mockReset();
  });

  it("renders completion progress, completed mountain image, completion date, and route endpoints", async () => {
    profileMocks.fetchOrCreateUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user-1@example.com",
      displayName: "테스트 등산객",
      displayNameNormalized: "테스트 등산객",
      avatarUrl: "/profile-avatars/avatar-1.svg",
      avatarKind: "default-1",
    });
    myPageMocks.fetchUserCompletedMountains.mockResolvedValue([
      {
        id: "completion-1",
        mountainId: "0000000002",
        completedAt: "2026-06-01T00:00:00.000Z",
        mountain: {
          id: "0000000002",
          name: "가리산",
          province: "강원특별자치도",
          city: "강원도 춘천시",
          latitude: 37.871353,
          longitude: 127.956485,
          elevationMeters: 1051,
          address: "강원도 춘천시",
          shortDescription: "가리산 설명",
          selectionReason: "선정 이유",
        },
      },
    ]);
    myPageMocks.fetchUserReviews.mockResolvedValue([
      {
        id: "review-1",
        userId: "user-1",
        mountainId: "0000000002",
        mountainName: "가리산",
        routeName: "추천 코스",
        routeStartPoint: "두촌면",
        routeEndPoint: "정상",
        authorName: "테스트 등산객",
        difficulty: "보통",
        durationMinutes: 180,
        durationLabel: "3시간",
        body: "길이 잘 정비되어 있어요.",
        imageUrls: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);

    renderMyPage({ activeTab: "completed" });

    expect(await screen.findByRole("heading", { name: "가리산" })).toBeInTheDocument();
    expect(screen.getByText("100대 명산 중 1% 완료")).toBeInTheDocument();
    expect(screen.getByText("등산 완료")).toBeInTheDocument();
    expect(screen.getByText(/완료 날짜/)).toBeInTheDocument();
    expect(screen.queryByText("1회")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByAltText("가리산 대표 이미지").getAttribute("src")).toContain(
        "/mountain-images/0000000002/hero.png",
      );
    });
  });

  it("shows only profile, completed, and reviews tabs", async () => {
    profileMocks.fetchOrCreateUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user-1@example.com",
      displayName: "테스트 등산객",
      displayNameNormalized: "테스트 등산객",
      avatarUrl: "/profile-avatars/avatar-1.svg",
      avatarKind: "default-1",
    });
    myPageMocks.fetchUserCompletedMountains.mockResolvedValue([]);
    myPageMocks.fetchUserReviews.mockResolvedValue([]);
    const onTabChange = vi.fn();

    renderMyPage({ onTabChange });

    expect(await screen.findByRole("heading", { name: "프로필 편집" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "요약" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "완료한 산" }));

    expect(onTabChange).toHaveBeenCalledWith("completed");
  });

  it("opens the profile editor when the profile tab is active", async () => {
    profileMocks.fetchOrCreateUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user-1@example.com",
      displayName: "테스트 등산객",
      displayNameNormalized: "테스트 등산객",
      avatarUrl: "/profile-avatars/avatar-1.svg",
      avatarKind: "default-1",
    });
    myPageMocks.fetchUserCompletedMountains.mockResolvedValue([]);
    myPageMocks.fetchUserReviews.mockResolvedValue([]);

    renderMyPage({ activeTab: "profile" });

    expect(await screen.findByRole("heading", { name: "프로필 편집" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "내 산행 현황" })).not.toBeInTheDocument();
  });

  it("edits and deletes a user review from MyPage", async () => {
    const existingReview = {
      id: "review-1",
      userId: "user-1",
      mountainId: "0000000002",
      mountainName: "Test Mountain",
      routeName: "Recommended Course",
      routeStartPoint: "Trailhead",
      routeEndPoint: "Summit",
      authorName: "Test Hiker",
      difficulty: "보통",
      durationMinutes: 180,
      durationLabel: "3시간",
      body: "original review body",
      imageUrls: [],
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };
    const updatedReview = {
      ...existingReview,
      body: "updated review body",
      difficulty: "쉬움",
      durationLabel: "3시간",
      updatedAt: "2026-06-02T00:00:00.000Z",
    };
    profileMocks.fetchOrCreateUserProfile.mockResolvedValue({
      id: "user-1",
      email: "user-1@example.com",
      displayName: "Test Hiker",
      displayNameNormalized: "test hiker",
      avatarUrl: "/profile-avatars/avatar-1.svg",
      avatarKind: "default-1",
    });
    myPageMocks.fetchUserCompletedMountains.mockResolvedValue([]);
    myPageMocks.fetchUserReviews.mockResolvedValue([existingReview]);
    reviewServiceMocks.updateMountainReview.mockResolvedValue(updatedReview);
    reviewServiceMocks.deleteMountainReview.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    try {
      renderMyPage({ activeTab: "reviews" });

      expect(await screen.findByText(/original review body/)).toBeInTheDocument();
      expect(screen.getByText("Trailhead → Summit")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Test Mountain 상세페이지/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /한줄평 수정/ }));
      fireEvent.change(screen.getByDisplayValue("original review body"), {
        target: { value: "updated review body" },
      });
      fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

      await waitFor(() => {
        expect(reviewServiceMocks.updateMountainReview).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "review-1",
            userId: "user-1",
            mountainId: "0000000002",
            body: "updated review body",
            existingImageUrls: [],
            imageFiles: [],
          }),
        );
      });
      expect(await screen.findByText(/updated review body/)).toBeInTheDocument();
      expect(screen.queryByText(/original review body/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /한줄평 삭제/ }));

      await waitFor(() => {
        expect(reviewServiceMocks.deleteMountainReview).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "review-1",
            body: "updated review body",
          }),
        );
      });
      expect(screen.queryByText(/updated review body/)).not.toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });
});
