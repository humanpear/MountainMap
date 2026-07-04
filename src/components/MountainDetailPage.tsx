import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  CloudRain,
  CloudSun,
  Clock,
  Droplets,
  Edit3,
  ExternalLink,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Mountain as MountainIcon,
  MountainSnow,
  Route,
  ShieldAlert,
  Trash2,
  UserRound,
  Wind,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { getMountainGuide } from "../data/mountainDetails";
import { cn } from "../lib/classNames";
import { MountainNameWithHanja } from "./MountainNameWithHanja";
import {
  fetchMountainWeather,
  getMountainWeatherPageUrl,
  getMountainWeatherStationForName,
  type MountainWeather,
} from "../services/mountainWeather";
import { isSupabaseConfigured } from "../services/env";
import {
  createMountainReview,
  deleteMountainReview,
  fetchMountainReviews,
  updateMountainReview,
  type MountainReview,
} from "../services/mountainReviews";
import type {
  ForestTripCourseKind,
  Mountain,
  MountainGuideDifficulty,
  MountainGuideImage,
  MountainGuideLink,
  MountainGuideRoute,
  MountainGuideRouteStop,
  MountainGuideSource,
  MountainGuideStatus,
} from "../types";

type MountainDetailPageProps = {
  mountain: Mountain;
  isCompleted: boolean;
  session?: Session | null;
  onBack: () => void;
  onShowOnMap: (mountain: Mountain) => void;
  onToggleCompleted: (mountain: Mountain) => void;
};

type CourseDetailTab = "overview" | "gallery";
type MountainMainTab = "courses" | "reviews";
type ForestTripCourseInfoVariant = "clean" | "matrix" | "ticket";

type CourseFeedbackPhoto = {
  id: string;
  name: string;
  url: string;
  file: File;
};

type ReviewLightboxState = {
  review: MountainReview;
  imageIndex: number;
};

type ReviewConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
};

type RouteDifficultyLabelMap = Record<string, string>;

const manualCourseRouteName = "코스 직접 입력";

type ScrollHeroState = {
  progress: number;
  expandedHeight: number;
  height: number;
  stickyOffset: number;
  imageBrightness: number;
  imageOpacity: number;
};

const initialScrollHeroState: ScrollHeroState = {
  progress: 0,
  expandedHeight: 600,
  height: 600,
  stickyOffset: 0,
  imageBrightness: 1,
  imageOpacity: 1,
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const defaultHeroImageRatio = 9 / 16;

function getExpandedHeroHeight(imageRatio = defaultHeroImageRatio) {
  if (typeof window === "undefined") {
    return initialScrollHeroState.height;
  }

  return clampNumber(window.innerWidth * imageRatio, 520, 860);
}

const difficultyLabels: Record<MountainGuideDifficulty, string> = {
  easy: "하",
  normal: "중",
  hard: "상",
  extreme: "최상",
  unknown: "확인 필요",
};

const difficultyShortLabels: Record<MountainGuideDifficulty, string> = {
  easy: "하",
  normal: "중",
  hard: "상",
  extreme: "최상",
  unknown: "확인",
};

function getGuideStatusLabel(
  status: MountainGuideStatus,
  source: MountainGuideSource,
) {
  if (status === "verified") {
    return "검증됨";
  }

  return source === "curated" ? "조사 초안 / 미검증" : "AI 초안 / 미검증";
}

function getGuideSourceLabel(source: MountainGuideSource) {
  return source === "curated" ? "웹검색 정리" : "AI 초안";
}

function getRouteTheme(route: MountainGuideRoute) {
  if (route.isRecommended || route.rank === 1) {
    return "recommended";
  }
  if (route.rank === 2) {
    return "balanced";
  }
  if (route.rank === 3) {
    return "forest";
  }
  if (route.rank >= 90) {
    return "easy";
  }
  if (route.difficulty === "easy") {
    return "easy";
  }
  if (route.difficulty === "extreme") {
    return "extreme";
  }
  if (route.difficulty === "hard") {
    return "hard";
  }
  return "forest";
}

function getRouteLabel(route: MountainGuideRoute) {
  if (route.isRecommended) {
    return "최고 인기 코스";
  }
  if (route.difficulty === "easy") {
    return "비교적 쉬운 코스";
  }
  if (route.difficulty === "hard") {
    return "난이도 높은 코스";
  }
  if (route.difficulty === "extreme") {
    return "숙련자용 고난도 코스";
  }
  if (route.rank === 2) {
    return "경관 좋은 코스";
  }
  return `코스 ${route.rank}`;
}

const routeThemeClass: Record<string, string> = {
  recommended:
    "[--route-color:#e10f07] [--route-panel:#e10f07] [--route-panel-dark:#c90000] [--route-soft:#fff7f5]",
  balanced:
    "[--route-color:#f58600] [--route-panel:#ff9100] [--route-panel-dark:#f07800] [--route-soft:#fffaf0]",
  easy: "[--route-color:#237c18] [--route-panel:#2f941f] [--route-panel-dark:#166d0d] [--route-soft:#f5fbef]",
  forest:
    "[--route-color:#237c18] [--route-panel:#2f941f] [--route-panel-dark:#166d0d] [--route-soft:#f5fbef]",
  hard: "[--route-color:#e10f07] [--route-panel:#e10f07] [--route-panel-dark:#c90000] [--route-soft:#fff7f5]",
  extreme:
    "[--route-color:#b70000] [--route-panel:#c90000] [--route-panel-dark:#8f0000] [--route-soft:#fff2f2]",
};

const difficultyThemeClass: Record<MountainGuideDifficulty, string> = {
  easy: "border-[#bfdab4] bg-[#e7f3e4] text-[#4d8b37]",
  normal: "border-[#d7e4ba] bg-[#f0f7e4] text-[#6f9134]",
  hard: "border-[#f3c79e] bg-[#fff0de] text-[#c46422]",
  extreme: "border-[#efb9b4] bg-[#fde7e3] text-[#a83a34]",
  unknown: "border-[#cfd7dc] bg-[#eef2f4] text-[#65717a]",
};

const difficultyEvaluationOptions = [
  "쉬움",
  "보통",
  "약간 어려움",
  "어려움",
  "매우 어려움",
];

const difficultyEvaluationIconSrcs = [
  "/course-feedback-icons/difficulty/easy.png",
  "/course-feedback-icons/difficulty/normal.png",
  "/course-feedback-icons/difficulty/slightly-hard.png",
  "/course-feedback-icons/difficulty/hard.png",
  "/course-feedback-icons/difficulty/extreme.png",
];

const difficultyDefaultIndex: Record<MountainGuideDifficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 3,
  extreme: 4,
  unknown: 2,
};

function getRouteStops(path: string) {
  return path
    .split(/(?:\s*(?:->|→)\s*|\s+-\s+)/g)
    .map((stop) => stop.trim())
    .filter(Boolean);
}

function buildRouteStops(route: MountainGuideRoute): MountainGuideRouteStop[] {
  if (route.routeStops?.length) {
    return route.routeStops;
  }

  const stops = getRouteStops(route.path);
  return stops.map((name, index) => ({
    name,
    label:
      index === 0
        ? "start"
        : index === stops.length - 1
          ? "finish"
          : name.includes("정상")
            ? "summit"
            : "waypoint",
  }));
}

function getRouteSummary(route: MountainGuideRoute) {
  const stops = buildRouteStops(route);
  if (stops.length >= 2) {
    return `${stops[0].name} ~ ${stops[stops.length - 1].name}`;
  }
  return route.startPoint;
}

function removeEndpointNumber(value: string) {
  return value.replace(/[\s\d①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]+$/u, "").trim();
}

const circledEndpointNumbers: Record<string, string> = {
  "①": "1",
  "②": "2",
  "③": "3",
  "④": "4",
  "⑤": "5",
  "⑥": "6",
  "⑦": "7",
  "⑧": "8",
  "⑨": "9",
  "⑩": "10",
  "⑪": "11",
  "⑫": "12",
  "⑬": "13",
  "⑭": "14",
  "⑮": "15",
  "⑯": "16",
  "⑰": "17",
  "⑱": "18",
  "⑲": "19",
  "⑳": "20",
};

function getEndpointNumber(value: string | undefined) {
  const endpoint = value?.trim() ?? "";
  const match = endpoint.match(/(?:^|\s)(\d+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])$/u);
  const rawNumber = match?.[1];

  return rawNumber ? (circledEndpointNumbers[rawNumber] ?? rawNumber) : "";
}

function getPrimaryRouteEndpoint(value: string | undefined) {
  const endpoint = value?.trim() ?? "";
  const primaryEndpoint =
    endpoint.split(/\s*(?:또는|\/|,)\s*/)[0]?.trim() ?? endpoint;

  return removeEndpointNumber(primaryEndpoint);
}

function getRouteEndpointNames(
  route: MountainGuideRoute,
  stops = buildRouteStops(route),
) {
  const pathStops = getRouteStops(route.path);
  const startPoint = getPrimaryRouteEndpoint(
    stops[0]?.name ?? pathStops[0] ?? route.startPoint,
  );
  const endPoint = getPrimaryRouteEndpoint(
    stops[stops.length - 1]?.name ??
      pathStops[pathStops.length - 1] ??
      route.startPoint,
  );

  return {
    startPoint,
    endPoint,
  };
}

function isRoundTripRoute(
  route: MountainGuideRoute,
  stops = buildRouteStops(route),
) {
  const pathStops = getRouteStops(route.path);
  const startNumber = getEndpointNumber(stops[0]?.name ?? pathStops[0]);
  const endNumber = getEndpointNumber(
    stops[stops.length - 1]?.name ?? pathStops[pathStops.length - 1],
  );

  if (startNumber && endNumber) {
    return startNumber === endNumber;
  }

  const normalize = (value: string | undefined) =>
    removeEndpointNumber(value ?? "")
      .replace(/\s+/g, "")
      .trim();
  const { startPoint, endPoint } = getRouteEndpointNames(route, stops);
  const firstStop = normalize(startPoint);
  const lastStop = normalize(endPoint);

  return (
    route.name.includes("원점회귀") ||
    route.name.includes("왕복") ||
    (Boolean(firstStop) && firstStop === lastStop)
  );
}

function getPrimaryStartPoint(
  route: MountainGuideRoute,
  stops = buildRouteStops(route),
) {
  return getRouteEndpointNames(route, stops).startPoint || route.name;
}

function getRouteDisplayName(route: MountainGuideRoute) {
  const stops = buildRouteStops(route);
  const { startPoint, endPoint } = getRouteEndpointNames(route, stops);

  if (!startPoint) {
    return `${route.name} 코스`;
  }

  if (isRoundTripRoute(route, stops) || startPoint === endPoint || !endPoint) {
    return `${startPoint} 원점회귀 코스`;
  }

  return `${startPoint}→${endPoint} 코스`;
}

function getSummaryMetricValue(value: string) {
  return value
    .replace(/^약\s*/, "")
    .replace(/\s*원점회귀$/, "")
    .replace(/\s*안팎$/, "")
    .trim();
}

function getRouteImage(
  route: MountainGuideRoute,
  guidePhotos: MountainGuideLink[],
  index = 0,
) {
  if (route.heroImageUrl) {
    return route.heroImageUrl;
  }
  if (route.courseMapImage?.src) {
    return route.courseMapImage.src;
  }
  return guidePhotos[index % Math.max(guidePhotos.length, 1)]?.url;
}

function getHeroImage(
  route: MountainGuideRoute | undefined,
  guidePhotos: MountainGuideLink[],
  guideHeroImage?: MountainGuideImage,
) {
  if (route) {
    return getRouteImage(route, guidePhotos);
  }
  return guideHeroImage?.src ?? guidePhotos[0]?.url;
}

export function getMountainMainHeroImage(
  mountainId: string,
  guideHeroImage?: MountainGuideImage,
) {
  return guideHeroImage?.src ?? `/mountain-images/${mountainId}/hero.png`;
}

function createPhotoPreviewUrl(file: File) {
  return typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : "";
}

function revokePhotoPreviewUrl(url: string) {
  if (url && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
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

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

export function MountainDetailPage({
  mountain,
  isCompleted,
  session = null,
  onBack,
  onShowOnMap,
  onToggleCompleted,
}: MountainDetailPageProps) {
  const guide = getMountainGuide(mountain);
  const sortedRoutes = useMemo(
    () =>
      [...guide.routes].sort(
        (a, b) =>
          Number(b.isRecommended) - Number(a.isRecommended) || a.rank - b.rank,
      ),
    [guide.routes],
  );
  const [activeRouteName, setActiveRouteName] = useState<string | null>(null);
  const activeRoute = sortedRoutes.find(
    (route) => route.name === activeRouteName,
  );

  useEffect(() => {
    setActiveRouteName(null);
  }, [mountain.id]);

  if (activeRoute) {
    return (
      <CourseDetailView
        mountain={mountain}
        route={activeRoute}
        guidePhotos={guide.photoLinks ?? []}
        onBackToMountain={() => setActiveRouteName(null)}
        onBackToMap={onBack}
      />
    );
  }

  return (
    <MountainMainDetailView
      mountain={mountain}
      routes={sortedRoutes}
      guideSource={guide.source}
      guideStatus={guide.status}
      selectionReason={guide.selectionReason ?? mountain.selectionReason}
      notes={guide.notes}
      heroImage={guide.heroImage}
      courseMapImage={guide.courseMapImage}
      isCompleted={isCompleted}
      session={session}
      onBack={onBack}
      onShowOnMap={onShowOnMap}
      onToggleCompleted={onToggleCompleted}
      onRouteOpen={(route) => setActiveRouteName(route.name)}
    />
  );
}

function MountainMainDetailView({
  mountain,
  routes,
  guideSource,
  guideStatus,
  selectionReason,
  notes,
  heroImage: guideHeroImage,
  courseMapImage,
  isCompleted,
  session,
  onBack,
  onShowOnMap,
  onToggleCompleted,
  onRouteOpen,
}: {
  mountain: Mountain;
  routes: MountainGuideRoute[];
  guideSource: MountainGuideSource;
  guideStatus: MountainGuideStatus;
  selectionReason: string;
  notes?: string;
  heroImage?: MountainGuideImage;
  courseMapImage?: MountainGuideImage;
  isCompleted: boolean;
  session: Session | null;
  onBack: () => void;
  onShowOnMap: (mountain: Mountain) => void;
  onToggleCompleted: (mountain: Mountain) => void;
  onRouteOpen: (route: MountainGuideRoute) => void;
}) {
  const heroImage = getMountainMainHeroImage(mountain.id, guideHeroImage);
  const recommendedRoute = routes[0];
  const sectionRef = useRef<HTMLElement | null>(null);
  const heroContentRef = useRef<HTMLDivElement | null>(null);
  const [mainTab, setMainTab] = useState<MountainMainTab>("courses");
  const [reviewDifficultyLabelsByRoute, setReviewDifficultyLabelsByRoute] =
    useState<RouteDifficultyLabelMap>({});
  const [heroImageRatio, setHeroImageRatio] = useState(defaultHeroImageRatio);
  const [heroState, setHeroState] = useState<ScrollHeroState>(() => ({
    ...initialScrollHeroState,
    expandedHeight: getExpandedHeroHeight(defaultHeroImageRatio),
    height: getExpandedHeroHeight(defaultHeroImageRatio),
  }));
  const handleRouteDifficultyLabelsChange = useCallback(
    (difficultyLabels: RouteDifficultyLabelMap) => {
      setReviewDifficultyLabelsByRoute((currentLabels) =>
        areDifficultyLabelMapsEqual(currentLabels, difficultyLabels)
          ? currentLabels
          : difficultyLabels,
      );
    },
    [],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    let animationFrameId = 0;

    const updateHeroState = () => {
      animationFrameId = 0;

      const expandedHeight = getExpandedHeroHeight(heroImageRatio);
      const measuredContentHeight = heroContentRef.current?.offsetHeight ?? 0;
      const contentHeight =
        measuredContentHeight > 0 ? measuredContentHeight : 360;
      const visualExpandedHeight = Math.max(expandedHeight, contentHeight);
      const pageScrollTop = Math.max(0, -section.getBoundingClientRect().top);
      if (window.innerWidth <= 900) {
        const mobileDarkeningDistance = Math.max(1, visualExpandedHeight * 0.82);
        const progress = clampNumber(
          Math.max(section.scrollTop, pageScrollTop) / mobileDarkeningDistance,
          0,
          1,
        );
        const nextState: ScrollHeroState = {
          progress,
          expandedHeight: visualExpandedHeight,
          height: visualExpandedHeight,
          stickyOffset: 0,
          imageBrightness: 1 - 0.45 * progress,
          imageOpacity: 1 - 0.28 * progress,
        };

        setHeroState((currentState) => {
          const hasMeaningfulChange =
            Math.abs(currentState.progress - nextState.progress) > 0.002 ||
            Math.abs(currentState.expandedHeight - nextState.expandedHeight) >
              0.5 ||
            Math.abs(currentState.height - nextState.height) > 0.5 ||
            Math.abs(currentState.stickyOffset - nextState.stickyOffset) >
              0.5 ||
            Math.abs(
              currentState.imageBrightness - nextState.imageBrightness,
            ) > 0.002 ||
            Math.abs(currentState.imageOpacity - nextState.imageOpacity) >
              0.002;

          return hasMeaningfulChange ? nextState : currentState;
        });
        return;
      }

      const collapsedHeight = Math.min(visualExpandedHeight, contentHeight);
      const collapseDistance = Math.max(
        1,
        visualExpandedHeight - collapsedHeight,
      );
      const scrollTop = Math.max(section.scrollTop, pageScrollTop);
      const progress = clampNumber(scrollTop / collapseDistance, 0, 1);
      const nextHeight =
        visualExpandedHeight -
        (visualExpandedHeight - collapsedHeight) * progress;
      const nextState: ScrollHeroState = {
        progress,
        expandedHeight: visualExpandedHeight,
        height: nextHeight,
        stickyOffset: Math.min(scrollTop, collapseDistance),
        imageBrightness: 1 - 0.45 * progress,
        imageOpacity: 1 - 0.28 * progress,
      };

      setHeroState((currentState) => {
        const hasMeaningfulChange =
          Math.abs(currentState.progress - nextState.progress) > 0.002 ||
          Math.abs(currentState.expandedHeight - nextState.expandedHeight) >
            0.5 ||
          Math.abs(currentState.height - nextState.height) > 0.5 ||
          Math.abs(currentState.stickyOffset - nextState.stickyOffset) > 0.5 ||
          Math.abs(currentState.imageBrightness - nextState.imageBrightness) >
            0.002 ||
          Math.abs(currentState.imageOpacity - nextState.imageOpacity) > 0.002;

        return hasMeaningfulChange ? nextState : currentState;
      });
    };

    const scheduleHeroUpdate = () => {
      if (animationFrameId === 0) {
        animationFrameId = window.requestAnimationFrame(updateHeroState);
      }
    };

    updateHeroState();
    section.addEventListener("scroll", scheduleHeroUpdate, { passive: true });
    window.addEventListener("scroll", scheduleHeroUpdate, { passive: true });
    window.addEventListener("resize", scheduleHeroUpdate);

    const contentResizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(scheduleHeroUpdate);
    if (heroContentRef.current && contentResizeObserver) {
      contentResizeObserver.observe(heroContentRef.current);
    }

    return () => {
      section.removeEventListener("scroll", scheduleHeroUpdate);
      window.removeEventListener("scroll", scheduleHeroUpdate);
      window.removeEventListener("resize", scheduleHeroUpdate);
      contentResizeObserver?.disconnect();
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [heroImageRatio, mountain.id, routes.length, selectionReason]);

  const handleHeroImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalHeight, naturalWidth } = event.currentTarget;
    if (naturalHeight > 0 && naturalWidth > 0) {
      setHeroImageRatio(naturalHeight / naturalWidth);
    }
  };

  const heroFrameStyle = {
    height: `${heroState.expandedHeight}px`,
    "--hero-frame-height": `${heroState.height}px`,
    "--hero-image-url": `url("${heroImage}")`,
    "--hero-sticky-offset": `${heroState.stickyOffset}px`,
    "--hero-image-brightness": heroState.imageBrightness.toFixed(3),
    "--hero-image-opacity": heroState.imageOpacity.toFixed(3),
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      className="min-h-[calc(100vh-68px)] min-w-0 w-full max-w-[100vw] bg-[#f5f7f4] font-sans text-mountain-ink"
      aria-label={`${mountain.name} 상세 정보`}
    >
      <header className="relative bg-black text-white" style={heroFrameStyle}>
        <div
          data-scroll-hero-frame
          className="sticky top-0 flex items-end overflow-hidden bg-black text-white max-[900px]:relative max-[900px]:top-auto"
          style={
            {
              height: "var(--hero-frame-height)",
            } as CSSProperties
          }
        >
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-black">
            {heroImage ? (
              <img
                className="absolute inset-0 h-full w-full max-w-none object-cover"
                src={heroImage}
                alt={`${mountain.name} 대표 이미지`}
                onLoad={handleHeroImageLoad}
                style={
                  {
                    filter: "brightness(var(--hero-image-brightness))",
                    opacity: "var(--hero-image-opacity)",
                  } as CSSProperties
                }
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(135deg,#133628,#06263a)]" />
            )}
          </div>
          <div
            ref={heroContentRef}
            data-scroll-hero-content
            className="relative z-[1] mx-auto w-[1180px] max-w-[calc(100%-80px)] pb-[34px] pt-[18px] max-[900px]:w-full max-[900px]:max-w-none max-[900px]:px-4 max-[900px]:pb-6"
          >
            <div className="grid min-h-[384px] grid-cols-[minmax(0,1fr)_304px] grid-rows-[auto_auto] items-end gap-x-[58px] gap-y-0 pt-5 max-[900px]:min-h-0 max-[900px]:grid-cols-1 max-[900px]:grid-rows-none max-[900px]:gap-5 max-[900px]:pt-6 max-[560px]:gap-4">
              <div className="col-start-1 row-start-1 max-w-[760px] max-[900px]:col-start-auto max-[900px]:row-start-auto">
                <div className="mb-10 flex flex-wrap items-center gap-3 max-[900px]:mb-5 max-[560px]:gap-2">
                  <span className="inline-flex min-h-[42px] items-center rounded-[5px] bg-[#00385d] px-3.5 text-[22px] font-black leading-none text-white shadow-heroPanel max-[560px]:min-h-9 max-[560px]:px-3 max-[560px]:text-lg">
                    {mountain.elevationMeters.toLocaleString()}m
                  </span>
                  <button
                    className={cn(
                       "inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-extrabold shadow-heroPanel transition max-[560px]:min-h-9 max-[560px]:px-3 max-[560px]:text-[13px]",
                      isCompleted
                        ? "border-[#1f8a5b] bg-[#1f8a5b] text-white"
                        : "border-white/70 bg-black/30 text-white hover:bg-black/45",
                    )}
                    type="button"
                    onClick={() => onToggleCompleted(mountain)}
                  >
                    <Check size={17} />
                    {isCompleted ? "등반완료 해제" : "등반완료"}
                  </button>
                </div>
              </div>
               <div className="col-start-1 row-start-2 flex max-w-[760px] self-stretch flex-col justify-between gap-10 max-[900px]:col-start-auto max-[900px]:row-start-auto max-[900px]:gap-5 max-[560px]:gap-4">
                <h2 className="m-0 text-[78px] font-black leading-[0.96] text-white shadow-black [letter-spacing:0] [text-shadow:0_5px_18px_rgba(0,0,0,0.42)] max-[900px]:text-[clamp(36px,10vw,52px)] max-[560px]:text-[34px] max-[560px]:leading-[1.02]">
                  <MountainNameWithHanja
                    mountain={mountain}
                    className="flex-wrap"
                    hanjaClassName="text-[0.35em] leading-none text-white/95"
                  />
                </h2>
                <p className="m-0 max-w-[650px] break-keep text-lg font-extrabold leading-[31px] text-white/95 max-[900px]:text-base max-[900px]:leading-7 max-[560px]:leading-6">
                  {selectionReason}
                </p>
              </div>

              <aside
                className="col-start-2 row-start-2 self-stretch rounded-[9px] border border-white/25 bg-black/45 px-[22px] py-[23px] text-white shadow-heroPanel backdrop-blur-sm max-[900px]:hidden [&_dl]:grid [&_dl]:gap-0 [&_h3]:mb-4 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-white"
                aria-label="산 정보"
              >
                <h3>산 정보</h3>
                <dl>
                  <HeroInfoRow
                    icon={<MapPin size={16} />}
                    label="위치"
                    value={`${mountain.province} ${mountain.city}`}
                  />
                  <HeroInfoRow
                    icon={<MountainIcon size={16} />}
                    label="높이"
                    value={`${mountain.elevationMeters.toLocaleString()}m`}
                  />
                  <HeroInfoRow
                    icon={<ShieldAlert size={16} />}
                    label="난이도"
                    value={
                      recommendedRoute
                        ? difficultyLabels[recommendedRoute.difficulty]
                        : "확인 필요"
                    }
                  />
                  <HeroInfoRow
                    icon={<Clock size={16} />}
                    label="소요시간"
                    value={recommendedRoute?.estimatedTime ?? "확인 필요"}
                  />
                </dl>
                <button
                  className="mt-[17px] inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-white/70 bg-black/10 px-3 text-[15px] font-extrabold text-white"
                  type="button"
                  onClick={() => onShowOnMap(mountain)}
                >
                  지도에서 보기
                  <MapPin size={17} />
                </button>
              </aside>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 w-full max-w-full px-4 pb-0 pt-[30px] min-[1260px]:max-w-[1180px] min-[1260px]:px-0">
        <RecommendedCourseSection
          courseMapImage={courseMapImage}
          routes={routes}
          activeTab={mainTab}
          onTabChange={setMainTab}
          routeDifficultyLabels={reviewDifficultyLabelsByRoute}
          weatherSection={<WeatherStatusCard mountain={mountain} />}
          reviewSection={
            <CourseFeedbackSection
              mountain={mountain}
              routes={routes}
              session={session}
              mode={mainTab === "reviews" ? "full" : "preview"}
              onShowAllReviews={() => setMainTab("reviews")}
              onRouteDifficultyLabelsChange={handleRouteDifficultyLabelsChange}
            />
          }
        />
      </main>
    </section>
  );
}

function CourseDetailView({
  mountain,
  route,
  guidePhotos,
  onBackToMountain,
  onBackToMap,
}: {
  mountain: Mountain;
  route: MountainGuideRoute;
  guidePhotos: MountainGuideLink[];
  onBackToMountain: () => void;
  onBackToMap: () => void;
}) {
  const heroImage = getHeroImage(route, guidePhotos);
  const heroStyle = heroImage
    ? ({
        backgroundImage: `linear-gradient(90deg, rgba(0, 14, 23, 0.76) 0%, rgba(0, 14, 23, 0.46) 42%, rgba(0, 14, 23, 0.12) 100%), linear-gradient(0deg, rgba(0, 14, 23, 0.5) 0%, rgba(0, 14, 23, 0.04) 54%, rgba(0, 14, 23, 0.2) 100%), url("${heroImage}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      } as CSSProperties)
    : undefined;
  const stops = buildRouteStops(route);
  const photos = guidePhotos;
  const [activeTab, setActiveTab] = useState<CourseDetailTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [route.name]);

  return (
    <section
      className="min-h-[calc(100vh-68px)] min-w-0 w-full max-w-[100vw] bg-white font-sans text-mountain-ink"
      aria-label={`${mountain.name} ${route.name} 상세 정보`}
    >
      <header
        className="relative min-h-[394px] overflow-hidden bg-[linear-gradient(135deg,rgba(6,38,58,0.95),rgba(16,69,56,0.84)),linear-gradient(135deg,#133628,#06263a)] text-white max-[900px]:min-h-0"
        style={heroStyle}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,12,22,0.62)_0%,rgba(0,12,22,0.22)_58%,rgba(0,12,22,0.36)_100%)]" />
        <div className="relative z-[1] mx-auto w-[1180px] max-w-[calc(100%-60px)] pb-[34px] pt-[18px] max-[900px]:w-full max-[900px]:max-w-none max-[900px]:px-4 max-[900px]:pb-8">
          <nav
            className="flex min-h-8 flex-wrap items-center gap-2 text-sm font-extrabold text-white/85 [&_button]:inline-flex [&_button]:items-center [&_button]:gap-1.5 [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:font-black [&_button]:text-white"
            aria-label="현재 위치"
          >
            <button type="button" onClick={onBackToMap}>
              홈
            </button>
            <span aria-hidden="true">›</span>
            <span>추천 코스</span>
            <span aria-hidden="true">›</span>
            <button type="button" onClick={onBackToMountain}>
              {mountain.name}
            </button>
            <span aria-hidden="true">›</span>
            <strong>{getRouteDisplayName(route)}</strong>
          </nav>

          <div className="grid min-h-[318px] grid-cols-[minmax(0,1fr)_312px] items-end gap-[58px] pt-[26px] max-[900px]:min-h-0 max-[900px]:grid-cols-1 max-[900px]:gap-6">
            <div>
              <span
                className={cn(
                  "mb-[18px] inline-flex rounded-[5px] bg-[#e10f07] px-2.5 py-1.5 text-sm font-black leading-[18px] text-white shadow-[0_8px_18px_rgba(0,0,0,0.26)]",
                  routeThemeClass[getRouteTheme(route)],
                )}
              >
                {getRouteLabel(route)}
              </span>
              <h2 className="m-0 max-w-[780px] text-[46px] font-black leading-[1.12] text-white [letter-spacing:0] [text-shadow:0_5px_18px_rgba(0,0,0,0.42)] max-[900px]:text-[clamp(34px,11vw,48px)]">
                <span>
                  {mountain.name} {getRouteDisplayName(route)}
                </span>
                <b className="ml-3 inline-flex min-h-9 min-w-9 translate-y-[-4px] items-center justify-center rounded-[8px] bg-[#e10f07] px-2.5 text-[18px] font-black leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.24)]">
                  {difficultyShortLabels[route.difficulty]}
                </b>
              </h2>
              <p className="mt-3 max-w-[650px] text-lg font-extrabold leading-[31px] text-white/95">
                {getRouteSummary(route)}
              </p>
              <p className="mt-5 max-w-[650px] text-base font-bold leading-7 text-white/95">
                {route.summary ??
                  route.recommendationReason ??
                  `${route.name}의 주요 경유지와 접근 정보를 확인하세요.`}
              </p>
              <div className="mt-[46px] grid grid-cols-4 gap-[38px] max-[900px]:mt-7 max-[900px]:grid-cols-2 max-[900px]:gap-3.5">
                <HeroFact
                  icon={<Route size={19} />}
                  label="거리"
                  value={route.distance}
                />
                <HeroFact
                  icon={<Clock size={19} />}
                  label="소요시간"
                  value={route.estimatedTime}
                />
                <HeroFact
                  icon={<MountainIcon size={19} />}
                  label="누적 고도"
                  value={route.elevationGain ?? "확인 필요"}
                />
                <HeroFact
                  icon={<ShieldAlert size={19} />}
                  label="난이도"
                  value={difficultyLabels[route.difficulty]}
                />
              </div>
            </div>

            <aside
              className="self-center rounded-[8px] border border-white/20 bg-black/60 px-[22px] py-[23px] text-white shadow-heroPanel backdrop-blur-xl [&_dl]:grid [&_dl]:gap-0 [&_h3]:mb-4 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-white"
              aria-label="코스 정보 요약"
            >
              <h3>코스 정보 요약</h3>
              <dl>
                <HeroInfoRow
                  icon={<MapPin size={16} />}
                  label="출발지"
                  value={stops[0]?.name ?? route.startPoint}
                />
                <HeroInfoRow
                  icon={<MapPin size={16} />}
                  label="도착지"
                  value={stops[stops.length - 1]?.name ?? "확인 필요"}
                />
                <HeroInfoRow
                  icon={<Route size={16} />}
                  label="거리"
                  value={route.distance}
                />
                <HeroInfoRow
                  icon={<Clock size={16} />}
                  label="소요시간"
                  value={route.estimatedTime}
                />
                <HeroInfoRow
                  icon={<ShieldAlert size={16} />}
                  label="난이도"
                  value={difficultyLabels[route.difficulty]}
                />
                <HeroInfoRow
                  icon={<MountainIcon size={16} />}
                  label="최고 고도"
                  value={`${mountain.elevationMeters.toLocaleString()}m`}
                />
                <HeroInfoRow
                  icon={<Route size={16} />}
                  label="누적 고도"
                  value={route.elevationGain ?? "확인 필요"}
                />
              </dl>
            </aside>
          </div>
        </div>
      </header>

      <main className="pb-0">
        <div
          className="border-b border-[#dedede] bg-white"
          role="tablist"
          aria-label="코스 상세 탭"
        >
          <div className="mx-auto flex w-[1180px] max-w-[calc(100%-60px)] gap-[30px] overflow-x-auto [&_button]:min-h-[54px] [&_button]:shrink-0 [&_button]:border-0 [&_button]:border-b-4 [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-6 [&_button]:text-[21px] [&_button]:font-black [&_button]:text-[#627168] [&_button.is-active]:border-b-[#e10f07] [&_button.is-active]:text-[#18221d] max-[900px]:max-w-none max-[900px]:px-4 max-[560px]:gap-3 max-[560px]:[&_button]:px-2 max-[560px]:[&_button]:text-[18px]">
            <button
              className={cn(activeTab === "overview" && "is-active")}
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
            >
              코스 개요
            </button>
            <button
              className={cn(activeTab === "gallery" && "is-active")}
              type="button"
              role="tab"
              aria-selected={activeTab === "gallery"}
              onClick={() => setActiveTab("gallery")}
            >
              포토 갤러리
            </button>
          </div>
        </div>

        <div className="mx-auto w-[1180px] max-w-[calc(100%-60px)] pt-[22px] max-[900px]:w-full max-[900px]:max-w-none max-[900px]:px-4">
          {activeTab === "overview" ? (
            <>
              <section
                className="grid grid-cols-[minmax(0,760px)_minmax(310px,1fr)] gap-5 max-[900px]:grid-cols-1"
                aria-label="코스 지도와 타임라인"
              >
                <div className="rounded-md border border-[#dedede] bg-white p-[22px] shadow-[0_10px_28px_rgba(24,34,29,0.04)] max-[560px]:p-4">
                  <h3 className="m-0 mb-4 text-[22px] font-black">
                    코스 이미지
                  </h3>
                  <CourseMapImagePanel route={route} />
                </div>
                <CourseTimelinePanel stops={stops} route={route} />
              </section>
            </>
          ) : (
            <CoursePhotoGalleryPanel
              mountainName={`${mountain.name} ${route.name}`}
              links={photos}
            />
          )}
        </div>
      </main>
    </section>
  );
}

function getDefaultFeedbackRouteName(routes: MountainGuideRoute[]) {
  return (
    routes.find(
      (route) =>
        route.forestTripCourseKind === "recommended" || route.isRecommended,
    )?.name ??
    routes[0]?.name ??
    manualCourseRouteName
  );
}

const reviewFilterLabels: Record<ForestTripCourseKind, string> = {
  recommended: "추천코스",
  other1: "기타코스1",
  other2: "기타코스2",
  other3: "기타코스3",
};

type ReviewFilterKind = "all" | ForestTripCourseKind | "mine";
type ReviewSortOrder = "newest" | "oldest";

type ReviewFilterOption = {
  kind: ReviewFilterKind;
  label: string;
};

function getReviewRouteKind(
  review: MountainReview,
  routes: MountainGuideRoute[],
) {
  return routes.find(
    (route) =>
      route.name === review.routeName ||
      getRouteDisplayName(route) === review.routeName,
    )?.forestTripCourseKind;
}

function getReviewRouteEndpoints(
  review: MountainReview,
  routes: MountainGuideRoute[],
) {
  if (review.routeStartPoint || review.routeEndPoint) {
    return {
      startPoint: review.routeStartPoint?.trim() || "출발지 미입력",
      endPoint: review.routeEndPoint?.trim() || "도착지 미입력",
    };
  }

  const route = routes.find(
    (candidate) =>
      candidate.name === review.routeName ||
      getRouteDisplayName(candidate) === review.routeName,
  );

  if (!route) {
    return null;
  }

  const endpoints = getRouteEndpointNames(route);
  if (!endpoints.startPoint && !endpoints.endPoint) {
    return null;
  }

  return {
    startPoint: endpoints.startPoint || "출발지 미입력",
    endPoint: endpoints.endPoint || "도착지 미입력",
  };
}

function isReviewForRoute(review: MountainReview, route: MountainGuideRoute) {
  return (
    review.routeName === route.name ||
    review.routeName === getRouteDisplayName(route)
  );
}

function getMostSelectedDifficultyLabel(reviews: MountainReview[]) {
  const counts = difficultyEvaluationOptions.map(() => 0);

  reviews.forEach((review) => {
    const index = difficultyEvaluationOptions.indexOf(review.difficulty);
    if (index >= 0) {
      counts[index] += 1;
    }
  });

  let selectedIndex = -1;
  let selectedCount = 0;
  counts.forEach((count, index) => {
    if (count > selectedCount) {
      selectedIndex = index;
      selectedCount = count;
    }
  });

  return selectedIndex >= 0
    ? difficultyEvaluationOptions[selectedIndex]
    : undefined;
}

function getRouteDifficultyLabelMap(
  reviews: MountainReview[],
  routes: MountainGuideRoute[],
): RouteDifficultyLabelMap {
  return routes.reduce<RouteDifficultyLabelMap>((difficultyMap, route) => {
    const routeReviews = reviews.filter((review) => isReviewForRoute(review, route));
    const difficultyLabel = getMostSelectedDifficultyLabel(routeReviews);

    if (difficultyLabel) {
      difficultyMap[route.name] = difficultyLabel;
    }

    return difficultyMap;
  }, {});
}

function areDifficultyLabelMapsEqual(
  left: RouteDifficultyLabelMap,
  right: RouteDifficultyLabelMap,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

function CourseFeedbackSection({
  mountain,
  routes,
  session,
  mode,
  onShowAllReviews,
  onRouteDifficultyLabelsChange,
}: {
  mountain: Mountain;
  routes: MountainGuideRoute[];
  session: Session | null;
  mode: "preview" | "full";
  onShowAllReviews: () => void;
  onRouteDifficultyLabelsChange?: (difficultyLabels: RouteDifficultyLabelMap) => void;
}) {
  const feedbackRoutes = useMemo(
    () => routes.filter((route) => route.forestTripCourseKind),
    [routes],
  );
  const displayRoutes = feedbackRoutes.length > 0 ? feedbackRoutes : routes;
  const defaultRouteName = getDefaultFeedbackRouteName(displayRoutes);
  const [selectedRouteName, setSelectedRouteName] = useState<string | null>(
    defaultRouteName,
  );
  const isManualCourse = selectedRouteName === manualCourseRouteName;
  const selectedRoute =
    !isManualCourse && selectedRouteName
      ? displayRoutes.find((route) => route.name === selectedRouteName)
      : undefined;
  const selectedRouteEndpoints = selectedRoute
    ? getRouteEndpointNames(selectedRoute)
    : null;
  const [manualStartPoint, setManualStartPoint] = useState("");
  const [manualEndPoint, setManualEndPoint] = useState("");
  const [difficultyIndex, setDifficultyIndex] = useState(
    difficultyDefaultIndex[selectedRoute?.difficulty ?? "unknown"],
  );
  const [durationMinutes, setDurationMinutes] = useState(
    getDefaultDurationMinutes(selectedRoute?.estimatedTime ?? ""),
  );
  const [reviewText, setReviewText] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<CourseFeedbackPhoto[]>([]);
  const [editingExistingImageUrls, setEditingExistingImageUrls] = useState<
    string[]
  >([]);
  const [reviews, setReviews] = useState<MountainReview[]>([]);
  const [reviewState, setReviewState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [isFullReviewFormOpen, setIsFullReviewFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [lightboxState, setLightboxState] = useState<ReviewLightboxState | null>(
    null,
  );
  const [confirmDialog, setConfirmDialog] =
    useState<ReviewConfirmDialogState | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedPhotosRef = useRef<CourseFeedbackPhoto[]>([]);
  const trimmedReviewText = reviewText.trim();
  const currentUserId = session?.user.id ?? null;
  const canWrite = Boolean(currentUserId && isSupabaseConfigured);
  const editingReview = editingReviewId
    ? reviews.find((review) => review.id === editingReviewId)
    : undefined;
  const totalSelectedPhotoCount =
    (editingReview ? editingExistingImageUrls.length : 0) + uploadedPhotos.length;

  useEffect(() => {
    onRouteDifficultyLabelsChange?.(
      getRouteDifficultyLabelMap(reviews, displayRoutes),
    );
  }, [displayRoutes, onRouteDifficultyLabelsChange, reviews]);

  useEffect(() => {
    setSelectedRouteName((currentRouteName) => {
      if (
        currentRouteName &&
        (currentRouteName === manualCourseRouteName ||
          displayRoutes.some((route) => route.name === currentRouteName))
      ) {
        return currentRouteName;
      }

      return defaultRouteName;
    });
  }, [defaultRouteName, displayRoutes]);

  useEffect(() => {
    uploadedPhotosRef.current = uploadedPhotos;
  }, [uploadedPhotos]);

  useEffect(() => {
    return () => {
      uploadedPhotosRef.current.forEach((photo) =>
        revokePhotoPreviewUrl(photo.url),
      );
    };
  }, []);

  useEffect(() => {
    if (editingReviewId) {
      return;
    }
    if (selectedRoute) {
      const endpoints = getRouteEndpointNames(selectedRoute);
      setDifficultyIndex(difficultyDefaultIndex[selectedRoute.difficulty]);
      setDurationMinutes(getDefaultDurationMinutes(selectedRoute.estimatedTime));
      setManualStartPoint(endpoints.startPoint);
      setManualEndPoint(endpoints.endPoint);
    } else {
      setDifficultyIndex(difficultyDefaultIndex.unknown);
      setDurationMinutes(180);
      setManualStartPoint("");
      setManualEndPoint("");
    }
    setReviewText("");
    setFormMessage(null);
    setUploadedPhotos((photos) => {
      photos.forEach((photo) => revokePhotoPreviewUrl(photo.url));
      return [];
    });
  }, [
    editingReviewId,
    selectedRoute?.difficulty,
    selectedRoute?.estimatedTime,
    selectedRoute?.name,
  ]);

  useEffect(() => {
    let isActive = true;

    if (!isSupabaseConfigured) {
      setReviews([]);
      setReviewState("error");
      setListMessage("Supabase 설정이 없어 한줄평을 불러올 수 없습니다.");
      return () => {
        isActive = false;
      };
    }

    setReviewState("loading");
    setListMessage(null);
    fetchMountainReviews(mountain.id)
      .then((nextReviews) => {
        if (!isActive) {
          return;
        }
        setReviews(nextReviews);
        setReviewState("ready");
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }
        setReviews([]);
        setReviewState("error");
        setListMessage(getReviewErrorMessage(error, "load"));
      });

    return () => {
      isActive = false;
    };
  }, [mountain.id]);

  const addSelectedPhotos = (selectedFiles: File[]) => {
    const remainingSlots = Math.max(5 - totalSelectedPhotoCount, 0);
    const acceptedFiles = selectedFiles.filter((file) => {
      const isSupportedType =
        file.type === "image/jpeg" || file.type === "image/png";
      return isSupportedType && file.size <= 10 * 1024 * 1024;
    });

    if (remainingSlots <= 0) {
      setFormMessage("사진은 최대 5장까지 추가할 수 있습니다.");
      return;
    }

    if (acceptedFiles.length !== selectedFiles.length) {
      setFormMessage("JPG, PNG 파일만 10MB 이하로 추가할 수 있습니다.");
    }

    const nextPhotos = selectedFiles
      .filter((file) => acceptedFiles.includes(file))
      .slice(0, remainingSlots)
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: createPhotoPreviewUrl(file),
        file,
      }));

    if (nextPhotos.length > 0) {
      setUploadedPhotos((photos) => [...photos, ...nextPhotos]);
    }
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    if (editingReview) {
      setConfirmDialog({
        title: "사진 추가",
        message: "기존 사진에 새로운 사진을 추가하시겠습니까?",
        confirmLabel: "추가",
        onConfirm: () => addSelectedPhotos(selectedFiles),
      });
      return;
    }

    addSelectedPhotos(selectedFiles);
  };

  const removeUploadedPhoto = (photoId: string) => {
    setUploadedPhotos((photos) => {
      const photoToRemove = photos.find((photo) => photo.id === photoId);
      if (photoToRemove) {
        revokePhotoPreviewUrl(photoToRemove.url);
      }

      return photos.filter((photo) => photo.id !== photoId);
    });
  };

  const requestRemoveExistingPhoto = (imageUrl: string) => {
    setConfirmDialog({
      title: "사진 삭제",
      message: "기존 사진을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      tone: "danger",
      onConfirm: () => {
        setEditingExistingImageUrls((imageUrls) =>
          imageUrls.filter((currentUrl) => currentUrl !== imageUrl),
        );
      },
    });
  };

  const resetReviewForm = () => {
    const defaultRoute =
      defaultRouteName === manualCourseRouteName
        ? undefined
        : displayRoutes.find((route) => route.name === defaultRouteName);

    setEditingReviewId(null);
    setEditingExistingImageUrls([]);
    setSelectedRouteName(defaultRouteName);
    setReviewText("");
    setFormMessage(null);
    setConfirmDialog(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    setUploadedPhotos((photos) => {
      photos.forEach((photo) => revokePhotoPreviewUrl(photo.url));
      return [];
    });
    if (defaultRoute) {
      setDifficultyIndex(difficultyDefaultIndex[defaultRoute.difficulty]);
      setDurationMinutes(getDefaultDurationMinutes(defaultRoute.estimatedTime));
      const endpoints = getRouteEndpointNames(defaultRoute);
      setManualStartPoint(endpoints.startPoint);
      setManualEndPoint(endpoints.endPoint);
    } else {
      setDifficultyIndex(difficultyDefaultIndex.unknown);
      setDurationMinutes(180);
      setManualStartPoint("");
      setManualEndPoint("");
    }
  };

  const handleReviewSubmit = async () => {
    if (!trimmedReviewText || isSubmitting) {
      return;
    }

    if (!currentUserId) {
      setFormMessage("로그인 후 한줄평을 남길 수 있습니다.");
      return;
    }

    if (!isSupabaseConfigured) {
      setFormMessage("Supabase 설정이 필요합니다.");
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const durationLabel = formatDurationMinutes(durationMinutes);
      const difficulty = difficultyEvaluationOptions[difficultyIndex];

      if (editingReview) {
        const updatedReview = await updateMountainReview({
          id: editingReview.id,
          userId: currentUserId,
          mountainId: mountain.id,
          difficulty,
          durationMinutes,
          durationLabel,
          body: trimmedReviewText,
          existingImageUrls: editingExistingImageUrls,
          imageFiles: uploadedPhotos.map((photo) => photo.file),
        });
        setReviews((currentReviews) =>
          currentReviews.map((review) =>
            review.id === updatedReview.id ? updatedReview : review,
          ),
        );
      } else {
        const routeStartPoint = manualStartPoint.trim();
        const routeEndPoint = manualEndPoint.trim();
        const createdReview = await createMountainReview({
          userId: currentUserId,
          mountainId: mountain.id,
          routeName: selectedRoute ? selectedRoute.name : manualCourseRouteName,
          routeStartPoint: routeStartPoint || null,
          routeEndPoint: routeEndPoint || null,
          authorName: getReviewAuthorName(session),
          difficulty,
          durationMinutes,
          durationLabel,
          body: trimmedReviewText,
          imageFiles: uploadedPhotos.map((photo) => photo.file),
        });
        setReviews((currentReviews) => [createdReview, ...currentReviews].slice(0, 50));
      }

      resetReviewForm();
      setIsFullReviewFormOpen(false);
      setReviewState("ready");
    } catch (error) {
      setFormMessage(getReviewErrorMessage(error, editingReview ? "update" : "save"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditingReview = (review: MountainReview) => {
    const routeForReview = displayRoutes.find(
      (route) =>
        route.name === review.routeName ||
        getRouteDisplayName(route) === review.routeName,
    );
    const reviewIsManualCourse = Boolean(
      review.routeStartPoint || review.routeEndPoint || !routeForReview,
    );
    setEditingReviewId(review.id);
    setIsFullReviewFormOpen(true);
    setSelectedRouteName(
      reviewIsManualCourse
        ? manualCourseRouteName
        : routeForReview?.name ?? manualCourseRouteName,
    );
    setManualStartPoint(review.routeStartPoint ?? "");
    setManualEndPoint(review.routeEndPoint ?? "");
    setDifficultyIndex(
      Math.max(0, difficultyEvaluationOptions.indexOf(review.difficulty)),
    );
    setDurationMinutes(review.durationMinutes);
    setReviewText(review.body);
    setFormMessage(null);
    setEditingExistingImageUrls(review.imageUrls);
    setUploadedPhotos((photos) => {
      photos.forEach((photo) => revokePhotoPreviewUrl(photo.url));
      return [];
    });
  };

  const executeDeleteReview = async (review: MountainReview) => {
    if (!currentUserId || review.userId !== currentUserId || deletingReviewId) {
      return;
    }

    setDeletingReviewId(review.id);
    setListMessage(null);

    try {
      await deleteMountainReview(review);
      setReviews((currentReviews) =>
        currentReviews.filter((currentReview) => currentReview.id !== review.id),
      );
      if (editingReviewId === review.id) {
        resetReviewForm();
      }
    } catch (error) {
      setListMessage(getReviewErrorMessage(error, "delete"));
    } finally {
      setDeletingReviewId(null);
    }
  };

  const requestDeleteReview = (review: MountainReview) => {
    setConfirmDialog({
      title: "한줄평 삭제",
      message: "한줄평을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      tone: "danger",
      onConfirm: () => executeDeleteReview(review),
    });
  };

  const requestReviewSubmit = () => {
    if (!editingReview) {
      void handleReviewSubmit();
      return;
    }

    setConfirmDialog({
      title: "수정 저장",
      message: "수정한 한줄평을 저장하시겠습니까?",
      confirmLabel: "저장",
      onConfirm: () => handleReviewSubmit(),
    });
  };

  const openReviewLightbox = (review: MountainReview, imageIndex: number) => {
    if (review.imageUrls.length === 0) {
      return;
    }

    setLightboxState({
      review,
      imageIndex: clampNumber(imageIndex, 0, review.imageUrls.length - 1),
    });
  };

  if (!selectedRoute && !isManualCourse) {
    return null;
  }

  const controlsDisabled = isSubmitting || !canWrite;
  const routeStartPoint = isManualCourse
    ? manualStartPoint
    : selectedRouteEndpoints?.startPoint ?? "";
  const routeEndPoint = isManualCourse
    ? manualEndPoint
    : selectedRouteEndpoints?.endPoint ?? "";
  const submitLabel = isSubmitting
    ? editingReview
      ? "수정 중..."
      : "저장 중..."
    : editingReview
      ? "수정 저장"
      : "등록하기";
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainderMinutes = durationMinutes % 60;
  const updateDurationFromParts = (hours: number, minutes: number) => {
    setDurationMinutes(
      clampNumber(Math.trunc(hours) * 60 + Math.trunc(minutes), 30, 600),
    );
  };
  const reviewForm = (
    <>
      <h3 className="m-0 px-6 pt-6 text-[22px] font-black leading-7 text-[#18221d] max-[560px]:px-4 max-[560px]:pt-5">
        코스 평가
      </h3>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,1.08fr)] grid-rows-[auto_auto] gap-3 px-5 pt-5 max-[1100px]:grid-cols-1 max-[1100px]:grid-rows-none max-[560px]:px-4 max-[560px]:pt-4">
        <div className="col-span-2 row-start-1 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[1100px]:col-span-1 max-[1100px]:row-auto">
          <label
            className="mb-3 block text-center text-base font-extrabold leading-6 text-[#18221d]"
            htmlFor="course-feedback-route"
          >
            코스를 선택해주세요
          </label>
          <div className="relative">
            <select
              id="course-feedback-route"
              className="h-11 w-full appearance-none rounded-md border border-[#d8e0da] bg-white px-3 pr-10 text-sm font-bold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
              value={selectedRouteName ?? manualCourseRouteName}
              disabled={isSubmitting}
              onChange={(event) => {
                setSelectedRouteName(event.target.value);
                if (editingReviewId) {
                  setEditingReviewId(null);
                  setEditingExistingImageUrls([]);
                  setReviewText("");
                  setUploadedPhotos((photos) => {
                    photos.forEach((photo) => revokePhotoPreviewUrl(photo.url));
                    return [];
                  });
                }
              }}
            >
              {displayRoutes.map((route) => {
                const endpoints = getRouteEndpointNames(route);
                const routeLabel =
                  endpoints.startPoint && endpoints.endPoint
                    ? `${endpoints.startPoint} > ${endpoints.endPoint}`
                    : route.path.replace(/\s*(?:->|→|~)\s*/g, " > ");

                return (
                  <option key={`${route.name}-${route.path}`} value={route.name}>
                    {routeLabel}
                  </option>
                );
              })}
              <option value={manualCourseRouteName}>{manualCourseRouteName}</option>
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
                value={routeStartPoint}
                placeholder="출발지 입력"
                readOnly={!isManualCourse}
                disabled={isSubmitting}
                onChange={(event) => setManualStartPoint(event.target.value)}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-extrabold text-[#18221d]">
              도착지
              <input
                className="h-11 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 text-sm font-bold text-[#18221d] outline-none transition placeholder:text-[#8a9690] read-only:bg-[#f4f8f6] read-only:text-[#5d6a62] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
                value={routeEndPoint}
                placeholder="도착지 입력"
                readOnly={!isManualCourse}
                disabled={isSubmitting}
                onChange={(event) => setManualEndPoint(event.target.value)}
              />
            </label>
          </div>
        </div>

        <EvaluationPicker
          className="col-start-1 row-start-2 max-[1100px]:col-auto max-[1100px]:row-auto"
          title="난이도는 어떠셨나요?"
          options={difficultyEvaluationOptions}
          activeIndex={difficultyIndex}
          onChange={(index) => {
            if (!isSubmitting) {
              setDifficultyIndex(index);
            }
          }}
        />

        <div className="col-start-2 row-start-2 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[1100px]:col-auto max-[1100px]:row-auto">
          <strong className="block text-center text-lg font-extrabold leading-7 text-[#18221d]">
            소요시간은 얼마나 걸렸나요?
          </strong>
          <p className="mx-auto mb-4 mt-2 max-w-[360px] break-keep text-center text-sm font-semibold leading-6 text-[#2d3932]">
            산행 시작부터 하산 완료까지 걸린 전체 시간입니다. 휴식, 사진 촬영,
            식사 시간을 포함해서 입력해주세요.
          </p>

          <div className="mx-auto grid max-w-[320px] grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="relative">
                <input
                  className="h-12 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 pr-11 text-right font-numeric text-xl font-extrabold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
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
                  className="h-12 min-w-0 w-full rounded-md border border-[#d8e0da] bg-white px-3 pr-8 text-right font-numeric text-xl font-extrabold text-[#18221d] outline-none transition focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
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

        <div className="col-start-3 row-span-2 row-start-1 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 max-[1100px]:col-auto max-[1100px]:row-auto max-[1100px]:row-span-1">
          <strong className="mb-3 block text-center text-lg font-extrabold leading-7 text-[#18221d]">
            한줄평을 남겨주세요!
          </strong>
          <textarea
            maxLength={100}
            value={reviewText}
            placeholder={
              canWrite
                ? "코스에 대한 느낌을 자유롭게 남겨주세요."
                : "로그인 후 한줄평을 남길 수 있습니다."
            }
            className="min-h-[108px] w-full resize-y rounded-md border border-[#d8e0da] p-3 text-[15px] font-medium leading-6 text-[#18221d] outline-none transition placeholder:text-[#8a9690] focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
            disabled={controlsDisabled}
            onChange={(event) => setReviewText(event.target.value)}
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
              disabled={controlsDisabled || totalSelectedPhotoCount >= 5}
              onChange={handlePhotoSelect}
            />
            <div className="grid grid-cols-[92px_repeat(3,minmax(0,1fr))] gap-2 max-[560px]:grid-cols-2">
              <button
                className="grid min-h-[82px] place-items-center content-center gap-1 rounded-md border border-[#d8e0da] bg-white px-2 text-xs font-extrabold text-[#5d6a62] transition hover:bg-[#f7faf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25 disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={
                  controlsDisabled || totalSelectedPhotoCount >= 5
                }
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera size={20} aria-hidden="true" />
                사진 추가
              </button>
              {editingExistingImageUrls.map((imageUrl, index) => (
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
                    onClick={() => requestRemoveExistingPhoto(imageUrl)}
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
                    onClick={() => removeUploadedPhoto(photo.id)}
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

          {!canWrite ? (
            <p className="m-0 mt-3 rounded-md bg-[#fff8e8] px-3 py-2 text-sm font-bold leading-5 text-[#8a5c18]">
              로그인한 유저만 한줄평을 작성할 수 있습니다.
            </p>
          ) : null}

          {formMessage ? (
            <p className="m-0 mt-3 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
              {formMessage}
            </p>
          ) : null}

          <div className="mt-3 grid gap-2">
            <button
              className="min-h-11 w-full rounded-md border-0 bg-[#166b3d] px-4 text-sm font-black text-white transition hover:bg-[#125b34] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!trimmedReviewText || controlsDisabled}
              onClick={requestReviewSubmit}
            >
              {submitLabel}
            </button>
            {editingReview ? (
              <button
                className="min-h-10 w-full rounded-md border border-[#d8e0da] bg-white px-4 text-sm font-black text-[#18221d] transition hover:bg-[#f7faf8]"
                type="button"
                disabled={isSubmitting}
                onClick={resetReviewForm}
              >
                수정 취소
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  if (mode === "full") {
    return (
      <>
        <FullReviewSection
          mountainName={mountain.name}
          reviews={reviews}
          routes={displayRoutes}
          currentUserId={currentUserId}
          reviewState={reviewState}
          message={listMessage}
          deletingReviewId={deletingReviewId}
          editingReviewId={editingReviewId}
          isFormOpen={isFullReviewFormOpen}
          reviewForm={reviewForm}
          onWrite={() => {
            resetReviewForm();
            setIsFullReviewFormOpen(true);
          }}
          onCancelWrite={() => {
            resetReviewForm();
            setIsFullReviewFormOpen(false);
          }}
          onEdit={startEditingReview}
          onDelete={requestDeleteReview}
          onPhotoOpen={openReviewLightbox}
        />
        <ReviewPhotoLightbox
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
        <ReviewConfirmDialog
          state={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      </>
    );
  }

  return (
    <>
      <section
        className="mt-6 overflow-hidden rounded-md border border-[#d8e0da] bg-white px-0 pb-5 pt-0 shadow-[0_10px_28px_rgba(24,34,29,0.045)]"
        aria-label={`${mountain.name} 코스 평가`}
      >
        {reviewForm}
      </section>
      <CourseReviewSection
        reviews={reviews}
        routes={displayRoutes}
        mountainName={mountain.name}
        currentUserId={currentUserId}
        reviewState={reviewState}
        message={listMessage}
        deletingReviewId={deletingReviewId}
        editingReviewId={editingReviewId}
        onShowAllReviews={onShowAllReviews}
        onEdit={startEditingReview}
        onDelete={requestDeleteReview}
        onPhotoOpen={openReviewLightbox}
      />
      <ReviewPhotoLightbox
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
      <ReviewConfirmDialog
        state={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </>
  );
}

function CourseReviewSection({
  reviews,
  routes,
  mountainName,
  currentUserId,
  reviewState,
  message,
  deletingReviewId,
  editingReviewId,
  onShowAllReviews,
  onEdit,
  onDelete,
  onPhotoOpen,
}: {
  reviews: MountainReview[];
  routes: MountainGuideRoute[];
  mountainName: string;
  currentUserId: string | null;
  reviewState: "idle" | "loading" | "ready" | "error";
  message: string | null;
  deletingReviewId: string | null;
  editingReviewId: string | null;
  onShowAllReviews: () => void;
  onEdit: (review: MountainReview) => void;
  onDelete: (review: MountainReview) => void;
  onPhotoOpen: (review: MountainReview, imageIndex: number) => void;
}) {
  const filterOptions = useReviewFilterOptions(routes);
  const [activeFilter, setActiveFilter] = useState<ReviewFilterKind>("all");
  const [sortOrder, setSortOrder] = useState<ReviewSortOrder>("newest");
  const filteredReviews = useMemo(
    () =>
      getFilteredReviews({
        reviews,
        routes,
        currentUserId,
        activeFilter,
        sortOrder,
      }),
    [activeFilter, currentUserId, reviews, routes, sortOrder],
  );

  return (
    <section
      className="mt-6 rounded-md border border-[#d8e0da] bg-white px-6 py-6 shadow-[0_10px_28px_rgba(24,34,29,0.045)] max-[560px]:px-4 max-[560px]:py-5"
      aria-label="다른 등산객들의 한줄평"
    >
      <div className="mb-5 flex items-start justify-between gap-4 max-[720px]:grid max-[720px]:gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[22px] font-black leading-7 text-[#18221d]">
            실제 등산객 한줄평
          </h3>
          <p className="m-0 mt-1 break-keep text-sm font-semibold leading-6 text-[#2d3932]">
            실제 다녀온 등산객들이 남긴 짧은 후기입니다. 코스 선택 전에
            참고해보세요.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {reviews.length > 0 ? (
            <span className="inline-flex min-h-8 items-center rounded-full bg-[#eef3f0] px-3 text-sm font-black text-[#245c46]">
              전체 {reviews.length}개
            </span>
          ) : null}
          <button
            className="inline-flex min-h-9 items-center rounded-md border border-[#245c46] bg-white px-3 text-sm font-black text-[#245c46] transition hover:bg-[#f7faf8]"
            type="button"
            onClick={onShowAllReviews}
          >
            전체 한줄평 보기
          </button>
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        aria-label="한줄평 코스 필터"
      >
        {filterOptions.map((option) => {
          const isActive = activeFilter === option.kind;

          return (
            <button
              key={option.kind}
              className={cn(
                "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25",
                isActive
                  ? "border-[#245c46] bg-[#245c46] text-white"
                  : "border-[#d8e0da] bg-white text-[#18221d] hover:bg-[#f7faf8]",
              )}
              type="button"
              aria-pressed={isActive}
              disabled={option.kind === "mine" && !currentUserId}
              onClick={() => setActiveFilter(option.kind)}
            >
              {option.label}
            </button>
          );
        })}
        <select
          className="min-h-10 rounded-full border border-[#d8e0da] bg-white px-4 text-sm font-black text-[#18221d] outline-none focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
          value={sortOrder}
          aria-label="한줄평 정렬"
          onChange={(event) => setSortOrder(event.target.value as ReviewSortOrder)}
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
        </select>
      </div>

      {reviews.length > 0 ? (
        filteredReviews.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-3 gap-5 p-0 max-[1100px]:grid-cols-2 max-[760px]:grid-cols-1">
          {filteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              routes={routes}
              currentUserId={currentUserId}
              deletingReviewId={deletingReviewId}
              editingReviewId={editingReviewId}
              layout="grid"
              onEdit={onEdit}
              onDelete={onDelete}
              onPhotoOpen={onPhotoOpen}
            />
          ))}
        </ul>
        ) : (
          <div className="grid min-h-[160px] place-items-center content-center gap-2 rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] p-6 text-center text-[#627168]">
            <MessageCircle size={24} className="text-[#2f6b4f]" />
            <strong className="text-[#18221d]">
              선택한 코스의 한줄평이 아직 없습니다.
            </strong>
            <p className="m-0 leading-6">전체 탭에서 모든 한줄평을 볼 수 있습니다.</p>
          </div>
        )
      ) : reviewState === "loading" ? (
        <div className="grid min-h-[160px] place-items-center content-center gap-2 rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] p-6 text-center text-[#627168]">
          <MessageCircle size={24} className="text-[#2f6b4f]" />
          <strong className="text-[#18221d]">한줄평을 불러오는 중입니다.</strong>
        </div>
      ) : (
        <div className="grid min-h-[160px] place-items-center content-center gap-2 rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] p-6 text-center text-[#627168]">
          <MessageCircle size={24} className="text-[#2f6b4f]" />
          <strong className="text-[#18221d]">
            아직 {mountainName}에 등록된 한줄평이 없습니다.
          </strong>
          <p className="m-0 leading-6">첫 한줄평을 남기면 이곳에 표시됩니다.</p>
        </div>
      )}
      {message ? (
        <p className="m-0 mt-3 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function FullReviewSection({
  mountainName,
  reviews,
  routes,
  currentUserId,
  reviewState,
  message,
  deletingReviewId,
  editingReviewId,
  isFormOpen,
  reviewForm,
  onWrite,
  onCancelWrite,
  onEdit,
  onDelete,
  onPhotoOpen,
}: {
  mountainName: string;
  reviews: MountainReview[];
  routes: MountainGuideRoute[];
  currentUserId: string | null;
  reviewState: "idle" | "loading" | "ready" | "error";
  message: string | null;
  deletingReviewId: string | null;
  editingReviewId: string | null;
  isFormOpen: boolean;
  reviewForm: ReactNode;
  onWrite: () => void;
  onCancelWrite: () => void;
  onEdit: (review: MountainReview) => void;
  onDelete: (review: MountainReview) => void;
  onPhotoOpen: (review: MountainReview, imageIndex: number) => void;
}) {
  const filterOptions = useReviewFilterOptions(routes);
  const [activeFilter, setActiveFilter] = useState<ReviewFilterKind>("all");
  const [sortOrder, setSortOrder] = useState<ReviewSortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(10);
  const filteredReviews = useMemo(
    () =>
      getFilteredReviews({
        reviews,
        routes,
        currentUserId,
        activeFilter,
        sortOrder,
      }),
    [activeFilter, currentUserId, reviews, routes, sortOrder],
  );
  const visibleReviews = filteredReviews.slice(0, visibleCount);
  const summary = useMemo(() => getReviewSummary(reviews, routes), [reviews, routes]);
  const [isTipDialogOpen, setIsTipDialogOpen] = useState(false);

  useEffect(() => {
    setVisibleCount(10);
  }, [activeFilter, sortOrder, reviews.length]);

  useEffect(() => {
    if (!isTipDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTipDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTipDialogOpen]);

  return (
    <section
      className="mt-6 min-h-[760px] rounded-none border border-[#d8e0da] bg-white px-5 py-5 max-[560px]:min-h-0 max-[560px]:px-3 max-[560px]:py-4"
      aria-label={`${mountainName} 전체 한줄평`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="m-0 text-[28px] font-black leading-[34px] text-[#18221d]">
            {mountainName} 한줄평
          </h3>
          <p className="m-0 mt-1 text-base font-semibold leading-6 text-[#5d6a62]">
            실제 등산객들이 남긴 코스 후기와 사진을 모아봤어요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-9 items-center rounded-full bg-[#eef3f0] px-3 text-sm font-black text-[#245c46]">
            총 {reviews.length}개
          </span>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-md border-0 bg-[#166b3d] px-4 text-sm font-black text-white transition hover:bg-[#125b34]"
            type="button"
            onClick={isFormOpen ? onCancelWrite : onWrite}
          >
            {isFormOpen ? <X size={16} /> : <Edit3 size={16} />}
            {isFormOpen ? "작성 취소" : "한줄평 작성하기"}
          </button>
        </div>
      </div>

      {isFormOpen ? (
        <div className="mb-5 rounded-none border border-[#d9dee2] bg-white pb-5">
          {reviewForm}
        </div>
      ) : null}

      <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-5 max-[900px]:grid-cols-1">
        <aside className="self-start rounded-md border border-[#d8e0da] bg-white p-4 shadow-[0_10px_24px_rgba(24,34,29,0.045)] max-[560px]:p-3">
          <div className="flex items-center gap-2">
            <h4 className="m-0 text-lg font-black leading-7 text-[#18221d] max-[560px]:text-base max-[560px]:leading-6">
              후기 요약
            </h4>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8e0da] bg-[#f7faf8] text-[#245c46] transition hover:bg-[#eef3f0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25 min-[901px]:hidden"
              type="button"
              aria-label="후기 작성 팁 보기"
              onClick={() => setIsTipDialogOpen(true)}
            >
              <CircleHelp size={17} />
            </button>
          </div>
          <dl className="m-0 mt-4 grid gap-3 max-[560px]:mt-3 max-[560px]:grid-cols-2 max-[560px]:gap-2">
            <div className="rounded-md border border-[#d8e0da] bg-[#f7faf8] p-3 max-[560px]:p-2.5">
              <dt className="text-xs font-extrabold leading-5 text-[#5d6a62]">
                평균 체감 난이도
              </dt>
              <dd className="m-0 mt-1 flex min-h-8 items-center gap-2 text-base font-black text-[#245c46] max-[560px]:min-h-0 max-[560px]:text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e7f3e4] text-[#237a1f] max-[560px]:h-6 max-[560px]:w-6">
                  <DifficultyEvaluationIcon
                    className="h-4 w-4 max-[560px]:h-3.5 max-[560px]:w-3.5"
                    level={summary.averageDifficultyIndex}
                  />
                </span>
                {summary.averageDifficulty}
              </dd>
            </div>
            <div className="rounded-md border border-[#d8e0da] bg-[#f7faf8] p-3 max-[560px]:p-2.5">
              <dt className="text-xs font-extrabold leading-5 text-[#5d6a62]">
                평균 소요시간
              </dt>
              <dd className="m-0 mt-1 flex min-h-8 items-center gap-2 font-numeric text-base font-black text-[#18221d] max-[560px]:min-h-0 max-[560px]:text-sm">
                <Clock size={17} className="text-[#245c46]" />
                {summary.averageDuration}
              </dd>
            </div>
            <div className="rounded-md border border-[#d8e0da] bg-[#f7faf8] p-3 max-[560px]:col-span-2 max-[560px]:p-2.5">
              <dt className="text-xs font-extrabold leading-5 text-[#5d6a62]">
                가장 많이 선택한 코스
              </dt>
              <dd className="m-0 mt-1 grid gap-1">
                <span className="flex min-h-8 items-center gap-2 text-base font-black text-[#237a1f] max-[560px]:min-h-0 max-[560px]:text-sm">
                  <Route size={17} className="text-[#245c46]" />
                  {summary.favoriteRoute}
                </span>
                {summary.favoriteRoutePath ? (
                  <span className="break-keep text-sm font-extrabold leading-5 text-[#49524d] max-[560px]:text-[13px]">
                    {summary.favoriteRoutePath}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
          <ReviewWritingTipCard />
        </aside>

        <div className="min-w-0">
          <div
            className="mb-4 flex flex-wrap items-center gap-2"
            aria-label="전체 한줄평 필터"
          >
            {filterOptions.map((option) => {
              const isActive = activeFilter === option.kind;

              return (
                <button
                  key={option.kind}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25 disabled:cursor-not-allowed disabled:opacity-45",
                    isActive
                      ? "border-[#245c46] bg-[#245c46] text-white"
                      : "border-[#d8e0da] bg-white text-[#18221d] hover:bg-[#f7faf8]",
                  )}
                  type="button"
                  aria-pressed={isActive}
                  disabled={option.kind === "mine" && !currentUserId}
                  title={
                    option.kind === "mine" && !currentUserId
                      ? "로그인 후 확인할 수 있습니다."
                      : undefined
                  }
                  onClick={() => setActiveFilter(option.kind)}
                >
                  {option.label}
                </button>
              );
            })}
            <select
              className="min-h-10 rounded-full border border-[#d8e0da] bg-white px-4 text-sm font-black text-[#18221d] outline-none focus:border-[#245c46] focus:ring-2 focus:ring-[#245c46]/15"
              value={sortOrder}
              aria-label="전체 한줄평 정렬"
              onChange={(event) =>
                setSortOrder(event.target.value as ReviewSortOrder)
              }
            >
              <option value="newest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
          </div>

          {reviews.length > 0 ? (
            visibleReviews.length > 0 ? (
              <>
                <ul className="m-0 grid list-none gap-3 p-0">
                  {visibleReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      routes={routes}
                      currentUserId={currentUserId}
                      deletingReviewId={deletingReviewId}
                      editingReviewId={editingReviewId}
                      layout="list"
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onPhotoOpen={onPhotoOpen}
                    />
                  ))}
                </ul>
                {visibleCount < filteredReviews.length ? (
                  <button
                    className="mx-auto mt-4 flex min-h-11 items-center rounded-md border border-[#d8e0da] bg-white px-5 text-sm font-black text-[#245c46] transition hover:bg-[#f7faf8]"
                    type="button"
                    onClick={() => setVisibleCount((count) => count + 10)}
                  >
                    더 보기
                  </button>
                ) : null}
              </>
            ) : (
              <ReviewEmptyState title="조건에 맞는 한줄평이 없습니다." />
            )
          ) : reviewState === "loading" ? (
            <ReviewEmptyState title="한줄평을 불러오는 중입니다." />
          ) : (
            <ReviewEmptyState title={`아직 ${mountainName}에 등록된 한줄평이 없습니다.`} />
          )}

          {message ? (
            <p className="m-0 mt-3 rounded-md bg-[#fff2f0] px-3 py-2 text-sm font-bold leading-5 text-[#b14a3d]">
              {message}
            </p>
          ) : null}
        </div>
      </div>
      {isTipDialogOpen ? (
        <ReviewWritingTipDialog onClose={() => setIsTipDialogOpen(false)} />
      ) : null}
    </section>
  );
}

function ReviewCard({
  review,
  routes,
  currentUserId,
  deletingReviewId,
  editingReviewId,
  layout,
  onEdit,
  onDelete,
  onPhotoOpen,
}: {
  review: MountainReview;
  routes: MountainGuideRoute[];
  currentUserId: string | null;
  deletingReviewId: string | null;
  editingReviewId: string | null;
  layout: "grid" | "list";
  onEdit: (review: MountainReview) => void;
  onDelete: (review: MountainReview) => void;
  onPhotoOpen: (review: MountainReview, imageIndex: number) => void;
}) {
  const isList = layout === "list";
  const routeEndpoints = getReviewRouteEndpoints(review, routes);

  return (
    <li
      className={cn(
        "relative rounded-md border border-[#d8e0da] bg-white p-4 shadow-[0_10px_24px_rgba(24,34,29,0.045)]",
        isList
          ? "grid grid-cols-[minmax(0,0.92fr)_minmax(280px,1fr)] gap-x-12 gap-y-4 max-[840px]:grid-cols-1 max-[840px]:gap-x-0"
          : "grid min-h-[258px] gap-3",
        editingReviewId === review.id && "border-[#245c46] ring-2 ring-[#245c46]/15",
      )}
    >
      <div className={cn("min-w-0", isList ? "grid content-start gap-3" : "grid gap-3")}>
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#d8e0da] bg-[#eef3f0] text-[#245c46]"
            role="img"
            aria-label="기본 프로필"
          >
            <UserRound size={19} aria-hidden="true" />
          </span>
          <div className="grid min-w-0 flex-1 gap-1">
            <div
              className={cn(
                "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
                isList && "pr-8",
              )}
            >
              <strong className="block max-w-full truncate text-[15px] font-black leading-5 text-[#18221d]">
                {review.authorName}
              </strong>
              <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#e7f3e4] px-2 py-0.5 text-xs font-medium text-[#237a1f]">
                <span className="truncate">{review.routeName}</span>
              </span>
              <time className="ml-auto block shrink-0 text-right font-numeric text-xs font-bold leading-5 text-[#5d6a62]">
                {formatReviewDate(review.createdAt)}
              </time>
            </div>
            {routeEndpoints ? (
              <span className="block min-w-0 truncate whitespace-nowrap text-xs font-medium leading-5 text-[#49524d]">
                {routeEndpoints.startPoint} &gt; {routeEndpoints.endPoint}
              </span>
            ) : null}
          </div>
        </div>

        <p
          className={cn(
            "m-0 min-w-0 break-words text-base font-extrabold leading-7 text-[#18221d] [overflow-wrap:anywhere]",
            !isList && "min-h-[82px]",
          )}
        >
          “{review.body}”
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-8 items-center rounded-full border border-[#d7e4ba] bg-[#f0f7e4] px-3.5 text-sm font-black",
              getDifficultyTextColorClass(review.difficulty),
            )}
          >
            난이도 {review.difficulty}
          </span>
          <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[#d8e0da] bg-[#f1f5f7] px-3.5 font-numeric text-sm font-black text-[#49524d]">
            <Clock size={14} />
            {review.durationLabel}
          </span>
        </div>
      </div>

      <ReviewPhotoStrip
        review={review}
        layout={layout}
        onPhotoOpen={onPhotoOpen}
      />

      {isList ? (
        <ReviewActionMenu
          review={review}
          currentUserId={currentUserId}
          deletingReviewId={deletingReviewId}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
    </li>
  );
}

function ReviewPhotoStrip({
  review,
  layout,
  onPhotoOpen,
}: {
  review: MountainReview;
  layout: "grid" | "list";
  onPhotoOpen: (review: MountainReview, imageIndex: number) => void;
}) {
  if (review.imageUrls.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] text-sm font-bold text-[#5d6a62]",
          layout === "list" ? "min-h-[112px] self-stretch" : "min-h-[108px]",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <Camera size={15} />
          사진 없음
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid min-w-0 gap-2",
        layout === "list" ? "grid-cols-3 self-stretch" : "grid-cols-3",
      )}
    >
      {review.imageUrls.slice(0, 3).map((imageUrl, index) => {
        const remainingImageCount = review.imageUrls.length - 3;
        const showImageCountOverlay = index === 2 && remainingImageCount > 0;

        return (
          <button
            key={imageUrl}
            className={cn(
              "relative overflow-hidden rounded-md border-0 bg-[#eef3f0] p-0 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/30",
              layout === "list" ? "h-[112px]" : "h-[108px]",
            )}
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
              <span className="absolute inset-0 grid place-items-center bg-black/55 font-numeric text-lg font-black text-white">
                +{remainingImageCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ReviewPhotoLightbox({
  state,
  onClose,
  onNavigate,
}: {
  state: ReviewLightboxState | null;
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
      className="fixed inset-0 z-[90] grid h-screen w-screen place-items-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${review.routeName} 한줄평 사진 확대`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative flex h-full max-h-[calc(100vh-32px)] w-full min-w-0 max-w-[calc(100vw-32px)] items-center justify-center rounded-md bg-black/85">
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
              className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/45 text-white transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-[560px]:left-0"
              type="button"
              aria-label="이전 사진 보기"
              onClick={() => onNavigate(previousIndex)}
            >
              <ArrowLeft size={22} />
            </button>
            <button
              className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/45 text-white transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 max-[560px]:right-0"
              type="button"
              aria-label="다음 사진 보기"
              onClick={() => onNavigate(nextIndex)}
            >
              <ArrowLeft className="rotate-180" size={22} />
            </button>
          </>
        ) : null}

        <div className="absolute bottom-2 left-0 right-0 min-h-6 text-center text-sm font-bold text-white/70">
          배경을 클릭하거나 ESC 키를 누르면 닫힙니다.
        </div>
      </div>
    </div>
  );
}

function ReviewConfirmDialog({
  state,
  onClose,
}: {
  state: ReviewConfirmDialogState | null;
  onClose: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setIsConfirming(false);
  }, [state]);

  if (!state) {
    return null;
  }

  const handleConfirm = async () => {
    if (isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      await state.onConfirm();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-md border border-[#d8e0da] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-confirm-title"
      >
        <h3
          id="review-confirm-title"
          className="m-0 text-lg font-black leading-7 text-[#18221d]"
        >
          {state.title}
        </h3>
        <p className="mb-5 mt-2 break-keep text-base font-semibold leading-6 text-[#5d6a62]">
          {state.message}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="min-h-11 rounded-md border border-[#d8e0da] bg-white px-4 text-sm font-black text-[#18221d] transition hover:bg-[#f7faf8] disabled:cursor-progress disabled:opacity-60"
            type="button"
            disabled={isConfirming}
            onClick={onClose}
          >
            취소
          </button>
          <button
            className={cn(
              "min-h-11 rounded-md border-0 px-4 text-sm font-black text-white transition disabled:cursor-progress disabled:opacity-60",
              state.tone === "danger"
                ? "bg-[#b14a3d] hover:bg-[#9c3f34]"
                : "bg-[#166b3d] hover:bg-[#125b34]",
            )}
            type="button"
            disabled={isConfirming}
            onClick={() => void handleConfirm()}
          >
            {isConfirming ? "처리 중..." : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewActionMenu({
  review,
  currentUserId,
  deletingReviewId,
  onEdit,
  onDelete,
}: {
  review: MountainReview;
  currentUserId: string | null;
  deletingReviewId: string | null;
  onEdit: (review: MountainReview) => void;
  onDelete: (review: MountainReview) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  if (currentUserId !== review.userId) {
    return null;
  }

  return (
    <div ref={menuRef} className="absolute right-3 top-3">
      <button
        className="grid h-9 w-9 place-items-center rounded-full border border-[#d8e0da] bg-white text-[#18221d] transition hover:bg-[#f7faf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25"
        type="button"
        aria-label={`${review.authorName} 한줄평 더보기`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MoreHorizontal size={18} />
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-10 mt-1 w-28 rounded-md border border-[#d8e0da] bg-white p-1 shadow-[0_12px_28px_rgba(24,34,29,0.16)]">
          <button
            className="flex min-h-9 w-full items-center gap-2 rounded-[5px] px-2 text-left text-sm font-black text-[#18221d] hover:bg-[#f7faf8]"
            type="button"
            disabled={deletingReviewId === review.id}
            onClick={() => {
              setIsOpen(false);
              onEdit(review);
            }}
          >
            <Edit3 size={14} />
            수정
          </button>
          <button
            className="flex min-h-9 w-full items-center gap-2 rounded-[5px] px-2 text-left text-sm font-black text-[#b14a3d] hover:bg-[#fff7f5] disabled:cursor-progress disabled:opacity-60"
            type="button"
            disabled={deletingReviewId === review.id}
            onClick={() => {
              setIsOpen(false);
              onDelete(review);
            }}
          >
            <Trash2 size={14} />
            {deletingReviewId === review.id ? "삭제 중" : "삭제"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewEmptyState({ title }: { title: string }) {
  return (
    <div className="grid min-h-[160px] place-items-center content-center gap-2 rounded-md border border-dashed border-[#d8e0da] bg-[#f7faf8] p-6 text-center text-[#627168]">
      <MessageCircle size={24} className="text-[#2f6b4f]" />
      <strong className="text-[#18221d]">{title}</strong>
    </div>
  );
}

function ReviewWritingTipCard() {
  return (
    <section
      className="mt-4 hidden overflow-hidden rounded-md border border-[#d8e0da] bg-white p-3 min-[901px]:block"
      aria-label="후기 작성 팁"
    >
      <h5 className="m-0 text-sm font-black leading-5 text-[#18221d]">
        후기 작성 팁
      </h5>
      <ReviewWritingTipContent variant="card" />
    </section>
  );
}

function ReviewWritingTipDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-black/45 p-4"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="relative w-[min(420px,100%)] overflow-hidden rounded-lg border border-[#d8e0da] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-[modal-pop_180ms_ease-out] max-[560px]:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-writing-tip-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e0da] bg-[#eef2ef] text-[#18221d]"
          type="button"
          onClick={onClose}
          aria-label="후기 작성 팁 닫기"
        >
          <X size={18} />
        </button>
        <h4
          id="review-writing-tip-title"
          className="m-0 pr-10 text-lg font-black leading-7 text-[#18221d]"
        >
          후기 작성 팁
        </h4>
        <ReviewWritingTipContent variant="dialog" />
      </section>
    </div>
  );
}

function ReviewWritingTipContent({ variant }: { variant: "card" | "dialog" }) {
  const isCard = variant === "card";

  return (
    <>
      <p
        className={cn(
          "m-0 break-keep font-bold text-[#49524d]",
          isCard
            ? "mt-1 text-sm leading-6"
            : "mt-2 text-base leading-7 max-[560px]:text-[15px] max-[560px]:leading-6",
        )}
      >
        방문한 코스, 난이도, 소요시간, 길 상태, 풍경, 찾아가는 길 등을
        남겨주시면 다른 등산객에게 큰 도움이 돼요!
      </p>
      <div
        className={cn(
          "rounded-md bg-[#e7f3e4] px-3 pb-2 pt-3",
          isCard ? "mt-3" : "mt-4",
        )}
        aria-hidden="true"
      >
        <svg
          className={cn(
            "block w-full",
            isCard ? "h-[86px]" : "h-[116px] max-[560px]:h-[92px]",
          )}
          viewBox="0 0 220 118"
          fill="none"
          focusable="false"
        >
          <path
            d="M12 95c28-5 42-18 60-18s34 14 54 13c16-.8 26-10 42-9 14 .8 25 8 40 8v18H12V95Z"
            fill="#DDEBE0"
          />
          <path d="M35 91 78 35l34 56H35Z" fill="#8DB79B" />
          <path
            d="M76 35 113 91H82L68 64 55 91H35L76 35Z"
            fill="#5E9272"
          />
          <path
            d="M83 47 78 35l-9 13 5 5 4-4 7 8 8-7-10-3Z"
            fill="#F4F8F6"
          />
          <path d="M93 91 140 24l48 67H93Z" fill="#9DC4A9" />
          <path
            d="M140 24 188 91h-35l-16-35-17 35H93l47-67Z"
            fill="#6FA080"
          />
          <path d="m141 24-11 17 8 6 5-6 7 9 9-7-18-19Z" fill="#F8FBF8" />
          <path
            d="M54 105c17-18 35-22 54-14 20 9 33 4 48-13"
            stroke="#245C46"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="1 12"
          />
          <circle cx="178" cy="31" r="9" fill="#F2C200" opacity="0.72" />
          <path
            d="M24 30h26M31 44h18M171 58h24"
            stroke="#B9CBBE"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </>
  );
}

function useReviewFilterOptions(routes: MountainGuideRoute[]) {
  return useMemo<ReviewFilterOption[]>(() => {
    const routeKinds = routes
      .map((route) => route.forestTripCourseKind)
      .filter((kind): kind is ForestTripCourseKind => Boolean(kind));
    const uniqueKinds = Array.from(new Set(routeKinds));

    return [
      { kind: "all", label: "전체" },
      ...uniqueKinds.map((kind) => ({
        kind,
        label: reviewFilterLabels[kind],
      })),
      { kind: "mine", label: "내 리뷰" },
    ];
  }, [routes]);
}

function getFilteredReviews({
  reviews,
  routes,
  currentUserId,
  activeFilter,
  sortOrder,
}: {
  reviews: MountainReview[];
  routes: MountainGuideRoute[];
  currentUserId: string | null;
  activeFilter: ReviewFilterKind;
  sortOrder: ReviewSortOrder;
}) {
  const filteredReviews = reviews.filter((review) => {
    if (activeFilter === "all") {
      return true;
    }
    if (activeFilter === "mine") {
      return Boolean(currentUserId) && review.userId === currentUserId;
    }
    return getReviewRouteKind(review, routes) === activeFilter;
  });

  return [...filteredReviews].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

    return sortOrder === "newest"
      ? safeRightTime - safeLeftTime
      : safeLeftTime - safeRightTime;
  });
}

function getReviewSummary(
  reviews: MountainReview[],
  routes: MountainGuideRoute[],
) {
  if (reviews.length === 0) {
    return {
      averageDifficulty: "아직 없음",
      averageDifficultyIndex: difficultyDefaultIndex.unknown,
      averageDuration: "아직 없음",
      favoriteRoute: "아직 없음",
      favoriteRoutePath: "",
    };
  }

  const difficultyTotal = reviews.reduce((total, review) => {
    const index = difficultyEvaluationOptions.indexOf(review.difficulty);
    return total + (index >= 0 ? index : difficultyDefaultIndex.unknown);
  }, 0);
  const averageDifficultyIndex = clampNumber(
    Math.round(difficultyTotal / reviews.length),
    0,
    difficultyEvaluationOptions.length - 1,
  );
  const averageDurationMinutes = Math.round(
    reviews.reduce((total, review) => total + review.durationMinutes, 0) /
      reviews.length,
  );
  const routeCounts = reviews.reduce<Record<string, number>>((counts, review) => {
    counts[review.routeName] = (counts[review.routeName] ?? 0) + 1;
    return counts;
  }, {});
  const favoriteRoute =
    Object.entries(routeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "아직 없음";
  const favoriteReview = reviews.find((review) => review.routeName === favoriteRoute);
  const favoriteOfficialRoute = routes.find(
    (route) =>
      route.name === favoriteRoute || getRouteDisplayName(route) === favoriteRoute,
  );
  const favoriteRouteKind = favoriteOfficialRoute?.forestTripCourseKind;
  const favoriteRouteEndpoints = favoriteReview
    ? getReviewRouteEndpoints(favoriteReview, routes)
    : null;

  return {
    averageDifficulty: difficultyEvaluationOptions[averageDifficultyIndex],
    averageDifficultyIndex,
    averageDuration: formatDurationMinutes(averageDurationMinutes),
    favoriteRoute: favoriteRouteKind
      ? reviewFilterLabels[favoriteRouteKind]
      : favoriteRoute,
    favoriteRoutePath: favoriteRouteEndpoints
      ? `${favoriteRouteEndpoints.startPoint} > ${favoriteRouteEndpoints.endPoint}`
      : "",
  };
}

function getReviewAuthorName(session: Session | null) {
  const metadata = session?.user.user_metadata;
  const metadataName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : "";
  const emailName = session?.user.email?.split("@")[0] ?? "";

  return metadataName.trim() || emailName.trim() || "등산객";
}

function getReviewErrorMessage(error: unknown, action: "load" | "save" | "update" | "delete") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const fallback: Record<typeof action, string> = {
    load: "한줄평을 불러오지 못했습니다.",
    save: "한줄평 저장에 실패했습니다.",
    update: "한줄평 수정에 실패했습니다.",
    delete: "한줄평 삭제에 실패했습니다.",
  };

  return fallback[action];
}

function CoursePhotoGalleryPanel({
  mountainName,
  links,
}: {
  mountainName: string;
  links: MountainGuideLink[];
}) {
  if (links.length === 0) {
    return (
      <section
        className="rounded-md border border-[#dedede] bg-white p-[22px] text-[#627168] max-[560px]:p-4"
        aria-label={`${mountainName} 갤러리`}
      >
        <h3 className="mt-0 text-[#18221d]">포토 갤러리</h3>
        <div className="grid min-h-[220px] place-items-center content-center gap-2 rounded-md bg-[#f4f8f6] p-6 text-center">
          <MountainIcon size={26} className="text-[#2f6b4f]" />
          <strong className="text-[#18221d]">
            등록된 코스 사진이 없습니다.
          </strong>
          <p className="m-0 max-w-[360px] leading-6">
            대표 산 사진이나 코스 사진이 추가되면 이 탭에서 크게 확인할 수
            있습니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[#dedede] bg-white p-[22px] max-[560px]:p-4">
      <PhotoGallery mountainName={mountainName} links={links} />
    </section>
  );
}

const forestTripCourseTheme: Record<
  ForestTripCourseKind,
  { label: string; color: string; soft: string }
> = {
  recommended: {
    label: "추천코스",
    color: "#C51B7D",
    soft: "#FFF0F7",
  },
  other1: {
    label: "기타코스1",
    color: "#2F9E44",
    soft: "#F0FAF2",
  },
  other2: {
    label: "기타코스2",
    color: "#1F6FD1",
    soft: "#EFF6FF",
  },
  other3: {
    label: "기타코스3",
    color: "#F2C200",
    soft: "#FFF9D8",
  },
};

function getForestTripCourseKind(
  route: MountainGuideRoute,
): ForestTripCourseKind {
  if (route.forestTripCourseKind) {
    return route.forestTripCourseKind;
  }
  if (route.isRecommended || route.rank === 1) {
    return "recommended";
  }
  if (route.rank === 2) {
    return "other1";
  }
  if (route.rank === 3) {
    return "other2";
  }
  return "other3";
}

function RecommendedCourseSection({
  courseMapImage,
  routes,
  activeTab,
  onTabChange,
  routeDifficultyLabels,
  weatherSection,
  reviewSection,
}: {
  courseMapImage?: MountainGuideImage;
  routes: MountainGuideRoute[];
  activeTab: MountainMainTab;
  onTabChange: (tab: MountainMainTab) => void;
  routeDifficultyLabels: RouteDifficultyLabelMap;
  weatherSection: ReactNode;
  reviewSection: ReactNode;
}) {
  const [mapFailed, setMapFailed] = useState(false);
  const courseInfoVariant = useMemo(getForestTripCourseInfoVariant, []);
  const forestTripRoutes = routes.filter((route) => route.forestTripCourseKind);
  const displayRoutes = forestTripRoutes.length > 0 ? forestTripRoutes : [];
  const hasCourseMap = Boolean(courseMapImage?.src) && !mapFailed;

  return (
    <section className="grid gap-5" aria-label="추천 코스">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex min-h-11 items-center rounded-md border border-[#d8e0da] bg-white p-1 shadow-[0_4px_14px_rgba(24,34,29,0.04)]"
          role="tablist"
          aria-label="추천 코스와 한줄평 보기"
        >
          {[
            { key: "courses" as const, label: "추천 코스" },
            { key: "reviews" as const, label: "한줄평" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                className={cn(
                  "min-h-9 rounded-[5px] px-4 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#245c46]/25",
                  isActive
                    ? "bg-[#245c46] text-white"
                    : "bg-transparent text-[#18221d] hover:bg-[#f7faf8]",
                )}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("grid gap-5", activeTab !== "courses" && "hidden")}>
        <article className="rounded-md border border-[#d8e0da] bg-white px-6 pb-6 pt-5 shadow-[0_10px_28px_rgba(24,34,29,0.045)] max-[560px]:px-4 max-[560px]:pb-5">
          <h4 className="mb-4 mt-0 text-[22px] font-black leading-7 text-[#18221d]">
            추천 코스 지도
          </h4>
          {hasCourseMap ? (
            <figure className="m-0 overflow-hidden rounded-[5px] border border-[#d8e0da] bg-[#f4f8f6]">
              <img
                className="block h-auto w-full"
                src={courseMapImage!.src}
                alt={courseMapImage!.alt}
                loading="lazy"
                onError={() => setMapFailed(true)}
              />
              {courseMapImage?.sourceUrl ? (
                <figcaption className="border-t border-[#d8e0da] bg-white px-3 py-2 text-xs font-bold text-[#627168]">
                  출처:{" "}
                  <a
                    className="text-[#276c8f]"
                    href={courseMapImage.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {courseMapImage.sourceLabel ?? "숲나들e"}
                  </a>
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <div className="grid min-h-[220px] place-items-center rounded-md border border-dashed border-[#b9c6bd] bg-[#f4f8f6] px-5 py-10 text-center">
              <div>
                <Route className="mx-auto mb-3 text-[#245c46]" size={28} />
                <strong className="block text-lg font-black text-[#18221d]">
                  추천 코스 지도 준비 중
                </strong>
                <p className="m-0 mt-2 text-base font-semibold leading-6 text-[#627168]">
                  숲나들e 지도 이미지를 불러오지 못했습니다.
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="rounded-md border border-[#d8e0da] bg-white px-6 pb-6 pt-5 shadow-[0_10px_28px_rgba(24,34,29,0.045)] max-[560px]:px-4 max-[560px]:pb-5">
          <h4 className="mb-4 mt-0 text-[22px] font-black leading-7 text-[#18221d]">
            추천 코스 정보
          </h4>
          {displayRoutes.length > 0 ? (
            <ul className="m-0 grid list-none gap-4 p-0 max-[720px]:gap-3">
              {displayRoutes.map((route) => (
                <ForestTripCourseInfoCard
                  key={`${route.forestTripCourseKind}-${route.path}`}
                  route={route}
                  variant={courseInfoVariant}
                  difficultyLabelOverride={routeDifficultyLabels[route.name]}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-[5px] border border-dashed border-[#b9c6bd] bg-[#f4f8f6] px-5 py-8 text-center">
              <strong className="block text-lg font-black text-[#18221d]">
                추천 코스 정보 준비 중
              </strong>
              <p className="m-0 mt-2 text-base font-semibold leading-6 text-[#627168]">
                숲나들e 코스 표를 확인한 뒤 표시합니다.
              </p>
            </div>
          )}
        </article>

      </div>

      {activeTab === "courses" ? weatherSection : null}

      {reviewSection}
    </section>
  );
}

function getForestTripCourseInfoVariant(): ForestTripCourseInfoVariant {
  if (typeof window === "undefined") {
    return "clean";
  }

  const design = new URLSearchParams(window.location.search).get(
    "courseInfoDesign",
  );

  if (design === "matrix" || design === "ticket") {
    return design;
  }

  return "clean";
}

function formatForestTripCourseTime(estimatedTime: string) {
  const hourMatch = estimatedTime.match(/(\d+(?:\.\d+)?)\s*시간/);
  const minuteMatch = estimatedTime.match(/(\d+)\s*분/);

  if (!hourMatch && !minuteMatch) {
    return estimatedTime.replace(/^약\s*/, "").split(",")[0].trim();
  }

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const wholeHours = Math.floor(hours);
  const decimalMinutes = Math.round((hours - wholeHours) * 60);
  const totalMinutes = minutes + decimalMinutes;

  return `${wholeHours}:${String(totalMinutes).padStart(2, "0")}`;
}

function getForestTripDifficultyLabel(difficulty: MountainGuideDifficulty) {
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

function getDifficultyTextColorClass(difficultyLabel: string) {
  if (difficultyLabel === "쉬움") {
    return "text-[#7fb33b]";
  }
  if (difficultyLabel === "보통") {
    return "text-[#237a1f]";
  }
  if (difficultyLabel === "약간 어려움") {
    return "text-[#c59a00]";
  }
  if (difficultyLabel === "어려움") {
    return "text-[#f28a00]";
  }
  if (difficultyLabel === "매우 어려움") {
    return "text-[#d90d0d]";
  }
  return "text-[#5d6a62]";
}

function DifficultyBarsIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-5 w-5 grid-cols-3 items-end gap-[3px]",
        className,
      )}
      aria-hidden="true"
    >
      <i className="block h-[7px] rounded-[1px] bg-current" />
      <i className="block h-[13px] rounded-[1px] bg-current" />
      <i className="block h-[18px] rounded-[1px] bg-current" />
    </span>
  );
}

function ForestTripCourseInfoCard({
  route,
  variant,
  difficultyLabelOverride,
}: {
  route: MountainGuideRoute;
  variant: ForestTripCourseInfoVariant;
  difficultyLabelOverride?: string;
}) {
  const kind = getForestTripCourseKind(route);
  const theme = forestTripCourseTheme[kind];
  const style = {
    "--foresttrip-course-color": theme.color,
    "--foresttrip-course-soft": theme.soft,
  } as CSSProperties;
  const displayName = getRouteDisplayName(route);
  const displayTime = formatForestTripCourseTime(route.estimatedTime);
  const difficultyLabel =
    difficultyLabelOverride ?? getForestTripDifficultyLabel(route.difficulty);
  const difficultyTextClassName = getDifficultyTextColorClass(difficultyLabel);

  if (variant === "matrix") {
    return (
      <ForestTripCourseMatrixCard
        route={route}
        themeLabel={theme.label}
        displayName={displayName}
        displayTime={displayTime}
        difficultyLabel={difficultyLabel}
        style={style}
      />
    );
  }

  if (variant === "ticket") {
    return (
      <ForestTripCourseTicketCard
        route={route}
        themeLabel={theme.label}
        displayName={displayName}
        displayTime={displayTime}
        difficultyLabel={difficultyLabel}
        style={style}
      />
    );
  }

  return (
    <li
      className="grid min-h-[112px] grid-cols-[minmax(0,1fr)_238px] overflow-hidden rounded-md border border-[#d8e0da] bg-white shadow-[0_6px_18px_rgba(24,34,29,0.045)] max-[720px]:min-h-[104px] max-[720px]:grid-cols-1"
      style={style}
    >
      <div className="grid min-w-0 content-center gap-2.5 border-t-[5px] border-[var(--foresttrip-course-color)] px-5 py-4 max-[720px]:gap-2.5 max-[720px]:px-4 max-[720px]:py-4">
        <span className="inline-flex min-h-7 w-fit items-center rounded-[5px] bg-[var(--foresttrip-course-color)] px-2.5 text-xs font-black leading-none text-white max-[720px]:min-h-[24px] max-[720px]:px-2 max-[720px]:text-[11px]">
          {theme.label}
        </span>
        <div className="flex min-w-0 items-start gap-2">
          <strong className="min-w-0 break-keep text-lg font-black leading-6 text-[#111] max-[720px]:text-base max-[720px]:leading-6">
            {displayName}
          </strong>
          <ArrowLeft
            className="mt-1 hidden flex-none rotate-180 text-[#5d6a62] max-[720px]:block"
            size={16}
            aria-hidden="true"
          />
        </div>
        <p className="m-0 min-w-0 break-keep text-sm font-bold leading-6 text-[#35413a] [overflow-wrap:anywhere] max-[720px]:text-[14px] max-[720px]:leading-6">
          {route.path}
        </p>
        <dl className="hidden grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 text-[13px] font-bold max-[720px]:grid">
          <dt className="flex items-center gap-1.5 text-[#111]">
            <Clock size={15} strokeWidth={2.4} />
            소요 시간
          </dt>
          <dd className="col-start-3 m-0 justify-self-end font-numeric text-[14px] font-black text-[#111]">
            {displayTime}
          </dd>
          <dt className="flex items-center gap-1.5 text-[#111]">
            <DifficultyBarsIcon className="text-[#111]" />
            난이도
          </dt>
          <dd
            className={cn(
              "col-start-3 m-0 justify-self-end text-[14px] font-black",
              difficultyTextClassName,
            )}
          >
            {difficultyLabel}
          </dd>
        </dl>
      </div>

      <dl className="m-3 grid content-center gap-0 rounded-md border border-[#d8e0da] bg-[#f7faf8] px-4 py-3 max-[720px]:hidden">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-[#e1e7e3] pb-2.5">
          <dt className="flex items-center gap-2.5 text-sm font-bold text-[#59636c]">
            <Clock className="text-[#111]" size={20} strokeWidth={2.4} />
            소요 시간
          </dt>
          <dd className="col-start-3 m-0 justify-self-end font-numeric text-lg font-black leading-6 text-[#111]">
            {displayTime}
          </dd>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 pt-2.5">
          <dt className="flex items-center gap-2.5 text-sm font-bold text-[#59636c]">
            <DifficultyBarsIcon className="h-[18px] w-[18px] text-[#111]" />
            난이도
          </dt>
          <dd
            className={cn(
              "col-start-3 m-0 justify-self-end text-base font-black leading-6",
              difficultyTextClassName,
            )}
          >
            {difficultyLabel}
          </dd>
        </div>
      </dl>
    </li>
  );
}

type ForestTripCourseInfoCardProps = {
  route: MountainGuideRoute;
  themeLabel: string;
  displayName: string;
  displayTime: string;
  difficultyLabel: string;
  style: CSSProperties;
};

function ForestTripCourseMetric({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 border-l border-[#d8e0da] pl-4 max-[720px]:min-h-[44px] max-[720px]:border-l-0 max-[720px]:border-t max-[720px]:pl-0 max-[720px]:pt-2">
      <dt className="flex items-center gap-2 text-[14px] font-bold leading-5 text-[#59636c] max-[720px]:text-[13px]">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 justify-self-end font-black leading-6 text-[#111]",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ForestTripCourseMatrixCard({
  route,
  themeLabel,
  displayName,
  displayTime,
  difficultyLabel,
  style,
}: ForestTripCourseInfoCardProps) {
  const difficultyTextClassName = getDifficultyTextColorClass(difficultyLabel);

  return (
    <li
      className="grid gap-3 rounded-[7px] border border-[#d8e0da] bg-[#fbfcfb] p-4 shadow-[0_1px_5px_rgba(24,34,29,0.04)]"
      style={style}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-[720px]:grid-cols-1 max-[720px]:gap-2.5">
        <div className="min-w-0">
          <span className="mb-2 inline-flex min-h-7 items-center rounded-[5px] bg-[var(--foresttrip-course-color)] px-2.5 text-[13px] font-black leading-none text-white max-[720px]:min-h-[24px] max-[720px]:px-2 max-[720px]:text-[11px]">
            {themeLabel}
          </span>
          <strong className="block min-w-0 break-keep text-[21px] font-black leading-7 text-[#111] max-[720px]:text-[17px] max-[720px]:leading-6">
            {displayName}
          </strong>
        </div>
        <dl className="grid min-w-[260px] grid-cols-2 gap-3 max-[720px]:min-w-0">
          <ForestTripCourseMetric
            icon={<Clock className="text-[#111]" size={18} strokeWidth={2.4} />}
            label="소요 시간"
            value={displayTime}
            valueClassName="font-numeric text-[19px] max-[720px]:text-[16px]"
          />
          <ForestTripCourseMetric
            icon={
              <DifficultyBarsIcon className="h-[18px] w-[18px] text-[#111]" />
            }
            label="난이도"
            value={difficultyLabel}
            valueClassName={cn(
              "text-[17px] max-[720px]:text-[15px]",
              difficultyTextClassName,
            )}
          />
        </dl>
      </div>
      <p className="m-0 min-w-0 rounded-[5px] border-l-[5px] border-[var(--foresttrip-course-color)] bg-[var(--foresttrip-course-soft)] px-4 py-3 text-[15px] font-bold leading-6 text-[#35413a] [overflow-wrap:anywhere] max-[720px]:px-3 max-[720px]:text-[14px] max-[720px]:leading-6">
        {route.path}
      </p>
    </li>
  );
}

function ForestTripCourseTicketCard({
  route,
  themeLabel,
  displayName,
  displayTime,
  difficultyLabel,
  style,
}: ForestTripCourseInfoCardProps) {
  const difficultyTextClassName = getDifficultyTextColorClass(difficultyLabel);

  return (
    <li
      className="grid min-h-[132px] grid-cols-[minmax(220px,0.9fr)_minmax(0,1.45fr)] overflow-hidden rounded-[7px] border border-[#d8e0da] bg-white shadow-[0_1px_5px_rgba(24,34,29,0.04)] max-[720px]:grid-cols-1"
      style={style}
    >
      <div className="grid content-center gap-3 bg-[var(--foresttrip-course-soft)] px-5 py-4 max-[720px]:px-4">
        <span className="inline-flex min-h-7 w-fit items-center rounded-[5px] bg-[var(--foresttrip-course-color)] px-2.5 text-[13px] font-black leading-none text-white max-[720px]:min-h-[24px] max-[720px]:px-2 max-[720px]:text-[11px]">
          {themeLabel}
        </span>
        <strong className="break-keep text-[22px] font-black leading-7 text-[#111] max-[720px]:text-[17px] max-[720px]:leading-6">
          {displayName}
        </strong>
      </div>

      <div className="grid min-w-0 content-center gap-3 px-5 py-4 max-[720px]:px-4">
        <p className="m-0 min-w-0 break-keep text-[15px] font-bold leading-6 text-[#35413a] [overflow-wrap:anywhere] max-[720px]:text-[14px]">
          {route.path}
        </p>
        <dl className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <ForestTripCourseMetric
            icon={<Clock className="text-[#111]" size={18} strokeWidth={2.4} />}
            label="소요 시간"
            value={displayTime}
            valueClassName="font-numeric text-[19px] max-[720px]:text-[16px]"
          />
          <ForestTripCourseMetric
            icon={
              <DifficultyBarsIcon className="h-[18px] w-[18px] text-[#111]" />
            }
            label="난이도"
            value={difficultyLabel}
            valueClassName={cn(
              "text-[17px] max-[720px]:text-[15px]",
              difficultyTextClassName,
            )}
          />
        </dl>
      </div>
    </li>
  );
}

function RouteSummaryCard({
  route,
  imageUrl,
  onOpen,
}: {
  route: MountainGuideRoute;
  imageUrl?: string;
  onOpen: () => void;
}) {
  const stops = buildRouteStops(route);
  const routeDisplayName = getRouteDisplayName(route);
  const routePanelStyle = {
    backgroundImage:
      "linear-gradient(135deg, var(--route-panel) 0%, var(--route-panel-dark) 100%)",
  } as CSSProperties;

  return (
    <li
      className={cn(
        "grid grid-cols-[282px_minmax(0,1fr)_316px] items-stretch overflow-hidden rounded-[5px] border border-[#d6d6d6] bg-white shadow-route max-[900px]:grid-cols-1",
        routeThemeClass[getRouteTheme(route)],
      )}
    >
      <div
        className="flex min-w-0 flex-col justify-center gap-2.5 px-5 py-[18px] text-white"
        style={routePanelStyle}
      >
        <span className="self-start rounded-[5px] bg-white px-2.5 py-1.5 text-[13px] font-black leading-[18px] text-[var(--route-color)]">
          {getRouteLabel(route)}
        </span>
        <div className="flex min-w-0 items-center gap-2.5">
          <strong className="min-w-0 break-keep text-[27px] font-black leading-[33px] [letter-spacing:0]">
            {routeDisplayName}
          </strong>
          <DifficultyBadge difficulty={route.difficulty} />
        </div>
        <p className="m-0 break-keep text-[15px] font-bold leading-[22px]">
          {getRouteSummary(route)}
        </p>
        <button
          className="mt-0.5 inline-flex min-h-[38px] items-center gap-2 self-start rounded-md border border-white/40 bg-white/10 px-3.5 text-sm font-black text-white [&_svg]:rotate-180"
          type="button"
          onClick={onOpen}
        >
          코스 상세보기
          <ArrowLeft size={16} />
        </button>
      </div>
      <div className="grid min-w-0 content-center gap-[22px] overflow-hidden bg-[linear-gradient(90deg,var(--route-soft),rgba(255,255,255,0.78))] px-[54px] py-[18px] max-[900px]:p-5">
        <div className="grid grid-cols-3 items-center gap-5 max-[900px]:grid-cols-1">
          <Metric
            icon={<Route size={17} />}
            label="거리"
            value={getSummaryMetricValue(route.distance)}
          />
          <Metric
            icon={<Clock size={17} />}
            label="소요시간"
            value={getSummaryMetricValue(route.estimatedTime)}
          />
          <DifficultyMetric difficulty={route.difficulty} />
        </div>
        <RouteTimeline stops={stops} rawPath={route.path} />
      </div>
      <figure className="relative m-0 min-w-0 bg-[linear-gradient(90deg,var(--route-soft),rgba(255,255,255,0.78))] p-2.5 max-[900px]:min-h-[170px]">
        {imageUrl ? (
          <img
            className="absolute inset-2.5 block h-[calc(100%-20px)] w-[calc(100%-20px)] rounded-[5px] object-cover max-[900px]:static max-[900px]:h-full max-[900px]:w-full"
            src={imageUrl}
            alt={`${route.name} 참고 사진`}
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-2.5 grid place-items-center rounded-[5px] bg-white/30 text-center max-[900px]:static max-[900px]:h-full"
            aria-hidden="true"
          >
            <span />
            <strong>{routeDisplayName}</strong>
          </div>
        )}
      </figure>
    </li>
  );
}

function CourseMapImagePanel({ route }: { route: MountainGuideRoute }) {
  const image = route.courseMapImage;

  if (!image) {
    return (
      <div className="grid min-h-[430px] place-items-center content-center gap-2.5 rounded-[5px] bg-[linear-gradient(rgba(47,107,79,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(47,107,79,0.08)_1px,transparent_1px),#edf3e8] bg-[length:42px_42px] p-6 text-center text-[#18221d] [&_p]:m-0 [&_p]:max-w-[420px] [&_p]:text-[#627168] [&_p]:leading-7 [&_strong]:text-xl [&_svg]:text-[#e10f07]">
        <Route size={24} />
        <strong>코스 이미지 준비 중</strong>
        <p>검증된 로컬 코스 지도 이미지를 추가하면 이 영역에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <figure className="m-0 overflow-hidden rounded-[5px] border border-[#d8e0da] bg-[#f4f8f6]">
      <img
        className="block min-h-[430px] w-full object-contain"
        src={image.src}
        alt={image.alt}
        loading="lazy"
      />
      {image.sourceLabel || image.sourceUrl ? (
        <figcaption className="flex flex-wrap items-center gap-2 border-t border-[#d8e0da] bg-white px-3 py-2 text-xs font-bold text-[#627168]">
          <span>출처</span>
          {image.sourceUrl ? (
            <a
              className="inline-flex items-center gap-1 text-[#276c8f]"
              href={image.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {image.sourceLabel ?? image.sourceUrl}
              <ExternalLink size={13} />
            </a>
          ) : (
            <span>{image.sourceLabel}</span>
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}

function RouteTimeline({
  stops,
  rawPath,
}: {
  stops: MountainGuideRouteStop[];
  rawPath: string;
}) {
  const displayStops = stops.slice(0, 5);
  const hasSegmentDistances = displayStops.some(
    (stop) => stop.distanceFromPrevious,
  );

  return (
    <div className="m-0 border-0 bg-transparent p-0">
      <strong className="sr-only">코스</strong>
      {stops.length > 1 ? (
        <>
          <ol
            className="relative m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(84px,1fr))] p-0"
            aria-label="코스 경유지"
          >
            {displayStops.map((stop, index) => (
              <li
                className={cn(
                  "relative min-w-0 px-1.5 text-center after:absolute after:left-1/2 after:right-[-50%] after:top-[7px] after:z-0 after:h-0.5 after:bg-[var(--route-color)] after:content-['']",
                  index === displayStops.length - 1 && "after:hidden",
                )}
                key={`${stop.name}-${index}`}
              >
                <span className="relative z-[1] mx-auto mb-3 flex h-4 w-4 items-center justify-center">
                  <span
                    className={cn(
                      "block h-3 w-3 rounded-full border-2 border-[var(--route-color)] bg-white",
                      (stop.label === "summit" || stop.name.includes("정상")) &&
                        "h-4 w-4 border-[4px]",
                    )}
                  />
                </span>
                <p className="m-0 break-keep text-[13px] font-black leading-[18px] text-[#18221d]">
                  {stop.name}
                </p>
                {stop.elevation ? (
                  <em className="mt-0.5 block font-numeric text-[12px] font-bold not-italic leading-[16px] text-[#627168]">
                    {stop.elevation}
                  </em>
                ) : null}
              </li>
            ))}
          </ol>
          {hasSegmentDistances ? (
            <ol
              className="mx-0 mb-0 mt-2 grid list-none grid-cols-[repeat(auto-fit,minmax(84px,1fr))] p-0"
              aria-label="구간 거리"
            >
              {displayStops.slice(1).map((stop, index) => (
                <li
                  className="relative min-w-0 border-t border-[#c5c9cc] pt-1 text-center font-numeric text-xs font-bold leading-4 text-[#627168] before:absolute before:left-0 before:top-[-5px] before:h-2.5 before:border-l before:border-[#c5c9cc] before:content-[''] after:absolute after:right-0 after:top-[-5px] after:h-2.5 after:border-l after:border-[#c5c9cc] after:content-['']"
                  key={`${stop.name}-${index}-distance`}
                >
                  {stop.distanceFromPrevious}
                </li>
              ))}
              <li className="hidden" aria-hidden="true" />
            </ol>
          ) : null}
          <p className="hidden">{rawPath}</p>
        </>
      ) : (
        <p>{rawPath}</p>
      )}
    </div>
  );
}

function CourseTimelinePanel({
  stops,
  route,
}: {
  stops: MountainGuideRouteStop[];
  route: MountainGuideRoute;
}) {
  const displayStops = stops.length ? stops : buildRouteStops(route);

  return (
    <aside
      className="rounded-md border border-[#dedede] bg-white px-6 py-[26px]"
      aria-label="코스 한눈에 보기"
    >
      <h3>코스 한눈에 보기</h3>
      <ol className="relative m-0 grid list-none gap-0 pl-[22px] before:absolute before:bottom-2.5 before:left-[7px] before:top-2.5 before:w-[3px] before:bg-[#a9adb0] before:content-['']">
        {displayStops.map((stop, index) => (
          <li
            className={cn(
              "relative grid min-h-[70px] grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 pb-3 before:absolute before:-left-[22px] before:top-[3px] before:h-3.5 before:w-3.5 before:rounded-full before:border-[3px] before:border-white before:bg-[#90979b] before:shadow-[0_0_0_2px_#90979b] before:content-[''] [&.is-start]:before:bg-[#e10f07] [&.is-start]:before:shadow-[0_0_0_2px_#e10f07] [&.is-finish]:before:bg-[#e10f07] [&.is-finish]:before:shadow-[0_0_0_2px_#e10f07]",
              `is-${stop.label ?? "waypoint"}`,
            )}
            key={`${stop.name}-${index}`}
          >
            {stop.label === "start" || stop.label === "finish" ? (
              <span className="justify-self-start rounded-[5px] bg-[#e10f07] px-2 py-1 text-[13px] font-black text-white">
                {stop.label === "start" ? "출발" : "도착"}
              </span>
            ) : null}
            <strong className="col-start-1 text-base leading-6 text-[#18221d]">
              {stop.name}
            </strong>
            {stop.elevation ? (
              <em className="col-start-1 text-sm not-italic text-[#627168]">
                {stop.elevation}
              </em>
            ) : null}
            {stop.distanceFromPrevious ? (
              <small className="col-start-1 text-sm text-[#627168]">
                {stop.distanceFromPrevious}
              </small>
            ) : null}
            {stop.estimatedArrival ? (
              <time className="col-start-2 row-span-2 row-start-1 font-numeric font-extrabold text-[#18221d]">
                {stop.estimatedArrival}
              </time>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-sm leading-[22px] text-[#627168]">
        소요시간은 개인 체력과 휴식 시간에 따라 달라질 수 있습니다.
      </p>
    </aside>
  );
}

function EvaluationPicker({
  className,
  title,
  options,
  activeIndex,
  onChange,
}: {
  className?: string;
  title: string;
  options: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-[#d8e0da] bg-[#fbfcfb] p-4 [&>strong]:mb-5 [&>strong]:block [&>strong]:text-center [&>strong]:text-lg [&>strong]:font-extrabold [&>strong]:leading-7",
        className,
      )}
    >
      <strong>{title}</strong>
      <div className="grid grid-cols-5 gap-2 max-[560px]:gap-1.5">
        {options.map((option, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={option}
              className={cn(
                "grid min-w-0 cursor-pointer justify-items-center gap-2 rounded-md border-0 bg-transparent px-1 py-1 text-[#627168] transition hover:bg-[#f7f8f7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e10f07]/40",
                isActive && "text-[#e10f07]",
              )}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(index)}
            >
              <FeedbackEvaluationIcon index={index} isActive={isActive} />
              <span className="break-keep text-center text-[13px] font-semibold leading-[18px] max-[560px]:text-xs">
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackEvaluationIcon({
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
        "grid h-11 w-11 place-items-center overflow-hidden rounded-full border bg-[#f7f8f7] p-[7px] max-[560px]:h-[42px] max-[560px]:w-[42px]",
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
        <DifficultyEvaluationIcon level={index} />
      )}
    </span>
  );
}

function DifficultyEvaluationIcon({
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

function HeroFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-white [&_svg]:row-span-2 [&_svg]:mt-1 [&_span]:text-[13px] [&_span]:font-black [&_span]:text-white/80 [&_strong]:text-base [&_strong]:font-extrabold [&_strong]:leading-6">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HeroInfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-h-[34px] grid-cols-[76px_minmax(0,1fr)] border-b border-white/10 py-1.5">
      <dt className="flex items-center gap-1.5 text-[13px] leading-[22px] text-white/80 [&_svg]:text-[#ffde1a]">
        {icon}
        {label}
      </dt>
      <dd className="m-0 text-[13px] leading-[22px] text-white/90">{value}</dd>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 text-[#18221d] max-[900px]:min-h-11 max-[900px]:rounded-lg max-[900px]:border max-[900px]:border-[#276c8f]/15 max-[900px]:bg-[#f4f8f6] max-[900px]:px-3 max-[900px]:py-2 [&_svg]:flex-none [&_span]:whitespace-nowrap [&_span]:text-[15px] [&_span]:font-black [&_strong]:truncate [&_strong]:font-numeric [&_strong]:text-[15px] [&_strong]:font-black [&_strong]:leading-5">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DifficultyBadge({
  difficulty,
}: {
  difficulty: MountainGuideDifficulty;
}) {
  return (
    <b className="inline-flex min-h-7 min-w-8 flex-none items-center justify-center rounded-[5px] border border-white/25 bg-white/20 px-2.5 text-sm font-black leading-none text-white">
      {difficultyShortLabels[difficulty]}
    </b>
  );
}

function DifficultyMetric({
  difficulty,
}: {
  difficulty: MountainGuideDifficulty;
}) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 text-[#18221d] max-[900px]:min-h-11 max-[900px]:rounded-lg max-[900px]:border max-[900px]:border-[#276c8f]/15 max-[900px]:bg-[#f4f8f6] max-[900px]:px-3 max-[900px]:py-2 [&_svg]:flex-none [&_span]:whitespace-nowrap [&_span]:text-base [&_span]:font-black">
      <ShieldAlert size={17} />
      <span>난이도</span>
      <strong
        className={cn(
          "inline-flex min-h-7 items-center rounded-[5px] border px-2.5 text-sm font-black leading-none",
          difficultyThemeClass[difficulty],
        )}
      >
        {difficultyShortLabels[difficulty]}
      </strong>
    </div>
  );
}

function DifficultyGuide() {
  return (
    <section
      className="min-h-[216px] rounded-none border border-[#d9dee2] bg-white px-6 pb-5 pt-0 [&_h3]:mx-[-24px] [&_h3]:mb-[18px] [&_h3]:mt-0 [&_h3]:bg-[#f1f5f7] [&_h3]:px-6 [&_h3]:py-3.5 [&_h3]:text-lg [&_h3]:font-black [&_h3]:leading-[26px] [&_dd]:m-0 [&_dd]:text-sm [&_dd]:leading-6 [&_dt]:font-black"
      aria-label="코스 난이도 안내"
    >
      <h3>코스 난이도 안내</h3>
      <dl className="grid gap-3 [&>div]:grid [&>div]:grid-cols-[44px_minmax(0,1fr)] [&>div]:items-center [&>div]:gap-3">
        <div>
          <dt className="inline-flex min-h-7 items-center justify-center rounded-full border border-[#bfdab4] bg-[#e7f3e4] px-3 text-sm font-black text-[#4d8b37]">
            하
          </dt>
          <dd>초보자도 비교적 쉽게 오를 수 있는 코스</dd>
        </div>
        <div>
          <dt className="inline-flex min-h-7 items-center justify-center rounded-full border border-[#d7e4ba] bg-[#f0f7e4] px-3 text-sm font-black text-[#6f9134]">
            중
          </dt>
          <dd>기본 체력이 필요한 일반적인 산행 코스</dd>
        </div>
        <div>
          <dt className="inline-flex min-h-7 items-center justify-center rounded-full border border-[#f3c79e] bg-[#fff0de] px-3 text-sm font-black text-[#c46422]">
            상
          </dt>
          <dd>경사, 거리, 암릉 등으로 경험이 필요한 코스</dd>
        </div>
        <div>
          <dt className="inline-flex min-h-7 items-center justify-center rounded-full border border-[#efb9b4] bg-[#fde7e3] px-3 text-sm font-black text-[#a83a34]">
            최상
          </dt>
          <dd>숙련자에게 적합한 고난도 코스</dd>
        </div>
      </dl>
    </section>
  );
}

function VisitWarnings({
  routes,
  notes,
}: {
  routes: MountainGuideRoute[];
  notes?: string;
}) {
  const warnings = routes.flatMap((route) => route.warnings ?? []).slice(0, 5);

  return (
    <section
      className="min-h-[216px] rounded-none border border-[#d9dee2] bg-white px-6 pb-5 pt-0 [&_h3]:mx-[-24px] [&_h3]:mb-[18px] [&_h3]:mt-0 [&_h3]:bg-[#f1f5f7] [&_h3]:px-6 [&_h3]:py-3.5 [&_h3]:text-lg [&_h3]:font-black [&_h3]:leading-[26px] [&_li]:flex [&_li]:gap-2 [&_li]:text-sm [&_li]:leading-6 [&_p]:text-sm [&_p]:leading-6 [&_ul]:m-0 [&_ul]:grid [&_ul]:list-none [&_ul]:gap-2 [&_ul]:p-0"
      aria-label="등산 시 유의사항"
    >
      <h3>등산 시 유의사항</h3>
      <ul>
        {(warnings.length > 0
          ? warnings
          : ["방문 전 탐방로 통제, 주차, 대중교통 운행 여부를 확인하세요."]
        ).map((warning, index) => (
          <li key={`${warning}-${index}`}>
            <Check size={17} />
            <span>{warning}</span>
          </li>
        ))}
      </ul>
      {notes ? <p>{notes}</p> : null}
    </section>
  );
}

function WeatherStatusCard({ mountain }: { mountain: Mountain }) {
  const stationId = getMountainWeatherStationForName(mountain.name);
  const [weather, setWeather] = useState<MountainWeather | null>(null);
  const [weatherState, setWeatherState] = useState<
    "idle" | "loading" | "ready" | "unavailable" | "error"
  >("idle");

  useEffect(() => {
    const controller = new AbortController();
    setWeather(null);

    if (!stationId) {
      setWeatherState("unavailable");
      return () => controller.abort();
    }

    setWeatherState("loading");
    fetchMountainWeather(mountain.name, controller.signal)
      .then((nextWeather) => {
        if (controller.signal.aborted) {
          return;
        }

        if (!nextWeather) {
          setWeatherState("unavailable");
          return;
        }

        setWeather(nextWeather);
        setWeatherState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWeatherState("error");
        }
      });

    return () => controller.abort();
  }, [mountain.name, stationId]);

  const sourceUrl = stationId
    ? getMountainWeatherPageUrl(stationId)
    : undefined;
  const statusText =
    weatherState === "ready" && weather?.observedAt
      ? `${weather.observedAt.slice(5, 16)} 기준`
      : weatherState === "loading"
        ? "산악기상 조회 중"
        : weatherState === "error"
          ? "연결 실패"
          : "관측지점 없음";
  const description =
    weatherState === "ready"
      ? `${weather?.stationName ?? mountain.name} 산악기상`
      : weatherState === "error"
        ? "브라우저 직접 호출이 차단되면 프록시 설정이 필요합니다."
        : weatherState === "unavailable"
          ? "산악기상정보시스템의 100대 명산 지점에 없습니다."
          : `${mountain.name} 산악기상 정보를 불러오는 중`;
  const weatherMetrics = [
    {
      icon: <CloudSun size={14} />,
      label: "체감온도",
      value: weather?.feelsLike ?? "--",
    },
    {
      icon: <CloudRain size={14} />,
      label: "강수량",
      value: weather?.precipitation ?? "--",
    },
    {
      icon: <Droplets size={14} />,
      label: "습도",
      value: weather?.humidity ?? "--",
    },
    {
      icon: <Wind size={14} />,
      label: "풍속",
      value: weather?.windSpeed ?? "--",
    },
    {
      icon: <MountainSnow size={14} />,
      label: "등산쾌적지수",
      value: weather?.climbIndex ?? "--",
    },
  ];

  return (
    <section
      className="grid min-h-[136px] grid-cols-[minmax(190px,1fr)_58px_minmax(118px,0.72fr)_minmax(410px,1.45fr)_minmax(230px,0.86fr)] items-center gap-x-5 gap-y-3 rounded-md border border-[#245c46]/35 bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.18),transparent_30%),linear-gradient(135deg,#06263a,#245c46)] px-6 py-5 text-white shadow-[0_10px_28px_rgba(24,34,29,0.07)] max-[1100px]:grid-cols-[minmax(180px,1fr)_auto_auto] max-[900px]:grid-cols-1 max-[900px]:items-start max-[900px]:gap-4 max-[560px]:min-h-0 max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:gap-x-3 max-[560px]:gap-y-2 max-[560px]:px-3 max-[560px]:py-3"
      aria-label={`${mountain.name} 날씨`}
    >
      <div className="min-w-0 self-center max-[560px]:col-start-1 max-[560px]:row-start-1 max-[560px]:p-px max-[560px]:pr-1">
        <h3 className="m-0 text-lg font-black leading-[26px] text-white max-[560px]:text-base max-[560px]:leading-6">
          오늘의 {mountain.name} 날씨
        </h3>
        <span className="mt-1 block text-sm font-bold leading-5 text-white/80 max-[560px]:text-xs max-[560px]:leading-4">
          {statusText}
        </span>
        <span className="mt-1 block break-keep text-sm font-extrabold leading-5 text-white/90 max-[560px]:text-xs max-[560px]:leading-5">
          {description}
        </span>
      </div>

      <div className="contents max-[560px]:col-start-2 max-[560px]:row-start-1 max-[560px]:grid max-[560px]:grid-cols-[42px_auto] max-[560px]:items-center max-[560px]:justify-end max-[560px]:gap-2 max-[560px]:p-px">
        {weatherState === "ready" && weather?.iconUrl ? (
          <img
            className="h-14 w-14 justify-self-center object-contain max-[560px]:h-[42px] max-[560px]:w-[42px]"
            src={weather.iconUrl}
            alt={`${mountain.name} 날씨 아이콘`}
            loading="lazy"
          />
        ) : (
          <CloudSun className="h-14 w-14 justify-self-center text-white/90 max-[560px]:h-[42px] max-[560px]:w-[42px]" strokeWidth={1.6} />
        )}

        <strong className="justify-self-start font-numeric text-[40px] font-black leading-none text-white max-[900px]:text-[36px] max-[560px]:justify-self-end max-[560px]:text-[36px]">
          {weather?.temperature ?? "--"}
        </strong>
      </div>

      <dl className="grid min-w-0 grid-cols-[repeat(5,minmax(0,1fr))] items-center gap-2 text-center max-[1100px]:col-span-3 max-[900px]:col-span-1 max-[720px]:grid-cols-2 max-[720px]:text-left max-[560px]:hidden">
        <div className="grid min-h-[58px] content-center justify-items-center rounded-md bg-white/8 px-2 py-1 max-[720px]:justify-items-start max-[560px]:min-h-[40px] max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:items-center max-[560px]:gap-x-2 max-[560px]:px-2">
          <dt className="mb-1 flex items-center justify-center gap-1 whitespace-nowrap text-xs font-bold text-white/75 max-[560px]:mb-0">
            <CloudSun size={14} />
            체감온도
          </dt>
          <dd className="m-0 text-sm font-black text-white max-[560px]:justify-self-end max-[560px]:text-right">
            {weather?.feelsLike ?? "--"}
          </dd>
        </div>
        <div className="grid min-h-[58px] content-center justify-items-center rounded-md bg-white/8 px-2 py-1 max-[720px]:justify-items-start max-[560px]:min-h-[40px] max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:items-center max-[560px]:gap-x-2 max-[560px]:px-2">
          <dt className="mb-1 flex items-center justify-center gap-1 whitespace-nowrap text-xs font-bold text-white/75 max-[560px]:mb-0">
            <CloudRain size={14} />
            강수량
          </dt>
          <dd className="m-0 text-sm font-black text-white max-[560px]:justify-self-end max-[560px]:text-right">
            {weather?.precipitation ?? "--"}
          </dd>
        </div>
        <div className="grid min-h-[58px] content-center justify-items-center rounded-md bg-white/8 px-2 py-1 max-[720px]:justify-items-start max-[560px]:min-h-[40px] max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:items-center max-[560px]:gap-x-2 max-[560px]:px-2">
          <dt className="mb-1 flex items-center justify-center gap-1 whitespace-nowrap text-xs font-bold text-white/75 max-[560px]:mb-0">
            <Droplets size={14} />
            습도
          </dt>
          <dd className="m-0 text-sm font-black text-white max-[560px]:justify-self-end max-[560px]:text-right">
            {weather?.humidity ?? "--"}
          </dd>
        </div>
        <div className="grid min-h-[58px] content-center justify-items-center rounded-md bg-white/8 px-2 py-1 max-[720px]:justify-items-start max-[560px]:min-h-[40px] max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:items-center max-[560px]:gap-x-2 max-[560px]:px-2">
          <dt className="mb-1 flex items-center justify-center gap-1 whitespace-nowrap text-xs font-bold text-white/75 max-[560px]:mb-0">
            <Wind size={14} />
            풍속
          </dt>
          <dd className="m-0 text-sm font-black text-white max-[560px]:justify-self-end max-[560px]:text-right">
            {weather?.windSpeed ?? "--"}
          </dd>
        </div>
        <div className="grid min-h-[58px] content-center justify-items-center rounded-md bg-white/8 px-2 py-1 max-[720px]:col-span-2 max-[720px]:justify-items-start max-[560px]:min-h-[40px] max-[560px]:grid-cols-[minmax(0,1fr)_auto] max-[560px]:items-center max-[560px]:gap-x-2 max-[560px]:px-2">
          <dt className="mb-1 flex items-center justify-center gap-1 whitespace-nowrap text-xs font-bold text-white/75 max-[560px]:mb-0">
            <MountainSnow size={14} />
            등산쾌적지수
          </dt>
          <dd className="m-0 text-sm font-black text-white max-[560px]:justify-self-end max-[560px]:text-right">
            {weather?.climbIndex ?? "--"}
          </dd>
        </div>
      </dl>
      <dl className="hidden min-w-0 grid-cols-5 gap-x-1 gap-y-1 text-center max-[560px]:col-span-2 max-[560px]:grid">
        {weatherMetrics.map((metric) => (
          <dt
            key={`label-${metric.label}`}
            className="min-w-0 break-keep text-[10px] font-bold leading-3 text-white/75"
          >
            {metric.label}
          </dt>
        ))}
        {weatherMetrics.map((metric) => (
          <dd
            key={`value-${metric.label}`}
            className="m-0 min-w-0 break-keep font-numeric text-[12px] font-black leading-4 text-white"
          >
            {metric.value}
          </dd>
        ))}
      </dl>
      {sourceUrl ? (
        <a
          className="inline-flex min-h-10 shrink-0 items-center justify-center justify-self-end whitespace-nowrap rounded-md border border-white/30 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10 max-[1100px]:col-span-3 max-[1100px]:justify-self-start max-[900px]:col-span-1 max-[900px]:w-full max-[560px]:col-span-2 max-[560px]:min-h-9 max-[560px]:text-[13px]"
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          산악기상정보시스템에서 보기
        </a>
      ) : null}
    </section>
  );
}

function PhotoGallery({
  mountainName,
  links,
}: {
  mountainName: string;
  links: MountainGuideLink[];
}) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section className="mt-[26px]" aria-label={`${mountainName} 갤러리`}>
      <div className="mb-3.5 flex items-center gap-2 [&_h3]:m-0 [&_h3]:text-[23px] [&_h3]:font-black [&_h3]:leading-[30px]">
        <MountainIcon size={18} />
        <h3>{mountainName} 갤러리</h3>
      </div>
      <div className="grid grid-cols-5 gap-2 max-[900px]:grid-cols-2">
        {links.map((link, index) => (
          <a
            className="block h-[116px] overflow-hidden rounded"
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
          >
            <img
              className="h-full w-full object-cover"
              src={link.url}
              alt={`${mountainName} 사진 ${index + 1}`}
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
