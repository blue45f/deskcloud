import { CalendarPlus } from 'lucide-react'

import type { PolicyDto, PolicyVersionSummaryDto } from '@termsdesk/shared'

import { Button } from '@/components/ui/button'
import { publicSiteUrl } from '@/config/urls'
import { useSession } from '@/services/auth'
import { downloadIcs } from '@/utils/buildIcs'

const HOUR_MS = 60 * 60 * 1000

/**
 * 시행 예정(effectiveAt 이 미래)인 게시 버전을 ICS 파일로 내보내는 버튼.
 * 컴플라이언스 담당자가 새 약관 시행일을 팀 캘린더에 등록하는 용도.
 * 조건에 해당하지 않으면(이미 발효·미게시) 아무것도 렌더하지 않는다.
 */
export function AddToCalendarButton({
  policy,
  version,
  className,
}: {
  policy: PolicyDto
  version: PolicyVersionSummaryDto
  className?: string
}) {
  const session = useSession()

  const effectiveAt = version.effectiveAt
  if (version.status !== 'published' || !effectiveAt) return null
  if (new Date(effectiveAt).getTime() <= Date.now()) return null

  const onDownload = () => {
    const orgSlug = session.data?.org.slug ?? '_'
    const startAt = new Date(effectiveAt)
    const notes = [`${policy.name} ${version.versionLabel} 시행`]
    if (version.changeSummary) notes.push(`변경 요약: ${version.changeSummary}`)
    if (version.requiresReconsent) notes.push('재동의가 필요한 중대한 변경입니다.')

    downloadIcs(
      {
        uid: `termsdesk-version-${version.id}`,
        title: `[약관 시행] ${policy.name} ${version.versionLabel}`,
        description: notes.join('\n'),
        startAt,
        endAt: new Date(startAt.getTime() + HOUR_MS),
        url: publicSiteUrl(`/p/${orgSlug}/${policy.slug}?version=${version.versionLabel}`),
      },
      `termsdesk-${policy.slug}-${version.versionLabel}.ics`
    )
  }

  return (
    <Button variant="secondary" size="sm" className={className} onClick={onDownload}>
      <CalendarPlus className="size-4" />
      캘린더에 추가
    </Button>
  )
}
