import {
  createEntrySchema,
  ENTRY_TAGS,
  updateEntrySchema,
  type ChangelogEntryDto,
  type CreateEntryInput,
  type EntryTag,
} from '@changelogdesk/shared'
import { Eye, PenLine } from 'lucide-react'
import { useState } from 'react'

import { MarkdownPreview } from './MarkdownPreview'

import { TagBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Input, Label, Select, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/utils/cn'

const TAG_LABELS: Record<EntryTag, string> = {
  new: '신규 기능',
  improved: '개선',
  fixed: '버그 수정',
  announcement: '공지',
}

interface FormState {
  title: string
  bodyMarkdown: string
  tag: EntryTag
  version: string
  category: string
  isPublished: boolean
}

function toForm(entry: ChangelogEntryDto | null): FormState {
  return {
    title: entry?.title ?? '',
    bodyMarkdown: entry?.bodyMarkdown ?? '',
    tag: entry?.tag ?? 'new',
    version: entry?.version ?? '',
    category: entry?.category ?? '',
    isPublished: entry?.isPublished ?? false,
  }
}

/**
 * 항목 생성·수정 다이얼로그. 작성/미리보기 탭, 태그 칩, 버전·카테고리, 게시 토글.
 * onSubmit 은 생성/수정 페이로드를 받아 저장한다(부모가 mutation 을 소유).
 */
export function EntryEditorDialog({
  open,
  onOpenChange,
  entry,
  onSubmit,
  saving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 수정 대상(없으면 신규). */
  entry: ChangelogEntryDto | null
  onSubmit: (payload: CreateEntryInput) => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(() => toForm(entry))
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [error, setError] = useState<string | null>(null)
  // entry 가 바뀌면(다른 행 편집) 폼을 다시 채운다.
  const [seededFor, setSeededFor] = useState<string | null>(entry?.id ?? null)
  const editing = entry !== null
  if (open && seededFor !== (entry?.id ?? null)) {
    setForm(toForm(entry))
    setMode('write')
    setError(null)
    setSeededFor(entry?.id ?? null)
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload: CreateEntryInput = {
      title: form.title,
      bodyMarkdown: form.bodyMarkdown,
      tag: form.tag,
      version: form.version || undefined,
      category: form.category || undefined,
      isPublished: form.isPublished,
    }
    // 생성/수정 스키마로 클라이언트 선검증(서버도 동일 스키마로 재검증).
    const schema = editing ? updateEntrySchema : createEntrySchema
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
      return
    }
    onSubmit(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? '항목 수정' : '새 항목 작성'}</DialogTitle>
          <DialogDescription>
            제목과 본문(마크다운)을 작성하고 태그·버전을 지정하세요. 게시하면 위젯에 즉시
            노출됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field label="제목" htmlFor="entry-title" required>
            <Input
              id="entry-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="예: 다크 모드 출시"
              autoFocus
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="태그" htmlFor="entry-tag" required>
              <Select
                id="entry-tag"
                value={form.tag}
                onChange={(e) => set('tag', e.target.value as EntryTag)}
              >
                {ENTRY_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {TAG_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="버전 (선택)" htmlFor="entry-version" hint="예: 2.4.0">
              <Input
                id="entry-version"
                value={form.version}
                onChange={(e) => set('version', e.target.value)}
                className="font-mono"
                placeholder="2.4.0"
              />
            </Field>
            <Field label="카테고리 (선택)" htmlFor="entry-category" hint="예: UI · API">
              <Input
                id="entry-category"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="UI"
              />
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="entry-body" className="mb-0">
                본문 (마크다운)
              </Label>
              <div
                className="inline-flex overflow-hidden rounded-md border border-border"
                role="tablist"
                aria-label="본문 보기 전환"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'write'}
                  onClick={() => setMode('write')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors',
                    mode === 'write'
                      ? 'bg-accent-soft text-accent-fg'
                      : 'text-text-muted hover:bg-surface-2'
                  )}
                >
                  <PenLine className="size-3.5" /> 작성
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'preview'}
                  onClick={() => setMode('preview')}
                  className={cn(
                    'inline-flex items-center gap-1.5 border-l border-border px-3 py-1 text-xs font-medium transition-colors',
                    mode === 'preview'
                      ? 'bg-accent-soft text-accent-fg'
                      : 'text-text-muted hover:bg-surface-2'
                  )}
                >
                  <Eye className="size-3.5" /> 미리보기
                </button>
              </div>
            </div>
            {mode === 'write' ? (
              <Textarea
                id="entry-body"
                value={form.bodyMarkdown}
                onChange={(e) => set('bodyMarkdown', e.target.value)}
                placeholder={
                  '**굵게**, *기울임*, `코드`, [링크](https://…)\n- 목록 항목\n- 또 하나'
                }
                className="min-h-40 font-mono text-[0.8125rem]"
              />
            ) : (
              <div className="min-h-40 rounded-md border border-border bg-surface-2 px-3 py-2.5">
                <MarkdownPreview markdown={form.bodyMarkdown} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <Label htmlFor="entry-publish" className="mb-0">
                지금 게시
              </Label>
              <TagBadge tag={form.tag} />
            </div>
            <Switch
              id="entry-publish"
              checked={form.isPublished}
              onCheckedChange={(v) => set('isPublished', v)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" variant="accent" loading={saving}>
              {editing ? '저장' : form.isPublished ? '작성 후 게시' : '초안 저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
