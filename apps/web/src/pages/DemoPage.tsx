import { createTermsDeskClient } from '@termsdesk/sdk'
import { ConsentGate } from '@termsdesk/sdk/react'
import { CheckCircle2, ListChecks, MonitorSmartphone, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePolicies } from '@/services/policies'

const DEMO_API_KEY = 'tdk_demo_publishable_key_change_me'
const TERMSDESK_DEMO_ACTION_LOG_KEY = 'termsdesk-demo-action-log-v1'
const MAX_DEMO_ACTION_LOGS = 48

const SUBJECTS = [
  { ref: 'user_1001', note: '현재 버전에 이미 동의 → 통과' },
  { ref: 'user_3090', note: '구버전에만 동의 → 재동의' },
  { ref: 'user_demo_new', note: '기록 없음 → 최초 동의' },
]

type TermsDeskDemoAction =
  | 'policy-change'
  | 'subject-preset'
  | 'subject-custom'
  | 'consent-accepted'
  | 'log-reset'

type TermsDeskDemoActionLog = {
  id: string
  at: number
  action: TermsDeskDemoAction
  label: string
  detail?: string
}

const makeDemoActionId = () => `td-demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const readDemoActionLogs = (): TermsDeskDemoActionLog[] => {
  if (typeof window === 'undefined') return []

  try {
    const raw = globalThis.localStorage.getItem(TERMSDESK_DEMO_ACTION_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is TermsDeskDemoActionLog => {
        const candidate = item as Partial<TermsDeskDemoActionLog>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.at === 'number' &&
          typeof candidate.action === 'string' &&
          typeof candidate.label === 'string'
        )
      })
      .slice(-MAX_DEMO_ACTION_LOGS)
  } catch {
    return []
  }
}

const writeDemoActionLogs = (logs: TermsDeskDemoActionLog[]) => {
  if (typeof window === 'undefined') return

  try {
    globalThis.localStorage.setItem(
      TERMSDESK_DEMO_ACTION_LOG_KEY,
      JSON.stringify(logs.slice(-MAX_DEMO_ACTION_LOGS))
    )
  } catch {
    // Demo persistence is optional.
  }
}

const formatDemoTime = (at: number) =>
  new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(at))

const SNIPPET = `import { createTermsDeskClient } from '@termsdesk/sdk'
import { ConsentGate } from '@termsdesk/sdk/react'

const client = createTermsDeskClient({
  baseUrl: 'https://terms.your-company.com',
  apiKey: 'tdk_...', // publishable
})

<ConsentGate client={client} policySlug="terms-of-service" subjectRef={userId}>
  <App />
</ConsentGate>`

export default function DemoPage() {
  useDocumentTitle('라이브 데모')
  const policies = usePolicies()
  const published = (policies.data ?? []).filter((p) => p.currentVersionId)
  const [policySlug, setPolicySlug] = useState('terms-of-service')
  const [subjectRef, setSubjectRef] = useState('user_demo_new')
  const [actionLogs, setActionLogs] = useState<TermsDeskDemoActionLog[]>(readDemoActionLogs)

  const client = useMemo(() => createTermsDeskClient({ baseUrl: '', apiKey: DEMO_API_KEY }), [])

  const appendActionLog = (action: TermsDeskDemoAction, label: string, detail?: string) => {
    setActionLogs((current) => {
      const next = [
        ...current,
        { id: makeDemoActionId(), at: Date.now(), action, label, detail },
      ].slice(-MAX_DEMO_ACTION_LOGS)
      writeDemoActionLogs(next)
      return next
    })
  }

  const clearActionLogs = () => {
    const next = [
      {
        id: makeDemoActionId(),
        at: Date.now(),
        action: 'log-reset' as const,
        label: '데모 로그 초기화',
      },
    ]
    writeDemoActionLogs(next)
    setActionLogs(next)
  }

  const demoChecks = [
    {
      id: 'policy',
      title: '정책 선택 변경',
      done: actionLogs.some((log) => log.action === 'policy-change'),
      detail: policySlug,
    },
    {
      id: 'subject',
      title: '대상 시나리오 변경',
      done: actionLogs.some(
        (log) => log.action === 'subject-preset' || log.action === 'subject-custom'
      ),
      detail: subjectRef,
    },
    {
      id: 'consent',
      title: '동의 영수증 기록',
      done: actionLogs.some((log) => log.action === 'consent-accepted'),
      detail: 'ConsentGate onConsent',
    },
    {
      id: 'guide',
      title: '가이드로 전달할 로그 생성',
      done: actionLogs.filter((log) => log.action !== 'log-reset').length >= 2,
      detail: `${actionLogs.length}건`,
    },
  ]
  const demoCompletionRate = Math.round(
    (demoChecks.filter((check) => check.done).length / demoChecks.length) * 100
  )
  const recentLogs = actionLogs.slice().reverse().slice(0, 5)

  return (
    <>
      <PageHeader
        title="라이브 데모"
        description="실제 SDK가 이 서버에 붙어 동작합니다. 대상과 정책을 바꿔 재동의 게이트를 확인하세요."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="정책" htmlFor="demo-policy">
                <Select
                  id="demo-policy"
                  value={policySlug}
                  onChange={(e) => {
                    setPolicySlug(e.target.value)
                    appendActionLog('policy-change', '정책 선택 변경', e.target.value)
                  }}
                >
                  {published.length === 0 ? (
                    <option value="terms-of-service">terms-of-service</option>
                  ) : null}
                  {published.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="대상(subjectRef)" htmlFor="demo-subject">
                <Select
                  id="demo-subject"
                  value={subjectRef}
                  onChange={(e) => {
                    setSubjectRef(e.target.value)
                    appendActionLog('subject-preset', '대상 프리셋 선택', e.target.value)
                  }}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.ref} value={s.ref}>
                      {s.ref} — {s.note}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="직접 입력"
                htmlFor="demo-custom"
                hint="새 식별자를 넣으면 최초 동의 게이트가 열립니다"
              >
                <Input
                  id="demo-custom"
                  value={subjectRef}
                  onChange={(e) => {
                    setSubjectRef(e.target.value)
                    appendActionLog('subject-preset', '대상 프리셋 선택', e.target.value)
                  }}
                  className="font-mono"
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <ListChecks className="size-4 text-text-subtle" />
                  데모 리허설 체크
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-text-subtle">
                  <span>완료율</span>
                  <span className="font-mono text-text-muted">{demoCompletionRate}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${demoCompletionRate}%` }}
                  />
                </div>
              </div>
              <ul className="space-y-2">
                {demoChecks.map((check) => (
                  <li
                    key={check.id}
                    className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/35 px-3 py-2 text-xs"
                  >
                    <CheckCircle2
                      className={
                        check.done ? 'mt-0.5 size-4 text-success' : 'mt-0.5 size-4 text-text-subtle'
                      }
                    />
                    <span>
                      <strong className="block text-text">{check.title}</strong>
                      <span className="text-text-subtle">{check.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border border-border bg-surface-2/25 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-text">최근 데모 로그</p>
                  <button
                    type="button"
                    onClick={clearActionLogs}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.7rem] text-text-muted transition-colors hover:text-text"
                  >
                    <RotateCcw className="size-3" />
                    초기화
                  </button>
                </div>
                {recentLogs.length === 0 ? (
                  <p className="text-xs text-text-subtle">
                    설정과 미리보기를 조작하면 가이드에 전달할 로그가 생깁니다.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {recentLogs.map((log) => (
                      <li
                        key={log.id}
                        className="rounded-md bg-surface px-2 py-1.5 text-xs text-text-muted"
                      >
                        <span className="font-medium text-text">{log.label}</span>
                        {log.detail ? <span> · {log.detail}</span> : null}
                        <span className="ml-2 text-text-subtle">{formatDemoTime(log.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>연동 코드</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-surface-2/60 p-3 font-mono text-xs leading-relaxed text-text-muted">
                {SNIPPET}
              </pre>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <MonitorSmartphone className="size-4 text-text-subtle" />
                고객 앱 미리보기
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-surface-2/40 p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-danger/60" />
                <span className="size-2.5 rounded-full bg-warning/60" />
                <span className="size-2.5 rounded-full bg-success/60" />
                <span className="ml-2 font-mono text-xs text-text-subtle">your-app.com</span>
              </div>
              <ConsentGate
                key={`${policySlug}:${subjectRef}`}
                client={client}
                policySlug={policySlug}
                subjectRef={subjectRef}
                allowDecline
                onConsent={() => {
                  appendActionLog(
                    'consent-accepted',
                    '동의 영수증 기록',
                    `${policySlug} / ${subjectRef}`
                  )
                  toast.success('동의 영수증이 기록되었습니다')
                }}
              >
                <div className="rounded-lg border border-success/30 bg-success-soft p-6 text-center">
                  <CheckCircle2 className="mx-auto size-7 text-success" />
                  <p className="mt-2 text-sm font-medium text-text">앱 본문이 표시됩니다</p>
                  <p className="mt-1 text-xs text-text-muted">
                    이 대상은 현재 버전에 동의한 상태입니다.
                  </p>
                  <Badge tone="success" size="sm" className="mt-3">
                    <CheckCircle2 className="size-3" />
                    동의 완료
                  </Badge>
                </div>
              </ConsentGate>
            </div>
            <p className="mt-3 text-xs text-text-subtle">
              동의/철회는 실제로 기록되어 <span className="text-text-muted">동의 영수증</span>{' '}
              목록에 나타납니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
