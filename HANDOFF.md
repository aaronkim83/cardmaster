# 실적가계부 — 작업 핸드오프 (HANDOFF)

> 다른 환경(Codex 등)에서 이어서 개발하기 위한 인수인계 문서.
> 최종 업데이트: 2026-06-15

---

## 1. 한 줄 요약

지출·수입을 빠르게 기록하면서 **예산 · 다수 신용카드 전월/당월 실적·혜택·절약 · 자동이체 실적 전망 · 순자산**을 한곳에서 관리하는 **100% 로컬 PWA**. 단일 사용자, 로그인·서버·클라우드 없음, KRW 단일 통화. 데이터는 브라우저 IndexedDB에 저장.

---

## 2. 현재 상태

| 항목 | 값 |
|---|---|
| 작업 브랜치 | `claude/dev-planning-confirmation-obv035` (이 브랜치에서 계속 작업) |
| 원격 | `github.com/aaronkim83/cardmaster` (현재 **public**) |
| 라이브 배포 | https://aaronkim83.github.io/cardmaster/ (PWA, 휴대폰 "홈 화면에 추가"로 설치) |
| 빌드/테스트 | `npm run build` 통과 · **Vitest 72개 통과** |
| 진행도 | MVP **로직 + 14개 화면 + 주요 폼 CRUD + PWA 배포** 완료. 아래 §10 TODO 남음 |

**개발 단계 요약**
- ✅ 1단계: 기반(Vite+TS+Tailwind+PWA) + Dexie 스키마/타입/2단 카테고리 시드 + 파서 이식 + **logic 8종 순수함수 + 단위테스트**
- ✅ 2단계: 앱 셸/네비게이션/스토어 CRUD + **14개 화면** + 첫 실행 데모 데이터 + 런타임 스모크 테스트
- ✅ 폼 채우기: 카테고리·예산·계좌·자동이체 CRUD, JSON 백업/복원, 엑셀(SheetJS) 가져오기
- ✅ PWA: 로컬 Pretendard 폰트, 설치 아이콘(192/512/maskable), GitHub Pages 자동 배포
- ✅ 모바일 QA 수정: 숫자 입력 강제 0, 키보드에 저장버튼 가림, 스크롤 출렁임, 상태바 세이프에어리어

---

## 3. 빠른 시작 (환경 셋업)

전제: **Node 20+ (개발은 22.x)**, npm.

```bash
git clone https://github.com/aaronkim83/cardmaster.git
cd cardmaster
git checkout claude/dev-planning-confirmation-obv035
npm install

npm run dev        # 개발 서버 (http://localhost:5173)
npm test           # Vitest 1회 실행 (72개)
npm run test:watch # 테스트 watch
npm run build      # tsc -b && vite build (타입체크 + 프로덕션 빌드)
npm run preview    # 빌드 결과 미리보기
```

- 외부 네트워크/서버/인증 코드 없음. 모든 데이터는 IndexedDB(로컬).
- 첫 실행 시 `src/db/demoSeed.ts`가 데모 계좌/카드/거래/예산을 시드함(2026년 6월 기준 데이터). **시스템 날짜가 데이터 월과 맞아야** 홈 화면 등에 바로 보임(`selectedMonth` 기본=오늘).
- 데이터 초기화: 브라우저 DevTools → Application → IndexedDB → `siljeok-ledger` 삭제 후 새로고침.

---

## 4. 기술 스택

React 18 · Vite 6 · TypeScript(strict) · Tailwind 3 · **Dexie(IndexedDB)** · **Zustand** · day.js · Recharts · SheetJS(xlsx) · vite-plugin-pwa(Workbox) · **Vitest + @testing-library/react + fake-indexeddb** · Pretendard(로컬 번들).

- 경로 alias: `@/*` → `src/*` (vite.config.ts, tsconfig.app.json, vitest.config.ts에 동일 설정).
- 테스트 설정은 `vitest.config.ts`에 **분리**되어 있음(플러그인 미포함 — vite/vitest 이중 vite 타입 충돌 회피). vite.config.ts에는 `test` 필드 없음.

---

## 5. 디렉토리 구조

```
src/
  db/         types.ts(전 엔티티 타입) · schema.ts(Dexie v1) · seed.ts(2단 카테고리 시드) · demoSeed.ts(첫 실행 데모)
  logic/      순수 함수 + *.test.ts (UI 의존 없음, SSOT 계산)
              performance · balance · forecast · benefit · budget · stats · merchants · recurring
              period.ts(YearMonth 헬퍼) · category.ts(2단 제외 상속) · testUtils.ts(테스트 팩토리)
  store/      useAppStore.ts(전역+CRUD+네비) · useMonthlyData.ts(월별 파생 집계 메모이즈) · lookups.ts
  app/        AppShell.tsx(레이아웃/라우팅/세이프에어리어/키보드) · TabBar.tsx · AppShell.test.tsx(렌더 스모크)
  screens/    14개 화면 (아래 §8)
  ui/         components.tsx(Chip·Meter·MonthNav·SegTabs·Toggle·FieldRow 등) · Modal.tsx(시트형 모달+NumberField) · format.ts
  parser/     cardSmsParser.ts(카드 SMS 정규식 파서) + test
  styles/     tokens.css(prototype :root 디자인 토큰 이식)
.github/workflows/deploy-pages.yml   # GitHub Pages 자동 배포
public/       favicon.svg, icon-180/192/512/512-maskable.png
```

---

## 6. 아키텍처 & 반드시 지킬 불변식 (정합성 핵심)

**원칙**: 잔액·실적·혜택·절약·예산소진·Top3는 **거래(Transaction)에서 계산**(SSOT, 별도 저장 안 함; 시세변동 자산 스냅샷만 예외). 모든 월별 집계는 `selectedMonth` 인자 + 메모이즈. 화면은 `useMonthlyData()` 결과만 표시.

1. **pending 제외**: `status='pending'` 거래는 모든 집계에서 빠짐.
2. **이체 이중계상 방지**: `type='transfer'`는 수입·지출·실적·예산에서 제외(잔액에서만 from/to 반영). 카드대금=통장→카드 이체.
3. **실적 인정 우선순위**: `countsForPerformance`가 `true/false`면 그 값 우선. `null`이면 자동판정(`expense && 해당카드 && 카테고리 미제외(대분류 상속) && amount≥minPerTxn && confirmed`). → `logic/performance.ts: txnCountsForCard`.
4. **2단 카테고리 제외 상속**: `defaultExcluded`는 plain boolean이라 상속을 **OR 결합**으로 해석 = `leaf.defaultExcluded || parent.defaultExcluded`. 카드 `excludedCategoryIds`에 대분류 id면 자식 전부 제외. → `logic/category.ts`. ⚠️ "제외 대분류 아래 자식만 포함"하는 역방향 오버라이드는 타입상 불가(필요 시 `boolean|null` 3-state로 변경 검토).
5. **Top3 가맹점**: 카드별 빈도 집계에서 **`source='recurring'` 제외**, 실적 인정 거래 우선, 상위 3. → `logic/merchants.ts`.
6. **혜택 3단계 가시화**: 매칭 → `requiresPerformance && 미충족`이면 미적용(예상치 별도) → `round(amount*rate)` → 월 한도 초과분 제외 → 한도 내 실제분만 저장. → `logic/benefit.ts`.
7. **실적 표시**: 부족액·달성률·전망 중심. **마감 D-day·하루필요액 비표시**. 긴급도는 "뒤처짐/양호".
8. **월 기준**: 현재달=전망 포함, 과거달=확정만. cycleType(prev_month/curr_month)로 혜택 적용 월 결정.

각 불변식은 `src/logic/*.test.ts`로 보호됨(경계값 포함). **로직 수정 시 반드시 테스트 통과 유지.**

---

## 7. 데이터 모델 (요약, 상세는 `src/db/types.ts`)

- `Account`(+`CardConfig`): 자산/부채, 카드 흡수. `card.{targetAmount,cycleType,trackPerformance,minPerTxn,excludedCategoryIds,settlement...}`
- `Transaction`: `type(expense|income|transfer)`, `status(confirmed|pending)`, `source(manual|parsed|recurring|import)`, `countsForPerformance(boolean|null)`, `categoryId`(소분류 권장)
- `Category`: 2단(`parentId`), `defaultExcluded`, `icon/color`
- `Budget`(categoryId=null→전체), `Benefit`(discount|point, rate, monthlyLimit, limitBasis, requiresPerformance), `RecurringRule`(isVariable→pending), `ImportProfile`, `MerchantRule`, `BalanceSnapshot`, `Setting`
- Dexie 스키마는 `src/db/schema.ts` v1. 스키마 변경 시 `db.version(2).stores({...}).upgrade(...)` 추가 필요.

---

## 8. 화면 (14개) & 네비게이션

탭: `홈 · 내역 · ＋입력 · 통계 · 더보기`. 더보기 → 자산·카드·자동이체·가져오기·예산·카테고리·백업/복원.

| 화면 파일 | 내용 |
|---|---|
| HomeScreen | 통합 요약 + 컴팩트 실적 카드(게이지·페이스·부족/전망·Top3) + 액션/진행/달성 그룹 |
| LedgerScreen | 월 네비·검색·카드/유형 필터·날짜 그룹·pending 배너 |
| InputScreen | 유형 세그·키패드·날짜·결제수단·2단 카테고리 드릴다운·실적 토글 |
| EditScreen | 거래 수정·실적 오버라이드·삭제 |
| StatsScreen | 예산 진행·카테고리 비중·월별 추이·일평균·전월대비 |
| BudgetScreen | 전체·카테고리별 월 예산 추가/편집/삭제 |
| CardsScreen / CardEditScreen / BenefitEditScreen | 혜택 요약·카드 설정·혜택 편집 |
| RecurringScreen | 자동이체 목록/추가/편집 + 변동금액 확인 |
| ImportScreen | SMS 붙여넣기(파서) + 엑셀 업로드(SheetJS) |
| CategoryScreen | 2단 카테고리 추가/편집/삭제 |
| AssetsScreen | 순자산·계좌별·계좌 추가/편집 |
| MoreScreen | 메뉴 + JSON 백업/복원 |

네비게이션은 `useAppStore`의 `screen/params/history` + `navigate()/goBack()`. URL 라우팅 아님(단일 SPA).

**모바일 레이아웃 주의(중요)**: `AppShell` 루트는 `h-[100dvh]` + `pt-[env(safe-area-inset-top)]`. 키보드는 `visualViewport`로 `--keyboard-inset`(키보드 높이)만 계산 → 스크롤 영역 하단 패딩 + 모달을 `--keyboard-inset`만큼 위로. **모달은 `createPortal(document.body)`로 렌더**(탭바 위로). 레이아웃 수정 시 이 구조 깨지 않도록 주의.

---

## 9. 배포 (GitHub Pages)

- `.github/workflows/deploy-pages.yml`: **이 브랜치에 push하면 자동 빌드·배포**. `npx vite build --base=/cardmaster/`로 프로젝트 경로 빌드 후 Pages 게시.
- Pages는 레포 설정에서 이미 활성화됨(Source: GitHub Actions). 레포 **public** 필요(Free 플랜).
- 로컬 dev/build는 base `/`(루트). Pages용 base는 워크플로에서만 `--base=/cardmaster/` 주입.
- PWA: `vite.config.ts`의 VitePWA. Pretendard woff2(~2MB) 포함 위해 `maximumFileSizeToCacheInBytes: 3MB`, `globPatterns`에 `woff2` 추가됨.

---

## 10. 알려진 미완성 / 다음 할 일 (TODO)

- [ ] **데모 데이터 정리/온보딩** — 실제 사용 전 데모 일괄 삭제 버튼 또는 첫 실행 온보딩(계좌/카드 등록) 흐름.
- [ ] **자동이체 실체화 자동화** — 현재 `logic/recurring.ts`의 `generateDueTransactions`는 구현됐으나 앱 로드시 자동 실행은 미연결(변동분 확인은 수동 버튼). 월 진입 시 도래분 생성 연결 검토.
- [ ] **엑셀 가져오기 고도화** — 현재 열 자동매핑 기본형. ImportProfile 저장/재사용, MerchantRule 자동분류·중복감지(dedup) 미구현.
- [ ] **혜택 매칭 정밀화** — 거래 저장 시 `appliedBenefitId/benefitAmount` 영속화는 아직 안 함(가시화는 `computeBenefits`로 실시간 계산). 필요 시 저장 파이프라인 연결.
- [ ] **카테고리 순서 변경 UI**(`reorderCategories` 액션은 있음, 드래그 UI 미구현), 계좌/카드 정렬·핀.
- [ ] **자산 스냅샷·추이 그래프**, 백업 리마인더, CSV 내보내기.
- [ ] v2(스코프 아웃, 손대지 말 것): 멀티 디바이스 동기화·로그인·서버·오픈뱅킹·다중통화.

품질 가드: 변경 후 항상 `npm run build`(타입 0) + `npm test`(72개) 녹색 유지. 로직은 테스트 먼저.

---

## 11. 원본 명세(SSOT) — ⚠️ 레포에 없음

다음 3개는 개발 기준 원본이며 채팅 업로드로만 제공됨(레포 미포함). Codex에서 충실히 이어가려면 **`docs/`에 추가 권장**:
1. `가계부_카드실적_혜택_앱_PRD_v6.md` — 제품 명세(데이터·로직·화면). 최우선.
2. `prototype.html` — 시각/인터랙션 명세(디자인 토큰·14개 화면). 미사용 CSS(`.focus`·`.freq`·`.fchip`·`.statusstrip`·`.nwmini`)는 이식 금지.
3. `card-sms-parser.js` — 검증된 파서 원본(`src/parser/cardSmsParser.ts`로 이식됨).

충돌 시 우선순위: **PRD(로직·데이터) > prototype(시각) > 본 문서(작업방식)**.

---

## 12. Codex에서 이어가기 팁

- 위 §3로 클론·설치·실행. 작업은 **반드시 `claude/dev-planning-confirmation-obv035` 브랜치**에 커밋(이 브랜치 push → 자동 재배포).
- 새 기능: ① `src/db/types.ts`에 타입 → ② `src/logic/*`에 순수함수 + `*.test.ts` → ③ 화면 연결 순서 권장.
- 디자인은 `src/styles/tokens.css` + Tailwind theme(`tailwind.config.js`) 토큰 사용. prototype 클래스 복붙 금지, 의도만 재구성.
- 설치형 PWA는 서비스워커 캐시 때문에 변경 후 **앱 완전 종료→재실행**(또는 브라우저 강력 새로고침) 해야 최신본 반영.
- 시각 확인은 헤드리스 브라우저로 가능하나 **세이프에어리어/소프트키보드는 실기기에서만 정확**.
