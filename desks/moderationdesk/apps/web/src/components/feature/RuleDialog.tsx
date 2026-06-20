import {
  RULE_PATTERN_MAX,
  type CreateRuleInput,
  type RuleAction,
  type RuleDto,
  type RuleKind,
  type UpdateRuleInput,
} from '@moderationdesk/shared'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Label, Select } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { useCreateRule, useUpdateRule } from '@/services/moderation'

const KIND_OPTIONS: { value: RuleKind; label: string }[] = [
  { value: 'substring', label: '부분일치 (substring)' },
  { value: 'exact', label: '완전일치 (exact)' },
  { value: 'regex', label: '정규식 (regex)' },
]

const ACTION_OPTIONS: { value: RuleAction; label: string }[] = [
  { value: 'block', label: '차단 (block → block)' },
  { value: 'flag', label: '주의 (flag → flag)' },
  { value: 'review', label: '검토 (review → flag)' },
]

/** 잘못된 정규식 패턴을 클라이언트에서 미리 검증(서버 superRefine 미러). */
function regexError(kind: RuleKind, pattern: string): string | null {
  if (kind !== 'regex' || !pattern) return null
  try {
    new RegExp(pattern, 'iu')
    return null
  } catch {
    return '유효한 정규식이 아닙니다'
  }
}

/** 금칙 규칙 생성/수정 다이얼로그. rule 이 있으면 수정, 없으면 생성. */
export function RuleDialog({
  rule,
  credKey,
  open,
  onOpenChange,
}: {
  rule: RuleDto | null
  credKey: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = rule !== null
  const create = useCreateRule(credKey)
  const update = useUpdateRule(credKey)

  const [pattern, setPattern] = useState('')
  const [kind, setKind] = useState<RuleKind>('substring')
  const [action, setAction] = useState<RuleAction>('block')
  const [label, setLabel] = useState('')
  const [enabled, setEnabled] = useState(true)

  // 열릴 때마다 폼 초기화. 컨트롤드 다이얼로그는 상시 마운트라 이 동기화 effect 가 올바르다
  // (React Compiler set-state-in-effect 휴리스틱만 의도적으로 완화한다).
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 열림/레코드 변경 시 폼 동기화(상시 마운트 다이얼로그)
      setPattern(rule?.pattern ?? '')
      setKind(rule?.kind ?? 'substring')
      setAction(rule?.action ?? 'block')
      setLabel(rule?.label ?? '')
      setEnabled(rule?.enabled ?? true)
    }
  }, [open, rule])

  const reErr = regexError(kind, pattern.trim())
  const pending = create.isPending || update.isPending

  const save = () => {
    const trimmed = pattern.trim()
    if (!trimmed) {
      toast.error('패턴을 입력해 주세요.')
      return
    }
    if (reErr) {
      toast.error(reErr)
      return
    }
    const onError = (e: unknown) =>
      toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.')
    const onSuccess = () => {
      toast.success(isEdit ? '규칙이 수정되었습니다.' : '규칙이 생성되었습니다.')
      onOpenChange(false)
    }

    if (isEdit && rule) {
      const input: UpdateRuleInput = {
        pattern: trimmed,
        kind,
        action,
        label: label.trim() ? label.trim() : undefined,
        enabled,
      }
      update.mutate({ id: rule.id, input }, { onSuccess, onError })
    } else {
      const input: CreateRuleInput = {
        pattern: trimmed,
        kind,
        action,
        label: label.trim() ? label.trim() : undefined,
        enabled,
      }
      create.mutate(input, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>{isEdit ? '규칙 수정' : '금칙 규칙 추가'}</DialogTitle>
          <DialogDescription>
            패턴이 텍스트에 매칭되면 선택한 액션으로 verdict 가 산출됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field
            label="패턴"
            htmlFor="rule-pattern"
            required
            error={reErr ?? undefined}
            hint={
              kind === 'regex'
                ? '정규식(대소문자 무시, u 플래그). 예: \\b(buy|cheap)\\s+now\\b'
                : kind === 'exact'
                  ? '텍스트 전체가 패턴과 정확히 같을 때 매칭'
                  : '텍스트가 패턴을 포함하면 매칭(대소문자 무시)'
            }
          >
            <Input
              id="rule-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={kind === 'regex' ? '\\b(spam|광고)\\b' : 'spam'}
              maxLength={RULE_PATTERN_MAX}
              className="font-mono"
              aria-invalid={reErr ? true : undefined}
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="매칭 종류" htmlFor="rule-kind">
              <Select
                id="rule-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as RuleKind)}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="액션" htmlFor="rule-action">
              <Select
                id="rule-action"
                value={action}
                onChange={(e) => setAction(e.target.value as RuleAction)}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="라벨 (선택)"
            htmlFor="rule-label"
            hint="운영용 메모. 로그·목록에 함께 표시."
          >
            <Input
              id="rule-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 스팸 키워드"
            />
          </Field>

          <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5">
            <Label htmlFor="rule-enabled" className="mb-0">
              활성화 (검사 시 평가)
            </Label>
            <Switch id="rule-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={save} loading={pending}>
            {isEdit ? '저장' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
