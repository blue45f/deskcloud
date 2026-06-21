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
})
