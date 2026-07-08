# 마이페이지 B안 구현 순서

이 문서는 마이페이지 B안을 잊지 않고 완성하기 위한 실행 순서와 회귀 방지 체크리스트다. 목표는 기존 산 상세 페이지의 리뷰 작성/수정/삭제 경험을 깨지 않으면서, 마이페이지를 "내 산행 기록장"으로 확장하는 것이다.

## 확정된 방향

- 마이페이지에는 완등 진행률과 완료한 산 리스트를 추가한다.
- 완료한 산 리스트에는 산 hero 이미지, 산 이름, 등산 완료를 누른 날짜를 표시한다.
- 산을 여러 번 오른 기록과 `N회` 표시는 이번 범위에서 제외한다. 지금은 산별 1회 완료 상태만 유지하고, 잘못 눌렀을 때 완료 취소하는 방식으로 간다.
- 내 리뷰 수정은 PC에서는 기존 리뷰 작성 폼 경험을 재사용하고, 모바일에서는 기존 바텀시트 경험을 재사용한다.
- 새 커스텀 프로필 이미지를 올릴 때 이전 커스텀 이미지는 삭제한다.
- 내 리뷰 목록에는 `route_start_point`, `route_end_point`도 가져온다.
- 닉네임 중복은 허용한다. 중복 확인 UI와 DB unique 제약은 만들지 않는다.
- 현재 마이페이지 디자인은 추후 변경 가능하지만, 당장 수정하는 UI는 `DESIGN.md` 기준을 지킨다.

## 이번 범위

### 포함

- 닉네임 중복 확인 제거
- 프로필 이미지 기본 5종 선택 및 커스텀 업로드 유지
- 이전 커스텀 프로필 이미지 삭제 정책 구현
- 완등 진행률과 완료한 산 리스트 구현
- 완료한 산의 다회차 표기 제거
- 내 리뷰 목록에 출발지/도착지 데이터 포함
- 산 상세 페이지 리뷰 폼 로직을 공유 가능한 구조로 정리
- 마이페이지에서 리뷰 수정/삭제 연결
- 기존 산 상세 페이지 리뷰 기능 회귀 테스트

### 제외

- 산별 여러 번 오른 기록 관리
- 완료 기록별 메모, 사진, 난이도, 코스 변경
- 마이페이지 전체 시각 디자인 리뉴얼
- 닉네임 기반 소셜 식별 기능
- 리뷰가 연결된 산 또는 코스 자체를 바꾸는 기능

## 권장 진행 순서

### 0. 스펙 정리부터 고정

구현 전에 문서와 SQL 초안이 현재 결정과 충돌하지 않는지 먼저 맞춘다.

- `profiles.display_name_normalized` unique index 생성 계획 제거
- 닉네임 중복 확인 문구 제거
- 완료한 산 `N회` 표현 제거
- 완료 모델은 "산별 1개 완료 상태"로 명시
- 리뷰 데이터 요구사항에 `route_start_point`, `route_end_point` 포함

완료 기준:

- 문서와 SQL 초안에 "닉네임 중복 불가", "N회 표시"가 남아 있지 않다.

### 1. 낮은 위험의 정책 변경 먼저 처리

가장 독립적인 변경부터 적용한다.

- `src/components/MyPage.tsx`
  - 닉네임 중복 확인 상태와 버튼 제거
  - 저장 버튼은 로그인 여부와 닉네임 유효성만 확인
- `src/services/profiles.ts`
  - `isDisplayNameAvailable` 사용 중단 또는 제거
  - 중복 닉네임 conflict 처리 제거
  - 저장 시 unique 충돌을 사용자 메시지로 다루지 않도록 변경
- `supabase/profiles_my_page.sql`
  - `display_name_normalized` unique index 제거
  - 필요하면 정규화 컬럼은 검색/정렬용 일반 컬럼으로만 유지
- 프로필 이미지 업로드
  - 새 커스텀 이미지를 저장하기 전에 이전 커스텀 이미지의 storage path를 계산
  - 새 이미지 저장과 프로필 업데이트가 성공한 뒤 이전 커스텀 이미지를 삭제
  - 기본 이미지로 변경할 때도 이전 커스텀 이미지 삭제

주의:

- 새 이미지 업로드가 실패했는데 이전 이미지를 먼저 삭제하면 안 된다.
- 기본 아바타 URL은 삭제 대상이 아니다.
- 다른 사용자의 이미지 경로로 보이는 URL은 삭제하지 않는다.

완료 기준:

- 같은 닉네임으로 여러 사용자가 저장 가능하다.
- 커스텀 이미지를 새로 올리면 이전 커스텀 파일이 남지 않는다.
- 기본 이미지 선택 시 이전 커스텀 파일이 삭제된다.

### 2. 완료한 산 데이터와 UI 정리

리뷰 공유화 전에 마이페이지의 산행 기록 가치를 먼저 올린다.

- 완료 진행률 계산
  - `완료한 산 수 / 전체 산 수`
  - 동일 산은 1개 완료 상태로만 계산
- 완료한 산 리스트
  - hero 이미지
  - 산 이름
  - 완료 날짜
  - 완료 취소 액션
- 기존 `N회` 표기는 제거
- 완료 취소는 현재처럼 완료 상태를 삭제하는 방식 유지

주의:

- 완료 산 데이터에 산 정보가 없으면 `mountains` 정적 데이터와 `mountain_id`로 조인하거나 매핑한다.
- hero 이미지는 산 상세/목록에서 이미 쓰는 이미지 소스 규칙을 재사용한다.
- 완료 날짜는 사용자가 누른 날짜 기준으로 보여준다.

완료 기준:

- 완료 진행률이 마이페이지 상단 또는 산행 기록 영역에서 바로 보인다.
- 완료한 산 리스트에서 산 이름, 이미지, 완료 날짜가 보인다.
- 완료 취소 후 진행률과 리스트가 즉시 갱신된다.

### 3. 내 리뷰 데이터 형태 확장

마이페이지 리뷰 편집 전에 목록 데이터가 필요한 정보를 모두 갖게 한다.

- `src/services/myPage.ts`
  - `fetchUserReviews` select에 `route_start_point`, `route_end_point` 포함
  - 반환 타입에 두 필드 추가
- 기존 `MountainReview` 타입과 차이가 크면 변환 함수를 둔다.
- MyPage 리뷰 카드에는 출발지/도착지가 있으면 표시하고, 없으면 기존처럼 자연스럽게 생략한다.

완료 기준:

- 내 리뷰 목록 데이터에서 출발지/도착지를 사용할 수 있다.
- 필드가 없는 과거 리뷰도 깨지지 않는다.

### 4. 산 상세 리뷰 편집 로직을 먼저 안전하게 분리

바로 마이페이지에 붙이지 말고, 산 상세 페이지에서 기존 동작이 유지되는지 확인하면서 분리한다.

추천 순서:

1. 순수 유틸과 타입부터 분리한다.
   - 난이도 옵션
   - 소요 시간 포맷/파싱
   - 리뷰 사진 preview 정리
   - 기존 이미지 삭제 후보 처리
2. 리뷰 편집 상태와 액션을 hook으로 분리한다.
   - 예: `src/components/reviews/useReviewEditor.ts`
   - 작성, 수정 시작, reset, 사진 추가/삭제, 기존 사진 삭제 요청, submit 상태를 포함
3. 산 상세 페이지가 새 hook을 쓰도록 바꾼다.
4. UI markup은 한 번에 크게 옮기지 말고, 기존 PC 폼과 모바일 바텀시트가 그대로 보이게 유지한다.
5. 산 상세 페이지 테스트를 먼저 통과시킨다.

주의:

- 이 단계의 핵심은 "공유화"가 아니라 "기존 기능 무손상"이다.
- 산 상세 페이지에서 리뷰 작성, 수정, 삭제, 모바일 바텀시트, 사진 업로드가 하나라도 깨지면 다음 단계로 가지 않는다.
- hook이 너무 범용적인 옵션 덩어리가 되면 PC 폼/모바일 시트 UI는 분리하고 상태 로직만 공유한다.

완료 기준:

- 산 상세 페이지 리뷰 작성이 기존처럼 동작한다.
- 산 상세 페이지 리뷰 수정이 기존처럼 동작한다.
- 모바일 바텀시트 단계 전환이 기존처럼 동작한다.
- 사진 추가, 기존 사진 제거, 삭제 확인 dialog가 기존처럼 동작한다.

### 5. 마이페이지에 리뷰 수정/삭제 연결

산 상세 페이지의 회귀가 잡힌 뒤 마이페이지에 붙인다.

- 리뷰 카드에 수정/삭제 액션 추가
- PC
  - 기존 리뷰 작성 폼과 같은 입력 구조를 재사용
  - 현재 리뷰 카드 아래 확장 패널 또는 별도 편집 영역으로 표시
- 모바일
  - 기존 바텀시트 구조를 재사용
  - 산 상세 페이지와 동일한 단계/닫기/저장 흐름 유지
- 수정 저장 성공 시
  - 해당 리뷰 카드 내용 갱신
  - 필요하면 최신 리뷰 목록 재조회
- 삭제 성공 시
  - 해당 리뷰 카드 제거
  - 빈 상태 표시 갱신

주의:

- 마이페이지에서는 산 정보와 코스 정보를 바꾸지 않는다.
- 리뷰 수정 중 다른 리뷰를 열 때 현재 편집 상태를 reset한다.
- 저장 실패 시 기존 카드 데이터를 덮어쓰지 않는다.

완료 기준:

- 마이페이지 PC에서 리뷰 수정/삭제가 가능하다.
- 마이페이지 모바일에서 리뷰 수정/삭제가 가능하다.
- 수정/삭제 후 목록 상태가 즉시 맞게 갱신된다.

### 6. 테스트와 검증

자동 검증은 회귀 위험이 큰 순서대로 수행한다.

- 기존 산 상세 페이지 리뷰 테스트
  - 작성 폼 열기
  - 리뷰 작성
  - 리뷰 수정 시작
  - 리뷰 저장
  - 리뷰 삭제
  - 모바일 바텀시트
  - 사진 추가/삭제
- 마이페이지 테스트
  - 닉네임 중복 확인 UI가 없음
  - 닉네임 저장 가능
  - 완등 진행률 표시
  - 완료한 산 리스트 표시
  - 완료 취소 후 리스트 갱신
  - 리뷰 출발지/도착지 표시
  - 리뷰 수정/삭제
- 서비스 테스트
  - `fetchUserReviews`가 route endpoint를 반환
  - 프로필 이미지 교체 시 이전 커스텀 파일 삭제
  - 기본 아바타 선택 시 이전 커스텀 파일 삭제

권장 명령:

```bash
npm run lint
npm run test
npm run build
```

완료 기준:

- lint, test, build가 통과한다.
- 실패가 있다면 마이페이지 신규 기능보다 산 상세 페이지 리뷰 회귀를 먼저 고친다.

### 7. 수동 QA

자동 테스트 후 실제 화면에서 흐름을 확인한다.

- 로그인한 상태에서 마이페이지 진입
- 중복 닉네임 저장
- 기본 아바타 선택
- 커스텀 이미지 업로드
- 다른 커스텀 이미지로 교체
- 기본 아바타로 되돌리기
- 산 상세 페이지에서 등산 완료 누르기
- 마이페이지에서 진행률과 완료 리스트 확인
- 완료 취소 후 진행률과 리스트 확인
- 산 상세 페이지에서 리뷰 작성
- 마이페이지 PC에서 리뷰 수정/삭제
- 마이페이지 모바일에서 리뷰 수정/삭제
- 산 상세 페이지 리뷰 작성/수정/삭제가 여전히 정상인지 재확인

완료 기준:

- 사용자가 마이페이지에서 자신의 프로필, 완등 기록, 리뷰를 모두 관리할 수 있다.
- 산 상세 페이지의 기존 핵심 흐름이 깨지지 않는다.

## 구현 운영 가이드

이 기능은 한 번에 끝까지 밀어붙이는 것보다 작은 단위로 끊어서 진행하는 것이 낫다. 특히 산 상세 페이지 리뷰 폼을 공유화하는 4단계는 회귀 위험이 가장 크므로, 1~3단계가 안정된 뒤 따로 진행한다.

### 사용할 스킬 순서

| 시점 | 사용할 스킬 | 목적 | 완료 후 다음 행동 |
| --- | --- | --- | --- |
| 구현 시작 전 | 없음 | 이미 이 문서와 eng review로 방향이 정리되어 있으므로 바로 구현 가능 | 0~1단계부터 지시 |
| 4단계 시작 전 | `$plan-eng-review` | 리뷰 폼 공유화 설계를 다시 점검 | 설계가 통과되면 4단계 구현 |
| 테스트 실패 또는 원인 불명 버그 발생 | `$investigate` | 증상만 고치는 것이 아니라 원인을 찾아 수정 | 원인과 수정 근거가 확인되면 다음 단계 진행 |
| UI가 많이 바뀐 뒤 | `$design-review` | `DESIGN.md` 기준으로 시각/반응형/터치 영역 점검 | 발견된 UI 문제 수정 |
| 기능 구현이 끝난 뒤 | `$qa` | 브라우저로 실제 마이페이지와 산 상세 페이지 흐름 검증 | QA 버그 수정 후 최종 검증 |
| PR/커밋 전 | `$review` | diff 기준으로 회귀, 누락 테스트, 위험한 변경 검토 | 지적사항 반영 후 ship |
| PR 생성 또는 배포 준비 | `$ship` | 테스트, 리뷰, 커밋, push, PR 생성 흐름 진행 | PR에서 CI 확인 |
| 중간에 세션을 멈출 때 | `$context-save` | 현재 진행 단계와 남은 작업 저장 | 다음 세션에서 `$context-restore` |

주의:

- `$design-review`는 전체 마이페이지 리디자인을 하라는 뜻이 아니다. 이번 범위에서는 새로 넣은 UI가 `DESIGN.md`와 깨지지 않는지만 본다.
- `$qa`는 기능 구현이 어느 정도 끝난 뒤 사용한다. 1단계마다 브라우저 QA를 돌리면 속도가 느려진다.
- 테스트가 깨진 상태에서 `$ship`으로 넘어가지 않는다.

### Codex에게 지시할 순서

아래 순서대로 한 번에 하나씩 지시한다. 각 단계가 끝나면 결과와 테스트 상태를 확인한 뒤 다음 단계로 넘어간다.

#### 1차 지시: 정책 정리와 프로필

```text
docs/my-page-b-implementation-plan.md의 0~1단계만 구현해줘.
닉네임 중복 확인은 제거하고, 중복 닉네임을 허용해줘.
프로필 이미지 교체 시 이전 커스텀 이미지를 삭제하도록 해줘.
완료 후 관련 테스트를 추가하거나 갱신하고, npm run lint, npm run test, npm run build 결과를 알려줘.
```

완료되면 확인할 것:

- 닉네임 중복 확인 UI가 사라졌는지
- SQL에서 닉네임 unique 제약 계획이 제거됐는지
- 이전 커스텀 이미지 삭제가 업로드 성공 후에만 실행되는지
- lint/test/build가 통과했는지

다음 지시 조건:

- 전부 통과하면 2차 지시로 간다.
- 테스트 실패가 있으면 `$investigate`로 원인 분석을 먼저 시킨다.

#### 2차 지시: 완료한 산과 내 리뷰 데이터

```text
docs/my-page-b-implementation-plan.md의 2~3단계를 구현해줘.
마이페이지에 완등 진행률과 완료한 산 리스트를 추가하고, 완료 산의 N회 표기는 제거해줘.
완료 리스트에는 hero 이미지, 산 이름, 완료 날짜가 보여야 해.
내 리뷰 목록에는 route_start_point와 route_end_point를 가져오도록 해줘.
완료 후 관련 테스트를 추가하거나 갱신하고, npm run lint, npm run test, npm run build 결과를 알려줘.
```

완료되면 확인할 것:

- 완료 진행률이 정확한지
- 완료 취소 후 진행률과 리스트가 갱신되는지
- 완료 리스트에 이미지, 산 이름, 완료 날짜가 보이는지
- 내 리뷰 데이터에 출발지/도착지가 포함되는지

다음 지시 조건:

- 마이페이지 데이터와 UI가 안정되면 3차 지시로 간다.
- 완료 취소나 진행률 계산이 이상하면 `$investigate`로 먼저 고친다.

#### 3차 지시: 리뷰 공유화 설계 재점검

```text
[$plan-eng-review](C:\Users\pibma\.codex\skills\gstack-plan-eng-review\SKILL.md)
docs/my-page-b-implementation-plan.md의 4단계, 산 상세 리뷰 편집 로직 공유화 설계를 다시 검토해줘.
기존 MountainDetailPage 리뷰 작성/수정/삭제와 모바일 바텀시트 회귀를 최소화하는 구현 순서를 제안해줘.
```

완료되면 확인할 것:

- 공유 hook 또는 공유 컴포넌트의 경계가 명확한지
- 산 상세 페이지 UI markup을 한 번에 크게 옮기지 않는지
- 테스트 우선순위가 정리됐는지

다음 지시 조건:

- 설계가 납득되면 4차 지시로 간다.
- 설계가 너무 커지면 4단계를 더 작게 쪼개라고 지시한다.

#### 3차 결과: Eng Review 결정

현재 코드 기준으로 4차는 `ReviewCard`, 필터, 요약, lightbox까지 옮기는 작업이 아니다. 회귀 위험을 줄이려면 산 상세 페이지의 리뷰 작성/수정 폼에서 반복될 상태와 액션만 먼저 분리한다.

What already exists:

- `src/services/mountainReviews.ts`
  - 리뷰 생성, 수정, 삭제, 이미지 업로드/삭제 cleanup이 이미 있다.
  - `route_start_point`, `route_end_point`도 생성/조회에 포함되어 있다.
  - 그대로 재사용한다.
- `src/components/MountainDetailPage.tsx`
  - PC 리뷰 작성 폼과 모바일 바텀시트가 이미 있다.
  - 리뷰 수정/삭제, 사진 추가/삭제, confirm dialog, lightbox가 이미 동작한다.
  - 4차에서는 이 UI 경험을 유지한다.
- `src/components/MountainDetailPage.courseFeedback.test.tsx`
  - 작성, 모바일 바텀시트, 필터, 사진, 수정, 삭제 관련 회귀 테스트가 이미 넓게 있다.
  - 4차의 게이트 테스트로 사용한다.
- `src/components/MyPage.tsx`
  - 내 리뷰 목록은 이미 route endpoint까지 표시한다.
  - 5차에서 수정/삭제 액션만 붙이면 된다.

Architecture decision:

```text
MountainDetailPage
  ├─ keeps review list, filter, summary, lightbox, confirm dialog
  ├─ uses shared review editor draft state
  └─ keeps existing PC form + mobile bottom sheet behavior

shared review editor layer
  ├─ owns draft fields: route, start/end, difficulty, duration, body
  ├─ owns photo draft lifecycle: preview URL create/revoke, existing image list
  ├─ exposes submit payload helpers
  └─ does not own Supabase calls, list fetch, filters, summary, or lightbox

MyPage later
  ├─ reuses the shared editor layer
  ├─ edits one existing review at a time
  └─ does not allow changing mountain or route in this release
```

4차에서 만들 후보:

- `src/components/reviews/useReviewEditorDraft.ts`
  - `selectedRouteName`
  - `manualStartPoint`
  - `manualEndPoint`
  - `difficultyIndex`
  - `durationMinutes`
  - `reviewText`
  - `uploadedPhotos`
  - `editingExistingImageUrls`
  - `resetDraft`
  - `startEditingDraft`
  - `addSelectedPhotos`
  - `removeUploadedPhoto`
  - `removeExistingImageUrl`
  - `clearUploadedPhotos`
- `src/components/reviews/reviewEditorUtils.ts`
  - `createPhotoPreviewUrl`
  - `revokePhotoPreviewUrl`
  - `getEditorRouteEndpoints`
  - `getEditorDurationParts`
  - `formatRouteEndpoints`
- 선택 사항: `src/components/reviews/ReviewEditorTypes.ts`
  - hook props/return 타입이 길어지면 분리한다.

4차에서 하지 않을 것:

- `ReviewCard` 이동
- 리뷰 필터/정렬/요약 이동
- lightbox 이동
- confirm dialog 이동
- MyPage 리뷰 수정/삭제 연결
- 산 상세 페이지의 PC 폼 markup 대규모 재작성
- 모바일 바텀시트 애니메이션 재작성

회귀 위험이 큰 지점:

- preview URL revoke 누락으로 메모리 leak이 생길 수 있다.
- 수정 중 기존 이미지와 새 이미지 개수 계산이 틀어질 수 있다.
- 모바일 바텀시트 mount/visible 타이밍이 깨질 수 있다.
- 기존 리뷰 수정에서 사진 추가 확인 dialog가 누락될 수 있다.
- 수정 저장 후 route 정보가 바뀐 것처럼 보이는 UI 혼동이 생길 수 있다.

4차 구현 게이트:

- `npm run test -- MountainDetailPage.courseFeedback`
- `npm run lint`
- `npm run test`
- `npm run build`

5차 전제:

- 4차 후 산 상세 페이지에서 리뷰 작성/수정/삭제/사진/모바일 바텀시트 테스트가 모두 통과해야 한다.
- MyPage 리뷰 수정은 산/코스 변경 없이 `difficulty`, `duration`, `body`, `imageUrls` 중심으로 시작한다.
- route endpoint는 MyPage 카드 표시에는 사용하지만, 이번 수정 UI에서 route 변경 기능으로 확장하지 않는다.

#### 4차 지시: 산 상세 리뷰 로직 공유화

```text
docs/my-page-b-implementation-plan.md의 4단계만 구현해줘.
3차 Eng Review 결과에 따라 산 상세 페이지 리뷰 작성/수정/삭제 동작이 유지되도록 리뷰 편집 draft 상태와 사진 draft 액션만 공유 가능한 구조로 분리해줘.
리뷰 목록, 필터, 요약, lightbox, confirm dialog는 아직 옮기지 마.
아직 마이페이지 리뷰 수정 연결도 하지 말고, MountainDetailPage.courseFeedback 테스트가 통과하는지 확인해줘.
npm run lint, npm run test, npm run build 결과를 알려줘.
```

완료되면 확인할 것:

- 산 상세 페이지 리뷰 작성이 유지되는지
- 산 상세 페이지 리뷰 수정/삭제가 유지되는지
- 모바일 바텀시트가 유지되는지
- 사진 추가/삭제가 유지되는지
- `MountainDetailPage.courseFeedback` 관련 테스트가 통과하는지

다음 지시 조건:

- 산 상세 페이지 회귀가 없으면 5차 지시로 간다.
- 회귀가 있으면 `$investigate`로 원인을 찾고, 마이페이지 연결은 보류한다.

#### 5차 지시: 마이페이지 리뷰 수정/삭제 연결

```text
docs/my-page-b-implementation-plan.md의 5단계를 구현해줘.
마이페이지 내 리뷰에서 수정/삭제가 가능하도록 연결해줘.
PC에서는 기존 리뷰 작성 폼 경험을 재사용하고, 모바일에서는 기존 바텀시트 경험을 재사용해줘.
수정/삭제 후 목록 상태가 즉시 갱신되게 해줘.
완료 후 관련 테스트를 추가하거나 갱신하고, npm run lint, npm run test, npm run build 결과를 알려줘.
```

완료되면 확인할 것:

- PC에서 내 리뷰 수정/삭제가 가능한지
- 모바일에서 내 리뷰 수정/삭제가 가능한지
- 수정 후 카드 내용이 갱신되는지
- 삭제 후 카드와 빈 상태가 맞게 갱신되는지
- 산 상세 페이지 리뷰 테스트가 여전히 통과하는지

다음 지시 조건:

- 자동 테스트가 통과하면 6차 지시로 간다.
- 모바일 바텀시트만 깨지면 `$investigate`로 모바일 흐름만 좁혀서 고친다.

#### 6차 지시: 실제 화면 QA

```text
[$qa](C:\Users\pibma\.codex\skills\gstack-qa\SKILL.md)
마이페이지 B안 기능을 실제 브라우저에서 QA해줘.
확인 범위는 프로필 수정, 프로필 이미지 교체, 완등 진행률, 완료한 산 리스트, 완료 취소, 내 리뷰 수정/삭제, 산 상세 페이지 리뷰 회귀야.
버그를 찾으면 수정하고 다시 검증해줘.
```

완료되면 확인할 것:

- 브라우저에서 핵심 흐름이 실제로 동작했는지
- 모바일 viewport도 확인했는지
- QA 중 수정한 버그가 테스트로 보강됐는지

다음 지시 조건:

- QA가 통과하면 7차 지시로 간다.
- 디자인 문제가 크면 `$design-review`를 먼저 실행한다.

#### 6차 결과: QA 진행 기록

- 브라우저 QA로 메인 지도, 산 선택, 산 상세 진입, 산 상세 리뷰 작성 폼의 PC/모바일 표시를 확인했다.
- QA 중 모바일 산 상세 페이지에서 문서 전체 `scrollWidth`가 375px 화면에서 716px까지 늘어나는 수평 overflow를 발견했다.
- `src/components/MountainDetailPage.tsx`의 추천 코스 섹션 grid track을 `minmax(0,1fr)`로 고정하고, 관련 컨테이너/card에 `min-w-0`, `max-w-full`, 모바일 `w-full`을 보강했다.
- `src/components/MyPage.tsx`도 모바일 wrapper에 `w-full`을 추가해 같은 고정폭 패턴을 예방했다.
- 수정 후 모바일 산 상세 페이지는 `innerWidth: 375`, `scrollWidth: 375`로 재검증했다. 필터 버튼 row 내부의 가로 스크롤은 의도된 overflow로 유지된다.
- Supabase/OAuth 외부 인증은 현재 브라우저 환경에서 `ERR_NETWORK_ACCESS_DENIED`로 막혀 마이페이지의 실제 로그인 후 수정/삭제 클릭 QA는 수행하지 못했다. 해당 흐름은 `MyPage` 통합 테스트와 서비스 테스트로 검증했다.
- 검증 명령:
  - `npm run lint`
  - `npm run test -- MyPage`
  - `npm run test -- MountainDetailPage.courseFeedback`
  - `npm run test`
  - `npm run build`

#### 7차 지시: 디자인 점검

```text
[$design-review](C:\Users\pibma\.codex\skills\gstack-design-review\SKILL.md)
마이페이지 B안에서 새로 추가된 UI가 DESIGN.md 기준과 맞는지 점검해줘.
전체 리디자인은 하지 말고, spacing, hierarchy, mobile layout, touch target, text overflow 문제만 찾아서 고쳐줘.
```

완료되면 확인할 것:

- 텍스트가 모바일에서 넘치지 않는지
- 터치 영역이 44px 이상인지
- 색상과 spacing이 `DESIGN.md` 방향과 충돌하지 않는지
- 카드 안에 카드 같은 과한 구조가 없는지

다음 지시 조건:

- 디자인 점검이 끝나면 8차 지시로 간다.

#### 7차 결과: 디자인 점검 기록

- `$design-review` 기준으로 `DESIGN.md`의 모바일 가로 스크롤 금지, 44px 터치 영역, 텍스트 넘침, spacing/hierarchy 범위를 중심으로 새 UI를 점검했다.
- 375px 모바일 산 상세/리뷰 바텀시트에서 문서 폭은 `innerWidth: 375`, `scrollWidth: 375`로 유지됐다. 리뷰 필터 row의 가로 스크롤은 의도된 내부 스크롤로 확인했다.
- 데스크톱 산 상세 리뷰 작성 영역에서 전역 `피드백 보내기` 플로팅 버튼이 textarea 위를 덮는 문제를 발견했다.
- `src/App.tsx`에서 산 상세 페이지 진입 중에는 전역 피드백 버튼을 숨기도록 수정해 리뷰 작성 UI와 겹치지 않게 했다.
- 모바일 리뷰 바텀시트 1단계에서 `다음` 버튼이 소요시간 입력보다 먼저 sticky로 노출되어 입력 영역을 덮는 문제를 발견했다.
- `src/components/MountainDetailPage.tsx`에서 1단계 `다음` 버튼의 sticky 동작을 제거하고, 사용자가 코스/난이도/소요시간을 확인한 뒤 다음으로 이동하게 했다. 2단계 이전/등록 sticky footer는 유지했다.
- 수정 후 데스크톱은 `visibleFeedbackButtonCount: 0`, 모바일은 `innerWidth: 375`, `scrollWidth: 375`, step 2 액션 버튼 높이 `48px`로 확인했다.
- Supabase/OAuth 네트워크 차단으로 로그인 상태 MyPage 실화면 점검은 이번에도 제한됐다. MyPage 자체 기능은 기존 컴포넌트/서비스 테스트로 검증하고, 실제 로그인 브라우저 QA는 배포 또는 인증 가능한 로컬 환경에서 추가 확인한다.

#### 8차 지시: 최종 코드 리뷰

```text
[$review](C:\Users\pibma\.codex\skills\gstack-review\SKILL.md)
마이페이지 B안 구현 diff를 최종 리뷰해줘.
특히 산 상세 페이지 리뷰 회귀, 프로필 이미지 삭제 안전성, SQL 정책 충돌, 누락 테스트를 중점적으로 봐줘.
```

완료되면 확인할 것:

- high/medium severity 지적사항이 없는지
- 있으면 수정 후 다시 review를 요청한다.

다음 지시 조건:

- 리뷰 지적사항이 해결되면 9차 지시로 간다.

#### 8차 결과: 최종 코드 리뷰 기록

- `$review` 기준으로 diff를 `origin/main`에 맞춰 확인했다.
- Scope check: 마이페이지 B안 구현 범위와 대체로 일치한다. 프로필, 완료 산, 내 리뷰, 산 상세 리뷰 공유 로직, SQL/스토리지 정책, 테스트가 함께 들어왔다.
- 발견 및 수정: 산 상세 페이지에서 기존 한줄평 수정 중 코스 select가 활성화되어 있었다. 코스를 바꾸면 내부 draft가 신규 작성 모드로 전환될 수 있어, 수정 저장이 아니라 새 리뷰 등록으로 흐를 위험이 있었다.
- `src/components/MountainDetailPage.tsx`에서 수정 모드일 때 코스, 출발지, 도착지 컨트롤을 비활성화하도록 고쳤다.
- `src/components/MountainDetailPage.courseFeedback.test.tsx`에 수정 모드에서 코스/출발지/도착지가 잠기는 회귀 테스트를 추가했다.
- SQL/RLS 검토: `mountain_reviews`, `completed_mountains`, `profiles`, profile image storage 정책은 현재 클라이언트 흐름과 충돌하지 않는다.
- 남은 제한: Supabase/OAuth 네트워크 차단 때문에 로그인 상태 MyPage 실브라우저 QA는 아직 완전 수동 검증하지 못했다. 배포 또는 인증 가능한 로컬 환경에서 최종 확인한다.
- 검증 명령:
  - `npm run lint`
  - `npm run test -- MountainDetailPage.courseFeedback`
  - `npm run test`
  - `npm run build`

#### 9차 지시: ship

```text
[$ship](C:\Users\pibma\.codex\skills\gstack-ship\SKILL.md)
마이페이지 B안 구현을 ship해줘.
테스트를 실행하고, 변경 내용을 정리해서 커밋한 뒤 PR을 만들어줘.
```

완료되면 확인할 것:

- PR 설명에 구현 범위와 테스트 결과가 들어갔는지
- CI가 통과하는지
- SQL 변경이 필요한 경우 적용 순서가 PR에 명시됐는지

### 명령 실행 순서

각 구현 단계에서 Codex가 기본적으로 실행해야 하는 명령 순서는 다음이다.

```bash
git status --short
npm run lint
npm run test
npm run build
```

브라우저 확인이 필요한 단계에서는 빌드 전 또는 빌드 후에 dev server를 띄워 확인한다.

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

테스트 실패 시에는 바로 다음 기능 구현으로 넘어가지 않고, 실패한 테스트를 좁혀서 다시 실행한다.

```bash
npm run test -- MountainDetailPage.courseFeedback
npm run test -- MyPage
```

주의:

- 프로젝트 테스트 스크립트가 파일명 필터를 지원하지 않으면 `npm run test` 전체 실행으로 대체한다.
- `npm run build`는 마지막에만 하지 말고, 4단계와 5단계처럼 타입 영향이 큰 단계가 끝날 때마다 실행한다.
- dev server는 QA나 화면 확인이 필요한 때만 띄운다.

### 중간에 멈출 때

작업을 중간에 멈춰야 하면 아래처럼 저장한다.

```text
[$context-save](C:\Users\pibma\.codex\skills\gstack-context-save\SKILL.md)
마이페이지 B안 진행 상황을 저장해줘.
완료한 단계, 실패 중인 테스트, 다음에 이어서 할 지시문을 포함해줘.
```

다음 세션에서는 아래처럼 복원한다.

```text
[$context-restore](C:\Users\pibma\.codex\skills\gstack-context-restore\SKILL.md)
마이페이지 B안 진행 상황을 복원하고, docs/my-page-b-implementation-plan.md 기준으로 다음 단계부터 이어서 진행해줘.
```

## 파일별 작업 지도

- `src/components/MyPage.tsx`
  - 닉네임 중복 확인 제거
  - 완료 진행률/완료 리스트 UI
  - 내 리뷰 수정/삭제 액션
  - PC/모바일 리뷰 편집 연결
- `src/components/MountainDetailPage.tsx`
  - 리뷰 편집 상태와 액션 분리
  - 기존 UI 동작 유지
- `src/components/reviews/*`
  - 공유 hook, 타입, 보조 컴포넌트 후보
- `src/services/profiles.ts`
  - 닉네임 중복 정책 변경
  - 프로필 이미지 교체 시 이전 커스텀 이미지 삭제
- `src/services/myPage.ts`
  - 완료 산 데이터 정리
  - 내 리뷰 route endpoint 포함
- `src/services/mountainReviews.ts`
  - 리뷰 수정/삭제 API 재사용 확인
- `supabase/profiles_my_page.sql`
  - 닉네임 unique 제약 제거
  - profile image storage 정책 확인
- `src/components/MountainDetailPage.courseFeedback.test.tsx`
  - 공유화 후 회귀 방지 테스트

## 중단 기준

- 산 상세 페이지 리뷰 테스트가 깨진 상태에서는 마이페이지 리뷰 편집 연결로 넘어가지 않는다.
- 프로필 이미지 삭제가 사용자별 경로 안전성을 보장하지 못하면 삭제 기능을 배포하지 않는다.
- SQL과 프론트 정책이 충돌하면 SQL을 먼저 고친다.
- 공유 hook이 산 상세 페이지와 마이페이지 양쪽 조건문으로 비대해지면 상태 로직만 공유하고 UI는 분리한다.

## 최종 완료 체크리스트

- [x] 닉네임 중복 확인 UI 제거
- [x] 닉네임 중복 허용 SQL 반영
- [x] 프로필 이미지 교체 시 이전 커스텀 이미지 삭제
- [x] 완등 진행률 표시
- [x] 완료한 산 리스트에 hero 이미지, 산 이름, 완료 날짜 표시
- [x] 완료 산 `N회` 표기 제거
- [x] 완료 취소 동작 유지
- [x] 내 리뷰 목록에 출발지/도착지 포함
- [x] 산 상세 페이지 리뷰 로직 공유 구조로 분리
- [x] 산 상세 페이지 리뷰 기능 회귀 없음
- [x] 마이페이지 PC 리뷰 수정/삭제 가능
- [x] 마이페이지 모바일 리뷰 수정/삭제 가능
- [x] lint 통과
- [x] test 통과
- [x] build 통과
- [ ] 수동 QA 완료

#### 9차 결과: ship 준비 기록

- `origin/main` 최신 변경을 `feature/my-page`에 병합했고 충돌은 없었다.
- `npm run lint` 통과.
- `npm run test` 통과. Vitest 기준 16개 파일, 77개 테스트가 통과했다.
- `npm run build` 통과. Vite의 500 kB 초과 chunk 경고는 남아 있으나 빌드 실패는 아니다.
- `git diff --check`는 공백 오류 없이 통과했고, Windows LF/CRLF 경고만 출력됐다.
- 인증이 필요한 실제 마이페이지 브라우저 QA는 Supabase/OAuth 네트워크 접근 제한으로 완료하지 못했다. 이 제한은 PR 본문에 남기고, 현재는 컴포넌트/서비스 테스트와 비인증 화면 QA 결과를 ship 근거로 삼는다.
