import { describe, expect, it } from 'vitest'

import { parseAdminAccounts } from './config'

describe('parseAdminAccounts', () => {
  it('parses semicolon-separated admin account records', () => {
    expect(
      parseAdminAccounts(
        'owner|DeskCloud Owner|owner|admin:*|owner-token;support|Support Desk|support|inquiries:read|support-token'
      )
    ).toEqual([
      {
        id: 'owner',
        label: 'DeskCloud Owner',
        role: 'owner',
        scopes: ['admin:*'],
        token: 'owner-token',
      },
      {
        id: 'support',
        label: 'Support Desk',
        role: 'support',
        scopes: ['inquiries:read'],
        token: 'support-token',
      },
    ])
  })

  it('falls back to safe role and read-only scope for malformed role/scope values', () => {
    expect(parseAdminAccounts('ops|Ops|unknown|bogus|ops-token')).toEqual([
      {
        id: 'ops',
        label: 'Ops',
        role: 'operator',
        scopes: ['inquiries:read'],
        token: 'ops-token',
      },
    ])
  })

  it('parses optional 6th field as appId allowlist (lowercased), absent → global', () => {
    expect(
      parseAdminAccounts(
        'picky|Picky Ops|operator|inquiries:read+inquiries:write|picky-token|Picky+Demo;glob|Global|owner|admin:*|g-token'
      )
    ).toEqual([
      {
        id: 'picky',
        label: 'Picky Ops',
        role: 'operator',
        scopes: ['inquiries:read', 'inquiries:write'],
        token: 'picky-token',
        appIds: ['picky', 'demo'],
      },
      {
        id: 'glob',
        label: 'Global',
        role: 'owner',
        scopes: ['admin:*'],
        token: 'g-token',
        appIds: undefined,
      },
    ])
  })
})
