# 실적가계부 — 현재 상태 분석 & 작업 명세서 (TASKS)

> 작성: 2026-06-16 · 대상 브랜치: `claude/dev-planning-confirmation-obv035`
> 이 문서는 Codex(또는 다른 에이전트)가 바로 집어 실행할 수 있는 **백로그/작업 티켓** 모음이다.
> 함께 읽을 것: `HANDOFF.md`(프로젝트 전반·아키텍처·불변식) + 채팅 첨부 원본 명세(PRD v6 / prototype.html / card-sms-parser.js).

---

## A. 현재 상태 분석 (스냅샷)

| 항목 | 상태 |
|---|---|
| 빌드 | ✅ `npm run build` 타입에러 0 |
| 테스트 | ✅ Vitest **104개 통과** (17 파일) |
| 배포 | ✅ GitHub Pages 자동 (브랜치 push 시) · https://aaronkim83.github.io/cardmaster/ |
| 런타임 | ✅ 주요 화면 콘솔 에러 0 (헤드리스 검증) |
| 코드 품질 | 양호 — 로직은 `src/logic/*` 순수함수 + 테스트, SSOT/불변식 유지, 변경은 가산적 |

**완료된 범위(요약)**: 데이터 모델·Dexie·시드, logic 8종 + 보조 로직, 14→**15개 화면**(예산설정 추가), 카테고리/예산/계좌/카드/혜택/자동이체 CRUD, JSON 백업·복원, SMS 파서, **스마트 엑셀 가져오기**, PWA(로컬 폰트·아이콘·오프라인·세이프에어리어·키보드 처리·스와이프 백).

---

## B. 직전 라운드(Codex) 개선사항 — 반영 확인됨

1. **예산 설정 화면(BudgetScreen)** 신설 — 전체/카테고리별 월 예산 추가·편집·삭제, 더보기 메뉴 연결, `deleteBudget` 액션 추가.
2. **혜택 정액(fixed) 지원** — `Benefit.valueType('rate'|'fixed')` + `fixedAmount`, `accrueBenefit`/`rawBenefitAmount`가 정률·정액 모두 처리, 퍼센트 입력 소수점 지원. (`src/logic/benefit.ts`, `BenefitEditScreen.tsx`)
3. **스마트 엑셀 가져오기** — 카드 뒤 4자리 매핑(`logic/cardImportMapping.ts`), 가맹점 키워드 자동분류(`logic/importClassification.ts`), 카드별 매핑 오버라이드·폴백 계좌·미리보기 확장. `CardConfig.cardLast4` 필드 + 카드 설정 화면 입력 UI 추가.
4. **계좌/카드 편집 안정화**, **입력 레이아웃·뒤로가기 개선**(엣지 스와이프 백 제스처), `--kb`→`--keyboard-inset` 명명.
5. **테스트 +18개**(import 매핑·분류, benefit 정액, AppShell 등).

> 결론: 직전 라운드는 견고하게 잘 진행됨. 아래 백로그는 **남은 미완성 + 실사용 품질**을 메우는 데 집중.

---

## C. 작업 백로그 (우선순위순 티켓)

각 티켓: **목표 / 관련 파일 / 구현 가이드 / 수용 기준(AC) / 테스트 / 불변식 주의**.
규칙: 로직은 `src/logic`에 순수함수 + `*.test.ts` 먼저 → 화면 연결. 변경 후 `npm run build` + `npm test` 녹색 유지.

### 🔴 P0 — 실사용 시작을 막는 것

#### T1. 데모 데이터 정리 + 실사용 시작 플로우 ✅ 완료
- **목표**: 첫 실행 데모(카드·거래)를 실제 사용 전에 깔끔히 비울 수 있어야 함. 현재 `환경설정` 행은 동작 없음.
- **관련**: `src/screens/MoreScreen.tsx`(환경설정 행), `src/store/useAppStore.ts`, `src/db/demoSeed.ts`, `src/db/schema.ts`.
- **구현 가이드**:
  - 스토어에 `resetAllData()`(전 테이블 clear 후 카테고리 시드만 재시드) + `loadDemoData()`(데모 재시드) 액션 추가.
  - `Setting`에 `demoSeeded`/`onboarded` 플래그를 두고, 데모는 "처음 1회"만. 사용자가 초기화하면 데모 자동 재시드 금지.
  - 간단한 **환경설정 화면**(새 ScreenId `settings`) 또는 모달: "데모 데이터 삭제", "전체 초기화(주의)", "저장소 영속화 상태" 표시.
- **AC**: 데모 삭제 후 새로고침해도 데모가 다시 생기지 않음 / 전체 초기화 시 카테고리 시드만 남고 거래·계좌·카드 0 / 실수 방지 confirm.
- **테스트**: 스토어 단위 — reset 후 transactions/accounts 0, categories>0; demo 재시드 가드.
- **불변식**: 시드 1회 가드(`seedOnce`) 흐름 깨지 않기.

#### T2. 자동이체 도래분 자동 실체화 연결 ✅ 완료
- **목표**: `logic/recurring.ts: generateDueTransactions`는 구현·테스트 완료됐으나 **앱에 연결 안 됨**. 월 진입/로드시 도래분을 실제 거래로 생성(고정=confirmed, 변동=pending)하고 persist.
- **관련**: `src/store/useAppStore.ts`(loadAll / setSelectedMonth), `src/logic/recurring.ts`, `RecurringScreen.tsx`.
- **구현 가이드**:
  - `loadAll` 직후 + `selectedMonth` 변경 시(현재달 한정 권장) `generateDueTransactions(rules, txns, selectedMonth, today)` 호출 → 결과를 `db.transactions.bulkAdd` 후 reload.
  - 중복 생성 방지는 기존 `isAlreadyRealized`(recurringId+월)로 보장됨. 과거달 일괄 실체화는 옵션(기본은 현재달까지만).
  - 변동(pending) 확인 흐름은 이미 RecurringScreen에 있음 — 생성된 pending이 내역/배너에 뜨는지 확인.
- **AC**: 6월 진입 시 도래 지난 고정 자동이체가 내역에 confirmed로 자동 생성 / 변동은 pending으로 생성되고 집계 제외 / 두 번 진입해도 중복 생성 안 됨.
- **테스트**: 스토어/통합 — 같은 달 두 번 호출 시 거래 수 불변; pending이 집계(실적·예산)에서 빠지는지(기존 로직 테스트로 커버되나 통합 1개 추가).
- **불변식**: #1 pending 제외, #2 이체 제외 유지.

### 🟠 P1 — 기능 완성도

#### T3. 가져오기 중복 감지(dedup) + ImportProfile 저장 ✅ 완료
- **목표**: 같은 내역을 두 번 가져올 때 중복 방지. 엑셀 열 매핑을 ImportProfile로 저장·재사용.
- **관련**: `src/screens/ImportScreen.tsx`, 새 `src/logic/importDedup.ts`, `db.importProfiles`, `Transaction.importBatchId`.
- **구현 가이드**:
  - dedup 키: `(date, amount, accountId, merchant 정규화)` 동일 거래가 이미 있으면 "중복" 표시·기본 제외. 순수함수 `findDuplicates(existing, candidates)` + 테스트.
  - 저장 시 `importBatchId`(nanoid) 부여. ImportProfile(columnMap/defaultAccountId/dateFormat/amountSign)을 저장하고 다음 업로드 시 제안.
- **AC**: 동일 파일 재업로드 시 중복 건이 "이미 있음"으로 표시되고 저장에서 빠짐 / 매핑 프로파일 재사용.
- **테스트**: `importDedup.test.ts` 경계(동일/유사/다른 거래).

#### T4. 입력 화면 소분류·실적토글 가시성 개선 ✅ 완료
- **목표**: 키패드에 **소분류 칩/실적 인정 토글**이 가려 스크롤 필요. 레이아웃 정돈(PRD §6.2: 상단 고정 금액 / 가운데 스크롤 / 하단 고정 키패드·저장).
- **관련**: `src/screens/InputScreen.tsx`.
- **구현 가이드**: 금액부 컴팩트화, 가운데 picker가 키패드 위에서 확실히 스크롤되도록(현재 일부 가림). 대분류 선택 시 소분류가 잘 보이게, 실적 토글은 카테고리 직후 노출. 키패드 토글(접기) 또는 picker 영역 min-height 확보 검토.
- **AC**: 실기기(작은 화면 포함)에서 소분류 선택과 실적 토글이 스크롤로 모두 도달 가능, 저장 항상 노출.
- **테스트**: 렌더 스모크(요소 존재) + 수동 QA 노트.

#### T5. 카테고리/계좌/카드 순서변경 + 핀 ✅ 완료
- **목표**: `reorderCategories` 액션은 있으나 UI 없음. 계좌/카드 정렬·카드 핀(집중) 토글 UI.
- **관련**: `CategoryScreen.tsx`, `AssetsScreen.tsx`, `CardsScreen.tsx`/`CardEditScreen.tsx`, store.
- **구현 가이드**: 우선 ↑/↓ 버튼 방식(드래그는 후순위). `sortOrder` 갱신. 카드 `isPinned`는 CardEdit에 이미 있음 — 목록 정렬에 반영.
- **AC**: 순서 변경이 영속되고 입력/목록 노출 순서에 반영.
- **테스트**: store reorder 단위(이미 일부) + 화면 연결 스모크.

### 🟡 P2 — 분석·내보내기·폴리시

#### T6. 자산 순자산 추이 + 월 스냅샷 ✅ 완료
- **목표**: 순자산 추이 그래프(Recharts) + 시세변동 자산(투자/부동산)의 월 스냅샷(manual) 저장(`BalanceSnapshot`).
- **관련**: `AssetsScreen.tsx`, `logic/balance.ts`, `db.balanceSnapshots`, recharts(이미 의존성 있음).
- **AC**: 월별 순자산 추이 표시, 수동 자산은 월 스냅샷으로 추이 반영.
- **불변식**: #1 — 스냅샷은 SSOT 예외(유일하게 저장 허용).

#### T7. 통계 소분류 드릴다운 UI + 차트 ✅ 완료
- **목표**: `categoryBreakdown`은 children 제공하나 UI는 대분류 위주. 대분류 탭 → 소분류 비중 드릴다운. CSS 막대를 Recharts로 교체(선택).
- **관련**: `StatsScreen.tsx`, `logic/stats.ts`.
- **AC**: 대분류 클릭 시 소분류 비중 노출.

#### T8. CSV 내보내기 + 백업 리마인더 ✅ 완료
- **목표**: PRD §7 — 거래 CSV 내보내기, 백업 리마인더(마지막 백업 7일/50건 경과 시 배너).
- **관련**: `MoreScreen.tsx`, `Setting`(lastBackupAt/시점), 인앱 배너.
- **AC**: CSV 다운로드 동작, 조건 충족 시 홈/더보기 배너.

#### T9. 환경설정 화면 실동작 ✅ 완료(SettingsScreen)
- **목표**: `환경설정` 행을 실제 화면으로(저장소 영속 상태/요청, 표시 옵션, 데모 토글 — T1과 연계).
- **관련**: `MoreScreen.tsx`, 새 settings 화면, `navigator.storage.persisted()`.

### 🟢 P3 — 품질/마감

#### T10. 거래 편집 필드 실제 수정 + 접근성 스윕 ✅ 완료
- **목표**: `EditScreen`에서 금액·결제수단·카테고리·가맹점·메모를 실제 수정 가능하게(현재 일부 표시 위주). 적용 혜택/실적 재계산 반영. aria-label·탭 순서 점검.
- **관련**: `EditScreen.tsx`, `InputScreen.tsx`(공용화 검토), store `updateTransaction`.
- **AC**: 편집 후 저장 시 내역/집계 즉시 반영, pending↔confirmed 전환 가능.

---

## D. 설계 결정 필요(사장님/리드 확인 후 진행)

1. **혜택액 거래 영속화** ✅ 결정: **실시간 유지**(저장 안 함, SSOT). PRD `benefitAmount` 필드는 표시/내보내기용 파생값으로 해석. EditScreen '적용 혜택'을 `useMonthlyData().benefits.applied`로 계산해 표시(한도 클리핑 반영). 거래에 상시 저장하지 않음.
2. **2단 카테고리 제외 3-state**: `defaultExcluded`가 boolean이라 "제외 대분류 아래 자식만 포함" 역오버라이드 불가. 필요해지면 `boolean|null`로 마이그레이션(Dexie v2).
3. **과거달 자동이체 일괄 실체화 범위**(T2): 현재달까지만 vs 누락분 소급.

---

## E. 작업 규칙 (재확인)

- 브랜치 `claude/dev-planning-confirmation-obv035`에만 커밋·push(=자동 재배포). PR은 명시 요청 시에만.
- **불변식**(HANDOFF §6) 절대 위반 금지: pending 제외 / 이체 이중계상 방지 / 실적 인정 우선순위 / 2단 제외 상속 / Top3 recurring 제외 / 혜택 3단계 / D-day 비표시. 변경 시 관련 `*.test.ts` 통과 유지·추가.
- 스코프 아웃(v2): 동기화·로그인·서버·오픈뱅킹·다중통화 — 손대지 말 것.
- 디자인 토큰(`src/styles/tokens.css`+Tailwind) 사용, prototype 시각 결과와 일치. 모바일 레이아웃 구조(`100dvh`+세이프에어리어, `--keyboard-inset`, 모달 `createPortal`) 유지.
- 각 작업 끝에 한 일 요약. 막히거나 PRD 모호하면 멈추고 질문.
