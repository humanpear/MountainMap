# Design System - 봉우리모아

## Product Context

- **What this is:** 100대 명산을 지도에서 탐색하고, 산별 상세 정보와 코스별 상세 정보를 확인하며, 등반 기록을 남기는 등산 계획 앱.
- **Who it is for:** 100대 명산 완등을 목표로 하는 사용자, 주말 산행지를 고르는 등산객, 모바일로 산행 정보를 찾는 40~70대 사용자.
- **Primary job:** 사용자가 산과 코스를 고른 뒤 “어디서 출발하고, 얼마나 걸리고, 어떻게 이동하며, 어떤 경로로 오르는지”를 빠르게 판단하게 한다.

## Reference Policy

- 첨부된 2개 이미지는 사용자가 직접 만든 디자인이다.
- 구현 시 **거의 동일한 수준이 아니라 완전히 동일한 레이아웃, 색상 방향, 정보 위계, 시각 구성을 따라도 된다.**
- 현재 적용된 상세페이지 디자인은 유지보수 대상이 아니라 전면 재설계 대상으로 본다.
- 새 상세 구조는 두 화면으로 나눈다:
  - **산 상세 메인 화면:** 산 소개와 추천 코스 목록.
  - **코스별 디테일 화면:** 하나의 등산코스 지도, 타임라인, 평가, 후기.

## Aesthetic Direction

- **Direction:** Korean 100 Famous Mountains Guide.
- **Mood:** 산악 관광 페이지의 몰입감과 등산 계획 도구의 실용성을 결합한다.
- **Visual anchor:** 실제 산 사진, 어두운 네이비 헤더, 흰색 콘텐츠 배경, 강한 코스 색상 패널.
- **Information style:** 첫눈에 비교 가능한 수치, 명확한 코스 경로, 큰 글자, 단정한 카드.
- **Trust posture:** 숲나들e, 검색 보강, 사용자 입력 좌표가 섞이므로 출처와 검증 상태를 숨기지 않는다.

## Top Navigation

상단 메뉴는 첨부 이미지보다 더 단순하게 만든다.

- 유지:
  - `봉우리모아` 로고
  - `산 이름을 검색하세요` 검색바
- 제거:
  - `100대 명산`
  - `추천 코스`
  - `등산 정보`
  - `커뮤니티`
  - `명산 가이드`
- Desktop:
  - 높이 64~72px.
  - 배경 `#06263A` 또는 더 어두운 네이비.
  - 로고는 왼쪽, 검색바는 오른쪽.
- Mobile:
  - 로고와 검색바를 세로 또는 2열로 배치하되 터치 타깃은 44px 이상.
  - 검색바가 너무 좁아지면 로고 아래로 내려도 된다.
- 브랜드 워드마크:
  - `봉우리모아`는 `봉`과 `모아` 사이의 `우리`를 주변 글자의 50% 크기로 표시하고, 하단선을 맞춰 하나의 로고타입으로 읽히게 한다.
  - Desktop은 24px, Mobile은 20px을 사용하며 자간은 `0.04em`으로 둔다.
  - 워드마크의 `font-black`은 브랜드 표시에만 허용하는 예외이며 일반 제목과 본문에는 확장하지 않는다.

## Mountain Detail Main Page

첫 번째 첨부 이미지를 기준으로 한다.

### Page Order

1. Top navigation
2. Full-width mountain hero
3. Recommended courses
4. Course difficulty guide
5. Hiking warnings
6. Optional weather/status card
7. Mountain gallery
8. Footer or bottom navigation

### Hero

- 풀폭 산 이미지 배경을 사용한다.
- 이미지 위에는 어두운 오버레이를 얹어 흰색 텍스트를 선명하게 만든다.
- 왼쪽에는 다음 정보를 둔다:
  - 고도 배지, 예: `1,947m`
  - 산 이름
  - 한자명은 데이터가 있을 때만 표시
  - 산 한줄 소개
  - 위치, 높이, 선정, 특징 메타
- 오른쪽에는 어두운 반투명 `산 정보` 패널을 둔다:
  - 위치
  - 높이
  - 난이도 또는 대표 난이도
  - 소요시간 범위
  - 주요 특징
  - 관리기관 또는 출처 상태
  - `지도에서 보기` 버튼
- Hero height:
  - Desktop: 460~540px.
  - Mobile: 520px 내외, 텍스트가 잘리지 않도록 높이를 자동 확장해도 된다.

### Recommended Course Cards

첨부 이미지와 동일한 구조를 기준으로 한다.

- 섹션 제목: `추천 코스`
- 카드 구성:
  - 왼쪽 컬러 패널
    - 코스 라벨: `최고 인기 코스`, `경관 좋은 코스`, `비교적 쉬운 코스`
    - 코스명
    - 난이도 칩
    - `코스 상세보기` 버튼
  - 가운데 정보 영역
    - 거리
    - 소요시간
    - 난이도
    - 경로 타임라인
  - 오른쪽 이미지
    - 코스 또는 산 사진
- Desktop:
  - 카드 높이 약 170~190px.
  - 컬러 패널 260~280px.
  - 오른쪽 이미지 300px 내외.
- Mobile:
  - 가로 3분할을 유지하지 않는다.
  - 컬러 패널, 수치, 경로, 이미지가 세로로 쌓인다.
  - 경로 타임라인은 작아지면 텍스트 경로 블록으로 대체한다.

### Route Card Colors

| Route type | Color | Usage |
| --- | --- | --- |
| 최고 인기 / 추천 | `#D90D0D` | 메인 추천 코스 |
| 경관 좋은 / 대체 | `#F28A00` | 두 번째 대표 코스 |
| 비교적 쉬움 / 숲길 | `#237A1F` | 쉬운 코스 |
| 어려움 / 능선 | `#7A2D2D` | 고난도 코스 |
| 확인 필요 | `#5D6A62` | 자료 부족 |

### Main Page Supporting Cards

- `코스 난이도 안내`
  - `하`, `중`, `상`, `최상`처럼 짧은 칩을 사용해도 된다.
  - 현재 데이터 라벨은 `수월함`, `보통`, `어려움`, `확인 필요`를 유지한다.
- `등산 시 유의사항`
  - 체크 아이콘 + 짧은 문장.
  - 기상 확인, 출입 금지, 쓰레기 되가져가기, 물/간식, 겨울 장비.
- `날씨 카드`
  - 실제 날씨 API가 없으면 구현 보류 가능.
  - 디자인 문서에는 선택 요소로 둔다.
- `갤러리`
  - 숲나들e 사진을 우선 사용.
  - Desktop: 5장 가로 스트립.
  - Mobile: 2열 그리드 또는 가로 스크롤.

## Course Detail Page

두 번째 첨부 이미지를 기준으로 새 화면을 만든다.

### Entry

- 메인 상세 화면의 코스 카드에서 `코스 상세보기`를 누르면 진입한다.
- URL 또는 내부 상태는 구현 단계에서 정하되, 화면 개념은 `mountain + route` 단위다.

### Page Order

1. Top navigation
2. Breadcrumb
3. Course hero
4. Tabs
   - `코스 개요`
   - `포토 갤러리`
5. Course map + course timeline
6. Course evaluation form
7. Other hikers' short reviews
8. Footer

### Course Hero

- 산 이미지 배경 + 어두운 오버레이.
- 왼쪽:
  - 코스 라벨, 예: `최고 인기 코스`
  - 산명 + 코스명, 예: `한라산 성판악 코스`
  - 출발지 ~ 도착지
  - 코스 요약 설명
  - 거리, 소요시간, 누적고도, 난이도 메타
- 오른쪽:
  - 어두운 반투명 `코스 정보 요약` 패널
  - 출발지
  - 도착지
  - 거리
  - 소요시간
  - 난이도
  - 최고 고도
  - 누적 고도

### Tabs

- 기본 선택 탭은 `코스 개요`.
- `포토 갤러리`는 코스 사진 또는 산 사진이 있을 때 표시한다.
- 탭은 빨간색 underline 또는 route color underline을 사용한다.

### Course Map

- `코스 지도` 영역은 카카오맵을 사용한다.
- 카카오맵 Web API의 `Polyline`을 사용해 코스 동선을 표시한다.
- 기본 구현 기준:
  - `mapPathCoordinates`가 있으면 `kakao.maps.Polyline({ path })`로 선을 그린다.
  - `routeStops`가 있으면 출발지, 경유지, 도착지 마커를 표시한다.
  - 좌표가 없으면 지도 대신 `경로 좌표 준비 중` 상태를 보여준다.
- 기술 메모:
  - 카카오맵 Web API는 좌표 배열 기반 Polyline 표시가 가능하다.
  - 자동 길찾기 경로가 아니라 사용자가 직접 입력한 위도/경도 배열을 기본 데이터로 사용한다.
  - 자동 길찾기가 필요하면 별도 API/비용/정확성 검토가 필요하므로 v1 범위 밖으로 둔다.

### Course Timeline

- 지도 오른쪽에 `코스 한눈에 보기` 세로 타임라인을 둔다.
- 각 지점은 다음 정보를 가질 수 있다:
  - 라벨: `출발`, `도착`, 또는 일반 경유지
  - 지점명
  - 고도
  - 이전 지점과의 거리
  - 예상 도착 시간 또는 누적 시간
- Mobile:
  - 지도 아래로 타임라인을 내린다.
  - 지도와 타임라인이 가로로 압축되지 않게 한다.

### Course Evaluation

- `난이도는 어떠셨나요?`
  - 5단계 버튼.
- `소요시간은 어떠셨나요?`
  - 2시간 이하, 2~3시간, 3~4시간, 4~5시간, 5시간 이상.
- `한줄평을 남겨주세요!`
  - 100자 내외 입력.
  - 등록 버튼.
- 실제 저장 기능이 준비되지 않았으면 UI는 disabled 또는 local mock 상태로 둔다.

### Other Hikers' Reviews

- 카드형 후기 목록.
- 각 카드:
  - 닉네임
  - 날짜
  - 난이도 배지
  - 소요시간
  - 한줄평
  - 좋아요/댓글 수
- 실제 데이터가 없으면 mock이 아니라 “후기가 아직 없습니다” 상태를 우선한다.

## Data Model Direction

`MountainGuideRoute`는 코스 상세 화면을 위해 확장한다.

```ts
type MountainGuideRoute = {
  rank: number;
  isRecommended: boolean;
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
  mapPathCoordinates?: MountainGuideCoordinate[];
  elevationGain?: string;
  coursePhotos?: MountainGuideLink[];
  reviewSummary?: string;
};

type MountainGuideCoordinate = {
  latitude: number;
  longitude: number;
};

type MountainGuideRouteStop = {
  name: string;
  label?: 'start' | 'waypoint' | 'summit' | 'finish';
  elevation?: string;
  distanceFromPrevious?: string;
  estimatedArrival?: string;
  latitude?: number;
  longitude?: number;
};
```

## Empty States

- 산 사진이 없으면 숲나들e 사진 또는 기존 산 사진을 히어로에 사용한다.
- 사진이 전혀 없으면 임시 gradient hero를 사용하되, 최종 데이터 작업에서는 사진을 채우는 것을 우선한다.
- 코스 좌표가 없으면 카카오맵 지도 대신 `경로 좌표 준비 중` 상태를 보여준다.
- 코스 상세 데이터가 부족하면 메인 코스 카드의 `코스 상세보기`는 비활성화하거나 `준비 중`으로 표시한다.
- 지도 로딩 실패 시에는 지도를 숨기지 말고 오류 메시지와 텍스트 코스 타임라인을 보여준다.

## Typography

- **Primary font:** SUIT Variable.
- **Fallback:** `"SUIT Variable", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`.
- **Numbers/data:** Geist.
- **Font weight:** Unless a design explicitly calls for a heavier weight, use `600` (semibold) as the maximum font weight. Reserve bold, extrabold, and black for specifically approved emphasis.
- **Do not use:** thin 300-weight body text, 12px body labels, negative letter-spacing.

| Token | Mobile | Desktop | Usage |
| --- | ---: | ---: | --- |
| hero-title | 42~56px | 72~88px | 산 상세 메인 산명 |
| course-hero-title | 34~44px | 48~60px | 코스 상세 제목 |
| section-title | 22px | 28px | 추천 코스, 코스 지도 |
| route-title | 24px | 32px | 코스 카드명 |
| body | 16px | 16px | 설명 |
| body-large | 17px | 18px | 코스 경로, 중요 안내 |
| metric | 18px | 20px | 거리, 시간, 고도 |
| label | 14px | 14px | 필드 라벨 |

## Color System

| Role | Token | Hex |
| --- | --- | --- |
| Background | `--bg` | `#F5F7F4` |
| Surface | `--surface` | `#FFFFFF` |
| Surface muted | `--surface-muted` | `#EEF3F0` |
| Border | `--border` | `#D8E0DA` |
| Text | `--text` | `#18221D` |
| Text muted | `--text-muted` | `#5D6A62` |
| Header navy | `--hero-navy` | `#06263A` |
| Primary green | `--primary` | `#245C46` |
| Route red | `--route-red` | `#D90D0D` |
| Route orange | `--route-orange` | `#F28A00` |
| Route green | `--route-green` | `#237A1F` |
| Warning | `--warning` | `#B56916` |
| Error | `--error` | `#B14A3D` |

## Responsive Rules

- Mobile is the baseline.
- Mobile must not require horizontal scrolling except optional image/gallery strips.
- Main detail route cards stack vertically on mobile.
- Course detail map and timeline stack vertically on mobile.
- Desktop may use two columns only when each column remains readable:
  - hero text + info panel
  - map + timeline
  - review cards grid
- Body text is never below 16px.
- Touch targets are at least 44px.

## Data And Source Policy

- 숲나들e has been confirmed by the user via email as allowed for this project as of 2026-05-14.
- Use 숲나들e directly for:
  - 100대 명산 선정 이유
  - 산행코스 table data
  - 산행코스 지도 image when still needed
  - mountain photos
- Use search/Naver/Google/blog sources to enrich:
  - distance
  - parking
  - public transit
  - current route notes
- Never rewrite 숲나들e 선정 이유 if the requirement is exact source text.
- AI or searched data must keep draft/verification status visible.
- User-entered route coordinates are allowed and should be treated as curated route geometry.

## Implementation Priorities

1. Simplify the top navigation to logo + search.
2. Rebuild the mountain detail main page to match the first attached image.
3. Add course card entry points for route-specific detail pages.
4. Add the course detail page matching the second attached image.
5. Extend route data with stops, map coordinates, elevation gain, summary, and photos.
6. Add Kakao map Polyline rendering for course detail pages.
7. Keep mobile readability and older-user accessibility above visual density.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-05-14 | Use 숲나들e as allowed source | User confirmed copyright use is acceptable by email. |
| 2026-05-15 | Attached images may be copied exactly | User created the designs, so exact layout and visual direction are allowed. |
| 2026-05-15 | Split mountain detail and course detail | The two attached images represent different product screens. |
| 2026-05-15 | Top navigation becomes logo + search only | User explicitly requested removal of the other top menu items. |
| 2026-05-15 | Use Kakao map Polyline with user-entered coordinates | Course geometry should be stable and not depend on runtime routing APIs. |
| 2026-07-27 | 브랜드명과 운영 도메인을 `봉우리모아`, `bongmoa.com`으로 확정 | 사용자에게 노출되는 제품명과 운영 URL을 하나의 브랜드로 통일한다. |
| 2026-08-25 | 헤더 워드마크에서 `우리`를 축소한 브랜드 전용 타이포그래피 사용 | 작은 화면에서도 `봉`과 `모아`를 강하게 읽히게 하면서 전체 브랜드명을 유지한다. |
| 2026-08-25 | 소셜 공유 제목과 `public/opengraph.png`를 봉우리모아 브랜드 계약으로 고정 | 공유 링크에서도 서비스명, 설명, `bongmoa.com` 출처가 일관되게 보이도록 한다. |
