/** 표시용 포매터 — 숫자·상대시간·날짜. */

const nf = new Intl.NumberFormat('ko-KR')

export function formatNumber(n: number): string {
  return nf.format(n)
}

/** "방금 전 · 3분 전 · 2시간 전 · 5일 전" 형태의 상대시간. 일주일 넘으면 날짜로. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 45) return '방금 전'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}일 전`
  return formatDate(iso)
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/\.$/, '')
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** 반응 집계를 합산해 총 반응 수로. */
export function sumReactions(reactions: Record<string, number | undefined>): number {
  return Object.values(reactions).reduce<number>((acc, v) => acc + (v ?? 0), 0)
}
