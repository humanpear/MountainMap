export const mountainRegionCodes = [
  'seoul-gyeonggi',
  'gangwon',
  'chungnam',
  'chungbuk',
  'gyeongbuk',
  'gyeongnam',
  'jeonbuk',
  'jeonnam',
  'jeju',
] as const;

export type MountainRegionCode = (typeof mountainRegionCodes)[number];

export const mountainReviewDifficulties = [
  '쉬움',
  '보통',
  '약간 어려움',
  '어려움',
  '매우 어려움',
] as const;

export type MountainReviewDifficulty = (typeof mountainReviewDifficulties)[number];

export type MountainDifficultySummary = {
  mountainId: string;
  reviewCount: number;
  averageScore: number;
};

export function isMountainReviewDifficulty(
  value: unknown,
): value is MountainReviewDifficulty {
  return (
    typeof value === 'string' &&
    (mountainReviewDifficulties as readonly string[]).includes(value)
  );
}

export type Mountain = {
  id: string;
  name: string;
  province: string;
  regionCodes: MountainRegionCode[];
  city: string;
  latitude: number;
  longitude: number;
  elevationMeters: number;
  address: string;
  shortDescription: string;
  selectionReason: string;
};

export type CompletionRecord = {
  id?: string;
  mountainId: string;
  completedAt: string;
  climbedOn?: string | null;
  photoUrl?: string | null;
};

export type MountainGuideStatus = 'draft' | 'verified';

export type MountainGuideSource = 'ai-draft' | 'curated';

export type MountainGuideConfidence = 'low' | 'medium' | 'high';

export type MountainGuideDifficulty = 'easy' | 'normal' | 'hard' | 'extreme' | 'unknown';

export type ForestTripCourseKind = 'recommended' | 'other1' | 'other2' | 'other3';

export type MountainGuideRouteStop = {
  name: string;
  label?: 'start' | 'waypoint' | 'summit' | 'finish';
  elevation?: string;
  distanceFromPrevious?: string;
  estimatedArrival?: string;
  latitude?: number;
  longitude?: number;
};

export type MountainGuideImage = {
  src: string;
  alt: string;
  sourceLabel?: string;
  sourceUrl?: string;
};

export type MountainGuideRoute = {
  rank: number;
  isRecommended: boolean;
  forestTripCourseKind?: ForestTripCourseKind;
  name: string;
  path: string;
  startPoint: string;
  distance: string;
  estimatedTime: string;
  difficulty: MountainGuideDifficulty;
  parking: string;
  transit: string;
  features: string[];
  sourceLinks: MountainGuideLink[];
  warnings: string[];
  recommendationReason?: string;
  heroImageUrl?: string;
  summary?: string;
  routeStops?: MountainGuideRouteStop[];
  elevationGain?: string;
  courseMapImage?: MountainGuideImage;
};

export type MountainGuideLink = {
  label: string;
  url: string;
  type: 'official' | 'blog' | 'search';
};

export type MountainGuide = {
  mountainId: string;
  status: MountainGuideStatus;
  source: MountainGuideSource;
  generatedAt?: string;
  confidence?: MountainGuideConfidence;
  selectionReason?: string;
  heroImage?: MountainGuideImage;
  courseMapImage?: MountainGuideImage;
  routes: MountainGuideRoute[];
  photoLinks?: MountainGuideLink[];
  verificationLinks?: MountainGuideLink[];
  notes?: string;
};

export type RandomResult = {
  winner: Mountain;
  sequence: Mountain[];
};
