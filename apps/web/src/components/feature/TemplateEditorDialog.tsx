import {
  CHANNELS,
  TEMPLATE_VAR_RE,
  type Channel,
  type CreateTemplateInput,
  type TemplateDto,
} from '@notifydesk/shared'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ChannelBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox, Field, Input, Label, Textarea } from '@/components/ui/field'
import { ApiError } from '@/services/api'
import { useCreateTemplate, useUpdateTemplate } from '@/services/notifications'

const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: 'in-app (인박스)',
  email: 'email',
  web_push: 'web-push',
}

/** `{{var}}` 토큰을 추출해 미리보기/안내에 쓴다. */
function extractVars(text: string): string[] {
  const set = new Set<string>()
  for (const m of text.matchAll(TEMPLATE_VAR_RE)) {
    if (m[1]) set.add(m[1])
  }
  return [...set]
}

/**
 * 템플릿 생성/수정 다이얼로그. key 는 생성 시에만 입력(수정은 경로 고정).
 * 채널·subject·bodyTemplate 을 편집하고, 본문의 {{변수}} 를 추출해 안내한다.
 */
export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 있으면 수정, 없으면 생성. */
  template?: TemplateDto | null
}) {
  const isEdit = Boolean(template)
  const create = useCreateTemplate()
  const update = useUpdateTemplate()

  const [key, setKey] = useState(template?.key ?? '')
  const [channels, setChannels] = useState<Channel[]>(template?.channels ?? ['in_app'])
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [bodyTemplate, setBodyTemplate] = useState(template?.bodyTemplate ?? '')

  const vars = useMemo(
    () => extractVars(`${subject} ${bodyTemplate}`),
    [subject, bodyTemplate]
  )

  const toggleChannel = (c: Channel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEdit && !key.trim()) {
      toast.error('템플릿 key 를 입력해 주세요.')
      return
    }
    if (channels.length === 0) {
      toast.error('채널을 1개 이상 선택해 주세요.')
      return
    }
    if (!bodyTemplate.trim()) {
      toast.error('본문 템플릿을 입력해 주세요.')
      return
    }

    const body: CreateTemplateInput = {
      key: key.trim(),
      channels,
      subject: subject.trim() ? subject.trim() : undefined,
      bodyTemplate: bodyTemplate.trim(),
    }

    try {
      if (isEdit && template) {
        const { key: _key, ...rest } = body
        await update.mutateAsync({ key: template.key, input: rest })
        toast.success('템플릿이 수정되었습니다.')
      } else {
        await create.mutateAsync(body)
        toast.success('템플릿이 생성되었습니다.')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했습니다.')
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>{isEdit ? `템플릿 수정 · ${template?.key}` : '새 템플릿'}</DialogTitle>
          <DialogDescription>
            본문에 <code className="font-mono">{'{{변수}}'}</code> 를 쓰면 발송 시 data 로 치환됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field
            label="key"
            htmlFor="tpl-key"
            hint={isEdit ? '수정 시 key 는 변경할 수 없습니다.' : '예: order.shipped · 영숫자·._- 만'}
            required={!isEdit}
          >
            <Input
              id="tpl-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="font-mono"
              placeholder="order.shipped"
              disabled={isEdit}
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-[0.8125rem] font-medium text-text">채널</legend>
            <div className="space-y-2">
              {CHANNELS.map((c) => (
                <label
                  key={c}
                  htmlFor={`tpl-ch-${c}`}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <Checkbox
                    id={`tpl-ch-${c}`}
                    checked={channels.includes(c)}
                    onChange={() => toggleChannel(c)}
                    disabled={c === 'in_app'}
                  />
                  <span className="flex-1 text-sm text-text">{CHANNEL_LABEL[c]}</span>
                  {c === 'in_app' ? (
                    <span className="text-xs text-text-subtle">항상 켜짐</span>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="제목 (subject, 선택)" htmlFor="tpl-subject" hint="email/web-push 제목. 변수 사용 가능.">
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="주문 {{orderId}} 이(가) 발송되었습니다"
            />
          </Field>

          <Field label="본문 템플릿" htmlFor="tpl-body" required>
            <Textarea
              id="tpl-body"
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={4}
              placeholder="{{name}}님, 주문 {{orderId}} 이(가) {{carrier}} 로 발송되었어요."
            />
          </Field>

          {vars.length > 0 ? (
            <div>
              <Label className="mb-1.5">사용된 변수</Label>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <span
                    key={v}
                    className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs text-text-muted"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <Label className="mb-1.5">선택된 채널</Label>
            <div className="flex flex-wrap gap-1.5">
              {channels.length > 0 ? (
                channels.map((c) => <ChannelBadge key={c} channel={c} size="md" />)
              ) : (
                <span className="text-xs text-text-subtle">없음</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              {isEdit ? '저장' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
