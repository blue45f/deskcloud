import { describe, expect, it } from 'vitest'

import { resolvePortfolioPublicRequest } from './portfolio-public-handler'

function searchParams(query = ''): URLSearchParams {
  return new URLSearchParams(query)
}

describe('portfolio public Vercel handler', () => {
  it('renders registered project policies without a database lookup', async () => {
    const result = await resolvePortfolioPublicRequest({
      method: 'GET',
      path: ['promptmarket', 'policies', 'terms-of-service'],
      query: searchParams('company_name=PromptMarket%20%EC%9A%B4%EC%98%81%ED%8C%80'),
    })

    expect(result?.status).toBe(200)
    expect(result?.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(result?.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(result?.body).toMatchObject({
      orgName: 'PromptMarket',
      policySlug: 'terms-of-service',
      name: '이용약관',
      versionLabel: 'v1',
    })
    expect(JSON.stringify(result?.body)).toContain('PromptMarket 운영팀')
  })

  it('renders HTML documents for registered project policies', async () => {
    const result = await resolvePortfolioPublicRequest({
      method: 'GET',
      path: ['family-care-platform', 'policies', 'privacy-policy', 'html'],
      query: searchParams('theme=light'),
    })

    expect(result?.status).toBe(200)
    expect(result?.headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(result?.body).toContain('<!doctype html>')
    expect(result?.body).toContain('Family Care Platform')
    expect(result?.body).toContain('개인정보처리방침')
  })

  it('answers CORS preflight for registered project policy paths', async () => {
    const result = await resolvePortfolioPublicRequest({
      method: 'OPTIONS',
      path: ['promptmarket', 'policies', 'terms-of-service'],
      query: searchParams(),
    })

    expect(result?.status).toBe(204)
    expect(result?.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(result?.headers['Access-Control-Allow-Methods']).toContain('GET')
    expect(result?.headers['Access-Control-Allow-Headers']).toContain('Content-Type')
    expect(result?.body).toBe('')
  })

  it('verifies registered project policy hashes', async () => {
    const result = await resolvePortfolioPublicRequest({
      method: 'GET',
      path: ['resume', 'policies', 'refund-policy', 'verify'],
      query: searchParams(),
    })

    expect(result?.status).toBe(200)
    expect(result?.headers['Content-Type']).toBe('application/json; charset=utf-8')
    expect(result?.body).toMatchObject({
      verified: true,
      orgName: 'Resume Gongbang',
      policySlug: 'refund-policy',
      versionLabel: 'v1',
    })
  })

  it('serves the generated portfolio sitemap without the upstream API', async () => {
    const result = await resolvePortfolioPublicRequest({
      method: 'GET',
      path: ['sitemap.xml'],
      query: searchParams(),
    })

    expect(result?.status).toBe(200)
    expect(result?.headers['Content-Type']).toBe('application/xml; charset=utf-8')
    expect(result?.body).toContain('<loc>https://termsdesk.vercel.app/</loc>')
    expect(result?.body).toContain(
      '<loc>https://termsdesk.vercel.app/p/promptmarket/terms-of-service</loc>'
    )
    expect(result?.body).toContain('<loc>https://termsdesk.vercel.app/support/termsdesk</loc>')
  })

  it('leaves non-policy public API requests for the existing upstream API', async () => {
    const result = await resolvePortfolioPublicRequest({
      method: 'GET',
      path: ['support', 'promptmarket', 'posts'],
      query: searchParams(),
    })

    expect(result).toBeNull()
  })
})
