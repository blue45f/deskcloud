import { markdownToSafeHtml } from '@changelogdesk/shared'
import { useMemo } from 'react'

import { cn } from '@/utils/cn'

/**
 * 마크다운 미리보기 — 공유 패키지의 안전 렌더러(markdownToSafeHtml)로 변환한다.
 * raw HTML 은 전부 이스케이프되므로 dangerouslySetInnerHTML 주입이 안전하다(위젯과 동일 계약).
 */
export function MarkdownPreview({ markdown, className }: { markdown: string; className?: string }) {
  const html = useMemo(() => markdownToSafeHtml(markdown ?? ''), [markdown])
  if (!html) {
    return <p className={cn('text-sm text-text-subtle', className)}>미리볼 내용이 없습니다.</p>
  }
  // 공유 새니타이저(markdownToSafeHtml)가 raw HTML 을 전부 이스케이프하므로 주입이 안전하다(위젯과 동일 계약).
  return <div className={cn('cd-prose', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
