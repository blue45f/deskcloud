import { describe, expect, it } from 'vitest'

import {
  buildPortfolioSitemapXml,
  findPortfolioPolicy,
  getPortfolioProject,
  PORTFOLIO_PROJECTS,
  renderPortfolioPolicy,
  TERMSDESK_PUBLIC_BASE_URL,
} from './portfolio-legal'

describe('portfolio legal catalog', () => {
  it('renders a TermsDesk-hosted terms document for a sibling project', async () => {
    const dto = await renderPortfolioPolicy('promptmarket', 'terms-of-service', {
      vars: { company_name: 'PromptMarket 운영팀' },
    })

    expect(dto.orgName).toBe('PromptMarket')
    expect(dto.policySlug).toBe('terms-of-service')
    expect(dto.name).toBe('이용약관')
    expect(dto.availableVersions).toEqual(['v1'])
    expect(dto.body).toContain('PromptMarket 운영팀')
    expect(dto.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('exposes support board URLs for every registered sibling project', () => {
    const project = getPortfolioProject('termsdesk')

    expect(project?.supportUrl).toBe(`${TERMSDESK_PUBLIC_BASE_URL}/support/termsdesk`)
  })

  it('exposes expected public document URLs per project', () => {
    const project = getPortfolioProject('proto-live')

    expect(project).toBeDefined()
    expect(project?.supportUrl).toBe(`${TERMSDESK_PUBLIC_BASE_URL}/support/proto-live`)
    expect(project?.supportUrl).toBe(`${TERMSDESK_PUBLIC_BASE_URL}/support/${project?.slug}`)
  })

  it('returns undefined for unknown project or policy slugs', () => {
    expect(findPortfolioPolicy('missing-project', 'terms-of-service')).toBeUndefined()
    expect(findPortfolioPolicy('promptmarket', 'missing-policy')).toBeUndefined()
  })

  it('serializes a sitemap covering the landing, every policy, and every support board', () => {
    const xml = buildPortfolioSitemapXml()
    const expectedUrls =
      1 + PORTFOLIO_PROJECTS.reduce((count, project) => count + project.policies.length + 1, 0)

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.match(/<loc>/g)).toHaveLength(expectedUrls)
    expect(xml).toContain(`<loc>${TERMSDESK_PUBLIC_BASE_URL}/</loc>`)
    expect(xml).toContain(`<loc>${TERMSDESK_PUBLIC_BASE_URL}/p/promptmarket/terms-of-service</loc>`)
    expect(xml).toContain(`<loc>${TERMSDESK_PUBLIC_BASE_URL}/p/offhours/refund-policy</loc>`)
    expect(xml).toContain(`<loc>${TERMSDESK_PUBLIC_BASE_URL}/support/termsdesk</loc>`)
    expect(xml).toContain('<lastmod>2026-06-08</lastmod>')
  })

  it('guarantees all seeded projects expose terms and privacy policies with clean variable resolution', async () => {
    for (const project of PORTFOLIO_PROJECTS) {
      const terms = findPortfolioPolicy(project.slug, 'terms-of-service')
      const privacy = findPortfolioPolicy(project.slug, 'privacy-policy')

      expect(terms).toBeDefined()
      expect(privacy).toBeDefined()
      expect(project.supportUrl).toMatch(
        /^https:\/\/desk-platform\.vercel\.app\/termsdesk\/support\/[a-z0-9-]+$/
      )

      const termsDoc = `${TERMSDESK_PUBLIC_BASE_URL}/p/${project.slug}/terms-of-service`
      const privacyDoc = `${TERMSDESK_PUBLIC_BASE_URL}/p/${project.slug}/privacy-policy`

      expect(termsDoc).toMatch(
        /^https:\/\/desk-platform\.vercel\.app\/termsdesk\/p\/[a-z0-9-]+\/terms-of-service$/
      )
      expect(privacyDoc).toMatch(
        /^https:\/\/desk-platform\.vercel\.app\/termsdesk\/p\/[a-z0-9-]+\/privacy-policy$/
      )

      const rendered = await renderPortfolioPolicy(project.slug, 'terms-of-service', {
        vars: { company_name: `${project.name} 운영팀` },
      })
      expect(rendered.unresolvedVars).toEqual([])
      expect(rendered.body).toContain(`${project.name} 운영팀`)

      const renderedPrivacy = await renderPortfolioPolicy(project.slug, 'privacy-policy', {
        vars: { company_name: `${project.name} 운영팀` },
      })
      expect(renderedPrivacy.unresolvedVars).toEqual([])
      expect(renderedPrivacy.body).toContain(`${project.name} 운영팀`)
    }
  })
})
