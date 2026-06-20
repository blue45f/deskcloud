# @moderationdesk/sdk

ModerationDesk 서버 SDK — **secret 키(`sk_`)** 로 텍스트를 검사하고 규칙/신고/로그를
관리한다. 런타임 의존성 0(전역 `fetch` 만 사용, 주입 가능). 형제 백엔드·서버리스 함수에서
쓰며, **브라우저 번들에는 넣지 않는다**(검사·신고만 필요한 클라이언트는
[`@moderationdesk/widget`](../widget) 의 publishable 키 경로를 쓴다).

## 설치

```bash
pnpm add @moderationdesk/sdk
```

## 검사(moderate) — 서버에서 콘텐츠 게이트

```ts
import { createModerationClient } from '@moderationdesk/sdk'

const md = createModerationClient({
  secretKey: process.env.MODERATIONDESK_SECRET_KEY!, // sk_...
  endpoint: process.env.MODERATIONDESK_ENDPOINT!, // https://moderate.example.com
})

// 전체 결과
const result = await md.moderate(comment, { meta: { userId, source: 'comments' } })
// → { verdict: 'allow' | 'flag' | 'block', matchedRules, aiScore?, logId }
if (result.verdict === 'block') {
  throw new Error('차단된 콘텐츠입니다')
}

// 편의 래퍼 — boolean 으로
const { blocked, flagged } = await md.check(comment)
if (blocked) return reject()
if (flagged) markForReview()
```

규칙 기반 검사는 항상 동작하고, 서버에 `ANTHROPIC_API_KEY` 가 있으면 Claude(작고 저렴한
`claude-haiku-4-5`)로 독성 점수를 더해 `flag` 로 격상한다. 키가 없으면 규칙 결과로 안전 폴백
— SDK 호출부는 동일하다.

`useAi: false` 로 AI 보조를 강제로 끌 수 있다(키가 있어도 규칙만):

```ts
await md.moderate(text, { useAi: false })
```

## 어드민 — 규칙·신고·로그·테넌트

```ts
await md.createRule({ pattern: '도배|광고', kind: 'regex', action: 'flag' })
const rules = await md.listRules()
await md.updateRule(rules[0].id, { enabled: false })

const { items, total } = await md.listReports({ status: 'open', limit: 20 })
await md.updateReport(items[0].id, { status: 'resolved', notes: '처리 완료' })

const logs = await md.listLogs({ verdict: 'block' })
const tenant = await md.getTenant()
```

## 에러

| 에러 | 의미 |
| --- | --- |
| `PlanLimitError` (402) | 무료 플랜 소프트 한도 초과 |
| `ModerationError` (status) | 검증(400)·인증(401)·권한(403)·서버(5xx) — `.status`·`.detail` 보존 |

```ts
import { ModerationError, PlanLimitError } from '@moderationdesk/sdk'

try {
  await md.moderate(text)
} catch (e) {
  if (e instanceof PlanLimitError) upsell()
  else if (e instanceof ModerationError) log(e.status, e.message)
}
```

## 참고

- 신고 **제출**(`POST /reports`)은 publishable 키 + Origin 가드라 서버 sk 로는 못 부른다 →
  신고는 브라우저 위젯(`@moderationdesk/widget` 의 `<ReportButton>`)에서 pk 로 보낸다.
  이 SDK 는 신고 **조회/전이**(어드민)만 노출한다.
- secret 키는 절대 클라이언트로 내려보내지 말 것.
