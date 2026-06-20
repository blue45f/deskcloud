import { useState } from 'react'

import { cn } from '@/utils/cn'

/**
 * 조직(프로젝트) 아이콘 — 로고 URL이 있으면 이미지를, 없거나 로드에 실패하면
 * 조직명 이니셜 모노그램(bg-accent-soft)을 보여준다. 공개 약관·지원 보드 헤더용.
 */
export function OrgIcon({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl?: string | null
  className?: string
}) {
  // URL 별로 실패를 기억 — logoUrl 이 바뀌면(미리보기 수정 등) 자동으로 다시 시도한다.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = !!logoUrl && logoUrl !== failedUrl
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?'

  return (
    <span
      aria-hidden="true"
      data-testid="org-icon"
      className={cn(
        'grid size-7 shrink-0 select-none place-items-center overflow-hidden rounded-lg bg-accent-soft text-xs font-bold text-accent-strong',
        className
      )}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        initial
      )}
    </span>
  )
}
