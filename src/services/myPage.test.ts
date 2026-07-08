import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  fetchPublicProfiles: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: supabaseMock,
}));

vi.mock("./profiles", () => ({
  fetchPublicProfiles: profileMocks.fetchPublicProfiles,
}));

describe("my page service", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    profileMocks.fetchPublicProfiles.mockReset();
  });

  it("maps completed mountain records to local mountain data", async () => {
    const query = createCompletedQueryResult({
      data: [
        {
          id: "completion-1",
          mountain_id: "0000000001",
          completed_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);
    const { fetchUserCompletedMountains } = await import("./myPage");

    const records = await fetchUserCompletedMountains("user-1");

    expect(records[0]).toEqual(
      expect.objectContaining({
        id: "completion-1",
        mountainId: "0000000001",
        mountain: expect.objectContaining({ id: "0000000001" }),
      }),
    );
  });

  it("uses the latest public profile nickname for user reviews", async () => {
    const query = createReviewQueryResult({
      data: [
        {
          id: "review-1",
          user_id: "user-1",
          mountain_id: "0000000001",
          route_name: "추천 코스",
          route_start_point: "해인사",
          route_end_point: "상왕봉",
          author_name: "예전 닉네임",
          difficulty: "보통",
          duration_minutes: 180,
          duration_label: "3시간",
          body: "길이 잘 정비되어 있어요.",
          image_urls: [],
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);
    profileMocks.fetchPublicProfiles.mockResolvedValue(
      new Map([
        [
          "user-1",
          {
            id: "user-1",
            displayName: "최신 닉네임",
            avatarUrl: "/profile-avatars/avatar-1.svg",
            avatarKind: "default-1",
          },
        ],
      ]),
    );
    const { fetchUserReviews } = await import("./myPage");

    const reviews = await fetchUserReviews("user-1");

    expect(reviews[0]).toEqual(
      expect.objectContaining({
        authorName: "최신 닉네임",
        authorAvatarUrl: "/profile-avatars/avatar-1.svg",
        mountainName: expect.any(String),
        routeStartPoint: "해인사",
        routeEndPoint: "상왕봉",
      }),
    );
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("route_start_point"));
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("route_end_point"));
  });
});

function createCompletedQueryResult(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue(result),
  };
}

function createReviewQueryResult(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue(result),
  };
}
