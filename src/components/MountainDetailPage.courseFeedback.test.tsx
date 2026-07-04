import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMountainGuide } from "../data/mountainDetails";
import { mountains } from "../data/mountains";
import type { MountainReview } from "../services/mountainReviews";
import { MountainDetailPage } from "./MountainDetailPage";

const reviewServiceMocks = vi.hoisted(() => ({
  createMountainReview: vi.fn(),
  deleteMountainReview: vi.fn(),
  fetchMountainReviews: vi.fn(),
  updateMountainReview: vi.fn(),
}));

vi.mock("../services/env", () => ({
  env: {
    kakaoMapAppKey: undefined,
    mountainWeatherProxyUrl: undefined,
    supabaseAnonKey: "anon-key",
    supabaseUrl: "https://example.supabase.co",
  },
  isKakaoMapConfigured: false,
  isSupabaseConfigured: true,
}));

vi.mock("../services/mountainReviews", () => ({
  createMountainReview: reviewServiceMocks.createMountainReview,
  deleteMountainReview: reviewServiceMocks.deleteMountainReview,
  fetchMountainReviews: reviewServiceMocks.fetchMountainReviews,
  updateMountainReview: reviewServiceMocks.updateMountainReview,
}));

function getMountainWithMultipleOfficialRoutes() {
  const mountain = mountains.find((candidate) => {
    const officialRoutes = getMountainGuide(candidate).routes.filter(
      (route) => route.forestTripCourseKind,
    );

    return officialRoutes.length >= 2;
  });

  if (!mountain) {
    throw new Error("Expected at least one mountain with multiple official routes");
  }

  return mountain;
}

function createSession(userId = "user-1") {
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
      email: `${userId}@example.com`,
      id: userId,
      user_metadata: { full_name: "테스트 등산객" },
    },
  } as Session;
}

function createReview(
  overrides: Partial<MountainReview> = {},
): MountainReview {
  return {
    id: "review-1",
    userId: "user-1",
    mountainId: "0000000002",
    routeName: "추천 코스",
    authorName: "테스트 등산객",
    difficulty: "보통",
    durationMinutes: 180,
    durationLabel: "3시간",
    body: "길이 잘 정비되어 있어요.",
    imageUrls: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function getExpectedForestTripDifficultyLabel(difficulty: string) {
  if (difficulty === "easy") {
    return "쉬움";
  }
  if (difficulty === "hard") {
    return "어려움";
  }
  if (difficulty === "extreme") {
    return "매우 어려움";
  }
  if (difficulty === "unknown") {
    return "확인 필요";
  }
  return "보통";
}

function renderMountainDetail(session: Session | null = createSession()) {
  const mountain = getMountainWithMultipleOfficialRoutes();
  const result = render(
    <MountainDetailPage
      mountain={mountain}
      isCompleted={false}
      session={session}
      onBack={() => undefined}
      onShowOnMap={() => undefined}
      onToggleCompleted={() => undefined}
    />,
  );

  return { mountain, ...result };
}

describe("MountainDetailPage course feedback", () => {
  beforeEach(() => {
    reviewServiceMocks.createMountainReview.mockReset();
    reviewServiceMocks.deleteMountainReview.mockReset();
    reviewServiceMocks.fetchMountainReviews.mockReset();
    reviewServiceMocks.updateMountainReview.mockReset();
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([]);
  });

  it("renders course feedback below the mountain detail support cards", () => {
    renderMountainDetail();

    expect(screen.getByRole("heading", { name: "코스 평가" })).toBeInTheDocument();
    expect(screen.getByText("한줄평을 남겨주세요!")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "실제 등산객 한줄평" }),
    ).toBeInTheDocument();
    expect(screen.getByText("전체")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "추천코스" })).toBeInTheDocument();
  });

  it("selects the recommended course by default", () => {
    const { mountain } = renderMountainDetail();
    const recommendedRoute = getMountainGuide(mountain).routes.find(
      (route) => route.forestTripCourseKind === "recommended" || route.isRecommended,
    );
    const courseSelect = screen.getByLabelText(
      "코스를 선택해주세요",
    ) as HTMLSelectElement;

    expect(recommendedRoute).toBeDefined();
    expect(courseSelect.value).toBe(recommendedRoute!.name);
  });

  it("uses the most selected review difficulty per recommended course and falls back without reviews", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const officialRoutes = getMountainGuide(mountain).routes.filter(
      (route) => route.forestTripCourseKind,
    );
    const reviewedRoute = officialRoutes[0];
    const fallbackRoute = officialRoutes[1];

    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "difficulty-easy",
        mountainId: mountain.id,
        routeName: reviewedRoute.name,
        difficulty: "쉬움",
        body: "쉬움 한 표",
      }),
      createReview({
        id: "difficulty-normal",
        mountainId: mountain.id,
        routeName: reviewedRoute.name,
        difficulty: "보통",
        body: "보통 한 표",
      }),
      createReview({
        id: "difficulty-slightly-hard-1",
        mountainId: mountain.id,
        routeName: reviewedRoute.name,
        difficulty: "약간 어려움",
        body: "약간 어려움 한 표",
      }),
      createReview({
        id: "difficulty-slightly-hard-2",
        mountainId: mountain.id,
        routeName: reviewedRoute.name,
        difficulty: "약간 어려움",
        body: "약간 어려움 두 표",
      }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/약간 어려움 두 표/)).toBeInTheDocument();

    const courseInfoHeading = screen.getByRole("heading", {
      name: "추천 코스 정보",
    });
    const courseInfoArticle = courseInfoHeading.closest("article");

    expect(courseInfoArticle).not.toBeNull();
    await waitFor(() => {
      expect(
        within(courseInfoArticle!).getAllByText("약간 어려움").length,
      ).toBeGreaterThan(0);
    });
    expect(
      within(courseInfoArticle!)
        .getAllByText("약간 어려움")
        .some((element) => element.className.includes("text-[#c59a00]")),
    ).toBe(true);
    expect(
      within(courseInfoArticle!).getAllByText(
        getExpectedForestTripDifficultyLabel(fallbackRoute.difficulty),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("keeps default recommended course difficulties when there are no reviews", () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const [route] = getMountainGuide(mountain).routes.filter(
      (candidate) => candidate.forestTripCourseKind,
    );

    renderMountainDetail();

    const courseInfoHeading = screen.getByRole("heading", {
      name: "추천 코스 정보",
    });
    const courseInfoArticle = courseInfoHeading.closest("article");

    expect(courseInfoArticle).not.toBeNull();
    expect(
      within(courseInfoArticle!).getAllByText(
        getExpectedForestTripDifficultyLabel(route.difficulty),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("does not render a footer on mountain detail pages", () => {
    renderMountainDetail();

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("shows direct course input and saves custom start and end points", async () => {
    const { mountain } = renderMountainDetail();
    const courseSelect = screen.getByLabelText(
      "코스를 선택해주세요",
    ) as HTMLSelectElement;
    const reviewBody = "직접 다녀온 코스입니다.";
    reviewServiceMocks.createMountainReview.mockResolvedValue(
      createReview({
        id: "direct-review",
        mountainId: mountain.id,
        routeName: "코스 직접 입력",
        routeStartPoint: "주차장",
        routeEndPoint: "정상",
        body: reviewBody,
      }),
    );

    fireEvent.change(courseSelect, { target: { value: "코스 직접 입력" } });
    fireEvent.change(screen.getByLabelText("출발지"), {
      target: { value: "주차장" },
    });
    fireEvent.change(screen.getByLabelText("도착지"), {
      target: { value: "정상" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("코스에 대한 느낌을 자유롭게 남겨주세요."),
      { target: { value: reviewBody } },
    );
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));

    await waitFor(() => {
      expect(reviewServiceMocks.createMountainReview).toHaveBeenCalledWith(
        expect.objectContaining({
          mountainId: mountain.id,
          routeName: "코스 직접 입력",
          routeStartPoint: "주차장",
          routeEndPoint: "정상",
          body: reviewBody,
        }),
      );
    });
  });

  it("loads all reviews for the mountain id and displays route names", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const officialRoutes = getMountainGuide(mountain).routes
      .filter((route) => route.forestTripCourseKind)
      .slice(0, 2);
    const routeNames = officialRoutes.map((route) => route.name);
    const firstRouteStops = officialRoutes[0].path
      .split(/(?:\s*(?:->|→)\s*|\s+-\s+)/g)
      .map((stop) => stop.trim())
      .filter(Boolean);
    const cleanEndpoint = (value: string) =>
      value.replace(/[\s\d①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]+$/u, "").trim();
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({ id: "review-1", mountainId: mountain.id, routeName: routeNames[0], body: "추천 코스가 편했어요." }),
      createReview({ id: "review-2", mountainId: mountain.id, routeName: routeNames[1], body: "두 번째 코스도 좋았어요." }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/추천 코스가 편했어요/)).toBeInTheDocument();
    expect(screen.getByText(/두 번째 코스도 좋았어요/)).toBeInTheDocument();
    expect(screen.getAllByText(routeNames[0]).length).toBeGreaterThan(0);
    expect(screen.getAllByText(routeNames[1]).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        `${cleanEndpoint(firstRouteStops[0])} > ${cleanEndpoint(firstRouteStops[firstRouteStops.length - 1])}`,
      ).length,
    ).toBeGreaterThan(0);
    expect(reviewServiceMocks.fetchMountainReviews).toHaveBeenCalledWith(mountain.id);
  });

  it("shows directly entered review route endpoints on review cards", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "manual-route-review",
        mountainId: mountain.id,
        routeName: "코스 직접 입력",
        routeStartPoint: "휴양림 주차장",
        routeEndPoint: "가리산 정상",
        body: "직접 입력한 경로입니다.",
      }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/직접 입력한 경로입니다/)).toBeInTheDocument();
    expect(screen.getByText("휴양림 주차장 > 가리산 정상")).toBeInTheDocument();
  });

  it("filters reviews by the selected official course kind", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const officialRoutes = getMountainGuide(mountain).routes.filter(
      (route) => route.forestTripCourseKind,
    );
    const recommendedRoute = officialRoutes.find(
      (route) => route.forestTripCourseKind === "recommended",
    );
    const otherRoute = officialRoutes.find(
      (route) => route.forestTripCourseKind && route.forestTripCourseKind !== "recommended",
    );

    expect(recommendedRoute).toBeDefined();
    expect(otherRoute).toBeDefined();

    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "recommended-review",
        mountainId: mountain.id,
        routeName: recommendedRoute!.name,
        body: "추천 코스 후기입니다.",
      }),
      createReview({
        id: "other-review",
        mountainId: mountain.id,
        routeName: otherRoute!.name,
        body: "기타 코스 후기입니다.",
      }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/추천 코스 후기입니다/)).toBeInTheDocument();
    expect(screen.getByText(/기타 코스 후기입니다/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "추천코스" }));

    expect(screen.getByText(/추천 코스 후기입니다/)).toBeInTheDocument();
    expect(screen.queryByText(/기타 코스 후기입니다/)).not.toBeInTheDocument();
  });

  it("switches the main section between recommended courses and full reviews", async () => {
    renderMountainDetail();

    expect(screen.getByRole("heading", { name: "추천 코스 지도" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));

    expect(await screen.findByRole("heading", { name: /한줄평$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "한줄평 작성하기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "추천 코스" }));

    expect(screen.getByRole("heading", { name: "추천 코스 지도" })).toBeInTheDocument();
  });

  it("places weather between recommended course info and feedback and hides it on full reviews", async () => {
    const { mountain } = renderMountainDetail();

    const courseInfoHeading = screen.getByRole("heading", {
      name: "추천 코스 정보",
    });
    const weatherSection = screen.getByRole("region", {
      name: `${mountain.name} 날씨`,
    });
    const feedbackHeading = screen.getByRole("heading", { name: "코스 평가" });

    expect(
      courseInfoHeading.compareDocumentPosition(weatherSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      weatherSection.compareDocumentPosition(feedbackHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "검증용 링크" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));

    expect(await screen.findByRole("heading", { name: /한줄평$/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: `${mountain.name} 날씨` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "검증용 링크" }),
    ).not.toBeInTheDocument();
  });

  it("opens the full review write form inline", async () => {
    renderMountainDetail();

    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));
    expect(await screen.findByRole("button", { name: "한줄평 작성하기" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "코스 평가" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "한줄평 작성하기" }));

    expect(screen.getByRole("heading", { name: "코스 평가" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "작성 취소" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "한줄평 작성하기" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "작성 취소" }));

    expect(screen.queryByRole("heading", { name: "코스 평가" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "한줄평 작성하기" })).toBeInTheDocument();
  });

  it("resets the full review write form when writing is canceled", async () => {
    renderMountainDetail();

    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));
    fireEvent.click(await screen.findByRole("button", { name: "한줄평 작성하기" }));

    const courseSelect = screen.getByLabelText(
      "코스를 선택해주세요",
    ) as HTMLSelectElement;
    const defaultRouteName = courseSelect.value;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "cancel-reset.png", { type: "image/png" });

    fireEvent.change(courseSelect, { target: { value: "코스 직접 입력" } });
    fireEvent.change(screen.getByLabelText("출발지"), {
      target: { value: "임시 출발지" },
    });
    fireEvent.change(screen.getByLabelText("도착지"), {
      target: { value: "임시 도착지" },
    });
    fireEvent.change(screen.getByLabelText("소요시간 시간"), {
      target: { value: 5 },
    });
    fireEvent.change(
      screen.getByPlaceholderText("코스에 대한 느낌을 자유롭게 남겨주세요."),
      { target: { value: "취소되면 사라질 내용" } },
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByAltText("cancel-reset.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "작성 취소" }));
    fireEvent.click(screen.getByRole("button", { name: "한줄평 작성하기" }));

    const resetCourseSelect = screen.getByLabelText(
      "코스를 선택해주세요",
    ) as HTMLSelectElement;
    expect(resetCourseSelect.value).toBe(defaultRouteName);
    expect(
      screen.getByPlaceholderText("코스에 대한 느낌을 자유롭게 남겨주세요."),
    ).toHaveValue("");
    expect(screen.queryByAltText("cancel-reset.png")).not.toBeInTheDocument();
  });

  it("filters full reviews to my reviews and sorts oldest first", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const [recommendedRoute, otherRoute] = getMountainGuide(mountain).routes.filter(
      (route) => route.forestTripCourseKind,
    );
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "newest-review",
        mountainId: mountain.id,
        routeName: recommendedRoute.name,
        body: "최신 리뷰",
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      }),
      createReview({
        id: "oldest-review",
        mountainId: mountain.id,
        routeName: recommendedRoute.name,
        body: "오래된 리뷰",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
      createReview({
        id: "other-user-review",
        userId: "user-2",
        authorName: "다른 등산객",
        mountainId: mountain.id,
        routeName: otherRoute.name,
        body: "다른 사람 리뷰",
        createdAt: "2026-06-02T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z",
      }),
    ]);

    renderMountainDetail();
    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));

    expect(await screen.findByText(/최신 리뷰/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("전체 한줄평 정렬"), {
      target: { value: "oldest" },
    });

    const oldestReview = screen.getByText(/오래된 리뷰/);
    const newestReview = screen.getByText(/최신 리뷰/);
    expect(
      oldestReview.compareDocumentPosition(newestReview) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "내 리뷰" }));

    expect(screen.getByText(/최신 리뷰/)).toBeInTheDocument();
    expect(screen.getByText(/오래된 리뷰/)).toBeInTheDocument();
    expect(screen.queryByText(/다른 사람 리뷰/)).not.toBeInTheDocument();
  });

  it("shows review actions only from the more menu for the current user's reviews", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "mine-review",
        mountainId: mountain.id,
        body: "내가 쓴 리뷰",
      }),
      createReview({
        id: "other-review",
        userId: "user-2",
        authorName: "다른 등산객",
        mountainId: mountain.id,
        body: "다른 사람이 쓴 리뷰",
      }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/내가 쓴 리뷰/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다른 등산객 한줄평 더보기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "테스트 등산객 한줄평 더보기" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));
    fireEvent.click(await screen.findByRole("button", { name: "테스트 등산객 한줄평 더보기" }));

    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("renders review metadata, image overflow and empty photo states", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const routeNames = getMountainGuide(mountain).routes
      .filter((route) => route.forestTripCourseKind)
      .slice(0, 2)
      .map((route) => route.name);
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "photo-review",
        mountainId: mountain.id,
        routeName: routeNames[0],
        body: "사진이 있는 후기입니다.",
        durationLabel: "4시간 20분",
        imageUrls: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
          "https://example.com/4.jpg",
          "https://example.com/5.jpg",
        ],
      }),
      createReview({
        id: "no-photo-review",
        mountainId: mountain.id,
        routeName: routeNames[1],
        body: "사진 없는 후기입니다.",
        imageUrls: [],
      }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/사진이 있는 후기입니다/)).toBeInTheDocument();
    expect(screen.getByText("4시간 20분")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("사진 없음")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /사진 없는 후기입니다.*사진 .* 확대/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("2026.06.01").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", { name: "기본 프로필" }).length,
    ).toBeGreaterThan(0);
  });

  it("opens review photos in a lightbox with navigation and close controls", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const [route] = getMountainGuide(mountain).routes.filter(
      (candidate) => candidate.forestTripCourseKind,
    );
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "photo-review",
        mountainId: mountain.id,
        routeName: route.name,
        body: "사진 확대 테스트입니다.",
        imageUrls: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
          "https://example.com/3.jpg",
        ],
      }),
    ]);

    renderMountainDetail();

    expect(await screen.findByText(/사진 확대 테스트입니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /한줄평 사진 1 확대/ }));

    let dialog = screen.getByRole("dialog", { name: /한줄평 사진 확대/ });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass(
      "fixed",
      "inset-0",
      "h-screen",
      "w-screen",
      "bg-black/85",
    );
    expect(within(dialog).getByRole("img")).toHaveClass(
      "object-contain",
      "max-w-[calc(100vw-32px)]",
    );
    expect(within(dialog).getByAltText(/한줄평 사진 1/)).toHaveAttribute(
      "src",
      "https://example.com/1.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: "다음 사진 보기" }));
    dialog = screen.getByRole("dialog", { name: /한줄평 사진 확대/ });
    expect(within(dialog).getByAltText(/한줄평 사진 2/)).toHaveAttribute(
      "src",
      "https://example.com/2.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: "이전 사진 보기" }));
    dialog = screen.getByRole("dialog", { name: /한줄평 사진 확대/ });
    expect(within(dialog).getByAltText(/한줄평 사진 1/)).toHaveAttribute(
      "src",
      "https://example.com/1.jpg",
    );

    fireEvent.click(screen.getByRole("button", { name: "확대 사진 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /한줄평 사진 1 확대/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /한줄평 사진 1 확대/ }));
    fireEvent.mouseDown(screen.getByRole("dialog", { name: /한줄평 사진 확대/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the full review container tall and summary focused", async () => {
    const mountain = getMountainWithMultipleOfficialRoutes();
    const [route] = getMountainGuide(mountain).routes.filter(
      (candidate) => candidate.forestTripCourseKind,
    );
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([
      createReview({
        id: "summary-review",
        mountainId: mountain.id,
        routeName: route.name,
        difficulty: "약간 어려움",
        durationMinutes: 220,
        body: "요약 테스트입니다.",
      }),
    ]);
    const { container } = renderMountainDetail();

    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));

    expect(await screen.findByText(/요약 테스트입니다/)).toBeInTheDocument();
    expect(
      container.querySelector('[aria-label$="전체 한줄평"]'),
    ).toHaveClass("min-h-[760px]");
    expect(screen.getByText("후기 요약")).toBeInTheDocument();
    expect(screen.getByText("평균 체감 난이도")).toBeInTheDocument();
    expect(screen.getByText("평균 소요시간")).toBeInTheDocument();
    expect(screen.getByText("가장 많이 선택한 코스")).toBeInTheDocument();
    expect(screen.getAllByText("약간 어려움").length).toBeGreaterThan(0);
    expect(screen.getByText("3시간 40분")).toBeInTheDocument();
    expect(screen.getAllByText("추천코스").length).toBeGreaterThan(0);
    expect(screen.queryByText("많이 언급된 키워드")).not.toBeInTheDocument();
    const tipButton = screen.getByRole("button", { name: "후기 작성 팁 보기" });
    expect(tipButton).toBeInTheDocument();
    fireEvent.click(tipButton);
    expect(screen.getByRole("dialog", { name: "후기 작성 팁" })).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "방문한 코스, 난이도, 소요시간, 길 상태, 풍경, 찾아가는 길 등을 남겨주시면 다른 등산객에게 큰 도움이 돼요!",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("creates a Supabase review with the selected route", async () => {
    const { mountain } = renderMountainDetail();
    const courseSelect = screen.getByLabelText(
      "코스를 선택해주세요",
    ) as HTMLSelectElement;
    const selectedRouteName = courseSelect.value;
    const routeStartPoint = (screen.getByLabelText("출발지") as HTMLInputElement)
      .value;
    const routeEndPoint = (screen.getByLabelText("도착지") as HTMLInputElement)
      .value;
    const reviewBody = "정상 조망이 좋아요.";
    reviewServiceMocks.createMountainReview.mockResolvedValue(
      createReview({
        id: "created-review",
        mountainId: mountain.id,
        routeName: selectedRouteName,
        body: reviewBody,
      }),
    );

    fireEvent.change(
      screen.getByPlaceholderText("코스에 대한 느낌을 자유롭게 남겨주세요."),
      { target: { value: reviewBody } },
    );
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));

    await waitFor(() => {
      expect(reviewServiceMocks.createMountainReview).toHaveBeenCalledWith(
        expect.objectContaining({
          body: reviewBody,
          imageFiles: [],
          mountainId: mountain.id,
          routeName: selectedRouteName,
          routeStartPoint,
          routeEndPoint,
          userId: "user-1",
        }),
      );
    });
    expect(await screen.findByText(/정상 조망이 좋아요/)).toBeInTheDocument();
  });

  it("previews selected images and removes them before upload", () => {
    const { container } = renderMountainDetail();
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["image"], "trail.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByAltText("trail.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "trail.png 사진 제거" }));
    expect(screen.queryByAltText("trail.png")).not.toBeInTheDocument();
  });

  it("disables review creation for signed-out users", () => {
    renderMountainDetail(null);

    expect(
      screen.getByPlaceholderText("로그인 후 한줄평을 남길 수 있습니다."),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "등록하기" })).toBeDisabled();
    expect(screen.getByText("로그인한 유저만 한줄평을 작성할 수 있습니다.")).toBeInTheDocument();
  });

  it("allows the author to edit and delete their own review", async () => {
    const existingReview = createReview({ body: "수정 전 한줄평" });
    const updatedReview = createReview({ body: "수정 후 한줄평" });
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([existingReview]);
    reviewServiceMocks.updateMountainReview.mockResolvedValue(updatedReview);
    reviewServiceMocks.deleteMountainReview.mockResolvedValue(undefined);

    renderMountainDetail();

    expect(await screen.findByText(/수정 전 한줄평/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));
    fireEvent.click(await screen.findByRole("button", { name: "테스트 등산객 한줄평 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(
      screen.getByPlaceholderText("코스에 대한 느낌을 자유롭게 남겨주세요."),
      { target: { value: "수정 후 한줄평" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(
      screen.getByRole("dialog", { name: "수정 저장" }),
    ).toBeInTheDocument();
    expect(reviewServiceMocks.updateMountainReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(reviewServiceMocks.updateMountainReview).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "수정 후 한줄평",
          existingImageUrls: [],
          imageFiles: [],
          id: existingReview.id,
          mountainId: existingReview.mountainId,
          userId: existingReview.userId,
        }),
      );
    });
    expect(await screen.findByText(/수정 후 한줄평/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "테스트 등산객 한줄평 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(
      screen.getByRole("dialog", { name: "한줄평 삭제" }),
    ).toBeInTheDocument();
    expect(reviewServiceMocks.deleteMountainReview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(reviewServiceMocks.deleteMountainReview).toHaveBeenCalledWith(updatedReview);
    });
    expect(screen.queryByText(/수정 후 한줄평/)).not.toBeInTheDocument();
  });

  it("manages existing and new photos while editing after confirmation", async () => {
    const existingReview = createReview({
      body: "사진 수정 전 한줄평",
      imageUrls: ["https://example.com/old-1.jpg", "https://example.com/old-2.jpg"],
    });
    const updatedReview = createReview({
      body: "사진 수정 전 한줄평",
      imageUrls: ["https://example.com/old-2.jpg", "https://example.com/new.jpg"],
    });
    reviewServiceMocks.fetchMountainReviews.mockResolvedValue([existingReview]);
    reviewServiceMocks.updateMountainReview.mockResolvedValue(updatedReview);
    renderMountainDetail();

    expect(await screen.findByText(/사진 수정 전 한줄평/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "한줄평" }));
    fireEvent.click(await screen.findByRole("button", { name: "테스트 등산객 한줄평 더보기" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(screen.getByAltText("기존 한줄평 사진 1")).toHaveAttribute(
      "src",
      "https://example.com/old-1.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: "기존 한줄평 사진 1 삭제" }));
    expect(screen.getByRole("dialog", { name: "사진 삭제" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(screen.getByAltText("기존 한줄평 사진 1")).toHaveAttribute(
        "src",
        "https://example.com/old-2.jpg",
      );
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["image"], "new-trail.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByRole("dialog", { name: "사진 추가" })).toBeInTheDocument();
    expect(screen.queryByAltText("new-trail.png")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByAltText("new-trail.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(reviewServiceMocks.updateMountainReview).toHaveBeenCalledWith(
        expect.objectContaining({
          existingImageUrls: ["https://example.com/old-2.jpg"],
          imageFiles: [file],
        }),
      );
    });
  });

  it("does not keep the moved feedback section inside the course detail view", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/MountainDetailPage.tsx"),
      "utf8",
    );

    expect(source).not.toContain('aria-label={`${route.name} 코스 평가`}');
    expect(source).not.toContain(
      "<CourseReviewSection reviews={reviews} routeName={route.name} />",
    );
  });
});
