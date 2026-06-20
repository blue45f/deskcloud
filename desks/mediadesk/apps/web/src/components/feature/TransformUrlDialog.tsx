import { Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AssetDto } from '@mediadesk/shared'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CopyButton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { buildTransformUrl } from '@/utils/embed'

/**
 * 변환 URL 빌더 — 자산에 w/h/format/q 를 붙여 즉시 미리보기 + 복사. 비-이미지(transformable=false)는
 * 변환 의미가 없어 원본 URL만 제공한다(서버는 graceful 하게 원본을 서빙).
 */
export function TransformUrlDialog({ asset }: { asset: AssetDto }) {
  const [w, setW] = useState('320')
  const [h, setH] = useState('')
  const [format, setFormat] = useState('webp')
  const [q, setQ] = useState('75')

  const url = useMemo(
    () =>
      buildTransformUrl(asset.url, {
        w: w ? Number(w) : undefined,
        h: h ? Number(h) : undefined,
        format: format || undefined,
        q: q ? Number(q) : undefined,
      }),
    [asset.url, w, h, format, q]
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Wand2 className="size-3.5" />
          변환 URL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>변환 URL 만들기</DialogTitle>
          <DialogDescription>
            {asset.transformable
              ? '리사이즈·포맷·품질 파라미터를 붙입니다. sharp 가 가능하면 변환본을, 아니면 원본을 서빙합니다.'
              : '이 자산은 래스터 이미지가 아니라 변환되지 않습니다 — 항상 원본이 서빙됩니다.'}
          </DialogDescription>
        </DialogHeader>

        {asset.transformable ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="너비 w (px)" htmlFor="t-w">
              <Input
                id="t-w"
                inputMode="numeric"
                value={w}
                onChange={(e) => setW(e.target.value.replace(/\D/g, ''))}
                placeholder="예: 320"
              />
            </Field>
            <Field label="높이 h (px)" htmlFor="t-h">
              <Input
                id="t-h"
                inputMode="numeric"
                value={h}
                onChange={(e) => setH(e.target.value.replace(/\D/g, ''))}
                placeholder="비우면 비율 유지"
              />
            </Field>
            <Field label="포맷" htmlFor="t-format">
              <Select id="t-format" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="">원본 유지</option>
                <option value="webp">webp</option>
                <option value="avif">avif</option>
                <option value="jpeg">jpeg</option>
                <option value="png">png</option>
              </Select>
            </Field>
            <Field label="품질 q (1–100)" htmlFor="t-q">
              <Input
                id="t-q"
                inputMode="numeric"
                value={q}
                onChange={(e) => setQ(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="예: 75"
              />
            </Field>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">미리보기</span>
          </div>
          <div className="grid place-items-center rounded-lg border border-border bg-surface-2 p-4">
            {asset.contentType.startsWith('image/') ? (
              <img
                src={url}
                alt={`${asset.key} 미리보기`}
                className="max-h-48 max-w-full rounded-md object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <p className="py-6 text-sm text-text-subtle">
                이미지가 아니라 미리보기를 표시할 수 없습니다.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-text" title={url}>
            {url}
          </code>
          <CopyButton value={url} label="변환 URL 복사" className="size-6" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
