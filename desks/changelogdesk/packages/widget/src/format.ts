/** 위젯용 날짜 포맷 — 의존성 0. ISO 문자열 → 짧은 로컬 날짜(예: "2026. 6. 14."). */
export function formatEntryDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** 태그별 사람이 읽는 라벨(chip 텍스트). */
const TAG_LABELS: Record<string, string> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
  announcement: 'News',
}

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag
}
