const pad = (n: number): string => String(n).padStart(2, '0')

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

/** HH:MM — 메시지 버블 시각용. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}일 전`
  const mon = Math.round(day / 30)
  if (mon < 12) return `${mon}개월 전`
  return `${Math.round(mon / 12)}년 전`
}

/** 큰 수를 천단위 구분으로. (메시지 수 등) */
export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('ko-KR').format(n)
}

/** 0~1 비율을 정수 퍼센트로. */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return `${Math.round(ratio * 100)}%`
}
