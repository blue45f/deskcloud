import { ExternalLink, FileText, Trash2 } from 'lucide-react'

import type { AssetDto } from '@mediadesk/shared'

import { TransformUrlDialog } from '@/components/feature/TransformUrlDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/feedback'
import { Tooltip } from '@/components/ui/tooltip'
import { buildTransformUrl } from '@/utils/embed'
import { formatBytes } from '@/utils/format'

function fileName(key: string): string {
  return key.split('/').pop() ?? key
}

/** 갤러리 그리드 셀 — 썸네일·메타·복사 URL·변환 URL·삭제. */
export function AssetCard({
  asset,
  onDelete,
  deleting,
}: {
  asset: AssetDto
  onDelete: (key: string) => void
  deleting: boolean
}) {
  const isImage = asset.contentType.startsWith('image/')
  const thumb =
    isImage && asset.transformable
      ? buildTransformUrl(asset.url, { w: 320, h: 320, format: 'webp', q: 70 })
      : asset.url
  const name = fileName(asset.key)

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong">
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="relative grid aspect-square place-items-center overflow-hidden bg-surface-2"
        title={`${name} 원본 열기`}
      >
        {isImage ? (
          <img
            src={thumb}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-text-subtle">
            <FileText className="size-8" aria-hidden />
            <span className="max-w-full truncate text-xs">{name}</span>
          </div>
        )}
        <span className="pointer-events-none absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="inline-grid size-6 place-items-center rounded-md bg-ink/80 text-ink-fg">
            <ExternalLink className="size-3.5" aria-hidden />
          </span>
        </span>
      </a>

      <div className="flex min-w-0 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-medium text-text" title={name}>
            {name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" size="sm">
              {asset.contentType.replace('image/', '')}
            </Badge>
            <span className="text-[0.6875rem] text-text-subtle">{formatBytes(asset.size)}</span>
            {asset.width && asset.height ? (
              <span className="text-[0.6875rem] text-text-subtle">
                {asset.width}×{asset.height}
              </span>
            ) : null}
            {asset.folder ? (
              <Badge tone="outline" size="sm">
                {asset.folder}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 border-t border-border pt-2">
          <div className="flex items-center gap-0.5">
            <Tooltip content="원본 URL 복사">
              <span>
                <CopyButton value={asset.url} label="원본 URL 복사" className="size-7" />
              </span>
            </Tooltip>
            <TransformUrlDialog asset={asset} />
          </div>
          <Tooltip content="자산 삭제">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(asset.key)}
              loading={deleting}
              aria-label={`${name} 삭제`}
              className="text-text-subtle hover:text-danger"
            >
              {deleting ? null : <Trash2 className="size-4" />}
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
