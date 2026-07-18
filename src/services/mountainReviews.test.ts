import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(),
  },
}));

vi.mock("./supabase", () => ({
  supabase: supabaseMock,
}));

describe("fetchMountainReviews", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.storage.from.mockReset();
  });

  it("falls back to the legacy select when route endpoint columns are missing", async () => {
    const missingColumnQuery = createReviewQueryResult({
      data: null,
      error: {
        code: "42703",
        message: "column mountain_reviews.route_start_point does not exist",
      },
    });
    const legacyQuery = createReviewQueryResult({
      data: [
        {
          id: "review-1",
          user_id: "user-1",
          mountain_id: "0000000002",
          route_name: "추천 코스",
          author_name: "테스트 등산객",
          difficulty: "보통",
          duration_minutes: 180,
          duration_label: "3시간",
          body: "좋았어요.",
          image_urls: [],
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    supabaseMock.from
      .mockReturnValueOnce(missingColumnQuery)
      .mockReturnValueOnce(legacyQuery);
    const { fetchMountainReviews } = await import("./mountainReviews");

    const reviews = await fetchMountainReviews("0000000002");

    expect(reviews).toEqual([
      expect.objectContaining({
        id: "review-1",
        routeStartPoint: null,
        routeEndPoint: null,
        body: "좋았어요.",
      }),
    ]);
    expect(missingColumnQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("route_start_point"),
    );
    expect(legacyQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("route_start_point"),
    );
  });

  it("rejects a review row with a difficulty outside the approved five values", async () => {
    const query = createReviewQueryResult({
      data: [createReviewRow({ difficulty: "알 수 없음" })],
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);
    const { fetchMountainReviews } = await import("./mountainReviews");

    await expect(fetchMountainReviews("0000000002")).rejects.toThrow(
      "Invalid mountain review difficulty",
    );
  });
});

describe("fetchMountainDifficultySummaries", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    supabaseMock.storage.from.mockReset();
  });

  it("maps the RPC snake_case result to the frontend contract", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          mountain_id: "0000000002",
          review_count: 1000,
          average_score: 3.42,
        },
      ],
      error: null,
    });
    const { fetchMountainDifficultySummaries } = await import("./mountainReviews");

    await expect(fetchMountainDifficultySummaries()).resolves.toEqual([
      {
        mountainId: "0000000002",
        reviewCount: 1000,
        averageScore: 3.42,
      },
    ]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "get_mountain_difficulty_summaries",
    );
  });

  it("returns an empty list when no mountain has reviews", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    const { fetchMountainDifficultySummaries } = await import("./mountainReviews");

    await expect(fetchMountainDifficultySummaries()).resolves.toEqual([]);
  });

  it("surfaces an RPC error", async () => {
    const error = new Error("RPC failed");
    supabaseMock.rpc.mockResolvedValue({ data: null, error });
    const { fetchMountainDifficultySummaries } = await import("./mountainReviews");

    await expect(fetchMountainDifficultySummaries()).rejects.toBe(error);
  });

  it.each([
    [null, "expected an array"],
    [[{ mountain_id: "", review_count: 1, average_score: 3 }], "mountain_id"],
    [[{ mountain_id: "0000000002", review_count: 0, average_score: 3 }], "review_count"],
    [[{ mountain_id: "0000000002", review_count: 1, average_score: 6 }], "average_score"],
  ])("rejects malformed RPC data %#", async (data, message) => {
    supabaseMock.rpc.mockResolvedValue({ data, error: null });
    const { fetchMountainDifficultySummaries } = await import("./mountainReviews");

    await expect(fetchMountainDifficultySummaries()).rejects.toThrow(message);
  });
});

describe("updateMountainReview", () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.storage.from.mockReset();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({
        width: 120,
        height: 80,
        close: vi.fn(),
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function toBlob(callback) {
        callback(new Blob(["optimized"], { type: "image/jpeg" }));
      },
    );
  });

  it("updates image_urls and removes only deleted existing storage images", async () => {
    const oldUrl =
      "https://example.supabase.co/storage/v1/object/public/mountain-review-images/user-1/0000000002/review-1/old.jpg";
    const keptUrl =
      "https://example.supabase.co/storage/v1/object/public/mountain-review-images/user-1/0000000002/review-1/kept.jpg";
    const existingQuery = createSingleQueryResult({
      data: { image_urls: [oldUrl, keptUrl] },
      error: null,
    });
    const updateQuery = createUpdateQueryResult({
      data: createReviewRow({ image_urls: [keptUrl] }),
      error: null,
    });
    const storage = {
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    supabaseMock.from
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(updateQuery);
    supabaseMock.storage.from.mockReturnValue(storage);
    const { updateMountainReview } = await import("./mountainReviews");

    const review = await updateMountainReview({
      id: "review-1",
      userId: "user-1",
      mountainId: "0000000002",
      difficulty: "어려움",
      durationMinutes: 240,
      durationLabel: "4시간",
      body: "수정된 한줄평",
      existingImageUrls: [keptUrl],
      imageFiles: [],
    });

    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "수정된 한줄평",
        image_urls: [keptUrl],
      }),
    );
    expect(storage.remove).toHaveBeenCalledWith([
      "user-1/0000000002/review-1/old.jpg",
    ]);
    expect(review.imageUrls).toEqual([keptUrl]);
  });

  it("removes newly uploaded images when later upload fails", async () => {
    const existingQuery = createSingleQueryResult({
      data: { image_urls: [] },
      error: null,
    });
    const uploadedPaths: string[] = [];
    const storage = {
      upload: vi.fn().mockImplementation((path: string) => {
        uploadedPaths.push(path);
        return uploadedPaths.length === 1
          ? Promise.resolve({ error: null })
          : Promise.resolve({ error: new Error("upload failed") });
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: "https://example.supabase.co/new.jpg" },
      }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    supabaseMock.from.mockReturnValue(existingQuery);
    supabaseMock.storage.from.mockReturnValue(storage);
    const { updateMountainReview } = await import("./mountainReviews");

    await expect(
      updateMountainReview({
        id: "review-1",
        userId: "user-1",
        mountainId: "0000000002",
        difficulty: "보통",
        durationMinutes: 180,
        durationLabel: "3시간",
        body: "수정된 한줄평",
        existingImageUrls: [],
        imageFiles: [
          new File(["one"], "one.png", { type: "image/png" }),
          new File(["two"], "two.png", { type: "image/png" }),
        ],
      }),
    ).rejects.toThrow("upload failed");

    expect(storage.remove).toHaveBeenCalledWith([uploadedPaths[0]]);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });
});

function createReviewQueryResult(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue(result),
  };
}

function createSingleQueryResult(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(result),
  };
}

function createUpdateQueryResult(result: { data: unknown; error: unknown }) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(result),
  };
}

function createReviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "review-1",
    user_id: "user-1",
    mountain_id: "0000000002",
    route_name: "추천 코스",
    route_start_point: null,
    route_end_point: null,
    author_name: "테스트 등산객",
    difficulty: "어려움",
    duration_minutes: 240,
    duration_label: "4시간",
    body: "수정된 한줄평",
    image_urls: [],
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}
