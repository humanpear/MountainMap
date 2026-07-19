# 산 찾기 필터·결과 목록·랜덤 추천 구현 워크플로

이 문서는 MountianMap 지도 화면에 산 찾기 기능을 추가하기 위한 실행 계획이다. 구현자는 각 단계를 순서대로 진행하고, 단계에 지정된 gstack 스킬을 필요한 시점에만 사용한다.

- 작성일: 2026-07-14
- 대상 브랜치: `refactor/re-design`
- 대상 화면: 메인 지도, 데스크톱 `aside`, 모바일 `bottomSheet`
- 관련 기준: [`DESIGN.md`](../DESIGN.md)
- 문서 성격: 구현 절차(How-to) + 주요 설계 결정 설명(Explanation)

## 이 문서를 실행하는 방법

앞으로 사용자가 다음처럼 요청하면 이 문서를 작업 계약으로 사용한다.

```text
0단계 진행해줘.
1단계 진행해줘.
3~6단계 진행해줘.
다음 단계 진행해줘.
```

### `N단계 진행해줘`의 의미

에이전트는 별도 설명을 다시 요구하지 않고 다음 순서로 해당 단계를 수행한다.

1. 이 문서와 `DESIGN.md`를 다시 읽는다.
2. 아래 진행 현황과 실제 코드·git 상태를 함께 확인한다.
3. 선행 단계의 완료 증거가 있는지 확인한다.
4. 해당 단계에 지정된 gstack 스킬이 있으면 그 스킬을 읽고 실행한다.
5. 일반 구현 단계라면 그 단계 범위 안에서 코드와 테스트를 직접 변경한다.
6. 단계별 검증 명령과 완료 기준을 확인한다.
7. 성공하면 진행 현황을 `완료`로 갱신하고 증거를 기록한다.
8. 실패하면 `차단`으로 기록하고 원인, 시도한 내용, 재개 조건을 남긴다.
9. 마지막 응답에는 변경 파일, 검증 결과, 남은 위험, 다음 단계 번호를 보고한다.

`N단계 진행해줘`는 **그 단계만** 수행하라는 뜻이다. 다음 단계까지 자동으로 넘어가지 않는다. `3~6단계 진행해줘`처럼 범위를 지정한 경우에는 각 단계를 순서대로 완료하고, 한 단계가 실패하면 이후 단계로 넘어가지 않는다.

`다음 단계 진행해줘`라고 하면 아래 진행 현황에서 선행 조건을 충족한 첫 번째 `대기` 단계를 선택한다. 문서의 상태만 믿지 않고 테스트 결과, 생성된 계획, 실제 코드도 확인한다.

### 선행 단계가 완료되지 않은 경우

- 현재 단계를 안전하게 수행할 수 없다면 임의로 선행 단계를 포함하지 않는다.
- 어떤 선행 단계와 완료 증거가 필요한지 보고하고 현재 단계를 `차단`으로 둔다.
- 사용자가 `선행 단계부터 진행해줘` 또는 단계 범위를 지정하면 이어서 수행한다.
- 단순 상태 확인처럼 현재 단계 안에서 해결 가능한 준비 작업은 추가 승인 없이 수행한다.

### 외부 상태를 바꾸는 단계

- 0~10단계는 로컬 계획, 코드, 테스트와 리뷰 작업이다.
- `11단계 진행해줘`는 `$ship`을 통한 커밋, 푸시, PR 준비 요청으로 해석한다. `$ship`의 자체 확인 절차는 그대로 따른다.
- `12단계 진행해줘`는 `$land-and-deploy`를 통한 병합과 배포 요청으로 해석한다. 배포 대상이나 권한이 준비되지 않았다면 실행하지 않고 차단 사유를 보고한다.

## 진행 현황

상태는 `대기`, `진행 중`, `완료`, `차단` 중 하나만 사용한다. 완료 증거 없이 `완료`로 변경하지 않는다.

| 단계 | 작업 | 상태 | 필수 선행 단계 | 완료 증거 |
| ---: | --- | --- | ---: | --- |
| 0 | 시작 상태 확인 | 완료 | 없음 | `refactor/re-design`, tracked clean, 워크플로 문서 보호 |
| 1 | 디자인 계획 검토 | 완료 | 0 | 7개 디자인 패스, D2~D14 승인, 최종 9/10 |
| 2 | 엔지니어링 계획 검토 | 완료 | 1 | D1~D13 승인, 미해결 0개, 구현·테스트·성능 계약 확정 |
| 3 | 데이터 기반 구현 | 완료 | 2 | 로컬 구현·관련 테스트 통과, 운영 Supabase SQL 적용 완료 확인 |
| 4 | 필터와 정렬 도메인 로직 구현 | 완료 | 3 | 필터 행렬 테스트와 전체 테스트 134개 통과 |
| 5 | 결과 목록과 패널 상태 구현 | 완료 | 4 | 패널·App 상태 전환 테스트와 전체 테스트 141개 통과 |
| 6 | 지도와 랜덤 추천 연결 | 완료 | 5 | 지도·랜덤 통합 테스트와 전체 테스트 151개 통과 |
| 7 | 코드 품질 점검 | 완료 | 6 | `$health` 10.0/10, 타입 검사, 전체 테스트 151개, 프로덕션 빌드 통과 |
| 8 | 브라우저 QA | 완료 | 7 | 데스크톱·375px 핵심 흐름 통과, High 1건 수정·회귀 검증, 전체 152개 테스트 통과 |
| 9 | 디자인 마감 | 완료 | 8 | `$design-review` 5건 수정·전후 검증, Design B→A, 전체 154개 테스트 통과 |
| 10 | 병합 전 리뷰 | 완료 | 9 | `$review` 4건 수정·회귀 검증, 전체 158개 테스트와 빌드 통과 |
| 11 | PR 준비 | 완료 | 10 | `$ship` 최종 재검증, 문서 동기화·푸시, PR #6 생성 완료 |
| 12 | 병합·배포·운영 확인 | 대기 | 11 | 프로덕션 URL과 상태 확인 |

### 단계 실행 기록 형식

각 단계가 끝날 때 이 섹션 아래에 최신 기록을 위쪽에 추가한다.

```markdown
### 2026-07-14 · 단계 N · 완료 또는 차단

- 범위: 수행한 작업
- 사용 스킬: 사용한 gstack 스킬 또는 `없음`
- 변경 파일: 파일 목록
- 검증: 실행한 명령과 결과
- 결정: 구현 중 확정된 정책
- 남은 위험: 없으면 `없음`
- 다음 단계: N+1
```

### 2026-07-19 · 단계 10 · 완료

- 범위: `$review`로 `origin/main...refactor/re-design` 전체 diff와 산 찾기 계획의 완료 여부를 점검했다. SQL 집계 완전성, 한줄평 변경 뒤 난이도 요약 갱신, 모바일 결과·상세 시트의 모달 포커스, 상세 화면에서 필터 밖 산을 지도에 표시하는 흐름 등 4건을 수정했다.
- 사용 스킬: `$review`. 외부 사용량 공유와 GBrain 동기화는 사용자 결정에 따라 실행하지 않았고 로컬 리뷰 기록만 남겼다.
- 변경 파일: `supabase/mountain_reviews.sql`, `src/App.tsx`, `src/components/MountainDiscoveryPanel.tsx`, `src/components/MountainDetailPage.tsx`, `src/components/MyPage.tsx`, 관련 테스트, 이 문서.
- 검증: `npm run lint` 통과, `npm test` 23개 파일·158개 테스트 통과, `npm run build` 통과, `npm run audit:guides` 통과, `git diff --check` 통과. Vite의 500KB 초과 청크 경고는 기존과 동일하다.
- 결정: 난이도 집계 RPC의 임의 `LIMIT 100`을 제거한다. 사용자가 작성·수정·삭제한 한줄평은 지도 복귀 시 난이도 요약을 한 번만 새로 조회한다. 모바일 결과·상세 시트는 포커스 트랩·Escape 닫기·포커스 복귀를 갖춘 모달로 동작한다. 상세 화면의 `지도에서 보기` 대상이 현재 필터 밖이면 사용자가 선택한 A안에 따라 필터를 전체 초기화하고 해당 산을 선택한다.
- 남은 위험: 이번 리뷰에서 `get_mountain_difficulty_summaries()` 함수 정의가 변경되었으므로, 3단계에서 적용한 운영 Supabase SQL에 최신 함수 정의를 다시 적용해야 한다. 프로덕션 JavaScript 청크 약 2.21MB(압축 약 481KB)의 Vite 500KB 경고가 남는다.
- 다음 단계: 운영 Supabase SQL 재적용을 확인한 뒤 11단계 `$ship` PR 준비.

### 2026-07-19 · 단계 11 · 완료

- 범위: `$ship`을 반복 실행해 `origin/main` 병합, 전체 검증, 구현 계획 감사, 테스트 커버리지 감사와 적대적 코드 리뷰를 수행했다. 데이터 로딩·결과 집합·모바일 시트·난이도 집계·필터 포커스·Kakao overlay 문제를 수정했고, 후속 검토에서 발견한 전체 상세 Back, 데스크톱 상세 문맥, 모바일 필터·결과 패널의 Back→Forward→Back 복원 문제까지 보강했다.
- 사용 스킬: `$ship`. 사용자 결정에 따라 telemetry와 GBrain 동기화는 비활성 상태를 유지했다.
- 변경 파일: `src/App.tsx`, `src/components/MountainDiscoveryPanel.tsx`, `src/components/MountainMap.tsx`, `src/kakao.d.ts`, `src/services/mountainReviews.ts`, `supabase/mountain_reviews.sql`, 관련 테스트, 이 문서와 10단계부터 남아 있던 리뷰 수정 파일.
- 검증: `origin/main` 병합 성공, `npm run lint` 통과, `npm test` 23개 파일·179개 테스트 통과, `npm run build` 통과, `npm run audit:guides` 정책 위반 0건. 최신 계획 감사는 48개 항목 중 45개 완료·1개 변경·2개 부분 완료·미구현 0개였고, 보수적으로 다시 산정한 테스트 커버리지 감사는 90%(27/30)였다. 후속 history 검토에서 발견한 결과 제외 후 Back, 모바일 중첩 필터, 모바일 결과 패널 복원 문제를 수정하고 회귀 테스트 3개를 추가했다.
- 결정: 로그인 사용자의 완료·미등정 필터는 등정 기록 조회가 `ready`일 때만 활성화한다. 결과 구성원이 바뀌어 선택한 산이 제외되면 결과 목록으로 복귀하고 지도를 새 결과에 맞춘다. 모바일 필터·결과·상세 시트는 필터와 패널을 구분한 임시 history layer를 사용하며, 중첩 필터의 적용·취소 action은 `popstate` 도착 시 실행해 아래 결과·상세 시트를 유지한다. 선택 패널에서 같은 산의 전체 상세 route로 왕복할 때는 데스크톱과 모바일 모두 discovery detail 상태를 보존하고, 검색으로 직접 연 전체 상세 route는 기존처럼 discovery를 닫는다. Kakao overlay는 표시 산 집합이 바뀔 때만 생성하고 선택·랜덤 강조·등정 표시는 기존 DOM과 z-index만 갱신한다. 난이도 백그라운드 갱신 실패 시 dirty 상태를 복구해 다음 지도 복귀에서 다시 조회한다. 난이도 집계 응답은 100대 명산에 없는 ID와 중복 ID를 거부하며 DB도 `0000000001`~`0000000100`만 저장하도록 제약한다.
- 완료 결과: 후속 리뷰 수정 커밋의 재검증, `CHANGELOG.md`의 `0.1.0` 릴리스 기록, 문서 동기화와 원격 푸시를 마쳤다. `main` 대상 PR [#6](https://github.com/humanpear/MountianMap/pull/6)을 생성했으며 최종 적대적 리뷰에서 추가 결함은 발견되지 않았다.
- 남은 위험: 최신 `supabase/mountain_reviews.sql`은 사용자가 운영 Supabase에 재적용 완료했다. 계획 감사에서 결과 행의 평가 인원 직접 표기와 일부 비동기 조합 테스트가 부분 완료로 남았으나 현재 확정 범위와 핵심 흐름을 막지는 않는다. 프로덕션 JavaScript 청크 약 2.22MB(압축 약 482KB)의 Vite 500KB 경고가 남는다.
- 다음 단계: 사용자 요청 시 12단계에서 PR을 병합하고 배포·운영 상태를 확인한다.

### 2026-07-19 · 단계 9 · 완료

- 범위: `$design-review` diff-aware Standard 검토로 산 찾기 지도, 데스크톱 필터·결과·상세 패널, 375px 모바일 필터·결과·상세, 랜덤 추천 흐름을 `DESIGN.md` 기준으로 점검했다. 낮은 화면의 필터 액션 유실, 선택 산과 지도 위치 불일치, 피드백 버튼의 결과 패널 겹침, 44px 미만 조작 영역, 10초 이상 랜덤 추천 대기 등 5건을 수정했다.
- 사용 스킬: `$design-review`, 인앱 브라우저. gstack Windows browse 실행 파일의 기존 장애 때문에 실제 화면 조작과 스크린샷은 Codex In-app Browser로 수행했다.
- 변경 파일: `src/App.tsx`, `src/components/MountainDiscoveryPanel.tsx`, `src/components/MountainMap.tsx`, `src/kakao.d.ts`, `src/game/random.ts`, `src/components/MountainMap.regression-2.test.tsx`, `src/game/randomTiming.regression-1.test.ts`, 디자인 리포트·스크린샷, 이 문서.
- 검증: 1280×720 필터 하단 액션 노출, 1440×900 결과·감악산 상세와 지도 선택 마커 동기화, 패널 위 피드백 버튼 0개, 375×812 수평 오버플로 0 및 앱 소유 헤더·마커 조작 영역 44px 이상을 확인했다. 랜덤 추천은 10.45초에서 브라우저 약 2.63초, 42단계 타이머 계약 2,310ms로 단축됐다. 수정 후 콘솔 오류·경고 0건, `npm run lint` 통과, `npm test` 23개 파일·154개 통과, `npm run build` 통과.
- 결정: Kakao 패널 가시 영역 계산은 월드 투영 좌표가 아니라 `containerPointFromCoords`·`coordsFromContainerPoint`를 우선 사용한다. 지도 마커는 외형 36px를 유지하되 실제 버튼 상자를 44px로 분리한다. 산 찾기 패널이 열리면 비핵심 피드백 버튼을 숨기고, 랜덤 추천은 최장 2.5초 이내에 끝낸다. 디자인 점수는 B→A, AI slop 점수는 A→A로 평가했다.
- 남은 위험: 실제 iOS·Android 기기가 아닌 브라우저 뷰포트 검증이다. 인증 계정의 등정 필터 조합은 8단계와 동일하게 브라우저에서 직접 검증하지 못했다. 프로덕션 JavaScript 청크 약 2.21MB(압축 약 480KB)의 Vite 500KB 경고가 남는다.
- 다음 단계: 10단계 `$review` 병합 전 리뷰.

### 2026-07-19 · 단계 8 · 완료

- 범위: `$qa` Standard 티어로 산 찾기의 지역·난이도·등정 상태, 결과 개수와 정렬, 지도 마커, 목록·상세 왕복과 스크롤 복원, 랜덤 추천, 0개 결과를 데스크톱과 375×812 모바일에서 검증했다. 랜덤 추천 완료 시 앱 전체가 흰 화면으로 중단되는 High 버그 1건을 재현하고 수정·회귀 검증했다.
- 사용 스킬: `$qa`. gstack Windows browse 실행 파일이 로컬 서버 스크립트를 찾지 못해 실제 브라우저 조작은 Codex In-app Browser로 수행했다.
- 변경 파일: `src/components/MountainMap.tsx`, `src/kakao.d.ts`, `src/components/MountainMap.regression-1.test.tsx`, `.gstack/qa-reports/qa-report-127-0-0-1-2026-07-19.md`, `.gstack/qa-reports/baseline.json`, QA 스크린샷, 이 문서.
- 검증: 수정 전 랜덤 추천 충돌 2/2 재현. 수정 후 데스크톱 100개 후보와 모바일 15개 후보에서 상세·지도 강조가 정상이고 콘솔 오류·경고 0건이다. 강원도 24개, 강원도+평가 전 23개, 서울/경기 15개, 제주도+매우 어려움 0개를 확인했다. 낮은 산 순·높은 산 순, 지도 마커 선택, 목록·상세 복귀와 모바일 스크롤 위치 유지가 정상이다. `npm run lint` 통과, `npm test` 21개 파일·152개 통과, `npm run build` 통과.
- 결정: Kakao 지도 화면 좌표를 지도 좌표로 바꿀 때 일반 `{x, y}` 객체 대신 공식 API 계약인 `new kakao.maps.Point(x, y)`를 전달한다. 기존 테스트 mock 호환을 위한 fallback만 유지한다. QA 기준 점수는 수정 전 92.5/100, 수정 후 검증 범위에서 100/100이다.
- 남은 위험: 로그인 계정에서만 가능한 등정 완료·미등정 조합은 브라우저에서 직접 검증하지 못했고 로그아웃 비활성화·안내만 검증했다. 실제 모바일 기기가 아닌 브라우저 뷰포트 검증이다. 프로덕션 JavaScript 청크 약 2.21MB(압축 약 480KB)의 Vite 500KB 경고가 남는다.
- 다음 단계: 9단계 `$design-review` 디자인 마감.

### 2026-07-19 · 단계 7 · 완료

- 범위: `$health`로 산 찾기 통합 구현의 코드 품질을 점검하고 프로젝트의 Health Stack을 설정했다. 타입 검사, 전체 테스트, 프로덕션 빌드를 현재 작업 트리 기준으로 재검증했다.
- 사용 스킬: `$health`.
- 변경 파일: `CLAUDE.md`, 이 문서. 애플리케이션 코드는 변경하지 않았다.
- 검증: `npm run lint` 통과(타입 오류 0건), `npm test` 통과(20개 파일·151개 테스트), `npm run build` 통과. `$health` 종합 점수는 설정된 타입 검사와 테스트 기준 10.0/10이다. Vitest와 Vite의 최초 실행은 샌드박스 파일 접근 제한으로 중단됐으나 정상 권한 재실행은 모두 통과했다.
- 결정: Health Stack은 `npm run lint`와 `npm test`를 사용한다. 현재 `lint` 스크립트는 실제 코드 스타일 린터가 아니라 `tsc -b --noEmit` 타입 검사다. ESLint·Biome, Knip, ShellCheck, GBrain은 설정되지 않아 이번 점수에서 제외했다.
- 남은 위험: 프로덕션 JavaScript 청크가 약 2.21MB(압축 약 480KB)여서 Vite의 500KB 경고가 남는다. 실제 브라우저 흐름과 반응형 시각 품질은 8~9단계에서 검증해야 한다.
- 다음 단계: 8단계 `$qa` 브라우저 QA.

### 2026-07-18 · 단계 6 · 완료

- 범위: 필터가 적용된 `resultMountains`를 지도 마커와 랜덤 추천 후보군에 공통 연결했다. `fitResultsRevision`이 증가한 명시적 적용에서만 결과 전체 bounds를 맞추고, 산 선택은 지도·패널 가시 영역 밖일 때만 현재 확대 수준을 유지한 채 `panTo`하도록 구현했다. 결과 목록에 현재 결과 개수를 포함한 랜덤 추천 버튼과 실행·취소 상태를 추가했다.
- 사용 스킬: 없음. 일반 Codex 구현 단계로 진행했다.
- 변경 파일: `src/App.tsx`, `src/App.test.tsx`, `src/components/MountainMap.tsx`, `src/components/MountainMap.test.tsx`, `src/components/MountainDiscoveryPanel.tsx`, `src/components/MountainDiscoveryPanel.test.tsx`, `src/game/random.ts`, `src/game/random.test.ts`, `src/kakao.d.ts`, `src/types.ts`, 이 문서.
- 검증: `npm run lint` 통과, 지도·패널·랜덤·App 관련 테스트 28개 통과, 전체 테스트 20개 파일·151개 통과, `npm run build` 통과. 빌드는 기존 대형 번들 경고만 남고 성공했다.
- 결정: 기존 `전체/미등정/직접 선택` 랜덤 모드와 별도 후보·결과 modal 상태를 제거하고 공통 필터 결과만 후보로 사용한다. 결과 0개에서는 랜덤 버튼을 비활성화한다. 실행 타이머는 ref로 관리하며 취소, 필터 열기·적용·초기화, 결과 집합 변경과 unmount에서 정리한다. 정렬만 바뀌면 지도 overlay를 재생성하거나 카메라를 이동하지 않는다. 결과 0개는 기존 카메라를 유지하고 한 개 결과는 제한된 확대 수준으로 중심을 맞춘다.
- 남은 위험: 실제 Kakao 지도와 모바일 bottomSheet가 겹치는 화면에서 padding·가시 영역 보정값은 8단계 브라우저 QA와 9단계 디자인 마감에서 실기기 기준으로 확인해야 한다.
- 다음 단계: 7단계 `$health` 코드 품질 점검.

### 2026-07-18 · 단계 5 · 완료

- 범위: 지도 위 산 찾기 진입·적용 조건 요약, 데스크톱 비모달 필터 popover, 모바일 필터 bottomSheet, 예상 결과 개수, 결과 aside·bottomSheet, 빈 결과, 정렬, 선택한 산 상세 전환과 목록 스크롤 복원을 구현했다. `App`에서 난이도 요약을 최초 1회 조회하고 request id로 오래된 응답과 unmount 이후 응답을 무효화하도록 연결했다.
- 사용 스킬: 없음. 일반 Codex 구현 단계로 진행했다.
- 변경 파일: `src/components/MountainDiscoveryPanel.tsx`, `src/components/MountainDiscoveryPanel.test.tsx`, `src/App.tsx`, `src/App.test.tsx`, 이 문서.
- 검증: `npm run lint` 통과, 패널·App 대상 테스트 10개 통과, 전체 테스트 20개 파일·141개 통과, `npm run build` 통과. 빌드는 기존 대형 번들 경고만 남고 성공했다.
- 결정: 데스크톱과 모바일은 하나의 `DiscoveryState`를 공유한다. 필터를 열 때 적용값을 draft로 복사하고 취소·바깥 클릭·Escape에서는 폐기하며, 적용할 때만 결과를 갱신한다. 난이도 loading·error는 평가 전으로 표시하지 않고 난이도 영역만 제한하며 지역·등정 필터는 계속 사용할 수 있다. 로그아웃 사용자는 완료·미등정 필터를 선택할 수 없고 결과 행도 미등정으로 단정하지 않는다. 결과 목록은 반복 카드 대신 구분선형 행을 사용하고 44px 이상 조작 영역과 16px 본문 기준을 지킨다.
- 남은 위험: 지도 마커 범위와 랜덤 추천 후보군은 아직 기존 전체 산·기존 상태를 사용한다. 이는 6단계 범위이며 이번 단계에서는 결과 패널 상태와 의도적으로 분리했다.
- 다음 단계: 6단계 지도와 랜덤 추천 연결.

### 2026-07-16 · 단계 2 · 완료

- 범위: `$plan-eng-review`의 Step 0 범위 검토, 아키텍처, 코드 품질, 테스트와 성능 검토를 완료했다.
- 사용 스킬: `$plan-eng-review`
- 변경 파일: `docs/mountain-discovery-implementation-workflow.md`
- 검증: `package.json`, `CLAUDE.md`, git 이력, `App.tsx`, `MountainMap.tsx`, `types.ts`, 산 데이터, 리뷰 서비스·SQL, 랜덤 로직과 기존 Vitest 테스트를 확인했다. React, Supabase, Kakao 공식 문서에서 내장 상태·RPC·지도 경계 API를 확인했다.
- 결정: 엔지니어링 D1에서 전체 범위를 유지하는 A안을 승인했다. 예상 변경 파일이 테스트를 포함해 10~12개로 복잡도 경고 기준을 넘지만, 새 모듈을 최대 2개로 제한하고 데이터→도메인→UI→지도 통합 순서로 나눠 구현한다. 파일 수를 줄이기 위해 기존 1,400줄 이상 `App.tsx`에 로직을 더 밀어 넣지 않는다. D2에서는 별도 요약 테이블 없이 Postgres RPC가 전체 리뷰를 산별로 집계하고 프론트에는 산별 평균·평가 인원만 반환하는 A안을 승인했다. D3에서는 `App`의 단일 `useReducer`가 탐색 상태를 소유하고 패널과 지도는 파생 상태와 action만 받는 A안을 승인했다. D4에서는 산림청 100대 명산의 9개 지역 분류를 필터 기준으로 채택하고, 여러 권역에 걸친 산을 누락하지 않도록 각 산에 복수 `regionCodes`를 명시한다. D5에서는 기존 난이도 값을 감사·정리한 후 DB `CHECK` 제약과 TypeScript literal union으로 승인된 5개 값만 허용한다. D6에서는 산별 원본 평균을 보존하고 가장 가까운 정수 단계로 반올림해 표시·필터 단계로 변환한다. D7에서는 명시적 필터 적용만 결과 전체 `setBounds`를 실행하고, 산 선택은 현재 줌을 유지하는 조건부 `panTo`만 실행한다. D8에서는 탐색 도메인과 탐색 UI만 새 모듈로 분리하고 `App.tsx`는 데이터 조회와 연결을 담당하는 조정자로 제한한다. D9에서는 난이도 요약의 idle·loading·ready·error를 하나의 discriminated union으로 관리해 불가능한 상태 조합을 제거한다. D10에서는 요청 번호를 사용해 가장 최근 난이도 요약 요청만 상태를 변경하고 unmount 시 진행 중 응답을 무효화한다. D11에서는 도메인·서비스·컴포넌트·지도 자동 테스트와 운영 Supabase 수동 SQL 검증을 분리한다. D12에서는 앱 진입 시 난이도 요약을 1회 미리 조회해 메모리에 유지하고 필터 조작마다 재조회하지 않는다. D13에서는 현재 정확한 전체 집계 RPC를 유지하고 실제 성능 병목이 측정된 경우에만 요약 테이블을 별도 설계한다.
- 남은 위험: 구현 단계에서 운영 Supabase에 SQL을 수동 적용하고 결과를 검증해야 한다. 이는 계획의 미해결 결정이 아니라 3단계 완료 조건이다.
- 다음 단계: 3

### 2026-07-18 · 단계 4 · 완료

- 범위: React·Supabase와 분리된 탐색 도메인 모듈에 난이도 평균 변환, 지역·난이도·등정 상태 필터, 한국어 이름·고도 정렬, draft/applied 필터 reducer와 `appliedRevision` 전이를 구현했다.
- 사용 스킬: 없음. 일반 Codex 구현 단계로 진행했다.
- 변경 파일: `src/domain/mountainDiscovery.ts`, `src/domain/mountainDiscovery.test.ts`, `src/types.ts`, `src/services/mountainReviews.ts`, 이 문서.
- 검증: `npm run lint` 통과, 도메인·지역·리뷰 서비스 관련 테스트 51개 통과, 상세 페이지·도메인 관련 테스트 65개 통과, 전체 테스트 134개 통과, `npm run build` 통과.
- 결정: 특정 난이도 필터는 난이도 요약이 `ready`일 때만 계산하며 loading·error를 평가 없음으로 간주하지 않는다. 로그아웃 상태에서 완료·미등정 계산을 시도하면 계약 오류를 내고 reducer의 인증 변경 전이가 해당 조건만 `전체`로 복구한다. 필터는 AND로 결합하고 정렬은 입력 배열을 변경하지 않으며, 고도 동률은 한국어 이름순으로 결정한다. 명시적 `APPLY_FILTERS`만 값의 동일 여부와 관계없이 `appliedRevision`을 증가시킨다.
- UI 정리: 사용자 결정에 따라 한줄평 필터 버튼의 접근성 이름을 `전체 0`처럼 공백을 포함하도록 명시하고 사진 라이트박스 배경을 `bg-black/85`로 통일했다. git 이력상 의도적으로 제거된 한줄평 정렬 UI를 계속 기대하던 오래된 테스트도 현재 제품 동작에 맞게 정리했다.
- 남은 위험: 없음.
- 다음 단계: 5단계 결과 목록과 패널 상태 구현.

### 2026-07-18 · 단계 3 · 완료

- 범위: 산림청 9개 권역의 100대 명산 메타데이터, 리뷰 난이도 5단계 공통 계약, 전체 리뷰 기반 산별 난이도 집계 RPC와 프론트 조회 서비스를 구현했다.
- 사용 스킬: 없음. 일반 Codex 구현 단계로 진행했다.
- 변경 파일: `src/types.ts`, `src/data/mountains.ts`, `src/data/mountainRegions.test.ts`, `src/services/mountainReviews.ts`, `src/services/mountainReviews.test.ts`, `src/services/myPage.ts`, `src/components/MountainDetailPage.tsx`, `src/components/MyPage.tsx`, `src/components/reviews/useReviewEditorDraft.ts`, `src/components/MountainMap.test.tsx`, `scripts/audit-mountain-guides.mjs`, `supabase/mountain_reviews.sql`, 이 문서.
- 검증: `npm run lint` 통과, `npm run build` 통과, 데이터·RPC·감사 스크립트 관련 테스트 15개 통과. 전체 테스트는 96개 중 90개 통과하고 기존 `MountainDetailPage.courseFeedback.test.tsx`의 UI 기대값 불일치 6개가 남았다. 이번 컴포넌트 변경은 난이도 상수 공유와 readonly 타입뿐이며 실패한 필터 버튼 공백·라이트박스 클래스 영역은 변경하지 않았다.
- 결정: 지역은 주소 런타임 추론 없이 산 ID별 명시적 복수 `regionCodes`로 저장한다. 난이도는 `쉬움`, `보통`, `약간 어려움`, `어려움`, `매우 어려움`만 허용하며 서비스에서 잘못된 행을 즉시 거부한다. RPC는 리뷰를 샘플링하지 않고 유효 리뷰 전체를 산별로 집계한 뒤 최대 100개의 요약 행만 반환한다. 기존 데이터 제약 추가는 `NOT VALID` 후 `VALIDATE`하여 적용 중 무제약 상태가 생기지 않게 했다.
- 운영 적용: 2026-07-18 사용자 확인으로 `supabase/mountain_reviews.sql`의 운영 Supabase 적용이 완료되었다.
- 남은 위험: 기존 상세 페이지 테스트 6개의 기대값을 현재 UI 계약과 맞출지 별도 확인이 필요하다.
- 다음 단계: 4단계 필터와 정렬 도메인 로직 구현.

### 2026-07-15 · 단계 1 · 완료

- 범위: `plan-design-review`의 정보 구조, 상태, 사용자 여정, AI slop, 디자인 시스템, 반응형·접근성, 미해결 결정 패스를 모두 완료했다.
- 사용 스킬: `$plan-design-review`
- 변경 파일: `docs/mountain-discovery-implementation-workflow.md`
- 검증: `git log --oneline -15`, `git diff origin/main --stat`, `CLAUDE.md`, `DESIGN.md`, 기존 디자인 감사 보고서·스크린샷, `App.tsx`의 지도·aside·모바일 시트 패턴을 확인했다.
- 결정: 초기 디자인 완성도 7/10에서 시작해 D1에서 7개 패스 전체 검토를 선택했고 D2~D14를 승인했다. 혼합형 반응형 구조, 결과 목록 기반 랜덤 추천, 명시적 필터 적용, 빈 결과, 평가 전, 소요시간 필터 제외, 지도 카메라와 선택 동기화, 반응형 modal 규칙, 랜덤 직접 후보 선택 제외, 구분선형 결과 목록, 로그아웃 등정 필터, 난이도 조회 오류 복구가 확정됐다. 최종 디자인 계획 평가는 9/10이다. `DESIGN.md`의 SUIT, 색상 토큰, 16px 이상 본문, 44px 이상 터치 영역, 모바일 가로 스크롤 금지를 구현 기준으로 고정한다.
- 남은 위험: gstack designer binary가 없어 새 시각 목업을 자동 생성하지 못했다. 계획 차단 요소는 아니며 8단계 브라우저 QA와 9단계 디자인 마감에서 실제 화면으로 검증한다.
- 다음 단계: 2

### 2026-07-14 · 단계 0 · 완료

- 범위: 저장소 루트, 현재 브랜치, upstream, HEAD, tracked·untracked 변경과 구현 보호 대상을 확인했다.
- 사용 스킬: 없음
- 변경 파일: `docs/mountain-discovery-implementation-workflow.md`의 진행 현황과 실행 기록만 갱신했다.
- 검증: `git status --short --branch`, `git diff --name-status`, `git ls-files --others --exclude-standard`, `git remote get-url origin`, `git rev-parse --show-toplevel`, `git log -1` 실행 완료.
- 결정: 현재 브랜치는 `refactor/re-design`, upstream은 `origin/refactor/re-design`, 시작 HEAD는 `2c707cc`다. tracked 파일은 깨끗하며 기존 구현 파일은 모두 보호 대상으로 두고 1단계 계획 검토 전에는 수정하지 않는다. 유일한 untracked 파일인 이 워크플로 문서는 의도한 작업 산출물로 보존한다.
- 남은 위험: 워크플로 문서가 아직 git에 추적되지 않아 외부 정리 작업에서 유실될 수 있다. 11단계 전까지 의도한 문서로 계속 보호한다.
- 다음 단계: 1

## 1. 목표

사용자가 지역, 등산객 체감 난이도, 등정 상태로 산을 찾고 결과를 지도와 목록에서 함께 확인할 수 있게 한다.

```text
산 찾기 열기
  -> 조건 편집
  -> 결과 적용
  -> 지도 마커와 결과 목록 동시 갱신
  -> 지도 마커 또는 목록 카드에서 산 선택
  -> 기존 산 상세정보 표시
  -> 결과 목록으로 돌아가기
```

랜덤 추천은 별개의 필터나 첫 화면의 탐색 모드로 두지 않는다. 결과 목록의 맥락 행동으로 제공하며 현재 필터 결과에서 하나를 추천한다.

## 2. 확정된 1차 범위

### 필터

- 지역: 시·도 단위
- 체감 난이도: 사용자 한줄평 난이도의 산별 평균
- 등정 상태: 전체, 등정 완료, 미등정

### 정렬

- 가나다순
- 낮은 산 순
- 높은 산 순

### 결과 경험

- 필터 결과에 포함된 산만 지도에 표시한다.
- 데스크톱은 기존 `aside`, 모바일은 기존 `bottomSheet`에 결과 목록을 표시한다.
- 결과 목록이나 지도에서 산을 선택하면 같은 패널이 기존 상세정보로 전환된다.
- 상세정보에서 결과 목록으로 돌아가면 필터, 정렬, 목록 스크롤 위치를 복원한다.
- 결과 개수는 고정 숫자가 아니라 적용된 조건으로 계산한 `N개`를 표시한다.

### 1차 범위에서 제외 (NOT in scope)

- 시·군·구 필터
- 현재 위치에서 가까운 순
- 주차 및 대중교통 필터
- 날씨와 계절 추천
- 필터 조합 저장
- 인기순 정렬
- 필터 조건을 URL로 공유하는 기능
- 코스 예상시간 또는 소요시간 필터. 기존 코스 시간은 산 상세정보에서 계속 제공한다.
- 랜덤 추천 후보 직접 선택. 1차에서는 적용된 필터 결과 전체를 후보군으로 사용한다.

## 3. 데이터 정책

### 3.1 지역

필터의 지역 선택지는 산림청 100대 명산 페이지와 같은 9개 권역을 사용한다.

1. 서울/경기
2. 강원도
3. 충청남도
4. 충청북도
5. 경상북도
6. 경상남도
7. 전라북도
8. 전라남도
9. 제주도

현재 `Mountain.province`는 문자열 하나이므로 여러 권역에 걸친 산이 누락될 수 있다. 주소 문자열을 실행 중에 해석하지 말고, 산 데이터에 산림청 분류에 대응하는 정규화된 복수 지역 코드를 명시한다.

```ts
type MountainRegionCode =
  | "seoul-gyeonggi"
  | "gangwon"
  | "chungnam"
  | "chungbuk"
  | "gyeongbuk"
  | "gyeongnam"
  | "jeonbuk"
  | "jeonnam"
  | "jeju";

type Mountain = {
  // 기존 필드
  regionCodes: MountainRegionCode[];
};
```

필터는 선택한 지역 코드가 `regionCodes`에 하나라도 포함되면 산을 결과에 넣는다. 기존 `province` 문자열은 상세 소재지와 목록 표시용으로 계속 사용한다.

```ts
// 한 권역에 속하는 예
{ name: "관악산", regionCodes: ["seoul-gyeonggi"] }
{ name: "계룡산", regionCodes: ["chungnam"] }

// 두 권역 이상에 걸친 예
{ name: "가야산", regionCodes: ["gyeongnam", "gyeongbuk"] }
{ name: "가지산", regionCodes: ["gyeongnam", "gyeongbuk"] }
{ name: "강천산", regionCodes: ["jeonbuk", "jeonnam"] }
```

광역시는 산림청 권역과 인접 도 분류에 맞춘다. 서울·인천은 `seoul-gyeonggi`, 대전·세종은 `chungnam`, 대구는 `gyeongbuk`, 부산·울산은 `gyeongnam`, 광주는 `jeonnam`에 포함한다. 이는 9개 필터 선택지를 유지하기 위한 애플리케이션 매핑 규칙이며, 산림청의 개별 산 소재지 목록과 대조해 100개 산 데이터를 명시적으로 입력한다.

데이터 품질 규칙:

- 모든 산의 `regionCodes`는 비어 있지 않아야 한다.
- 허용된 9개 코드 외의 값은 타입과 테스트에서 거부한다.
- 소재지가 여러 권역에 걸치면 모든 해당 코드를 기록한다.
- 런타임 주소 파싱으로 코드를 생성하지 않는다.
- 단위 테스트에서 100개 산 전체의 코드 유효성과 대표 다중 권역 산을 검증한다.

### 3.2 체감 난이도

한줄평 난이도를 다음 숫자로 변환해 산별 산술평균을 계산한다.

| 한줄평 난이도 | 값 |
| --- | ---: |
| 쉬움 | 1 |
| 보통 | 2 |
| 약간 어려움 | 3 |
| 어려움 | 4 |
| 매우 어려움 | 5 |

엔지니어링 검토 D5에서 리뷰 난이도를 자유 문자열로 유지하지 않고 데이터베이스와 TypeScript 양쪽에서 같은 5개 값으로 제한하기로 승인했다.

```ts
export const mountainReviewDifficulties = [
  "쉬움",
  "보통",
  "약간 어려움",
  "어려움",
  "매우 어려움",
] as const;

export type MountainReviewDifficulty =
  (typeof mountainReviewDifficulties)[number];
```

- `MountainReview.difficulty`, 생성 입력, 수정 입력은 `string` 대신 `MountainReviewDifficulty`를 사용한다.
- 상세 페이지와 마이페이지에 중복 선언된 난이도 배열은 공용 상수를 사용한다.
- Supabase에서 읽은 값은 타입 단언만 하지 않고 공용 값 목록을 이용한 런타임 검증을 거친다.
- 승인되지 않은 값은 임의로 `보통`으로 바꾸지 않는다. 데이터 계약 위반으로 처리해 잘못된 평균에 포함되지 않게 한다.

운영 데이터에는 먼저 다음 감사 쿼리를 실행한다.

```sql
select difficulty, count(*) as review_count
from public.mountain_reviews
where difficulty not in (
  '쉬움',
  '보통',
  '약간 어려움',
  '어려움',
  '매우 어려움'
)
group by difficulty
order by review_count desc;
```

잘못된 값이 있으면 의미를 확인해 승인된 값으로 수정하거나 잘못 생성된 행을 별도로 처리한 뒤 제약조건을 추가한다. 감사 결과가 남아 있는 상태에서 제약조건 추가를 강행하지 않는다.

```sql
alter table public.mountain_reviews
  drop constraint if exists mountain_reviews_difficulty_check;

alter table public.mountain_reviews
  add constraint mountain_reviews_difficulty_check
  check (
    difficulty in (
      '쉬움',
      '보통',
      '약간 어려움',
      '어려움',
      '매우 어려움'
    )
  );
```

- 새 테이블 생성 구문에도 같은 `CHECK`를 포함하고, 기존 테이블에는 `ALTER TABLE`로 적용한다.
- RPC의 점수 변환 `CASE`도 같은 다섯 값만 1~5로 변환한다.
- SQL 적용 후 잘못된 값 insert·update가 거부되는지 확인한다.
- 서비스 테스트에는 유효한 5개 값, 잘못된 응답 값, 잘못된 생성·수정 입력의 타입 계약을 포함한다.

엔지니어링 검토 D6에서 표시 단계는 평균과 가장 가까운 정수 단계로 반올림하기로 승인했다. RPC가 반환한 원본 평균은 보존하고 화면 표시와 특정 난이도 필터 판정에서만 다음 구간을 사용한다.

| 평균 점수 | 표시·필터 단계 |
| ---: | --- |
| 1.00 이상, 1.50 미만 | 쉬움 |
| 1.50 이상, 2.50 미만 | 보통 |
| 2.50 이상, 3.50 미만 | 약간 어려움 |
| 3.50 이상, 4.50 미만 | 어려움 |
| 4.50 이상, 5.00 이하 | 매우 어려움 |

```ts
function getDifficultyFromAverage(
  averageScore: number,
): MountainReviewDifficulty {
  const roundedScore = Math.round(averageScore);
  return mountainReviewDifficulties[roundedScore - 1];
}
```

입력 계약:

- `reviewCount`가 0이면 이 함수를 호출하지 않고 `평가 전`으로 처리한다.
- 유효한 평균 범위는 `1 <= averageScore <= 5`다.
- 범위를 벗어나거나 `NaN`, `Infinity`인 응답을 1 또는 5로 강제 보정하지 않는다. RPC 응답 계약 오류로 처리한다.
- 화면에 평균 숫자를 추가로 표시하더라도 계산용 원본 평균을 임의로 한 자리 소수로 잘라 필터에 사용하지 않는다.

필수 경계 테스트:

- `1`, `1.49` → 쉬움
- `1.5`, `2.49` → 보통
- `2.5`, `3.49` → 약간 어려움
- `3.5`, `4.49` → 어려움
- `4.5`, `5` → 매우 어려움
- `0.99`, `5.01`, `NaN`, `Infinity` → 계약 오류
- 평가 0건 → 평가 전이며 변환 함수 미호출

- 화면 명칭은 객관적인 `산 난이도`가 아니라 `등산객 체감 난이도`를 사용한다.
- 평가 인원을 함께 표시한다. 예: `체감 난이도 보통 · 8명 평가`.
- 한줄평이 없으면 코스 난이도로 값을 대신 만들지 않고 `평가 전`으로 표시한다.
- `전체` 필터에는 평가가 없는 산도 포함한다.
- 특정 난이도 필터에는 해당 평균 단계의 산만 포함한다.
- `평가 없음`을 별도 선택지로 제공한다.
- 리뷰 조회 실패는 `평가 없음`과 구분한다. 실패 시 난이도 필터를 비활성화하고 오류 안내를 보여주되 다른 필터는 사용할 수 있어야 한다.

현재 앱은 선택한 산의 최신 리뷰 최대 50개만 `fetchMountainReviews`로 조회하고 작성자 프로필까지 보강한다. 이 함수를 산 100개에 반복하거나 전체 난이도 필터 집계에 재사용하지 않는다.

엔지니어링 검토 D2에서 별도 요약 테이블 없이 Postgres RPC로 호출 시점에 전체 리뷰를 집계하는 방식을 승인했다.

```text
React 지도 진입
  -> fetchMountainDifficultySummaries()
  -> supabase.rpc('get_mountain_difficulty_summaries')
  -> Postgres가 mountain_reviews 전체를 mountain_id로 GROUP BY
  -> 유효한 난이도를 1~5점으로 변환해 평균·평가 인원 계산
  -> 산별 요약 최대 100행 반환
  -> 순수 도메인 함수가 평균을 표시 단계로 변환
  -> 필터·결과 목록에 반영
```

RPC 반환 계약:

```ts
type MountainDifficultySummary = {
  mountainId: string;
  reviewCount: number;
  averageScore: number;
};
```

- `public.get_mountain_difficulty_summaries()`는 `language sql`, `stable`, `security invoker`, 빈 `search_path`와 완전한 스키마명을 사용한다.
- 리뷰 원본 쿼리에는 `limit`을 적용하지 않는다. 응답 행은 집계가 끝난 산별 요약이므로 최대 산 개수 수준이다.
- 함수 실행 권한은 `public`에서 회수하고 `anon`, `authenticated`에 명시적으로 부여한다.
- 기존 `mountain_reviews` 공개 읽기 RLS 정책을 따르며 service role 키를 프론트에 노출하지 않는다.
- RPC 실패 시 난이도 필터만 오류 상태로 두고 지역·등정 필터, 정렬과 결과 탐색은 유지한다.
- SQL은 기존 `supabase/mountain_reviews.sql`에 추가하고 현재 프로젝트의 수동 SQL 적용 절차로 운영 Supabase에 반영한다.
- 프론트 서비스는 기존 `src/services/mountainReviews.ts`에 `fetchMountainDifficultySummaries()`를 추가해 RPC 행 검증과 camelCase 변환을 담당한다.
- 기존 `src/services/mountainReviews.test.ts`에 RPC 성공, 빈 응답, 오류, 잘못된 행 계약 테스트를 추가한다.

### 3.3 등정 상태

- 로그인 사용자는 `completedIds`를 기준으로 필터한다.
- 로그아웃 사용자를 모두 미등정으로 간주하지 않는다. 이는 실제 기록이 아니라 인증되지 않은 상태이기 때문이다.
- 로그아웃 상태에서는 등정 필터를 비활성화하고 로그인 안내를 제공하는 방향을 우선 검토한다.

### 3.4 정렬

정렬은 결과 포함 여부를 바꾸지 않으므로 필터 화면이 아니라 결과 목록 상단에 둔다.

- 가나다순: 한국어 이름 기준
- 낮은 산 순: `elevationMeters` 오름차순, 동률이면 가나다순
- 높은 산 순: `elevationMeters` 내림차순, 동률이면 가나다순

## 4. 상태와 화면 구조

필터 편집 도중 지도가 즉시 흔들리지 않도록 편집 중 조건과 적용된 조건을 분리한다. 엔지니어링 검토 D3에서 `App`이 단일 `useReducer`로 탐색 상태를 소유하는 방식을 승인했다.

```ts
type DiscoveryView =
  | { kind: "closed" }
  | { kind: "filters" }
  | { kind: "results" }
  | { kind: "detail"; mountainId: string }
  | {
      kind: "random-running";
      winnerId: string;
      highlightedId: string;
      sequenceIds: string[];
    };

type DiscoveryState = {
  view: DiscoveryView;
  draftFilters: MountainFilters;
  appliedFilters: MountainFilters;
  sort: MountainSort;
  resultScrollTop: number;
};
```

승인된 전환은 다음과 같다.

```text
closed
  -> filters
filters
  -> cancel -> closed 또는 이전 view
  -> apply -> results
results
  -> select mountain -> detail(mountainId)
  -> start random -> random-running
detail
  -> back -> results + scroll restore
random-running
  -> tick -> highlightedId 갱신
  -> finish -> detail(winnerId)
  -> cancel -> results
closed/results/detail
  -> reset filters -> 전체 결과
```

- 새 `src/domain/mountainDiscovery.ts`는 `DiscoveryState`, action union, `discoveryReducer`, 난이도 단계 변환, 필터·정렬 순수 함수를 함께 소유한다.
- 새 탐색 패널 컴포넌트는 상태를 복제하지 않고 `state`, 파생 결과와 action callback만 받는다.
- `App`은 세션, 완료 기록, 난이도 요약과 reducer를 조합해 지도·목록·랜덤이 사용할 동일한 `resultMountains`를 한 번만 계산한다.
- 기존 `randomMode`, `candidateIds`, `isMobileDetailSheetOpen`, `resultModalMountain`은 새 흐름과 중복되므로 제거한다.
- 기존 `selectedMountainId`, `focusedMountainId`, `randomState`가 표현하던 선택·포커스·실행 상태는 `DiscoveryView`에서 파생한다.
- 랜덤 타이머 ID는 렌더링 상태가 아니므로 `useRef`에 두고 시작, 취소, 필터 변경, unmount에서 명시적으로 정리한다.
- reducer는 비동기 호출이나 지도 객체를 직접 다루지 않는다. 서비스 호출과 Kakao 명령은 `App`과 `MountainMap` 경계에 남긴다.
- 이 구조를 위해 전역 Context나 Zustand를 추가하지 않는다.

```text
App
  ├─ session / completionRecords / difficultySummaries
  └─ useReducer(discoveryReducer)
       ├─ draftFilters / appliedFilters / sort / view
       ├─ resultMountains -> DiscoveryPanel
       ├─ resultMountains + selected/highlighted ids -> MountainMap
       └─ resultMountains -> random picker
```

### 4.1 승인된 파일 책임과 의존 방향

엔지니어링 검토 D8에서 새 모듈은 다음 두 개로 제한하기로 승인했다.

`src/domain/mountainDiscovery.ts`

- `DiscoveryState`, `DiscoveryView`, filter·sort 타입
- reducer와 action union
- 난이도 평균 단계 변환
- 지역·난이도·등정 필터와 정렬 순수 함수
- 지도 명령에 필요한 `appliedRevision` 상태 전이
- React 컴포넌트, Supabase client, Kakao 객체를 import하지 않는다.

`src/components/MountainDiscoveryPanel.tsx`

- 데스크톱 필터 popover와 결과 aside의 탐색 화면
- 모바일 필터·결과·상세 전환용 bottomSheet
- 결과 목록, 빈 결과, 난이도 오류와 로그인 필요 상태
- 필터 계산이나 비동기 조회를 직접 수행하지 않고 props와 callback만 사용한다.
- 기존 산 상세 본문은 복제하지 않고 현재 상세 컴포넌트 또는 승인된 상세 렌더 경계를 재사용한다.

기존 파일 책임:

- `src/App.tsx`: 세션·등정 기록·난이도 요약 조회, reducer 연결, 파생 `resultMountains` 계산, 패널·지도·랜덤 연결
- `src/components/MountainMap.tsx`: overlay 수명주기와 명시적으로 전달된 카메라 명령 실행
- `src/components/MountainDetailPage.tsx`: 산 상세와 한줄평 작성·수정·삭제 역할 유지
- `src/services/mountainReviews.ts`: Supabase row 검증·변환, 상세 리뷰와 난이도 요약 RPC 호출
- `src/types.ts`: `MountainRegionCode`, `MountainReviewDifficulty`와 공용 난이도 값

의존 방향:

```text
types
  ↓
mountainDiscovery domain
  ↓
App orchestration
  ├─ MountainDiscoveryPanel
  └─ MountainMap

mountainReviews service
  → App orchestration
```

금지 규칙:

- `MountainDiscoveryPanel`에서 Supabase 또는 Kakao API를 직접 호출하지 않는다.
- `mountainDiscovery.ts`에서 React hook이나 브라우저 API를 사용하지 않는다.
- `MountainDetailPage.tsx`에 탐색 필터·정렬 상태를 추가하지 않는다.
- 데스크톱과 모바일용 필터 상태를 따로 만들지 않는다.
- 공용 난이도 상수를 상세 페이지와 마이페이지에 중복 선언하지 않는다.
- 새 상태 관리 라이브러리나 세 번째 탐색 전용 모듈을 추가하지 않는다.

파일 크기보다 책임 경계를 우선 검증한다. 구현 후 `App.tsx`의 총 줄 수가 즉시 크게 줄지 않더라도 새 필터 JSX, 필터 계산, 상태 전이 로직이 `App.tsx`에 남지 않아야 한다.

### 4.2 승인된 난이도 요약 비동기 상태

엔지니어링 검토 D9에서 난이도 요약 데이터와 로딩·오류 flag를 따로 관리하지 않고 다음 배타적 상태 타입으로 관리하기로 승인했다.

```ts
type DifficultySummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      summaries: Map<string, MountainDifficultySummary>;
    }
  | {
      status: "error";
      message: string;
    };
```

상태 전이:

```text
앱 진입
  idle -> loading -> ready | error

오류 후 재시도
  error -> loading -> ready | error
```

사용 규칙:

- `ready` 상태에서만 `summaries`에 접근하고 난이도 필터를 활성화한다.
- `loading` 동안 지역·등정 필터와 정렬은 사용할 수 있지만 난이도 필터는 로딩 상태로 비활성화한다.
- `error`에서는 난이도 필터만 비활성화하고 `message`와 재시도 행동을 노출한다.
- `idle`은 최초 요청 전의 짧은 내부 상태이며 `평가 전`을 의미하지 않는다.
- `error` 또는 `loading` 상태에서 빈 `Map`을 만들어 평가가 없는 산으로 해석하지 않는다.
- 특정 난이도가 적용된 상태에서 조회가 오류로 전환되면 승인된 복구 규칙에 따라 난이도 조건을 해제하고 사용자에게 알린다.
- 재시도 성공 시 지역·등정 조건과 정렬은 유지한다.

`App.tsx`는 이 상태와 서비스 호출을 소유하고, `MountainDiscoveryPanel`에는 상태에 필요한 읽기 전용 값과 `onRetryDifficultySummaries` callback만 전달한다.

필수 상태 테스트:

- `idle -> loading -> ready`
- `idle -> loading -> error`
- `error -> loading -> ready`
- loading·error에서 난이도 필터 비활성화
- error를 평가 전으로 표시하지 않음
- 재시도 후 기존 지역·등정·정렬 유지

### 4.3 승인된 요청 경합과 unmount 처리

엔지니어링 검토 D10에서 `AbortController` 지원 여부에 의존하지 않고 요청 번호로 오래된 응답을 무효화하기로 승인했다.

```ts
const difficultyRequestIdRef = useRef(0);

const loadDifficultySummaries = useCallback(async () => {
  const requestId = ++difficultyRequestIdRef.current;
  setDifficultySummaryState({ status: "loading" });

  try {
    const summaries = await fetchMountainDifficultySummaries();

    if (requestId !== difficultyRequestIdRef.current) {
      return;
    }

    setDifficultySummaryState({ status: "ready", summaries });
  } catch (error) {
    if (requestId !== difficultyRequestIdRef.current) {
      return;
    }

    setDifficultySummaryState({
      status: "error",
      message: getDifficultySummaryErrorMessage(error),
    });
  }
}, []);

useEffect(() => {
  loadDifficultySummaries();

  return () => {
    difficultyRequestIdRef.current += 1;
  };
}, [loadDifficultySummaries]);
```

규칙:

- 각 최초 조회와 재시도는 요청 번호를 증가시킨다.
- 응답은 자신의 요청 번호가 현재 번호와 같을 때만 상태를 변경한다.
- cleanup에서 번호를 증가시켜 unmount 이후 도착한 응답을 무효화한다.
- 로딩 중 재시도 버튼은 비활성화해 불필요한 중복 요청을 줄이되, 개발 환경의 effect 재실행이나 미래의 다른 호출 경로에서도 요청 번호 검사를 유지한다.
- 오래된 성공 응답이 최신 오류를 덮거나 오래된 오류가 최신 성공을 덮지 못한다.
- 요청 번호는 화면에 표시할 상태가 아니므로 `useRef`에 두며 reducer action에 포함하지 않는다.
- 서비스 함수가 추후 `AbortSignal`을 지원하면 네트워크 취소를 추가할 수 있지만, 최신 요청 검사 자체는 최종 안전장치로 유지한다.

필수 경합 테스트:

- 첫 요청이 늦게 성공하고 두 번째 요청이 먼저 성공하면 두 번째 결과 유지
- 첫 요청이 늦게 실패하고 두 번째 요청이 먼저 성공하면 오류로 되돌아가지 않음
- 첫 요청 성공 후 두 번째 요청 실패면 최신 오류 표시
- unmount 후 성공·실패 응답 모두 상태 변경 없음
- loading 중 재시도 행동 비활성화

### 4.4 승인된 난이도 요약 조회와 캐시 수명

엔지니어링 검토 D12에서 난이도는 짧은 시간에 급격히 변하는 값이 아니므로 필터를 열 때마다 최신 데이터를 요청하지 않기로 승인했다.

조회 시점:

- 메인 앱 진입 시 세션·등정 기록 등 다른 초기 데이터와 병렬로 RPC를 한 번 호출한다.
- 최초 성공 응답은 `DifficultySummaryState.ready`의 `Map`으로 메모리에 유지한다.
- 필터 열기·닫기, draft 변경, 적용, 초기화와 정렬 변경은 재조회 사유가 아니다.
- 조회 실패 후 사용자가 `다시 시도`를 누르면 새 요청을 실행한다.
- 현재 사용자가 한줄평을 작성·수정·삭제한 뒤 메인 지도 탐색으로 돌아오면 한 번 갱신한다.
- 다른 사용자의 실시간 리뷰 변경을 반영하기 위한 polling이나 realtime subscription은 1차 범위에 포함하지 않는다.

렌더링과 계산:

- `resultMountains`는 산 데이터, 적용 필터, 완료 기록, ready 난이도 요약을 입력으로 `useMemo`에서 한 번 계산한다.
- 같은 `resultMountains`를 지도, 결과 목록과 랜덤 추천에 공유한다.
- 정렬은 목록 순서만 바꾸며 지도 overlay 집합을 다시 만들지 않는다.
- 최대 산 100개이므로 1차 범위에서는 목록 가상 스크롤을 추가하지 않는다.
- RPC 응답은 원본 리뷰 수가 아니라 산별 최대 100행 수준이어야 한다.

캐시 테스트:

- 필터를 여러 번 열고 적용해도 RPC 호출 수는 증가하지 않는다.
- 정렬 변경은 RPC 호출과 지도 overlay 재생성을 유발하지 않는다.
- 오류 재시도는 RPC 호출을 정확히 한 번 추가한다.
- 한줄평 변경 후 지도 복귀는 한 번만 갱신한다.
- 갱신 중에도 D10의 최신 요청 우선 규칙을 유지한다.

### 4.5 승인된 집계 성능 전환 기준

엔지니어링 검토 D13에서 리뷰 수가 많다는 이유만으로 별도 요약 테이블을 미리 만들지 않기로 승인했다.

현재 원칙:

- RPC는 일부 리뷰를 샘플링하지 않고 유효한 전체 리뷰를 정확하게 집계한다.
- 원본 리뷰가 1만 건 수준이어도 우선 동일한 실시간 `GROUP BY` 집계를 사용한다.
- 별도 요약 테이블, 집계 trigger, background job과 새 난이도 전용 인덱스는 1차 범위에 추가하지 않는다.
- 앱은 D12의 캐시 정책에 따라 RPC를 최초 1회만 호출하므로 필터 조작 횟수가 DB 집계 횟수를 늘리지 않는다.

전환 검토 조건:

- 운영 환경에서 RPC p95 응답 시간이 지속적으로 약 500ms를 넘는다.
- 데이터베이스 모니터링에서 난이도 집계가 눈에 띄는 CPU·I/O 부하의 원인으로 확인된다.
- `EXPLAIN ANALYZE` 결과 전체 스캔과 집계 비용이 사용자 체감 지연의 주된 원인으로 확인된다.

500ms는 즉시 구조를 바꾸는 절대 제한이 아니라 성능 조사를 시작하는 운영 신호다. 일시적인 네트워크 지연 한 번으로 전환하지 않는다.

전환이 필요할 때의 별도 설계 범위:

```text
mountain_difficulty_summaries
  mountain_id
  review_count
  score_sum 또는 average_score
  updated_at
```

- 리뷰 작성·수정·삭제와 요약 갱신의 원자성을 설계한다.
- 기존 전체 집계와 요약 테이블 결과를 대조하는 마이그레이션 검증을 수행한다.
- 프론트의 `MountainDifficultySummary` 계약은 가능하면 유지해 저장 방식 변경이 UI에 전파되지 않게 한다.
- 이 전환은 현재 기능 구현에 섞지 않고 별도 계획·마이그레이션·성능 검증 작업으로 진행한다.

## 5. 필터와 랜덤 추천의 정보 구조

지도 위에는 여러 개의 필터를 직접 나열하지 않는다. `산 찾기` 진입 버튼과 적용 조건 요약만 둔다.

```text
지도 상단
[산 찾기] [강원 · 미등정] [초기화]

산 찾기
├─ 지역
├─ 체감 난이도
└─ 등정 상태

결과 목록
├─ 결과 개수와 정렬
├─ [이 결과 N개 중 랜덤 추천]
├─ 산 목록
└─ 산 선택 → 상세정보
```

기존 랜덤의 `전체`, `미등정`, `직접 선택` 모드는 새 탐색 구조와 중복되므로 독립 모드로 유지하지 않는다.

- 전체와 미등정은 공통 등정 필터를 사용한다.
- 랜덤 추천은 결과 목록에서만 시작하며 버튼에 후보 개수를 함께 표시한다.
- 랜덤 추천의 기본 후보군은 현재 필터 결과다.
- 필터가 없으면 현재 필터 결과는 전체 100대 명산이다.
- 후보가 0개면 랜덤 버튼을 비활성화하고 이유를 표시한다.

### 5.1 승인된 반응형 정보 구조

사용자는 디자인 검토 D2에서 화면 크기에 따라 탐색 도구의 위치를 달리하는 혼합안을 선택했다.

데스크톱 흐름:

`지도 → 산 찾기 버튼·적용 조건 칩 → 지도 위 필터 패널 → 조건 적용 → 우측 결과 aside → 선택한 산 상세`

- 필터를 조정하는 동안에는 지도의 가로 폭을 유지한다.
- 필터 패널은 마커, 확대·축소 컨트롤 등 핵심 지도 조작을 가리지 않는 위치에 띄운다.
- `결과 N개 보기`를 누르면 패널을 닫고 기존 360px 우측 aside에 결과 목록을 연다.
- 목록이나 지도 마커에서 산을 선택하면 같은 aside가 상세 화면으로 전환된다.

모바일 흐름:

`지도 → 산 찾기·적용 조건 수 → 필터 bottomSheet → 결과 N개 보기 → 결과 bottomSheet → 선택한 산 상세`

- 지도에는 탐색 진입점과 적용 조건 수만 간결하게 노출한다.
- 필터, 결과, 상세 bottomSheet를 동시에 띄우지 않고 하나의 시트가 단계별 콘텐츠를 전환한다.
- 필터 시트의 초기 높이는 화면의 약 70~80%로 두고 내부 내용을 세로 스크롤한다.
- 시트를 닫아도 마지막으로 적용한 조건은 유지한다.

공통 규칙:

- 지도에는 적용된 조건을 짧은 칩과 초기화 동작으로 요약한다.
- 조건 칩을 누르면 해당 조건을 바로 수정할 수 있도록 필터 화면을 다시 연다.
- 결과에서 상세로 이동했다가 돌아오면 필터, 정렬, 목록 스크롤 위치를 복원한다.
- 편집 중 조건인 `draftFilters`와 실제 지도·목록에 반영된 `appliedFilters`를 분리한다.

### 5.2 승인된 필터 적용 계약

사용자는 디자인 검토 D4에서 명시적 적용 방식을 선택했다.

- 필터를 열면 `draftFilters`를 현재 `appliedFilters`의 복사본으로 초기화한다.
- 사용자가 조건을 편집하는 동안 지도 마커와 결과 목록은 바꾸지 않고 예상 결과 개수만 갱신한다.
- `결과 N개 보기`를 누르면 `draftFilters`를 `appliedFilters`로 확정하고 결과 목록을 연다.
- 적용하지 않고 닫기, 바깥 영역 누르기 또는 뒤로 가기를 수행하면 `draftFilters`를 버린다.
- 다시 필터를 열면 마지막으로 적용된 조건부터 편집을 시작한다.
- 적용 버튼은 최소 44px 높이를 유지하고 현재 예상 결과 수를 버튼 문구에 포함한다.

### 5.3 승인된 빈 결과 상태

사용자는 디자인 검토 D5에서 결과 0개를 적용 가능한 정상 상태로 보여주는 안을 선택했다.

- 적용한 조건은 그대로 유지하고 결과 영역에 `조건에 맞는 산이 없어요`를 표시한다.
- 빈 상태의 주요 행동은 `필터 수정`, 보조 행동은 `전체 초기화`로 둔다.
- 지도에는 결과 마커를 표시하지 않되 적용 조건 칩은 유지한다.
- 랜덤 추천 버튼은 비활성화하고 `추천할 산이 없어요`라는 이유를 함께 표시한다.
- 조건을 자동으로 완화하거나 사용자의 선택을 임의로 되돌리지 않는다.
- 빈 상태에서도 필터 패널 또는 bottomSheet로 돌아갈 수 있는 명확한 포커스 경로를 제공한다.

### 5.4 승인된 난이도 데이터 없음 상태

사용자는 디자인 검토 D6에서 한줄평이 없는 산의 난이도를 추정하지 않는 안을 선택했다.

- 한줄평이 없는 산은 목록과 상세에서 `등산객 체감 난이도 · 평가 전`으로 표시한다.
- 전체 결과에는 평가 전 산을 포함한다.
- 쉬움, 보통, 약간 어려움, 어려움, 매우 어려움 중 특정 난이도를 적용하면 평가 전 산은 제외한다.
- 고도, 코스 시간 또는 임의의 중간값으로 체감 난이도를 대신 만들지 않는다.
- 상세 화면에서는 `첫 난이도 평가를 남겨주세요`라는 참여 행동을 제공할 수 있다.
- 리뷰 조회 실패는 `평가 전`으로 표시하지 않고 별도의 오류 상태로 처리한다.

### 5.5 승인된 필터 적용 후 지도 카메라

사용자는 디자인 검토 D8에서 필터 적용 후 결과 마커 전체가 보이도록 지도 범위를 자동 조정하는 안을 선택했다.

- 지도 카메라는 `결과 N개 보기`로 필터를 확정한 순간에만 자동으로 움직인다.
- 결과가 여러 개면 모든 결과 마커가 보이는 경계에 맞춘다.
- 결과가 한 개면 해당 마커를 중심에 두되 과도하게 확대되지 않도록 최대 확대 수준을 제한한다.
- 데스크톱 우측 aside와 모바일 bottomSheet가 지도 결과를 가리지 않도록 가시 영역에 맞는 padding을 적용한다.
- 결과가 0개면 기존 지도 위치와 확대 수준을 유지한다.
- 정렬 변경은 결과 집합을 바꾸지 않으므로 지도 카메라를 움직이지 않는다.
- 사용자의 모션 감소 설정이 켜져 있으면 즉시 이동하고, 그렇지 않으면 짧은 지도 전환을 사용한다.

엔지니어링 검토 D7에서는 결과 배열 변경 자체가 아니라 사용자 명령을 기준으로 카메라 효과를 실행하도록 계약을 구체화했다.

```ts
type DiscoveryState = {
  // 기존 탐색 상태
  appliedRevision: number;
};

type MountainMapProps = {
  mountains: Mountain[];
  fitResultsRevision: number;
  focusedMountainId?: string;
  // 기존 지도 props
};
```

- `APPLY_FILTERS` action은 필터 값이 이전과 같더라도 `appliedRevision`을 증가시킨다. 사용자가 같은 조건으로 다시 `결과 N개 보기`를 눌러도 결과 전체 보기 명령을 다시 실행할 수 있다.
- `MountainMap`의 결과 경계 effect는 `fitResultsRevision`이 변경될 때만 실행한다. `mountains` 배열 참조 변경, 난이도 재조회, 로그인 상태 갱신 또는 정렬 변경만으로는 실행하지 않는다.
- 결과가 2개 이상이면 모든 결과 좌표로 bounds를 만들고 현재 데스크톱 aside 또는 모바일 bottomSheet 가시 영역에 맞는 padding과 함께 `setBounds`를 호출한다.
- 결과가 1개면 해당 위치를 중심으로 이동하되 최대 확대 한계를 적용한다.
- 결과가 0개면 지도 중심과 확대 수준을 그대로 유지한다.
- 지도 레이아웃 변경 시 `relayout()`만 실행하며, 기존처럼 레이아웃 effect에서 선택한 산으로 다시 중심을 맞추지 않는다.

### 5.6 승인된 산 선택과 지도 동기화

사용자는 디자인 검토 D9에서 상세정보와 선택한 지도 마커를 필요한 범위에서만 동기화하는 안을 선택했다.

- 결과 카드 또는 지도 마커를 선택하면 기존 패널이 해당 산의 상세정보로 전환된다.
- 선택한 산의 마커는 `DESIGN.md`의 선택 상태 언어에 맞춰 다른 결과 마커보다 분명하게 강조한다.
- 선택 전의 지도 확대 수준은 유지한다.
- 선택한 마커가 화면 밖이거나 aside·bottomSheet에 가려질 때만 가시 영역 안으로 최소 이동한다.
- 상세에서 뒤로 가면 결과 목록, 정렬, 필터와 목록 스크롤 위치를 복원한다.
- 결과로 돌아갈 때 지도 카메라는 다시 전체 경계로 맞추지 않고 현재 위치를 유지하며 선택 강조를 해제한다.
- 여러 산을 연속해서 확인해도 매번 확대·축소가 발생하지 않아야 한다.

산 하나를 선택했을 때의 엔지니어링 계약:

- 선택한 마커 좌표가 현재 지도 bounds와 패널을 제외한 가시 영역 안에 있으면 카메라를 움직이지 않는다.
- 화면 밖이거나 패널에 가려진 경우에만 `panTo`로 최소 이동한다.
- `panTo` 전후에 `getLevel()`과 `setLevel()`을 반복 호출하지 않는다. `panTo`가 현재 확대 수준을 유지하는 동작을 사용한다.
- 같은 산의 상세를 다시 렌더링하거나 상세에서 목록으로 돌아오는 것만으로 `panTo`를 재실행하지 않는다.
- 모션 감소 설정에서는 애니메이션 이동 대신 즉시 중심 이동을 사용한다.

지도 명령 회귀 테스트:

- `fitResultsRevision` 증가 시에만 결과 전체 경계가 적용된다.
- 정렬 변경과 동일 데이터 재렌더링은 `setBounds`를 호출하지 않는다.
- 0개 결과는 기존 카메라를 유지한다.
- 화면 안의 산 선택은 `panTo`를 호출하지 않는다.
- 화면 밖의 산 선택은 한 번만 `panTo`를 호출하고 지도 level은 유지한다.
- `relayout()`은 카메라를 선택 산으로 재설정하지 않는다.

### 5.7 승인된 반응형 포커스와 닫기 동작

사용자는 디자인 검토 D10에서 데스크톱과 모바일의 조작 맥락에 맞춰 modal 여부를 다르게 적용하는 안을 선택했다.

데스크톱 필터 패널:

- 지도와 함께 사용할 수 있는 non-modal popover로 동작한다.
- 열릴 때 패널 제목 또는 첫 번째 필터 컨트롤로 포커스를 이동한다.
- `Esc` 또는 바깥 영역 누르기로 닫으면 적용 전 편집을 취소한다.
- 닫힌 뒤 포커스를 원래의 `산 찾기` 버튼으로 반환한다.

모바일 bottomSheet:

- 열려 있는 동안 배경 지도와 다른 컨트롤을 비활성화하는 modal로 동작한다.
- 키보드와 스크린리더 포커스를 시트 안에 유지한다.
- 시스템 뒤로 가기, `Esc` 또는 명시적인 닫기 동작으로 닫으면 적용 전 편집을 취소한다.
- 닫힌 뒤 포커스를 원래의 `산 찾기` 버튼으로 반환한다.

공통으로 닫기 버튼은 접근 가능한 이름을 가지며 키보드만으로 모든 필터와 적용 행동에 도달할 수 있어야 한다.

### 5.8 승인된 랜덤 추천 후보군

사용자는 디자인 검토 D11에서 후보 직접 선택 기능을 1차 범위에서 제거하는 안을 선택했다.

- 랜덤 추천의 후보군은 현재 `appliedFilters`로 계산된 결과 전체다.
- 결과 목록의 `이 결과 N개 중 랜덤 추천`을 누르면 별도의 후보 선택 없이 추천을 시작한다.
- 기존 랜덤 추천의 `전체`와 `미등정` 구분은 공통 등정 상태 필터가 대신한다.
- 후보가 0개면 추천을 실행하지 않고 승인된 빈 결과 안내를 사용한다.
- 직접 후보 선택은 실제 사용자 요구가 확인된 뒤 2차 범위에서 재검토한다.

### 5.9 승인된 결과 목록 시각 구조

사용자는 디자인 검토 D12에서 결과를 구분선 중심의 간결한 목록 행으로 표시하는 안을 선택했다.

- aside와 bottomSheet 안에 하나의 연속된 목록을 두고 결과마다 별도의 둥근 카드나 그림자를 반복하지 않는다.
- 각 행은 56~64px 산 이미지, 산 이름, 고도, 지역, 등산객 체감 난이도, 등정 상태로 구성한다.
- 산 이름과 고도를 주요 정보로, 지역·난이도·등정 상태를 보조 정보로 표현한다.
- 행 사이에는 `--border` 기반의 얇은 구분선을 사용하고 hover, focus, selected 상태는 배경색과 명확한 포커스 링으로 구분한다.
- 행 전체를 선택 영역으로 만들고 최소 44px 터치 영역과 16px 이상 본문 기준을 지킨다.
- 이미지가 없어도 행 높이와 정보 정렬이 흔들리지 않도록 지정된 fallback을 사용한다.
- 모바일에서도 한 행의 정보를 가로 스크롤 없이 읽을 수 있도록 보조 정보의 우선순위를 유지하고 필요하면 두 줄로 배치한다.

### 5.10 승인된 로그아웃 등정 필터

사용자는 디자인 검토 D13에서 로그아웃 상태에도 등정 필터의 존재와 비활성화 이유를 보여주는 안을 선택했다.

- 로그아웃 상태의 등정 필터 값은 `전체`로 고정한다.
- `등정 완료`와 `미등정`은 비활성화하고 `로그인 필요` 상태를 함께 표시한다.
- `로그인하면 내 등정 기록으로 산을 찾을 수 있어요`라는 설명과 로그인 행동을 제공한다.
- 로그아웃 사용자를 모두 미등정으로 간주하거나 결과 행에 잘못된 미등정 상태를 표시하지 않는다.
- 로그인에 성공하면 현재 지역·난이도 조건을 유지한 채 등정 필터를 사용할 수 있게 한다.
- 비활성 컨트롤만으로 이유를 전달하지 않고 주변 설명을 스크린리더도 읽을 수 있게 연결한다.

### 5.11 승인된 난이도 조회 오류 복구

사용자는 디자인 검토 D14에서 난이도 집계 조회가 실패해도 다른 산 찾기 기능을 유지하는 안을 선택했다.

- 난이도 집계 조회 실패를 `평가 전`으로 변환하지 않는다.
- 난이도 필터만 비활성화하고 `난이도 정보를 불러오지 못했어요`와 `다시 시도` 행동을 표시한다.
- 지역·등정 필터, 정렬, 지도와 결과 목록은 계속 사용할 수 있다.
- 오류 전에 특정 난이도가 적용돼 있었다면 해당 조건을 안전하게 해제하고 사용자가 인지할 수 있게 알린다.
- 결과 행의 난이도 영역은 `정보를 불러오지 못함`으로 표시하며 실제 평가가 없는 것처럼 보이지 않게 한다.
- 재시도가 성공하면 현재 지역·등정 조건과 정렬을 유지한 채 난이도 선택을 다시 활성화한다.

### 5.12 1단계 디자인 검토 완료 요약

| 검토 패스 | 초기 | 최종 | 반영한 핵심 결정 |
| --- | ---: | ---: | --- |
| 정보 구조 | 6/10 | 9/10 | 반응형 혼합안, 결과 목록 기반 랜덤 추천 |
| 상태 설계 | 6/10 | 9/10 | 명시적 적용, 빈 결과, 평가 전, 난이도 오류 |
| 사용자 여정 | 7/10 | 9/10 | 결과·상세 왕복, 지도 카메라와 선택 동기화 |
| AI slop 방지 | 6/10 | 9/10 | 반복 카드 대신 구분선형 결과 목록 |
| 디자인 시스템 | 8/10 | 9/10 | `DESIGN.md` 토큰, SUIT, 터치·본문 기준 재사용 |
| 반응형·접근성 | 6/10 | 9/10 | desktop non-modal, mobile modal, 포커스 복귀 |
| 미해결 결정 | 13건 대상 | 13건 해결 | D2~D14 승인, 미응답 결정 없음 |
| 전체 | 7/10 | 9/10 | 구현 가능한 디자인 계획으로 확정 |

#### What already exists

- `DESIGN.md`의 색상, 타이포그래피, 카드·마커 언어와 반응형 원칙을 재사용한다.
- 기존 360px 데스크톱 aside와 모바일 bottomSheet를 결과·상세 컨테이너로 재사용한다.
- 기존 지도 마커 선택, 산 상세정보, 랜덤 추천 로직을 새 탐색 상태에 통합한다.

#### Review artifacts

- NOT in scope: 9개 항목을 2장에 기록했다.
- TODOS.md updates: 제안할 미해결 디자인 부채가 없어 0개다.
- Approved mockups: gstack designer binary를 사용할 수 없어 0개다.
- Decisions made: D2~D14의 13개 결정을 계획에 반영했다.
- Unresolved decisions: 없음.

### 5.13 2단계 엔지니어링 검토 완료 요약

| 검토 섹션 | 발견한 결정·문제 | 확정 결과 |
| --- | ---: | --- |
| Step 0 범위 | 1 | 전체 수직 기능 범위 유지, 새 모듈 최대 2개 |
| 아키텍처 | 6 | RPC 집계, reducer 소유권, 9개 권역, 난이도 계약·반올림, 지도 명령 |
| 코드 품질 | 3 | 파일 책임 분리, 배타적 비동기 상태, 최신 요청 우선 |
| 테스트 | 1 | 자동 테스트와 운영 Supabase 검증 경계 확정 |
| 성능 | 2 | 최초 1회 캐시, 실측 후 요약 테이블 전환 |
| 전체 | 13 | D1~D13 승인, 미해결 결정 0개 |

완성도 원칙:

- Step 0: 전체 범위를 그대로 승인했다.
- Lake Score: 13/13 결정에서 축약 구현보다 완전한 데이터·오류·테스트 계약을 선택했다.
- NOT in scope: 2장의 9개 항목으로 기록했다.
- What already exists: React `useReducer`, Supabase RPC, Kakao `setBounds`·`panTo`, 기존 aside·bottomSheet·랜덤 로직을 재사용한다.
- TODOS.md: 파일이 없고 새 TODO 제안도 0개다.
- Outside voice: 실행하지 않았다.

최종 데이터 흐름:

```text
앱 진입
  ├─ 세션·등정 기록 조회
  └─ 난이도 요약 RPC 1회
       └─ mountain_reviews 전체 유효 행 GROUP BY mountain_id
            └─ 산별 averageScore + reviewCount 최대 100행

Mountain[] + difficulty summaries + completedIds
  └─ filterMountains(appliedFilters)
       └─ sortMountains(sort)
            └─ resultMountains 단일 파생 값
                 ├─ MountainDiscoveryPanel 결과 목록
                 ├─ MountainMap 마커
                 └─ 랜덤 추천 후보군
```

테스트 흐름:

```text
데이터 계약
  -> 도메인 순수 함수·reducer
       -> 서비스 mock 계약
            -> 패널·App 통합
                 -> Kakao 명령 mock
                      -> 브라우저 QA
                           -> 운영 Supabase 수동 SQL 검증
```

실패 모드와 복구:

| 실패 모드 | 차단·복구 계약 |
| --- | --- |
| 잘못된 난이도 문자열 | 운영 데이터 감사 후 수정, DB `CHECK`, 프론트 런타임 검증 |
| 난이도 RPC 실패 | 난이도 필터만 비활성화하고 재시도, 평가 전으로 위장하지 않음 |
| 이전 요청이 늦게 도착 | request id가 최신 응답만 상태에 반영 |
| 결과 0개 | 조건 유지, 지도 카메라 유지, 필터 수정·초기화 제공 |
| 로그아웃 등정 필터 | 전체로 고정하고 완료·미등정은 로그인 필요로 비활성화 |
| 랜덤 실행 중 필터 변경 | 타이머 취소, 새 `resultMountains` 밖 후보 제거 |
| 지도 overlay 잔존 | 결과 변경·unmount에서 기존 overlay 제거 |
| 불필요한 지도 이동 | `appliedRevision`과 조건부 `panTo` 외 카메라 effect 금지 |
| SQL 권한 오류 | `public` 회수, `anon`·`authenticated` grant 수동 검증 |
| 대규모 집계 지연 | p95·DB 부하와 `EXPLAIN ANALYZE` 확인 후 별도 요약 테이블 설계 |

위 실패 모드 중 계획에 해결책이 없는 critical gap은 0개다.

구현 병렬화:

```text
Lane 1 — 순차 기반
  types + 지역 데이터 + SQL/RPC + 리뷰 서비스
       ↓
Lane 2A — 병렬
  mountainDiscovery 도메인 + 단위 테스트

Lane 2B — 병렬
  MountainDiscoveryPanel 골격 + 접근성 테스트

Lane 2C — 병렬
  MountainMap 카메라 명령 + random 회귀 테스트
       ↓
Lane 3 — 순차 통합
  App reducer·비동기 조회·단일 resultMountains 연결
       ↓
Lane 4 — 순차 검증
  lint + test + build + QA + design review
```

- 총 6개 작업 lane 중 기반·통합·검증 3개는 순차, 도메인·패널·지도 3개는 계약이 준비된 뒤 병렬 진행할 수 있다.
- 병렬 lane은 `App.tsx`를 수정하지 않는다. 통합 lane만 `App.tsx`를 변경해 충돌을 피한다.
- Lane 2A와 2B는 공용 타입 파일을 동시에 수정하지 않는다. 필요한 타입 변경은 Lane 1에서 먼저 끝낸다.
- Lane 2C의 `MountainMap.tsx`와 기존 지도 테스트는 독립적이지만, 최종 prop 이름은 Lane 1·2A 계약에 맞춘다.

엔지니어링 검토 결론:

- Architecture issues: 6개 발견·해결
- Code quality issues: 3개 발견·해결
- Test gaps: 1개 발견·해결
- Performance issues: 2개 발견·해결
- Critical gaps: 0개
- Unresolved decisions: 0개
- Verdict: ENG CLEARED — 3단계 데이터 기반 구현을 시작할 수 있다.

## 6. 전체 실행 순서

| 단계 | 목적 | 기본 도구 또는 스킬 | 산출물 | 다음 단계 조건 |
| --- | --- | --- | --- | --- |
| 0 | 현재 작업 상태 보존 | `git status`, 필요 시 `$context-save` | 안전한 시작점 | 작업 범위가 명확함 |
| 1 | 상호작용과 반응형 UX 확정 | `$plan-design-review` | 승인된 디자인 계획 | 필터·결과·상세·랜덤 흐름 확정 |
| 2 | 데이터와 상태 구조 확정 | `$plan-eng-review` | 승인된 엔지니어링 계획 | 집계·상태·테스트 규칙 확정 |
| 3 | 데이터 기반 구현 | 일반 Codex 구현 | 정규화 데이터와 집계 서비스 | 단위 테스트 통과 |
| 4 | 순수 필터·정렬 로직 구현 | 일반 Codex 구현 | 재사용 가능한 도메인 함수 | 필터 행렬 테스트 통과 |
| 5 | 결과 목록과 패널 상태 구현 | 일반 Codex 구현 | 데스크톱 aside와 모바일 시트 | 컴포넌트 테스트 통과 |
| 6 | 지도와 랜덤 추천 연결 | 일반 Codex 구현 | 동기화된 마커와 후보군 | 통합 테스트 통과 |
| 7 | 코드 품질 점검 | `$health` | 품질 점수와 실패 목록 | 필수 검사 통과 |
| 8 | 실제 사용자 흐름 검증·수정 | `$qa` | QA 보고와 수정된 버그 | 핵심 흐름 재검증 통과 |
| 9 | 시각·반응형 마감 | `$design-review` | 디자인 수정과 전후 검증 | `DESIGN.md` 위반 없음 |
| 10 | 병합 전 코드 검토 | `$review` | 심각도별 리뷰 결과 | high/medium 문제 해결 |
| 11 | PR 준비 | `$ship` | 커밋, 푸시, PR | CI 통과 |
| 12 | 배포가 요청된 경우만 배포 | `$land-and-deploy` | 병합, 배포, 운영 확인 | 프로덕션 정상 |

## 7. 단계별 진행 방법

### 단계 0. 시작 상태 확인

1. `git status --short`로 기존 변경을 확인한다.
2. 기존 변경은 사용자 작업으로 간주하고 덮어쓰지 않는다.
3. 여러 세션에 걸쳐 진행한다면 시작 전 또는 논리적 구간 종료 후 `$context-save`를 사용한다.
4. 이 문서에 없는 기능은 구현 중 임의로 추가하지 않는다.

완료 기준:

- 현재 브랜치와 변경 파일을 알고 있다.
- 구현 범위 밖의 파일을 식별했다.
- 중단 후 복구가 필요한 경우 컨텍스트를 저장했다.

### 단계 1. 디자인 계획 검토

사용 스킬: `$plan-design-review`

검토할 결정:

- 데스크톱 필터가 지도 위 플로팅 패널인지 기존 `aside`의 한 상태인지
- 모바일 필터 시트와 결과 시트의 높이·전환 방식
- `결과 -> 상세 -> 결과`의 뒤로가기와 스크롤 복원
- 적용 조건 칩의 위치와 긴 조건의 줄바꿈
- 결과 0개, 평가 없음, 난이도 조회 오류 상태
- 필터 적용 후 지도 카메라가 결과 전체에 맞춰지는지
- 랜덤 추천을 탭, 메뉴, 결과 하단 행동 중 어디에 노출할지
- 44px 터치 영역, 16px 이상 본문, 가로 스크롤 금지 준수

권장 호출문:

```text
[$plan-design-review]
docs/mountain-discovery-implementation-workflow.md의 산 찾기 기능을 검토해줘.
DESIGN.md를 기준으로 지도 위 산 찾기 진입, 데스크톱 aside, 모바일 bottomSheet,
필터 결과 목록, 산 상세 전환, 랜덤 추천의 정보 구조를 확정해줘.
구현은 하지 말고 각 화면 상태와 전환, 빈 상태, 오류 상태, 반응형 규칙을 계획에 반영해줘.
```

완료 기준:

- 화면 상태별 와이어 수준 구조가 정해졌다.
- 데스크톱과 모바일 전환 규칙이 정해졌다.
- 필터와 랜덤 추천의 진입점이 하나로 정리됐다.
- 미정인 시각 결정이 구현자에게 남아 있지 않다.

선택 사항: 서로 다른 시각안 비교가 실제로 필요하다고 판정된 경우에만 `$design-shotgun`을 사용한다. 방향이 이미 확정됐다면 생략한다.

### 단계 2. 엔지니어링 계획 검토

사용 스킬: `$plan-eng-review`

#### 승인 결정

- D1: 1차 범위를 유지한다. 지역·체감 난이도·등정 필터와 정렬, 결과 목록, 지도·랜덤 동기화를 한 수직 기능으로 완성한다.
- D2: 별도 요약 테이블 없이 Postgres RPC가 전체 리뷰를 산별로 집계하고 프론트에는 산별 평균 점수와 평가 인원만 반환한다.
- D3: `App`의 단일 `useReducer`가 탐색 상태를 소유한다. 패널·지도·랜덤은 같은 파생 결과와 action을 사용한다.
- D4: 지역 필터는 산림청 100대 명산과 같은 9개 권역을 사용한다. 각 산은 `regionCodes: MountainRegionCode[]`로 하나 이상의 권역을 명시해 경계 산을 양쪽 검색 결과에 포함한다.
- D5: 리뷰 난이도는 기존 데이터를 먼저 감사·정리한 후 DB `CHECK`와 TypeScript `MountainReviewDifficulty`로 `쉬움`, `보통`, `약간 어려움`, `어려움`, `매우 어려움`만 허용한다.
- D6: 산별 원본 평균은 보존하고 `Math.round`와 동일한 경계로 가장 가까운 1~5 단계에 매핑한다. 정확히 `.5`인 값은 높은 단계에 포함한다.
- D7: 필터 적용 시 증가하는 `appliedRevision`으로만 결과 전체 `setBounds`를 실행한다. 산 선택은 화면 밖이거나 패널에 가려졌을 때만 현재 줌을 유지하는 `panTo`를 실행한다.
- D8: 새 모듈은 `src/domain/mountainDiscovery.ts`와 `src/components/MountainDiscoveryPanel.tsx` 두 개로 제한한다. `App.tsx`는 데이터와 화면을 연결하는 조정자, `MountainDetailPage.tsx`는 상세·한줄평 역할만 유지한다.
- D9: 난이도 요약은 `idle | loading | ready | error` discriminated union으로 관리한다. `ready`에서만 데이터를 사용하며 loading·error를 빈 데이터나 평가 전으로 해석하지 않는다.
- D10: 난이도 요약 요청마다 증가하는 request id를 `useRef`에 저장하고 최신 요청만 상태를 변경한다. effect cleanup은 id를 증가시켜 unmount 후 응답을 무효화한다.
- D11: 자동 테스트는 도메인·서비스·컴포넌트 통합·지도 명령 계층으로 나누고, 실제 Supabase의 데이터 감사·제약·RPC·권한은 수동 SQL 검증 체크리스트로 분리한다.
- D12: 난이도 요약 RPC는 앱 진입 시 다른 초기 데이터와 병렬로 1회 호출해 메모리에 유지한다. 필터 열기·닫기·적용·정렬에서는 다시 조회하지 않고, 명시적 재시도와 한줄평 변경 후 지도 복귀에서만 갱신한다.
- D13: 리뷰 수만으로 요약 테이블을 미리 도입하지 않는다. 전체 리뷰를 정확히 집계하는 RPC를 유지하고 p95 응답 지연이 지속적으로 약 500ms를 넘거나 DB 부하가 확인될 때 `EXPLAIN ANALYZE` 후 요약 테이블 전환을 별도 과제로 검토한다.
- 새 모듈은 도메인 로직과 탐색 UI처럼 책임이 분명한 최대 2개로 제한한다.
- React `useReducer`, Supabase Data API·RPC, Kakao Maps의 `setBounds`·padding을 재사용하고 새 상태 라이브러리, Edge Function, 별도 지도 계산 계층은 추가하지 않는다.
- 구현은 데이터→순수 도메인→UI 상태→지도·랜덤 통합 순서로 진행해 구조 변경과 행동 변경을 한 번에 섞지 않는다.

검토할 결정:

- `Mountain`의 복수 지역 코드 모델과 데이터 마이그레이션
- 리뷰 난이도 일괄 조회와 평균 계산 경계
- 리뷰 없음, 로딩, 조회 오류의 구분
- `draftFilters`와 `appliedFilters` 상태 전이
- 기존 `selectedMountainId`, 모바일 시트, 랜덤 상태 통합
- 로그아웃 상태의 등정 필터
- 결과 목록 스크롤 복원
- 랜덤 후보군과 필터 결과의 관계
- 지도 마커 갱신과 카메라 이동
- 테스트 파일과 회귀 범위

권장 호출문:

```text
[$plan-eng-review]
docs/mountain-discovery-implementation-workflow.md와 현재 App.tsx, MountainMap.tsx,
mountainReviews.ts, game/random.ts 구조를 기준으로 엔지니어링 계획을 검토해줘.
산 100개 리뷰의 개별 조회를 금지하고, 일괄 난이도 집계, 필터·정렬 순수 로직,
패널 상태 머신, 지도·랜덤 동기화와 테스트 계획을 확정해줘.
구현은 하지 말고 파일별 변경 계획과 데이터 흐름, 실패 경로를 문서에 반영해줘.
```

완료 기준:

- 데이터 흐름과 상태 소유자가 하나로 정해졌다.
- 모든 로딩·빈 값·오류 경로의 사용자 표시가 정해졌다.
- 파일별 변경 범위와 테스트 위치가 정해졌다.
- 구현 중 새 아키텍처 결정을 내릴 필요가 없다.

### 단계 3. 데이터 기반 구현

일반 Codex 구현 단계다. 별도의 gstack 스킬을 먼저 호출하지 않는다.

권장 작업 순서:

1. 지역 코드 타입과 산별 복수 지역 데이터를 추가한다.
2. 리뷰 난이도 일괄 조회 서비스를 추가한다.
3. 난이도 평균 계산을 순수 함수로 구현한다.
4. 누락된 지역·난이도 메타데이터를 감사하는 테스트 또는 스크립트를 추가한다.

예상 변경 영역은 `plan-eng-review` 결과를 우선하며, 기본 후보는 다음과 같다.

- `src/types.ts`
- `src/data/mountains.ts`
- `src/services/mountainReviews.ts`
- 새 도메인 테스트 파일

완료 기준:

- 산 100개당 100번의 리뷰 요청이 발생하지 않는다.
- 리뷰 없음과 조회 실패가 다른 상태다.
- 복수 지역 산이 각 해당 지역 결과에 나타난다.

### 단계 4. 필터와 정렬 도메인 로직 구현

UI와 분리된 순수 함수를 먼저 만든다.

```text
mountains
  + province metadata
  + difficulty summaries
  + completedIds
  -> filterMountains
  -> sortMountains
  -> result mountains
```

필수 테스트:

- 전국과 단일 지역
- 두 지역에 걸친 산
- 난이도 각 단계와 평가 없음
- 리뷰 조회 오류 시 잘못된 평가 없음 처리 금지
- 전체, 완료, 미등정
- 로그아웃 상태
- 가나다, 고도 오름차순, 고도 내림차순과 동률
- 여러 조건의 AND 결합
- 결과 0개와 전체 100개

완료 기준:

- 필터와 정렬 함수가 React와 Supabase에 의존하지 않는다.
- 같은 입력은 같은 결과를 반환한다.
- 모든 정책 경계가 단위 테스트로 고정됐다.

### 4단계까지의 승인된 자동 테스트 배치

엔지니어링 검토 D11에서 테스트를 다음 계층으로 나누기로 승인했다.

| 계층 | 기본 테스트 위치 | 핵심 검증 |
| --- | --- | --- |
| 데이터·도메인 | `src/domain/mountainDiscovery.test.ts` | 지역, 난이도 경계, 필터 AND, 정렬, reducer |
| 리뷰 서비스 | `src/services/mountainReviews.test.ts` | RPC 성공·빈 응답·오류·잘못된 행 계약 |
| 탐색 컴포넌트 | `src/components/MountainDiscoveryPanel.test.tsx` | 필터 편집·적용, 결과·빈 상태, 접근성 |
| 앱 통합 | 기존 `src/App.test.tsx` | 비동기 상태, 상세 왕복, 재시도, 랜덤 후보 |
| 지도 | 기존 `src/components/MountainMap.test.tsx` | setBounds·panTo 명령과 overlay 정리 |
| 랜덤 | 기존 `src/game/random.test.ts` | 현재 필터 결과 밖의 산이 후보가 되지 않음 |

필수 자동 테스트 범위:

- 산 100개 모두 하나 이상의 허용된 지역 코드를 가진다.
- 대표 복수 권역 산이 각 해당 지역 결과에 포함된다.
- 난이도 평균의 모든 경계값과 잘못된 숫자 응답을 검증한다.
- `draftFilters` 닫기 취소와 `APPLY_FILTERS` 확정을 구분한다.
- 지역·난이도·등정 필터의 AND 결합과 결과 0개를 검증한다.
- 가나다·고도 오름차순·내림차순과 동률 정렬을 검증한다.
- 난이도 loading·error가 평가 전으로 표시되지 않는다.
- 오래된 비동기 응답이 최신 상태를 덮어쓰지 않는다.
- 결과→상세→결과에서 필터·정렬·스크롤 위치가 유지된다.
- 랜덤 당첨 산은 현재 `resultMountains` 안에만 존재한다.
- 명시적 적용에서만 `setBounds`, 필요한 산 선택에서만 `panTo`를 실행한다.
- 필터 결과가 바뀔 때 기존 지도 overlay와 랜덤 타이머를 정리한다.

자동 테스트에서 실제 운영 Supabase에 insert·update·DDL을 실행하지 않는다. 저장소에는 로컬 Supabase 테스트 환경이 없으므로 SQL 적용은 다음 수동 검증 체크리스트를 따른다.

Supabase 수동 검증:

1. 잘못된 난이도 값 감사 쿼리 결과가 0행인지 확인한다.
2. `mountain_reviews_difficulty_check` 제약조건을 적용한다.
3. 승인되지 않은 난이도 insert와 update가 거부되는지 확인한다.
4. `get_mountain_difficulty_summaries()` 결과를 직접 `GROUP BY` 집계 결과와 표본 산 및 전체 산 수 기준으로 비교한다.
5. 리뷰가 0개인 산이 RPC 응답에 잘못된 0점 행으로 생성되지 않는지 확인한다.
6. `public` 실행 권한이 회수되고 `anon`, `authenticated` 호출이 가능한지 확인한다.
7. 프론트에서 service role 키를 사용하지 않는지 확인한다.

최종 필수 명령:

```text
npm run lint
npm run test
npm run build
```

세 명령 중 하나라도 실패하면 구현 단계를 완료로 표시하지 않는다.

### 단계 5. 결과 목록과 패널 상태 구현

1. 산 찾기 진입과 필터 편집 UI를 구현한다.
2. `draftFilters`로 예상 결과 개수를 보여준다.
3. 적용 버튼에서 `appliedFilters`를 갱신하고 결과 목록을 연다.
4. 결과 카드 선택 시 기존 상세 UI로 전환한다.
5. 목록 복귀 시 정렬과 스크롤 위치를 복원한다.
6. 데스크톱 `aside`와 모바일 `bottomSheet`가 같은 도메인 상태를 사용하게 한다.

필수 상태:

- 로딩 중
- 결과 있음
- 결과 0개
- 평가 없음
- 난이도 데이터 오류
- 선택한 산 상세
- 목록 복귀
- 필터 초기화

완료 기준:

- 모바일과 데스크톱이 서로 다른 필터 상태를 만들지 않는다.
- 산을 선택했다가 돌아와도 결과와 위치가 유지된다.
- 결과가 한 개여도 자동으로 상세를 열지 않는다.
- 모든 조작 영역이 `DESIGN.md`의 접근성 규칙을 지킨다.

### 단계 6. 지도와 랜덤 추천 연결

1. `MountainMap`에 필터 결과 산만 전달한다.
2. 목록 선택 시 지도 중심과 마커 강조를 동기화한다.
3. 지도 마커 선택 시 결과 패널을 상세 상태로 전환한다.
4. 필터 초기화 시 전체 마커를 복원한다.
5. 랜덤 후보군을 현재 필터 결과로 제한한다.
6. 후보 0개와 랜덤 실행 중 필터 변경을 안전하게 처리한다.

필수 테스트:

- 필터 변경 시 Kakao overlay 정리와 재생성
- 목록 선택과 지도 강조
- 필터 결과 안에서만 랜덤 당첨
- 후보 0개
- 랜덤 실행 중 중복 클릭
- 모바일 상세 시트 전환

완료 기준:

- 지도, 목록, 상세, 랜덤이 같은 결과 집합을 사용한다.
- 숨겨진 산이 랜덤 결과로 나오지 않는다.
- 이전 overlay와 타이머가 남지 않는다.

### 단계 7. 코드 품질 점검

사용 스킬: `$health`

```text
[$health]
산 찾기 필터, 결과 목록, 지도 동기화, 랜덤 추천 통합 구현의 코드 품질을 점검해줘.
타입 검사, 전체 테스트, 빌드, 중복 상태와 사용되지 않는 코드를 확인하고 점수를 보고해줘.
```

기본 검증 명령:

```bash
npm run lint
npm run test
npm run build
```

실패 원인이 명확하지 않으면 추측해서 수정하지 않고 `$investigate`를 사용한다.

```text
[$investigate]
산 찾기 기능 구현 후 발생한 실패를 재현하고 근본 원인을 찾아 수정해줘.
증상, 재현 조건, 원인, 수정, 회귀 테스트를 분리해서 보고해줘.
```

### 단계 8. 브라우저 QA

사용 스킬: `$qa`

`$qa`는 구현이 기능적으로 완성되고 자동 테스트가 통과한 뒤 한 번 집중해서 실행한다.

```text
[$qa]
산 찾기 기능을 데스크톱과 모바일에서 QA하고 발견한 버그를 수정해줘.
지역·난이도·등정 필터, 결과 개수, 정렬, 지도 마커 동기화,
결과 목록과 상세 왕복, 스크롤 복원, 랜덤 추천, 0개 결과와 오류 상태를 검증해줘.
수정 후 같은 흐름을 다시 검증해줘.
```

핵심 시나리오:

1. 지역만 선택한다.
2. 지역과 미등정을 결합한다.
3. 평가 없음 산을 찾는다.
4. 가나다순과 고도순을 전환한다.
5. 목록에서 산을 열고 목록으로 돌아온다.
6. 지도 마커에서 산을 연다.
7. 현재 결과에서 랜덤 추천을 실행한다.
8. 결과 0개를 만든 뒤 조건을 초기화한다.
9. 375px 모바일과 900px 경계 화면을 확인한다.

### 단계 9. 디자인 마감

사용 스킬: `$design-review`

```text
[$design-review]
구현된 산 찾기 기능만 DESIGN.md 기준으로 시각 검토하고 수정해줘.
필터 진입, 적용 조건 칩, 결과 카드, aside, 모바일 bottomSheet,
상세 왕복, 빈 상태의 위계·간격·터치 영역·텍스트 넘침·반응형을 확인해줘.
전체 사이트 재디자인은 범위에 포함하지 마.
```

기능 QA 전에 사용하지 않는다. 동작이 계속 바뀌는 동안 시각 마감을 반복하면 같은 화면을 여러 번 수정하게 된다.

### 단계 10. 병합 전 리뷰

사용 스킬: `$review`

```text
[$review]
산 찾기 기능 diff를 병합 전 리뷰해줘.
리뷰 난이도 일괄 조회, 필터 상태 중복, 지도 overlay 정리,
랜덤 후보 누출, 로그아웃 등정 상태, 누락 테스트와 기존 기능 회귀를 중점적으로 확인해줘.
```

high 또는 medium 문제가 나오면 수정 후 관련 테스트와 `$review`를 다시 실행한다.

### 단계 11. PR 준비

사용 스킬: `$ship`

사용자가 커밋·푸시·PR 생성을 원할 때만 실행한다.

```text
[$ship]
산 찾기 필터, 결과 목록, 지도·랜덤 추천 통합 기능을 ship해줘.
문서에 정한 범위와 테스트 결과를 PR 본문에 포함해줘.
```

배포까지 요청받은 경우에만 PR 이후 `$land-and-deploy`를 사용한다. 단순히 구현이 끝났다는 이유로 자동 배포하지 않는다.

완료 기준:

- 의도한 파일만 커밋됐다.
- PR 본문에 기능 범위, 데이터 정책, 테스트와 QA 결과가 포함됐다.
- 원격 브랜치와 PR 주소를 확인했다.
- 필수 CI가 통과했거나 실패 원인과 재개 조건이 기록됐다.

### 단계 12. 병합·배포·운영 확인

사용 스킬: `$land-and-deploy`

사용자가 실제 병합과 배포를 요청했을 때만 실행한다.

```text
[$land-and-deploy]
산 찾기 기능 PR을 병합하고 배포 완료까지 확인해줘.
배포 후 메인 지도, 산 찾기 진입, 필터 결과, 산 상세 전환,
현재 결과에서 랜덤 추천까지 프로덕션에서 확인해줘.
```

배포 설정이 없다면 먼저 `$setup-deploy`가 필요한지 확인한다. 대상 환경, 프로덕션 URL, 상태 확인 방법이 불명확하면 추측해서 배포하지 않는다.

완료 기준:

- PR이 의도한 기준 브랜치에 병합됐다.
- 배포가 성공했고 프로덕션 URL이 확인됐다.
- 필수 사용자 흐름이 프로덕션에서 정상 동작한다.
- 콘솔 오류, 페이지 실패, 심각한 성능 회귀가 없다.
- 문제가 있으면 롤백 또는 후속 수정 상태가 명확하다.

## 8. 효율적인 스킬 사용 규칙

- 이미 수행한 제품 범위 검토를 반복하기 위해 `$plan-ceo-review`나 `$autoplan`을 다시 실행하지 않는다.
- UX 결정에는 `$plan-design-review`, 코드 구조 결정에는 `$plan-eng-review`를 각각 한 번 집중해서 사용한다.
- 구현 자체는 일반 Codex 작업으로 진행한다. 모든 작은 변경에 스킬을 호출하지 않는다.
- 원인이 불명확한 실패에만 `$investigate`를 사용한다.
- `$qa`는 통합 완료 후, `$design-review`는 기능 QA 후 실행한다.
- `$review`는 diff가 완성되고 검사 명령이 통과한 뒤 실행한다.
- 세션을 끊어야 할 때만 `$context-save`, 다시 시작할 때 `$context-restore`를 사용한다.
- 성능 문제가 실제로 관찰되거나 번들·지도 렌더링 회귀를 측정해야 할 때만 `$benchmark`를 추가한다.
- 배포 후 감시가 필요한 경우에만 `$canary`를 사용한다.

## 9. 중단 기준

다음 중 하나라도 발생하면 다음 구현 단계로 넘어가지 않는다.

- 복수 지역 산의 소속 규칙이 확정되지 않았다.
- 난이도 조회 실패를 평가 없음으로 처리하고 있다.
- 산 100개에 대해 리뷰를 개별 요청하고 있다.
- 필터 결과와 랜덤 후보군이 서로 다른 산 집합을 사용한다.
- 로그아웃 사용자를 미등정으로 단정한다.
- 기존 랜덤 타이머나 지도 overlay가 필터 변경 후 남는다.
- 모바일에서 필터 시트와 상세 시트가 동시에 조작 가능하다.
- `npm run lint`, `npm run test`, `npm run build` 중 하나가 실패한다.

## 10. 최종 완료 체크리스트

- [x] 지역 필터가 복수 지역 산을 누락하지 않는다.
- [ ] 체감 난이도 평균과 평가 인원이 표시된다.
- [x] 평가 없음과 조회 오류가 구분된다.
- [x] 등정 필터가 로그인 상태를 정직하게 처리한다.
- [x] 정렬은 결과 목록에서만 순서를 바꾼다.
- [x] 지도와 결과 목록이 같은 산 집합을 표시한다.
- [x] 결과 목록과 상세정보 왕복 시 상태와 스크롤이 유지된다.
- [x] 랜덤 추천이 현재 필터 결과를 벗어나지 않는다.
- [x] 결과 0개와 데이터 오류 상태에 복구 행동이 있다.
- [x] 데스크톱과 모바일 핵심 흐름을 QA했다.
- [x] `DESIGN.md`의 글자 크기, 터치 영역, 반응형 규칙을 지켰다.
- [x] lint, test, build가 통과했다.
- [x] 병합 전 `$review`의 high/medium 문제를 해결했다.

## 관련 문서

- [`DESIGN.md`](../DESIGN.md): 제품 디자인 시스템과 반응형 규칙
- [`mountain-guide-data-workflow.md`](./mountain-guide-data-workflow.md): 산과 코스 데이터 작업 흐름
- [`my-page-b-implementation-plan.md`](./my-page-b-implementation-plan.md): 기존 단계형 구현 문서의 형식 참고

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | ---: | --- | --- |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 현재 리뷰 로그 없음 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 실행하지 않음 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 12개 이슈 해결, critical gap 0개, 미해결 0개 |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | 7/10 → 9/10, 13개 결정, 미해결 0개 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 실행하지 않음 |

- **UNRESOLVED:** 0
- **VERDICT:** DESIGN + ENG CLEARED — 3단계 데이터 기반 구현을 시작할 수 있다.
