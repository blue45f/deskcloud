import { INQUIRY_STATUSES, type InquiryAdminDto, type InquiryStatus } from '@desk/shared/browser'

export interface InquiryOriginFacet {
  host: string
  count: number
  openCount: number
}

export interface AdminInquirySummary {
  total: number
  open: number
  missingOrigin: number
  statusCounts: Record<InquiryStatus, number>
  origins: InquiryOriginFacet[]
}

const EMPTY_STATUS_COUNTS = Object.fromEntries(
  INQUIRY_STATUSES.map((status) => [status, 0])
) as Record<InquiryStatus, number>

function copyStatusCounts(): Record<InquiryStatus, number> {
  return { ...EMPTY_STATUS_COUNTS }
}

export function inquiryOriginHost(inquiry: InquiryAdminDto): string | null {
  if (inquiry.originHost) return inquiry.originHost
  if (!inquiry.originUrl) return null
  try {
    return new URL(inquiry.originUrl).host.toLowerCase()
  } catch {
    return null
  }
}

export function buildAdminInquirySummary(items: readonly InquiryAdminDto[]): AdminInquirySummary {
  const statusCounts = copyStatusCounts()
  const originCounts = new Map<string, { count: number; openCount: number }>()
  let missingOrigin = 0
  let open = 0

  for (const item of items) {
    statusCounts[item.status] += 1
    const isOpen = item.status === 'new' || item.status === 'in_progress'
    if (isOpen) open += 1

    const host = inquiryOriginHost(item)
    if (!host) {
      missingOrigin += 1
      continue
    }

    const current = originCounts.get(host) ?? { count: 0, openCount: 0 }
    current.count += 1
    if (isOpen) current.openCount += 1
    originCounts.set(host, current)
  }

  const origins = [...originCounts.entries()]
    .map(([host, counts]) => ({ host, ...counts }))
    .toSorted((a, b) => b.count - a.count || a.host.localeCompare(b.host))

  return {
    total: items.length,
    open,
    missingOrigin,
    statusCounts,
    origins,
  }
}
