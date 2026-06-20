I'll synthesize the integration plan with the four critiques into a final, decisive recommendation. The four dossiers and critiques contain everything needed—my value-add is the merge, not more file-reading. Let me write the final document.

# DeskCloud 심층 통합 — 최종 권고안 (spa-seo-gateway + remote-devtools)

> 이 문서는 통합 플랜과 4개 적대적 비평(아키텍처/테넌시, 가격/경제성, 운영콘솔 보안, 브랜드/디자인)을 병합한 **최종 결정안**입니다. 오너가 이미 결정한 3대 목표(하나의 아키텍처 · 하나의 가격/빌링 · 하나의 운영 콘솔)는 재론하지 않고, **거기에 도달하는 가장 실현 가능한 순서**를 제시합니다. 비평이 플랜을 바꾸게 만든 지점과, 강행이 진짜로 틀린 소수의 예외만 명시 표기합니다.

비평이 강제한 변경은 본문에서 **[비평 반영]** 으로, 오너 목표에 대한 좁은 예외는 **[승인된 예외]** 로 표기합니다.

---

## 1. TL;DR 판정

**두 후보 모두 DeskCloud의 정식 Desk로 완전 동화(full assimilation)합니다. 오너 지침에 따라 둘 다 통합 가격 + 통합 운영 콘솔에 편입됩니다 — 자체 가격 체계도, 독립 admin 앱도 유지하지 않습니다.** 동화의 기준선은 골드 스탠더드 Desk인 **TermsDesk와의 패리티**(아키텍처 배선 · 통합 빌링 · 통합 admin · 디자인 패밀리 · 동등한 기능 표면)입니다.

| 후보 | 권고 동화 | 시점/방식 | 한 줄 근거 |
|---|---|---|---|
| **spa-seo-gateway** | **완전 Desk 통합** (먼저) | Fastify 렌더 데이터플레인은 보존, 제어플레인을 `@desk/core`(NestJS+Drizzle, 실재 확인됨)로 재귀속. Phase 0→2. 전체 **M–L** | 이미 70% 도달 — Fastify 제어플레인·OKLCH 토큰·`UsageEvent` 형태가 사전 정의되어 있음. 통합 비용이 낮고 위험이 한정적 |
| **remote-devtools** | **완전 Desk 통합** (나중) | 테넌시/빌링을 `@desk/core`/`@desk/billing`에 위임, CDP 데이터플레인은 TypeORM 유지. SDK 자격증명 발명 + 상태기반 게이트웨이에 `orgId` 스레딩이 핵심. Phase 3→4. 전체 **L** | 빌링은 가장 준비됨(Stripe 출하)이나 인제스트 테넌시가 부재 — 가장 무거운 로드베어링 작업 |

**판정 한 줄:** 두 데이터플레인 핫패스(Chromium 렌더 루프 · CDP WebSocket 게이트웨이)만 네이티브로 두고 나머지 전부를 동화한다. 단, 4개 비평이 드러낸 대로 **이 동화는 플랜이 S–M으로 매긴 곳들이 실제로는 더 어렵다** — 특히 (a) 3-방향 식별자 모델 재조정, (b) 메터링 기질(substrate)의 물리적 한계, (c) 단일 콘솔의 폭발 반경(blast radius), (d) 청중 아키텍처. 아래 각 축에서 재조정한다.

---

## 2. 축 1 — Desk-fit · 포털 그룹핑 · 아키텍처 표준화

### 2.1 Desk-fit 스코어카드 (요약)

spa-seo-gateway는 **제어플레인-완비 / 빌링-공백**, remote-devtools는 **빌링-완비 / 인제스트-테넌시 파탄**. 갭이 상보적이라 작업은 발명이 아닌 재조정. 단 [비평 반영]: "TermsDesk가 `@desk/*`를 import하지 않고 계약을 첫줄로 구현"한다는 사실은 **검증의 부재**를 뜻한다 — 계약 정의가 문서 + 4개 구현으로 분기 가능하다(§2.5 참조).

### 2.2 아키텍처 표준화 — 최종 결정

**원칙: 데이터플레인은 네이티브 유지, 제어플레인은 `@desk/*`로 재귀속.** 단, 두 비평이 이 "깔끔한 분리"의 누수를 드러냈으므로 다음을 의무화한다.

**spa-seo-gateway (Fastify) — 감싸되 재작성하지 않는다.**
- **유지:** `@heejun/spa-seo-gateway-core`(puppeteer 풀·캐시·품질게이트·워머)와 Fastify 렌더 데이터플레인. Chromium 핫패스에는 Fastify의 가벼운 오버헤드가 필요 — NestJS 포팅은 이득 0, 풀/동시성 튜닝 리스크. **[승인된 예외]** 렌더 엔진 + Fastify 핫패스.
- **제어플레인 재귀속:** 테넌트/키/멤버/플랜/사용량 CRUD를 `@desk/core`의 Drizzle/Neon 테넌시 스키마로. JSON 파일 `TenantStore` → 공유 Drizzle.
- **[비평 반영 — 핫패스 결합 제거] 가장 큰 미가격(unpriced) 위험:** 플랜은 "렌더 요청마다 `@desk/core`로 테넌트 조회"를 제안하는데, 이는 **제어플레인 의존성을 빠르던 데이터플레인 핫패스(캐시 히트 포함)에 동기 네트워크 홉으로 삽입**해, Fastify 분리의 명분 자체를 깬다. **수정:** Fastify 에지가 host/keyhash 키 기반의 **read-through 캐시(짧은 TTL + stale-while-revalidate)** 를 in-memory로 보유 — `@desk/core`는 *쓰기*의 system-of-record, 에지는 결과적 일관성 읽기 복제본. 테넌트 비활성화/키 회전은 TTL(보안 파라미터로 30–60초, 문서화) 내 전파. **렌더는 절대 라이브 제어플레인 호출에 블록되지 않는다.** Phase 2에서 설계 의무.

**remote-devtools (NestJS + TypeORM) — `@desk/core`를 테넌시/빌링 system-of-record로 채택, CDP 데이터플레인은 TypeORM 유지.**
- `@desk/core`/`@desk/billing`이 **조직·플랜·사용량·구독상태의 system-of-record**. TypeORM은 고볼륨 append-only CDP 엔티티(record/screen/dom/network/runtime) 소유 유지.
- **[승인된 예외] 풀 Drizzle 마이그레이션은 하지 않는다** — 비용/위험은 실재, 이득은 ORM 외형 통일뿐. "하나의 플랫폼 아키텍처"는 "모든 레포 단일 ORM"이 아니라 "단일 테넌시/빌링/사용량 권한". TermsDesk가 이를 검증(Drizzle이지만 `@desk/*` 미import — 계약은 행위적).
- **[비평 반영 — 크로스-스토어 일관성 계약 명문화]:** `record.entity.ts`의 `org_id`는 system-of-record가 다른 DB로 이동하는 조직을 가리키는 **referential-integrity 없는 크로스-스토어 키**. 서비스 경계 너머로 NOT NULL+FK를 강제할 수 없다. **수정:** TypeORM의 `org_id`를 **불변 테넌트 스탬프(FK 아님, 명시)** 로 취급 — 조직은 append-only UUID, `@desk/core`에서 **하드 삭제 금지(tombstone만)**, 기존 행은 합성 "legacy/unattributed" 조직 UUID로 백필해 NOT NULL 달성, 야간 잡으로 `@desk/core`에 없는 `org_id` 플래그(가짜 FK 무결성 가장 금지). 이 no-FK/tombstone 계약을 문서화해야만 "TypeORM 유지+나머지 위임"이 성립.
- **마이그레이션 러너 추가**(현재 `synchronize:true`만) — 비협상 하드닝, Phase 0.

### 2.3 [비평 반영] 위임 사이징 재조정 — S–M → **M–L**

플랜은 양 후보의 테넌시/빌링 위임을 "백킹 스토어 스왑"으로 봤으나, 실제로는 **3-방향 식별자 모델 임피던스 불일치**다:
- `@desk/core`: 해시된 pk_/sk_ 분리.
- spa-seo-gateway: 단일 평문 `apiKey` + 선형 스캔.
- remote-devtools: **키 개념 자체가 없음**(deviceId only).

따라서 위임 = spa-seo는 평문→해시→pk/sk 분리 + 전 테넌트 재발급(임베드된 모든 고객 통합 파손), remote-devtools는 키를 무에서 발명. 둘 다 **파괴적 자격증명 마이그레이션**. **수정(가법적 마이그레이션):** "`@desk/core`를 system-of-record로 채택"과 "pk_/sk_ 포맷 채택"을 분리. Phase A: spa-seo 리졸버를 `@desk/core`로 향하되 레거시 평문 키를 `sha256(legacyKey)` 추가 인덱스로 보존해 기존 키 무중단 유지. Phase B: pk_/sk_ 병행 발급, dual-accept, 공표 일자에 평문 폐기. **파괴적 재발급 → 가법적 마이그레이션으로 전환.**

### 2.4 그룹핑 & 브랜딩 [비평 반영 — 청중 아키텍처]

플랜은 `track` 필드를 "표현적 IA"로 격하했으나, 브랜드 비평이 핵심을 짚었다: **두 후보의 구매자(엔지니어)는 나머지 Desk의 구매자(운영/법무/창업자)와 같은 지갑·같은 니즈 순간이 아니다.** 법무-운영 TermsDesk 구매자에게 CDP 세션 리플레이는 무용. 한 그리드에 섞으면 "이 벤더는 자기 대상이 누군지 모른다"로 읽힌다. 또한 "비즈니스 Desk(N개) vs 개발·인프라(2개)"의 비대칭 2-버킷은 **잡동사니 서랍(junk drawer)** 신호.

**최종 결정:**
1. **공유 인프라(빌링 엔진·운영 콘솔·토큰 권한)는 그대로** — 구매자에게 비가시.
2. **공개 내러티브를 분리:** DeskCloud 마케팅/카탈로그 홈페이지는 **비즈니스 Desk** 스토리(= 브랜드). 두 개발 도구는 **"DeskCloud for Developers"** 라는 별도 *목적지*(자체 URL·히어로·카피 레지스터)에 거주 — 비즈니스 그리드에 인터리브하지 않는다. 2-버킷 토글이 아니라 destination.
3. **대안 수용:** 한 카탈로그에 공존이 불가피하면 청중-유형이 아닌 **job-to-be-done**으로 그룹(운영 자동화 / 고객 응대 / 콘텐츠 / **개발·인프라**)해 비대칭을 정상 분류로 해소.
4. **포지셔닝 문장을 PRODUCT.md에 커밋:** "DeskCloud는 비즈니스 운영을 판다; 개발 트랙은 인프라를 공유하는 동거 제품 라인이지 비즈니스 카탈로그의 동급 peer가 아니다."

**네이밍:**
- **자체 이름 유지, "*Desk" 강제 리브랜드 금지**(SEO 자산·OSS 인지). 코히전은 이름이 아니라 공유 크롬 + "Powered by DeskCloud" 배지에서.
- **[비평 반영] 단, 레포 슬러그가 아닌 제품 표시명을 부여.** `"spa-seo-gateway"`는 슬러그지 제품명이 아니다 — TermsDesk 옆에 슬러그가 노출되면 레지스터 균열. 표시명 예: "Prerender Gateway"(Rendertron/Prerender SEO 연상 보존), "Remote DevTools"(이미 실명). **규칙: 모든 카탈로그 엔트리는 제품명, 슬러그는 코드/URL에만.** Phase 0 1시간 작업, 가장 싼 패밀리 코히전 승리.

### 2.5 [비평 반영] 구조적 갭 — 실행 가능한 적합성 검증

"is a Desk"가 "다 만들어진 느낌"이 아니라 **`@desk/conformance` 통과**를 뜻하게 한다. 이미 존재하는 `@desk/shared` Zod 스키마를 **CI 적합성 테스트 스위트**로 승격: 키 포맷/해시, `UsageEvent` 형태, 플랜리밋 402/429 시맨틱, CORS 허용목록 행위를 모든 Desk가 import해 검증. 이게 없으면 "동화 완료"가 falsifiable하지 않다. **Phase 1 산출물.**

### 2.6 동화 깊이 & 노력 (재조정)

- **spa-seo-gateway: 완전 동화, 전체 M–L.** 제어플레인 재귀속 L · read-through 캐시 설계 S-M · CORS S-M · 메터링 배선 M · 빌링 M · admin 폐기 M · 디자인 별칭레이어 S. **[승인된 예외]** 렌더 엔진 + Fastify 핫패스.
- **remote-devtools: 완전 동화, 전체 L** (SDK-키 + 게이트웨이-orgId 스레딩 지배). 테넌시/빌링 위임 M(↑ from S) · SDK 키 발급 L · 게이트웨이 orgId 스레딩 L · 메터링 브리지 M-L · admin 리프트 M · 디자인 S. **[승인된 예외]** TypeORM CDP 데이터플레인 + 상태기반 WebSocket 인제스트 게이트웨이.

---

## 3. 축 2 — 통합 가격/빌링 (하나의 시스템, 지속가능한 한 최대한 저렴하게)

### 3.1 최종 스킴

**계정 단위 구독(하나의 지갑, 하나의 인보이스) + `PlanLimit` 맵을 통한 Desk별 엔타이틀먼트 + `UsageMeter`를 통한 Desk별 metered 오버리지.** 후보는 자체 가격을 잃는다(remote-devtools의 free/starter/pro Stripe 카탈로그는 통합 카탈로그로 폐합, 멱등 머신은 유지). 이것이 경제성 비평을 통과한 **공유지갑 / Desk별 미터 하이브리드**다.

가격 의도는 **저렴한 헤드라인을 진짜 비용 동인의 타이트한 캡 + 종량 오버리지로 지속가능하게** — 후한 무료(저비용 단위), 타이트한 무료(고비용 단위).

### 3.2 [비평 반영] 메터링 기질의 물리적 한계 — 두 선결 작업

경제성 비평이 **빌링 시스템의 코드 레벨 모순 2개**를 드러냈다. 두 후보가 착륙하기 전에 반드시 해소.

**선결 A — 두 개의 공존 limit 엔진을 하나로 붕괴.** 레포에 limit 엔진이 둘이다: `@desk/shared`의 닫힌 enum(`api_calls|events|storage_mb|seats`, `UsageMeter.checkAllowed`/`enforce`가 호출) vs `@desk/billing`의 제네릭 string-키(`UsageLimitGuard`만 사용, HTTP 전용). 후보의 신규 차원(renders/events_ingested/replay_storage/concurrent_sessions)은 닫힌 enum에서 타입체크조차 안 되고, remote-devtools의 핫패스는 **WS 게이트웨이라 HTTP 가드가 실행 안 된다**. **수정:** 닫힌 `USAGE_METRICS`/shared `checkLimit`를 폐기(마이그레이션 shim 경유, 기존 Desk가 load-bearing)하고 `UsageMeter`를 `@desk/billing` 제네릭 엔진에 위임. Phase 1 필수.

**선결 B — gauge/시간적분 메터링 포트 추가.** `UsageStore`는 `(tenant,period,metric)` 단조 카운터(increment/get/reset, decrement·시간적분 없음). 그런데 플랜의 **가장 큰 비용 동인 둘이 이 위에서 물리적으로 표현 불가**:
- **replay storage-GB-months** = ∫(bytes·dt) → 단조 카운터로 "5GB를 10일 저장 후 삭제"를 표현 못 함.
- **concurrent_sessions / render_concurrency** = 순간 게이지(peak in-flight)이지 월 누적이 아님 → `PlanLimit` 맵에 넣고 `checkAllowed`에 태우면 *생애 세션 수*를 3과 비교해 4번째 세션을 영구 차단(동시 4번째가 아님).
**수정:** 차원을 **누적형**(renders·events·warm — 기존 카운터에 맞음) vs **게이지/시간적분형**(storage-GB-month·peak concurrency)으로 명시 분리. `UsageStore`에 `setGauge` + `gaugeRollup` 포트 추가(타이머마다 `storage_gb_month += currentBytes/GiB × Δhours/730` — 단조 increment로 storage-time 표현). **동시성은 게이지로만, 라이브 게이트웨이에서 플랜 스코프 ceiling으로 강제**(연결 시 하드 429), 빌링에는 peak-observed 스냅샷으로만 노출.

### 3.3 비용 동인 → PlanLimit 매핑 (재조정)

**spa-seo-gateway** — 요청이 아닌 렌더를 과금:
| 차원 | 비용 동인 | 비고 |
|---|---|---|
| **`render_cpu_seconds`** (1차) | **[비평 반영]** 렌더 *수*는 tenant-fair하지 않다 — 5,000×8초 렌더 ≠ 5,000×0.4초. 풀에서 이미 각 렌더를 타이밍하므로 캡처 저렴 | 무료 하드캡·오버리지 키를 CPU초에 |
| `renders_per_month` (2차 가드) | 캐시 미스 + 워밍 = Chromium 런치 | render_cpu_seconds 보조 |
| `cache_storage_mb` | LRU + Redis | 게이지 롤업(선결 B) |
| **`cache_key_cardinality`** (월별 distinct 정규화 URL) | **[비평 반영]** `?_=random` 쿼리 퍼징이 캐시-히트 사이트를 100% 미스로 전환(noisy-neighbor) | 별도 limit, 기본 휘발성 쿼리파라미터 정규화 |
| `render_concurrency` | **per-tenant** 풀 입장(글로벌 아님 — 무료 테넌트가 유료 굶기지 못하게) | 게이지 |

**remote-devtools** — 인제스트 이벤트 + replay-GB-months:
| 차원 | 비용 동인 | 비고 |
|---|---|---|
| `events_ingested_per_month` | DB 쓰기 + 버퍼 메모리 | 게이트웨이 connect/disconnect + 샘플 카운터 |
| `replay_storage_gb_months` | **최대 비용** — PG 행 + S3 blob | 게이지 롤업(선결 B); 보존기간이 핵심 레버 |
| `concurrent_sessions` | WS 팬아웃 + in-memory 버퍼 | **게이지, 게이트웨이 connect 하드캡**(PlanLimit 누적 아님) |
| `session_minutes` | 팬아웃 시간 프록시 | 무료 토큰버킷 게이트 |

### 3.4 [비평 반영] 무료 티어 백스톱 — connection-admission

플랜의 "메터에 인제스트를 절대 블록 안 함"은 *데이터 무결성*엔 옳지만 *무료 티어 유일 정책*으론 틀리다 — 단조 카운터는 과소청구만 가능하고, 무료 소켓이 한 달 내내 스트리밍 가능. **수정(티어별 정책 분리):**
- **무료 티어:** 게이트웨이 `handleConnection`에서 현재기간 `events_ingested`·`concurrent_sessions` 게이지를 읽어 초과 시 **신규 세션 거부**(진행 중 데이터는 드롭 안 함 — 무결성 보존) + 업그레이드 신호. 무료에 세션-분/일·이벤트/초 ceiling(토큰버킷).
- **유료 티어:** "절대 블록 안 함" + 소프트 오버리지 유지.

### 3.5 예시 티어 (예시 명시 — 저가 의도)

DeskCloud 기존 계정 티어(free/pro/scale ₩0/₩29k/₩99k)에 얹는 Desk별 ceiling. **숫자는 모두 예시.**

**spa-seo-gateway (예시):** Free = 5,000 렌더/월(+ CPU초 캡)·동시성 2·100MB, 하드캡 / Pro(₩29k) = 100,000 렌더·동시성 8·5GB, 오버리지 ≈₩2–4/1,000렌더 / Scale(₩99k) = 1,000,000 렌더·동시성 24·50GB / Enterprise = 전용 풀.

**remote-devtools (예시):** Free = 100 세션/월·**7일** 보존·동시성 3·~50k 이벤트 + **하드 `replay_storage` 캡(예: 500MB)**[비평 반영: 거대 DOM 스냅샷이 7일 캡을 수시간에 돌파] / Pro(₩29k) = 5,000 세션·30일·동시성 10·~2M 이벤트 / Scale(₩99k) = 50,000 세션·90일·동시성 30 / Enterprise = 커스텀. **보존기간 = storage 비용 핵심 레버.**

### 3.6 [비평 반영] "하나의 인보이스" = 다중-Desk 집계 객체 (단일 플랜 행 아님)

현재 `subscription.ts`는 테넌트당 단일 `Subscription` + 즉시-free 취소, 비례배분·크레딧 없음. 이는 단일 플랜엔 OK지만 혼합 metered 오버리지·세금(KRW VAT vs cross-border USD 동일 인보이스)·중도 변경 비례배분·다운그레이드 후 초과 저장에서 깨진다. **수정:**
- **계정 스코프 `InvoiceDraft` 집계 도입:** `{ base: oneSubscription } + lines: PerDeskOverage[]`(각 라인에 `deskId`·`metric`·`currency`·`taxCategory`). 구독은 하나(공유지갑) 유지, 오버리지는 일급 다중-Desk 컬렉션 — "하나의 인보이스"는 단일 행이 아니라 *집계*.
- **비례배분·크레딧 프리미티브 추가**(decision-only라도): 중도 변경 시 비례 base + 누적 오버리지 동결, 취소 시 free 즉시 제로화 대신 `periodEnd`까지 오버리지 보유, 환불은 음수 인보이스 라인.
- **다운그레이드 storage 정책 명시:** 캡 초과 시 **자동 보존기간 트림**(선호 — 비용 캡) 또는 read-only+오버리지. 자동 트림 채택.

### 3.7 원장·번들·크로스셀
- 전 Desk 단일 인보이스(계정 단위 구독), 패밀리 번들 할인, free-on-one/paid-on-another 크로스셀(공유 지갑 = 원클릭) — **단, §2.4의 트랙 분리 내에서**: 개발 트랙 내부 크로스셀(remote-devtools↔spa-seo)은 자연스럽고, 비즈니스↔개발 트랙 간 크로스셀은 강요하지 않는다.
- **정직성 경계(메모리):** DeskCloud STUB/decision-only 빌링 자세 유지. remote-devtools의 출하된 Stripe 경로가 실제 자금이 움직일 수 있는 유일 지점 — 플랫폼 어댑터 선택 뒤에 게이트, webhook 멱등 유지, 라이브 과금 무단 배선 금지.

**최대 위험(축 2):** 상태기반·손실성(lossy) WS 게이트웨이에서 올바른 단위를 내구성 있게 메터링. 완화: connect/disconnect + 샘플 카운터를 타이머 플러시, 영속 행과 대조해 작은 drift 수용·문서화, **인제스트를 메터에 절대 블록 안 함**(단 무료는 §3.4 connection-admission로 백스톱).

---

## 4. 축 3 — 통합 admin / 운영 콘솔 (하나의 백오피스, 독립 admin 없음)

### 4.1 현재 vs 신규

운영 콘솔은 **부재**(per-tenant `/dashboard` + 단일 토큰 `/admin/inquiries`만). 즉 **그린필드**. 단 [비평 반영]: 안전한 버전은 "하나의 번들 + 하나의 롤 + 하나의 audit 스토어"가 아니라 **하나의 셸 + 하나의 SSO + 하나의 audit *심(seam)*, 이질적·독립 출하 가능·최소권한 부품들 위에**.

### 4.2 [비평 반영] 콘솔 아키텍처 — import 그래프가 아닌 버전드 런타임 심

플랜은 "셋 다 React 19+Vite라 공유 `@desk/console-shell` lib가 최저 마찰"이라 했으나, 보안 비평이 두 결함을 드러냈다:
1. **패널을 lazy-import 라우트로 마운트하면 콘솔이 모든 Desk 패널 코드에 빌드 의존** → React/lucide/motion 버전 드리프트 시 콘솔이 핀하거나 깨짐. N개 배포 admin을 **가장 느린 Desk에 게이트된 하나의 출하 불가 메가번들**로 교환 — iframe 대신 import 그래프로 도착한 brittle-aggregator.
2. **CDP DevTools 프론트엔드(4,753 벤더 파일)는 "React 패널"이 아니다** — 자체 툴체인/런타임의 독립 앱. Vite 셸의 lazy React 라우트가 될 수 없다.

**최종 패턴 — 이질성을 정직하게 인정:**
- **제네릭 ops**(테넌트 목록·키·사용량) = 콘솔이 소유·동반배포하는 네이티브 React(공유 lib, OK).
- **Desk 도메인 패널** = **버전드 런타임 심**으로 통합 — (a) 딥링크 SSO(셸은 nav+제네릭 ops 렌더, 도메인 패널은 공유 세션 하에 Desk 자체 UI를 새 오리진에서 열기 — 빌드 결합 0, 독립 출하) 또는 (b) thin 런타임 계약(Web Component/iframe + postMessage). 심은 **버전드 프로토콜**(auth 핸드오프·RBAC 컨텍스트·breadcrumb/title·CSS var 테마). TypeScript import이면 독립 출하 불가, 버전드 프로토콜이면 가능.
- **CDP DevTools** = **iframe/별도 오리진, 무조건**(§5.2의 "호스팅된 외부 표면"). "하나의 콘솔" = 하나의 셸+하나의 auth+하나의 audit이지 하나의 번들이 아니다.
- **릴리스 결합 제거:** 셸을 범위(range) 의존 게시 패키지로, 도메인 패널은 런타임에 매니페스트 등록/해제(feature-flag)해 깨진 패널이 딥링크로 격하될 뿐 콘솔 빌드 실패가 안 되게.

### 4.3 콘솔 ↔ Desk 계약 — 프록시 패턴

각 Desk는 운영 auth 하 admin API 노출. **프록시 패턴 권장:** 콘솔 → 플랫폼 admin API → Desk admin API. Desk는 브라우저 토큰이 아닌 플랫폼만 신뢰, admin 엔드포인트는 공개 인터넷에서 차단, audit 중앙화.

### 4.4 [비평 반영] RBAC · 임퍼소네이션 · audit — god-role 분리 + 외부화

`superadmin`을 위협모델로 다룬다(빌드 항목이 아니라).
- **god-role 분리:** 단일 롤이 {크로스-Desk 쓰기 + 임퍼소네이션 + 빌링 + 키 회전}의 합집합을 갖지 못하게. 파괴적/크로스-테넌트 액션은 `billing_ops`+`support` 공동승인(dual-control) 또는 **break-glass**(시간박스·사유필수·out-of-band 알림).
- **임퍼소네이션 하드닝:** 기본 read-only, 직전 step-up 재인증(WebAuthn/TOTP), 하드 TTL(≤15분)+액션 상한, **money-movement 엔드포인트 deny-list**(메모리: refund/보증금캡처는 decision-only — 임퍼소네이션으로 진입은 잠재 발),  bespoke `impersonatedBy` 대신 **RFC 8693 `act` actor claim**(전 Desk 균일 검증). 테넌트 알림/동의.
- **audit 외부 변조증명:** 해시체인 헤드를 운영 플레인이 *쓸 수 없는* append-only 싱크(별도 계정 object-lock 버킷)로 출판. spa-seo의 HMAC `verifyAuditChain`을 `@desk/audit`로 승격. **실시간 이상 알림**(임퍼소네이션 스파이크·심야 키 회전·플랜 오버라이드 버스트) — 사후 포렌식만이 아니라 탐지.
- **토큰을 발급 시 Desk+액션 스코프:** 탈취된 `desk_operator`(spa-seo) 토큰이 remote-devtools를 못 건드리게, `support` 토큰이 빌링 스코프를 못 갖게.

### 4.5 [비평 반영] 마이그레이션 — 딥링크 우선, 빅뱅 금지 + 정적 토큰 즉시 폐기

두 admin은 비대칭이고 컷오버가 위험하다(평문 키 vs 키 부재; 컷오버 중 *두* auth 시스템 동시 가동 = *넓은* 공격면). **순서:**
1. **정적 admin 토큰(`dev-admin-token-change-me`) Phase 0/1 즉시 폐기** — 단일 공유 시크릿을 진짜 auth로 교체하는 게 최고 보안 ROI, 임퍼소네이션/audit 작업 뒤로 미루지 않는다. 레거시 경로 병행은 하드 바운드 만료 창 내로만.
2. 콘솔 **셸 + 운영 SSO**를 세우고 **기존 standalone admin으로 딥링크**(무변경) — 운영자는 즉시 단일 현관, 워크플로 손실 0.
3. **제네릭 ops**(테넌트/키/사용량) 흡수 먼저.
4. **도메인 패널을 Desk별로** 흡수, 대체물이 작동 관측된 후에만 구 표면 폐기(패널별 가역).
5. **shadow-audit:** 새 audit 파이프라인을 기존 admin 액션에 병렬 가동해 단일 control로 의존하기 *전에* 탐지 검증.
6. **RBAC 기본 최소권한:** 운영자는 `desk_operator`/`support`로 시드, `billing_ops`/break-glass는 명시 부여.

### 4.6 standalone admin의 운명
- **spa-seo `apps/admin-frontend`:** 제네릭 페이지(Tenants·멤버·auth·audit·support) **폐기**(콘솔로 redirect). **9개 도메인 패널만** 콘솔 마운트 번들로 유지. Fastify admin REST는 도메인 API라 잔존.
- **remote-devtools standalone:** 제네릭(org/멤버/billing/Pricing)을 콘솔로 리프트, 도메인(라이브 CDP 콘솔·리플레이·Jira 설정)은 in-product 패널로 마운트.
- 양쪽: 구 admin URL → 통합 콘솔 redirect.

### 4.7 [비평 반영] 단일 콘솔 = 단일 가용성/침해 도메인 — Desk-로컬 break-glass

콘솔이 하나면 그 가용성이 모든 Desk 운영의 의존성이 되고 침해가 전면적. **수정:** Desk별 최소 **break-glass 경로**(봉인 자격증명 뒤 Desk admin API CLI)를 별도 배포 — 통합 콘솔은 *주* 운영 표면이지 *유일* 표면이 아니다.

**최대 위험(축 3):** 정적 단일 토큰에서의 운영자-auth 업그레이드. 플랜의 "RBAC 먼저"는 옳으나 미사이즈 — "**최소권한** RBAC 먼저 + 탐지 작동 증명 + 새 중앙 플레인이 출하불가 메가번들도 생존불가 단일점도 되지 않게."

---

## 5. 축 4 — 디자인/UX as a FAMILY (공유 DNA + Desk별 개성)

오늘 셋은 3개 디자인 시스템(OKLCH/LAB/HSL · Pretendard/system/Inter · marketing-header/dark-rail/console). 목표는 **공유 DNA, 뚜렷한 개성** — 한 템플릿을 평면 복제하는 게 아니다.

### 5.1 수렴 = 공유 DNA
- **토큰 → OKLCH 캐노니컬(`@desk/tokens`).** spa-seo의 LAB `--app-*`, remote-devtools의 HSL `--accent`는 **별칭 레이어**(`--app-accent: var(--desk-accent)`)로 — 변수 스왑만, 컴포넌트 무변경, Phase 0 무위험.
- **타이포 → Pretendard Variable(UI/한글) + JetBrains Mono(코드)** (`@desk/typography`). spa-seo system font·remote-devtools Inter 교체.
- **공유 셸/크롬:** `@desk/console-shell`(rail+topbar+⌘K+밀도토글+테마토글+ko/en) — remote-devtools 스켈레톤 + spa-seo 콘솔 성숙도 결합.
- **공유 auth 게이트 · "Powered by DeskCloud" 배지 · marketing-header lockup · a11y 베이스라인**(SkipLink·RouteAnnouncer·ErrorBoundary·포커스·`useConfirm`) · 공유 card-radius/shadow/nav 스타일 · **공통 logo-icon 시스템.**

### 5.2 [비평 반영] 경계를 아티팩트 타입이 아닌 **표면 종류**로 — 2티어 아님 3티어

플랜은 경계를 "셸 vs 패널"로 그었으나, 디자인 비평이 이 절단이 잘못이라 지적: CDP 워크스페이스와 render-config 표면을 똑같이 "불투명 패널"로 묶었지만 둘은 다르다.

| 티어 | 표면 | 공유 DNA | 개성 |
|---|---|---|---|
| **패밀리 멤버** (풀 DNA) | 비즈니스 Desk, **render-config 표면**(RouteOverride·Lighthouse·VisualDiff — 폼·테이블 UI, 공유 시스템이 잘 맞음, 플랜보다 *더* 많은 DNA), remote-devtools 세션리스트/대시보드/Jira-config | 토큰+타이포+셸+컴포넌트+액센트 | 액센트 hue + 도메인 아이코노그래피 |
| **호스팅된 외부 표면** (셸만, *설계된* 심) | 벤더 CDP DevTools 워크스페이스, rrweb 리플레이 뷰포트 | DeskCloud 셸이 *둘레만*, 경계에 **"임베디드 도구" 어포던스**(라벨 프레임/모드 전환 표시)로 심을 의도적으로 보이게 | Chrome 네이티브 언어 완전 유지, DeskCloud는 리스킨 시도 안 함 |
| **크롬만** | auth 게이트·⌘K·marketing header | 풀 DNA | 없음 |

**핵심:** CDP 워크스페이스는 패밀리 *형제*가 아니라 패밀리가 *호스팅하는 세입자*. 배지+셸이 형제로 만든다고 가장하는 게 실패 모드. `@desk/console-shell` 계약에 **외부 표면 심 렌더링 방식**을 명문화(플랜은 "셸이 무엇을 소유하는지"만 명시하고 "외부 표면으로의 심을 어떻게 그리는지"는 빠뜨림).

### 5.3 [비평 반영] 공유 `@desk/ui` 컴포넌트 레이어 — "형제로 읽힘"은 콘텐츠에서 이긴다

플랜의 공유 DNA는 거의 셸-레벨 + 토큰-레벨(= 프레임). 그러나 동일 프레임을 공유해도 *프레임 안 콘텐츠*가 무관한 컴포넌트 어휘(다른 테이블/빈상태/버튼 위계)면 형제로 안 읽힌다 — "같은 액자, 다른 그림". "shadcn-style"은 각 레포가 로컬 복사·분기했다는 뜻이지 공유 시스템이 아니다. **수정:** 토큰과 셸 사이에 **`@desk/ui` 컴포넌트 레이어**(Button·Table/DataGrid·Form·Badge/Status·EmptyState·Dialog/`useConfirm`·Toast)를 게시 패키지로 추가 — 패밀리 멤버 표면이 *소비*(복사 아님). **단 패밀리-멤버 티어 한정; 호스팅된 CDP 표면(티어 2)은 명시 제외**(Chrome 컴포넌트 유지) — 이 제외가 over-homogenization을 막는다.

### 5.4 Desk별 개성 (균질화 금지)
- **액센트 = 단일 hue 토큰 스왑**(공유 chroma/lightness 곡선). Core 277(violet), spa-seo ≈265–277(indigo·계기판 정체성), remote-devtools ≈230–250(blue·Vercel/Linear 모노크롬). semantic·표면·테두리 공유.
- 내부 도메인 표면 bespoke 유지(§5.2 티어 2). 각자의 히어로/마케팅 정체성·도메인 아이코노그래피를 공유 헤더 lockup 아래 유지.

**최대 위험(축 4):** 내부 도메인 표면 과균질화. 완화: 셸은 rail/topbar/auth/palette/badge만 소유, 패널은 공유 토큰 곡선 위 per-Desk 개성을 가진 불투명 자식. `@desk/console-shell` 계약에 written boundary로.

---

## 6. 단계별 로드맵

spa-seo-gateway(쉬움) → remote-devtools(어려움). 노력: S ≤ ~3d, M ~1–2wk, L ~3wk+.

### Phase 0 — 빠른 승리 (공유·저위험·병렬) — **S each**
- `@desk/tokens`(OKLCH) + `@desk/typography` 게시, 양 후보에 **별칭 레이어** 적용(변수 스왑, 컴포넌트 무편집). [축4]
- `DESK_CATALOG`에 `track` 필드 + **제품 표시명**(슬러그 아님) + 개발 트랙 destination 스캐폴드. [축1, 비평]
- "Powered by DeskCloud" 배지 투입. [축4]
- remote-devtools 마이그레이션 러너(`synchronize:true` 제거). [축1]
- **[비평 반영] 정적 admin 토큰 폐기 시작** — 진짜 auth로 교체(RBAC 풀빌드 전 최고 ROI). [축3]
- **의존:** 없음. **최대 위험:** 사소 / 정적 토큰 교체 시 운영자 락아웃 → 하드 바운드 병행 창.

### Phase 1 — 플랫폼 기질 (로드베어링 그린필드) — **L**
- **[비평 반영] 선결 A+B 먼저:** 두 limit 엔진 붕괴(`UsageMeter`→`@desk/billing` 위임, shim 경유) + `UsageStore`에 gauge/롤업 포트 추가. 이거 없이는 후보 차원이 표현 불가. [축2]
- `@desk/billing`을 실 통합 엔진으로(PlanLimit 맵 + 오버리지, decision-only). 누적/게이지 차원 분리, 예시 티어. [축2]
- **[비평 반영] `InvoiceDraft` 집계 + 비례배분/크레딧 프리미티브.** [축2]
- **[비평 반영] god-role 분리 RBAC(최소권한) + 임퍼소네이션(read-only/step-up/deny-list/`act` claim) + 외부화 변조증명 audit + 실시간 알림**; `AdminTokenGuard` 업그레이드; `@desk/audit` 승격. [축3]
- `@desk/shared` Zod 계약 + pk_/sk_ 해시키 모델 + **`@desk/conformance` CI 스위트**(실행가능 적합성). [축1, 비평]
- `@desk/ui` 컴포넌트 레이어 추출(패밀리-멤버 티어). [축4, 비평]
- **의존:** Phase 0. **최대 위험(전체 최고):** auth/RBAC 업그레이드 = 보안 임계경로 → **최소권한 먼저 + shadow-audit로 탐지 증명 + 프록시 패턴 백스톱**.

### Phase 2 — spa-seo-gateway 동화 — **L (엔진 무손이 경계 지음)**
- **[비평 반영] 제어플레인 재귀속 + read-through 캐시:** Fastify `preHandler`가 `@desk/core` 해시키를 라이브 호출하지 않고 host/keyhash TTL 캐시(stale-while-revalidate)에서 해소 — 렌더 핫패스를 제어플레인 가용성에서 분리. [축1]
- **[비평 반영] 가법적 키 마이그레이션:** `sha256(legacyKey)` 추가 인덱스로 기존 키 무중단 → pk_/sk_ 병행 발급 → 공표일 평문 폐기(파괴적 재발급 회피). 리졸버 feature-flag + dual-read. [축1]
- per-tenant CORS(글로벌 `origin:true` 교체). [축1]
- **[비평 반영]** `render_cpu_seconds`(1차) + `cache_key_cardinality` 캡 + per-tenant 동시성 입장 배선 → `UsageMeter`. [축2]
- `@desk/console-shell` 추출; **9개 도메인 패널** 런타임 심으로 마운트(import 아님); 제네릭 admin 폐기·redirect. [축3/4]
- Pretendard/JetBrains; 공유 헤더 lockup의 마케팅/인트로 표면; `--desk-accent-hue`(indigo). [축4]
- **의존:** Phase 1. **최대 위험:** 키 마이그레이션 중 host/apiKey/subdomain/pathPrefix 리졸브 전략 파손 → feature-flag + 구/신 dual-read 컷오버.

### Phase 3 — remote-devtools 테넌시 + 빌링 위임 — **M (제어플레인) + L (SDK/게이트웨이)**
- org→plan/구독상태를 `@desk/core`/`@desk/billing`에 위임(backing store 스왑); 자체 plan/Stripe-as-truth 폐기, webhook 멱등 유지. [축1/2] — **M**
- **[비평 반영] `org_id` no-FK/tombstone 계약 구현:** 조직 하드삭제 금지, 합성 legacy UUID 백필, 야간 reconcile 잡. [축1]
- **SDK 프로젝트/사이트 자격증명(린치핀):** org별 쓰기 키(pk_급) 발급, 외부 게이트웨이 `handleConnection`에서 검증, key→orgId. SDK는 현재 자격증명 무. [축1/2] — **L**
- **상태기반 WS 게이트웨이에 `orgId` 스레딩:** `createRoom`/`recordService.create`에 스탬프(현재 NULL), 역사 백필, NOT NULL화. [축1] — **L**
- **[비평 반영] 격리 실패모드 처리(빌링 정확도가 아니라):** (a) 키 회전/취소 = **서버 푸시 disconnect**(다음 연결 재확인 의존 금지 — mid-session 테넌시 누수/과금 창 제거); (b) **per-org-fair 버퍼 축출**(노이즈 무료 org가 유료 org 버퍼 축출 못 하게) — NOT NULL 플립 전 부하 테스트로 "무료 org가 유료 버퍼 축출 불가" 단언. [축1]
- **의존:** Phase 1, SDK-키가 orgId-스레딩 선행. **최대 위험:** 게이트웨이가 상태기반·단일인스턴스·손실성 → self-host bypass 뒤 스테이징, 팬아웃+버퍼 축출 부하 검증 후 플립.

### Phase 4 — remote-devtools 메터링 + 콘솔 + 디자인 — **M-L**
- 메터링 브리지: connect/disconnect(동시 세션·세션-분) + 샘플 `cdpEventPersistence` 카운터 + **게이지 롤업으로 replay-GB-month**(PG+S3) → `@desk/core`; drift reconcile, 인제스트 블록 안 함. [축2] — **M-L**
- 예시 티어 강제(보존기간 storage 레버 + **무료 connection-admission 게이트** §3.4 + 하드 storage 캡). [축2]
- 도메인 패널(라이브 CDP 콘솔·리플레이·Jira) 콘솔 마운트 — **CDP는 iframe/별도 오리진(티어 2)**; 제네릭 org/멤버/billing 리프트; 구 admin redirect. [축3/4, 비평]
- 토큰/폰트 정렬(Inter→Pretendard, lucide/motion 버전), `--desk-accent-hue`(blue); CDP 워크스페이스 bespoke 유지(설계된 심). [축4]
- **의존:** Phase 3. **최대 위험:** 손실성 게이트웨이 메터링 정확도 → connect/disconnect + 샘플 카운터, drift reconcile.

### Phase 5 — 크로스셀·번들·폴리시 — **S-M**
- 단일 인보이스 라인아이템(`InvoiceDraft`), 패밀리 번들 할인, 트랙-내 크로스셀 프롬프트. [축2]
- 개발 트랙 destination 폴리시; 카탈로그 크로스링크; 패밀리 레전빌리티 QA(Desk별 액센트 숨쉬기, 공유 크롬 일관, 제품 표시명). [축1/4]

---

## 7. 오너 결정 필요 (진짜 판단 호출)

1. **개발 트랙 노출 형태 [브랜드 비평 핵심]:** "DeskCloud for Developers"를 (a) 완전 별도 destination(자체 URL·히어로)으로 분리할지, 아니면 (b) 단일 카탈로그 내 job-to-be-done 카테고리("개발·인프라")로 둘지. 둘 다 비대칭 잡동사니 서랍을 피하지만, (a)는 브랜드 분리가 더 또렷하고 (b)는 단일 포털 단순성을 유지. — *기본 추천: (a) destination 분리, PRODUCT.md에 포지셔닝 문장 커밋.*

2. **제품 표시명 확정:** "Prerender Gateway" / "Render Gateway" / 기타? "Remote DevTools"는 이미 실명이라 슬러그 노출만 중단하면 됨. 슬러그의 SEO/OSS 자산은 URL·코드에 보존.

3. **무료 티어 관대함 vs 비용 노출:** 예시 무료 ceiling(spa-seo 5,000 렌더 / remote-devtools 100 세션·7일·500MB)이 "관대하지만 바운드"의 의도된 균형점인지. 더 관대하게(채택 우선) 또는 더 타이트하게(비용 안전) 조정 가능 — CPU초·GB-month·connection-admission 가드가 어느 쪽이든 출혈을 막음.

4. **money-movement 활성화 시점:** remote-devtools의 출하된 Stripe 경로를 통합 어댑터 뒤에서 *언제* 실 과금으로 켤지. 그때까지 전 빌링 decision-only 유지(메모리 정직성 경계).

5. **break-glass / dual-control 운영 정책:** 파괴적·크로스-테넌트 액션에 (a) `billing_ops`+`support` 공동승인을 의무화할지 (b) 1인 break-glass(시간박스+사유+알림)로 충분할지 — 운영 인원 규모에 달림(소규모면 (b)가 현실적).

6. **`@desk/core` 풀 Drizzle 통일 강행 여부 [승인된 예외 재확인]:** remote-devtools CDP 엔티티를 TypeORM 유지하는 본 권고를 수용할지(추천), 아니면 ORM 외형 통일을 위해 풀 Drizzle 마이그레이션 비용/위험을 감수할지. — *기본 추천: TypeORM 유지(행위적 계약이 권한, ORM 아님).*