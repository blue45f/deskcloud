import { QUESTION_TYPES, type QuestionType } from '@surveydesk/shared'
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react'

import { isChoice, TYPE_LABELS, type DraftQuestion } from '@/components/feature/questionDraft'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Label, Select } from '@/components/ui/field'
import { cn } from '@/utils/cn'

export function QuestionEditor({
  question,
  index,
  total,
  error,
  onChange,
  onRemove,
  onMove,
}: {
  question: DraftQuestion
  index: number
  total: number
  error?: string
  onChange: (next: DraftQuestion) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const set = (patch: Partial<DraftQuestion>) => onChange({ ...question, ...patch })

  const changeType = (type: QuestionType) => {
    set({
      type,
      variant: type === 'text' ? (question.variant ?? 'short') : undefined,
      options: isChoice(type)
        ? question.options.length > 0
          ? question.options
          : [
              { value: 'opt1', label: '' },
              { value: 'opt2', label: '' },
            ]
        : [],
    })
  }

  const setOption = (i: number, patch: Partial<{ value: string; label: string }>) => {
    set({ options: question.options.map((o, oi) => (oi === i ? { ...o, ...patch } : o)) })
  }
  const addOption = () =>
    set({
      options: [...question.options, { value: `opt${question.options.length + 1}`, label: '' }],
    })
  const removeOption = (i: number) => set({ options: question.options.filter((_, oi) => oi !== i) })

  return (
    <div
      className={cn('rounded-lg border bg-surface p-4', error ? 'border-danger' : 'border-border')}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1.5 flex flex-col items-center gap-1 text-text-subtle">
          <GripVertical className="size-4" aria-hidden />
          <span className="font-mono text-xs">{index + 1}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor={`q-label-${index}`}>질문 라벨</Label>
              <Input
                id={`q-label-${index}`}
                value={question.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="예: 전반적인 만족도"
              />
            </div>
            <div>
              <Label htmlFor={`q-type-${index}`}>유형</Label>
              <Select
                id={`q-type-${index}`}
                value={question.type}
                onChange={(e) => changeType(e.target.value as QuestionType)}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`q-id-${index}`}>질문 id (answers 키)</Label>
              <Input
                id={`q-id-${index}`}
                value={question.id}
                onChange={(e) => set({ id: e.target.value })}
                placeholder="q_rating"
                className="font-mono"
              />
            </div>
            {question.type === 'text' ? (
              <div>
                <Label htmlFor={`q-variant-${index}`}>길이</Label>
                <Select
                  id={`q-variant-${index}`}
                  value={question.variant ?? 'short'}
                  onChange={(e) => set({ variant: e.target.value as 'short' | 'long' })}
                >
                  <option value="short">짧게 (280자)</option>
                  <option value="long">길게 (4000자)</option>
                </Select>
              </div>
            ) : null}
          </div>

          {/* 선택지 편집 */}
          {isChoice(question.type) ? (
            <div className="rounded-md border border-border bg-bg p-3">
              <p className="mb-2 text-xs font-medium text-text-subtle">보기 (1개 이상)</p>
              <div className="space-y-2">
                {question.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      value={o.value}
                      onChange={(e) => setOption(oi, { value: e.target.value })}
                      placeholder="value"
                      aria-label={`보기 ${oi + 1} value`}
                      className="max-w-32 font-mono text-xs"
                    />
                    <Input
                      value={o.label}
                      onChange={(e) => setOption(oi, { label: e.target.value })}
                      placeholder="표시 라벨"
                      aria-label={`보기 ${oi + 1} 라벨`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOption(oi)}
                      disabled={question.options.length <= 1}
                      aria-label={`보기 ${oi + 1} 삭제`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addOption}
              >
                <Plus className="size-3.5" /> 보기 추가
              </Button>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Checkbox
              id={`q-required-${index}`}
              checked={question.required}
              onChange={(e) => set({ required: e.target.checked })}
            />
            <Label htmlFor={`q-required-${index}`} className="mb-0">
              필수 응답
            </Label>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="위로 이동"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="아래로 이동"
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            disabled={total <= 1}
            aria-label="질문 삭제"
          >
            <Trash2 className="size-4 text-danger" />
          </Button>
        </div>
      </div>
    </div>
  )
}
