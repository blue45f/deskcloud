import { type NotifyInput, type NotifyResultDto, type TemplateDto } from '@notifydesk/shared'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ChannelBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ApiError } from '@/services/api'
import { useSendNotification } from '@/services/notifications'

/**
 * 알림 발송 컴포저 — 템플릿 선택 또는 애드혹(title/body). recipientId·type 필수.
 * 발송 성공 시 deliveries 요약을 토스트로 안내하고 onSent 콜백을 호출(인박스 프리뷰 갱신 등).
 */
export function SendComposer({
  templates,
  onSent,
  defaultRecipientId = 'user_demo',
}: {
  templates: TemplateDto[]
  onSent?: (result: NotifyResultDto) => void
  defaultRecipientId?: string
}) {
  const send = useSendNotification()

  const [recipientId, setRecipientId] = useState(defaultRecipientId)
  const [mode, setMode] = useState<'template' | 'adhoc'>(
    templates.length > 0 ? 'template' : 'adhoc'
  )
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? '')
  const [type, setType] = useState('system')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dataText, setDataText] = useState('')
  const [email, setEmail] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rid = recipientId.trim()
    if (!rid) {
      toast.error('recipientId 를 입력해 주세요.')
      return
    }

    let data: Record<string, unknown> | undefined
    if (dataText.trim()) {
      try {
        const parsed = JSON.parse(dataText) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          data = parsed as Record<string, unknown>
        } else {
          toast.error('data 는 JSON 객체여야 합니다.')
          return
        }
      } catch {
        toast.error('data JSON 을 파싱할 수 없습니다.')
        return
      }
    }

    const effectiveType =
      mode === 'template' ? (templateKey.trim() || type.trim() || 'system') : type.trim() || 'system'

    const payload: NotifyInput =
      mode === 'template'
        ? {
            recipientId: rid,
            type: effectiveType,
            templateKey: templateKey.trim(),
            ...(data ? { data } : {}),
            ...(email.trim() ? { email: email.trim() } : {}),
          }
        : {
            recipientId: rid,
            type: effectiveType,
            ...(title.trim() ? { title: title.trim() } : {}),
            body: body.trim(),
            ...(data ? { data } : {}),
            ...(email.trim() ? { email: email.trim() } : {}),
          }

    if (mode === 'adhoc' && !body.trim()) {
      toast.error('애드혹 발송은 본문(body)이 필요합니다.')
      return
    }
    if (mode === 'template' && !templateKey.trim()) {
      toast.error('발송할 템플릿을 선택해 주세요.')
      return
    }

    try {
      const result = await send.mutateAsync(payload)
      if (result.capExceeded) {
        toast.warning('무료 플랜 발송 한도를 초과했습니다. 발송이 거부되었습니다.')
      } else {
        const delivered = result.deliveries.filter((d) => d.status === 'delivered')
        toast.success(
          `발송 완료 — ${delivered.map((d) => d.channel).join(', ') || 'in_app'}` +
            (result.suppressed.length ? ` · 억제 ${result.suppressed.join(', ')}` : '')
        )
      }
      onSent?.(result)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '발송에 실패했습니다.')
    }
  }

  const selectedTemplate = templates.find((t) => t.key === templateKey)

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="recipientId" htmlFor="send-rid" hint="알림을 받을 사용자 식별자" required>
          <Input
            id="send-rid"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            className="font-mono"
            placeholder="user_42"
          />
        </Field>
        <Field label="발송 방식" htmlFor="send-mode">
          <Select
            id="send-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'template' | 'adhoc')}
          >
            <option value="template" disabled={templates.length === 0}>
              템플릿 렌더{templates.length === 0 ? ' (템플릿 없음)' : ''}
            </option>
            <option value="adhoc">애드혹 (직접 입력)</option>
          </Select>
        </Field>
      </div>

      {mode === 'template' ? (
        <>
          <Field label="템플릿" htmlFor="send-tpl">
            <Select
              id="send-tpl"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key}
                </option>
              ))}
            </Select>
          </Field>
          {selectedTemplate ? (
            <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-xs text-text-muted">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {selectedTemplate.channels.map((c) => (
                  <ChannelBadge key={c} channel={c} />
                ))}
              </div>
              {selectedTemplate.subject ? (
                <p className="font-medium text-text">{selectedTemplate.subject}</p>
              ) : null}
              <p className="mt-0.5 font-mono whitespace-pre-wrap">{selectedTemplate.bodyTemplate}</p>
            </div>
          ) : null}
          <Field
            label="템플릿 변수 (data, JSON)"
            htmlFor="send-data"
            hint='예: {"name":"지은","orderId":"A-1024"}'
          >
            <Textarea
              id="send-data"
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              className="font-mono"
              rows={3}
              placeholder='{"name":"지은"}'
            />
          </Field>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="type (분류·선호 키)" htmlFor="send-type" required>
              <Input
                id="send-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="font-mono"
                placeholder="system"
              />
            </Field>
            <Field label="제목 (선택)" htmlFor="send-title">
              <Input
                id="send-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="환영합니다"
              />
            </Field>
          </div>
          <Field label="본문" htmlFor="send-body" required>
            <Textarea
              id="send-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="가입을 축하해요!"
            />
          </Field>
        </>
      )}

      <Field label="이메일 수신 주소 (선택)" htmlFor="send-email" hint="email 채널이 활성일 때 사용">
        <Input
          id="send-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="font-mono"
          placeholder="user@example.com"
        />
      </Field>

      <Button type="submit" loading={send.isPending}>
        <Send className="size-4" />
        발송
      </Button>
    </form>
  )
}
