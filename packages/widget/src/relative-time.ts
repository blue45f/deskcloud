/**
 * 상대 시간 포맷 — 외부 라이브러리 0(Intl.RelativeTimeFormat 만 사용).
 * "방금 전", "3분 전", "2시간 전", "어제", "3일 전" … 그 이상은 짧은 절대 날짜.
 *
 * 순수 함수 — now 를 주입 가능(테스트 결정성). locale 은 기본 'ko'.
 */
export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
  locale = 'ko'
): string {
  const then = new Date(iso)
  const ms = then.getTime()
  if (Number.isNaN(ms)) return ''

  const diffSec = Math.round((ms - now.getTime()) / 1000) // 과거면 음수
  const absSec = Math.abs(diffSec)

  // Intl 이 없는 (드문) 환경 폴백.
  const hasRtf = typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
  const rtf = hasRtf
    ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    : null

  if (absSec < 45) return rtf ? rtf.format(0, 'second') : '방금 전'
  if (absSec < 90) return rtf ? rtf.format(Math.round(diffSec / 60) || -1, 'minute') : '1분 전'

  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf ? rtf.format(diffMin, 'minute') : `${Math.abs(diffMin)}분 전`

  const diffHour = Math.round(diffSec / 3600)
  if (Math.abs(diffHour) < 24) return rtf ? rtf.format(diffHour, 'hour') : `${Math.abs(diffHour)}시간 전`

  const diffDay = Math.round(diffSec / 86_400)
  if (Math.abs(diffDay) < 7) return rtf ? rtf.format(diffDay, 'day') : `${Math.abs(diffDay)}일 전`

  // 일주일 이상 — 짧은 절대 날짜(연도는 다를 때만).
  const sameYear = then.getFullYear() === now.getFullYear()
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(then)
  } catch {
    return then.toISOString().slice(0, 10)
  }
}
