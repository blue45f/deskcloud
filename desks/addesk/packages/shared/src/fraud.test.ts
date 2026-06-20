import { describe, expect, it } from 'vitest'

import { isBotUserAgent } from './fraud'

describe('isBotUserAgent', () => {
  it('UA 가 없거나 빈 문자열이면 봇이 아님(통과)', () => {
    expect(isBotUserAgent(undefined)).toBe(false)
    expect(isBotUserAgent(null)).toBe(false)
    expect(isBotUserAgent('')).toBe(false)
  })

  it('일반 브라우저 UA 는 봇이 아님', () => {
    const chrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    expect(isBotUserAgent(chrome)).toBe(false)
    const safariMobile =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(isBotUserAgent(safariMobile)).toBe(false)
  })

  it('명백한 봇/크롤러/헤드리스 시그니처는 봇으로 판정', () => {
    expect(isBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true)
    expect(isBotUserAgent('curl/8.4.0')).toBe(true)
    expect(isBotUserAgent('python-requests/2.31.0')).toBe(true)
    expect(isBotUserAgent('HeadlessChrome/124.0.0.0')).toBe(true)
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true)
  })

  it('대소문자 무관(소문자 부분일치)', () => {
    expect(isBotUserAgent('SomeCrawlerSpider')).toBe(true)
    expect(isBotUserAgent('MY-BOT-AGENT')).toBe(true)
  })
})
