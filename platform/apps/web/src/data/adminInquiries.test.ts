import { describe, expect, it } from 'vitest'

import { buildAdminInquirySummary, inquiryOriginHost } from './adminInquiries'

import type { InquiryAdminDto } from '@desk/shared/browser'

let nextId = 0

function inquiry(partial: Partial<InquiryAdminDto>): InquiryAdminDto {
  return {
    id: `inq-${++nextId}`,
    appId: 'rotifolk',
    category: 'partnership',
    status: 'new',
    title: '문의',
    body: '본문',
    authorName: null,
    contactEmail: null,
    originUrl: null,
    originHost: null,
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z',
    ...partial,
  }
}

describe('admin inquiry operations summary', () => {
  it('normalizes origin host from the API field or originUrl fallback', () => {
    expect(inquiryOriginHost(inquiry({ originHost: 'app.example.com' }))).toBe('app.example.com')
    expect(inquiryOriginHost(inquiry({ originUrl: 'https://Admin.Example.com/support' }))).toBe(
      'admin.example.com'
    )
    expect(inquiryOriginHost(inquiry({ originUrl: 'not-a-url' }))).toBeNull()
  })

  it('summarizes status and service-domain facets for the admin console', () => {
    const summary = buildAdminInquirySummary([
      inquiry({ status: 'new', originHost: 'app.example.com' }),
      inquiry({ status: 'in_progress', originHost: 'app.example.com' }),
      inquiry({ status: 'resolved', originHost: 'admin.example.com' }),
      inquiry({ status: 'closed', originUrl: null }),
    ])

    expect(summary.total).toBe(4)
    expect(summary.open).toBe(2)
    expect(summary.missingOrigin).toBe(1)
    expect(summary.statusCounts).toMatchObject({
      new: 1,
      in_progress: 1,
      resolved: 1,
      closed: 1,
    })
    expect(summary.origins).toEqual([
      { host: 'app.example.com', count: 2, openCount: 2 },
      { host: 'admin.example.com', count: 1, openCount: 0 },
    ])
  })
})
