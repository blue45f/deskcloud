import { surveyBodySchema, type SurveyBodyInput, type SurveyDto } from '@surveydesk/shared'
import { CheckCircle2, FilePlus2, Plus, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useAppIdStore } from '@/app/appIdStore'
import { AppIdSelector } from '@/components/feature/AppIdSelector'
import {
  emptyQuestion,
  fromDraft,
  toDraft,
  type DraftQuestion,
} from '@/components/feature/questionDraft'
import { QuestionEditor } from '@/components/feature/QuestionEditor'
import { ActivePill, Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useActivateSurvey, useCreateSurvey, useSurveys, useUpdateSurvey } from '@/services/surveys'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'

type Selection = { kind: 'new' } | { kind: 'version'; version: number }

interface DraftState {
  title: string
  intro: string
  questions: DraftQuestion[]
}

function blankDraft(): DraftState {
  return { title: '', intro: '', questions: [emptyQuestion(1)] }
}

function surveyToDraft(s: SurveyDto): DraftState {
  return {
    title: s.title,
    intro: s.intro ?? '',
    questions: s.questions.map(toDraft),
  }
}

export default function EditorPage() {
  useDocumentTitle('설문 에디터')
  const appId = useAppIdStore((s) => s.appId)
  const surveysQ = useSurveys(appId)
  const createM = useCreateSurvey(appId)
  const updateM = useUpdateSurvey(appId)
  const activateM = useActivateSurvey(appId)

  const surveys = useMemo(() => surveysQ.data ?? [], [surveysQ.data])

  const [selection, setSelection] = useState<Selection>({ kind: 'new' })
  const [draft, setDraft] = useState<DraftState>(blankDraft)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmActivate, setConfirmActivate] = useState<number | null>(null)
  const [idSeed, setIdSeed] = useState(2)

  // 앱이 바뀌거나 설문 데이터가 처음 로드되면 편집 폼을 데이터 소스에 맞춰 재초기화한다
  // (가장 최신 버전 우선, 없으면 새로 만들기). React 가 권장하는 "키가 바뀔 때 렌더 중
  // 상태 조정" 패턴 — 동기 setState 를 effect 가 아니라 렌더에서 수행하므로 cascading
  // render 없이 동작하고, 이후엔 사용자가 자유롭게 편집할 수 있다.
  const resetKey = surveysQ.isLoading
    ? null
    : `${appId}:${surveys.length > 0 ? surveys[0]!.version : 'none'}`
  const [syncedKey, setSyncedKey] = useState<string | null>(null)
  if (resetKey !== null && resetKey !== syncedKey) {
    setSyncedKey(resetKey)
    if (surveys.length > 0) {
      setSelection({ kind: 'version', version: surveys[0]!.version })
      setDraft(surveyToDraft(surveys[0]!))
    } else {
      setSelection({ kind: 'new' })
      setDraft(blankDraft())
    }
    setFieldErrors({})
    setFormError(null)
  }

  const selectVersion = (v: number) => {
    const s = surveys.find((x) => x.version === v)
    if (!s) return
    setSelection({ kind: 'version', version: v })
    setDraft(surveyToDraft(s))
    setFieldErrors({})
    setFormError(null)
  }

  const startNew = () => {
    setSelection({ kind: 'new' })
    setDraft(blankDraft())
    setFieldErrors({})
    setFormError(null)
  }

  const setQuestion = (i: number, next: DraftQuestion) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q, qi) => (qi === i ? next : q)) }))
  const removeQuestion = (i: number) =>
    setDraft((d) => ({ ...d, questions: d.questions.filter((_, qi) => qi !== i) }))
  const addQuestion = () => {
    setDraft((d) => ({ ...d, questions: [...d.questions, emptyQuestion(idSeed)] }))
    setIdSeed((n) => n + 1)
  }
  const moveQuestion = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir
      if (j < 0 || j >= d.questions.length) return d
      const qs = [...d.questions]
      const tmp = qs[i]!
      qs[i] = qs[j]!
      qs[j] = tmp
      return { ...d, questions: qs }
    })

  const buildBody = (): { ok: true; body: SurveyBodyInput } | { ok: false } => {
    const candidate = {
      title: draft.title,
      intro: draft.intro.trim() === '' ? undefined : draft.intro,
      questions: draft.questions.map(fromDraft),
    }
    const parsed = surveyBodySchema.safeParse(candidate)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      let top: string | null = null
      for (const issue of parsed.error.issues) {
        const [root, idx] = issue.path
        if (root === 'questions' && typeof idx === 'number') {
          errs[String(idx)] = issue.message
        } else if (root === 'title') {
          errs.title = issue.message
        } else {
          top = issue.message
        }
      }
      setFieldErrors(errs)
      setFormError(top ?? '입력을 확인해 주세요.')
      return { ok: false }
    }
    setFieldErrors({})
    setFormError(null)
    return { ok: true, body: parsed.data }
  }

  const save = async () => {
    const built = buildBody()
    if (!built.ok) {
      toast.error('입력을 확인해 주세요.')
      return
    }
    try {
      if (selection.kind === 'new') {
        const created = await createM.mutateAsync(built.body)
        toast.success(`v${created.version} 설문을 만들었습니다. 활성화하면 위젯에 반영됩니다.`)
        setSelection({ kind: 'version', version: created.version })
      } else {
        const updated = await updateM.mutateAsync({ version: selection.version, input: built.body })
        toast.success(`v${updated.version} 설문을 저장했습니다.`)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
    }
  }

  const activate = async (version: number) => {
    try {
      await activateM.mutateAsync(version)
      toast.success(`v${version} 을 활성화했습니다.`)
      setConfirmActivate(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : '활성화에 실패했습니다.')
    }
  }

  const selectedSurvey =
    selection.kind === 'version' ? surveys.find((s) => s.version === selection.version) : undefined
  const saving = createM.isPending || updateM.isPending

  const noToken = surveysQ.error instanceof ApiError && surveysQ.error.status === 401
  // 401(인증)은 재로그인 안내, 그 외 실패는 다시 시도를 제공한다 — 빈 목록으로
  // 오해를 주지 않도록 오류와 "설문 없음"을 구분한다.
  const surveysFailed = surveysQ.isError && !noToken

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">설문 에디터</h1>
          <p className="mt-1 text-sm text-text-muted">
            테넌트 <span className="font-mono font-medium text-text">{appId}</span> 의 설문을
            구성하고 활성화합니다. 새 저장은 항상 새 버전(비활성)으로 들어갑니다.
          </p>
        </div>
      </div>

      <Card>
        <CardContent>
          <AppIdSelector />
        </CardContent>
      </Card>

      {noToken ? (
        <EmptyState
          title="인증이 필요합니다"
          description="어드민 토큰이 만료되었을 수 있습니다. 다시 로그인해 주세요."
        />
      ) : surveysFailed ? (
        <ErrorState
          title="설문을 불러오지 못했습니다"
          description="네트워크 또는 서버 문제일 수 있습니다. 잠시 후 다시 시도해 주세요."
          onRetry={() => void surveysQ.refetch()}
          retrying={surveysQ.isFetching}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* 버전 목록 */}
          <aside>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">버전</h2>
              <Button variant="secondary" size="sm" onClick={startNew}>
                <FilePlus2 className="size-3.5" /> 새 버전
              </Button>
            </div>
            {surveysQ.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {selection.kind === 'new' ? (
                  <li>
                    <div className="rounded-md border border-accent bg-accent-soft px-3 py-2.5">
                      <p className="text-sm font-medium text-accent-fg">새 설문 (미저장)</p>
                      <p className="text-xs text-accent-fg/80">
                        저장 시 v{(surveys[0]?.version ?? 0) + 1}
                      </p>
                    </div>
                  </li>
                ) : null}
                {surveys.map((s) => {
                  const selected = selection.kind === 'version' && selection.version === s.version
                  return (
                    <li key={s.version}>
                      <button
                        type="button"
                        onClick={() => selectVersion(s.version)}
                        aria-current={selected ? 'true' : undefined}
                        className={cn(
                          'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
                          selected
                            ? 'border-border-strong bg-surface-2'
                            : 'border-border bg-surface hover:bg-surface-2'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-text">v{s.version}</span>
                          <ActivePill active={s.active} />
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">{s.title}</p>
                        <p className="mt-0.5 text-[0.6875rem] text-text-subtle">
                          {formatDateTime(s.updatedAt)}
                        </p>
                      </button>
                    </li>
                  )
                })}
                {surveys.length === 0 && selection.kind !== 'new' ? (
                  <li className="text-sm text-text-subtle">설문이 아직 없습니다.</li>
                ) : null}
              </ul>
            )}
          </aside>

          {/* 편집 폼 */}
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text">
                  {selection.kind === 'new' ? '새 설문' : `v${selection.version} 편집`}
                </h2>
                {selectedSurvey ? <ActivePill active={selectedSurvey.active} /> : null}
              </div>
              <div className="flex items-center gap-2">
                {selectedSurvey && !selectedSurvey.active ? (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => setConfirmActivate(selectedSurvey.version)}
                  >
                    <CheckCircle2 className="size-4" /> 활성화
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void save()} loading={saving}>
                  <Save className="size-4" />
                  {selection.kind === 'new' ? '새 버전으로 저장' : '저장'}
                </Button>
              </div>
            </div>

            {formError ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>설문 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="제목" htmlFor="survey-title" required error={fieldErrors.title}>
                  <Input
                    id="survey-title"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="예: 데모 앱은 어떠셨나요?"
                    aria-invalid={Boolean(fieldErrors.title)}
                  />
                </Field>
                <Field
                  label="안내문 (선택)"
                  htmlFor="survey-intro"
                  hint="위젯 상단에 노출되는 짧은 안내."
                >
                  <Textarea
                    id="survey-intro"
                    value={draft.intro}
                    onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))}
                    placeholder="몇 가지 짧은 질문에 답해 주시면 큰 도움이 됩니다."
                    className="min-h-20"
                  />
                </Field>
              </CardContent>
            </Card>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">
                  질문{' '}
                  <Badge tone="neutral" size="sm">
                    {draft.questions.length}
                  </Badge>
                </h3>
              </div>
              <div className="space-y-3">
                {draft.questions.map((q, i) => (
                  <QuestionEditor
                    key={i}
                    question={q}
                    index={i}
                    total={draft.questions.length}
                    error={fieldErrors[String(i)]}
                    onChange={(next) => setQuestion(i, next)}
                    onRemove={() => removeQuestion(i)}
                    onMove={(dir) => moveQuestion(i, dir)}
                  />
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={addQuestion}>
                <Plus className="size-3.5" /> 질문 추가
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 활성화 확인 */}
      <Dialog
        open={confirmActivate !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmActivate(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>v{confirmActivate} 을 활성화할까요?</DialogTitle>
            <DialogDescription>
              활성화하면 기존 활성본은 자동으로 내려가고, 위젯은 즉시 이 버전을 받게 됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button
              variant="accent"
              size="sm"
              loading={activateM.isPending}
              onClick={() => confirmActivate !== null && void activate(confirmActivate)}
            >
              활성화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
