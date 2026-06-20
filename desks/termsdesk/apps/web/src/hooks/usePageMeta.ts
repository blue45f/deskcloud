import { useEffect } from 'react'

const SUFFIX = 'TermsDesk'
const SITE_URL = 'https://termsdesk.vercel.app'

/** index.html 의 정적 기본값(크롤러용). 언마운트/미지정 시 이 값으로 복원. */
const DEFAULTS = {
  title: 'TermsDesk',
  description:
    '회사 약관·정책을 버전 관리하고, content_hash로 변조 방지 게시하고, 동의를 증거로 남깁니다. SaaS·셀프호스팅.',
} as const

interface PageMeta {
  /** document.title 본문(접미사 ` · TermsDesk` 자동 추가). 생략 시 'TermsDesk'. */
  title?: string
  /** og:description / twitter:description. 생략 시 정적 기본값으로 복원. */
  description?: string
  /** 정규 경로(예: '/app'). 생략 시 현재 location 사용. */
  path?: string
}

/** name= 또는 property= 메타 태그를 찾아 content 를 설정(없으면 head 에 생성). */
function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * 라우트별 메타(title + OG/Twitter description + canonical/og:url)를 설정한다.
 * 네이티브 useEffect 기반(외부 의존성 0). 크롤러(Kakao/Facebook)는 JS 를 돌리지 않으므로
 * index.html 의 정적 기본값이 1순위이고, 이 훅은 클라이언트 공유/탭 표시를 풍부하게 만든다.
 * 언마운트 시 정적 기본값으로 복원해 라우트 간 메타가 새지 않게 한다.
 */
export function usePageMeta({ title, description, path }: PageMeta = {}): void {
  useEffect(() => {
    const docTitle = title ? `${title} · ${SUFFIX}` : SUFFIX
    const ogTitle = title ? `${title} · ${SUFFIX}` : DEFAULTS.title
    const desc = description ?? DEFAULTS.description
    const url = `${SITE_URL}${path ?? globalThis.location.pathname}`

    document.title = docTitle
    setMetaTag('property', 'og:title', ogTitle)
    setMetaTag('property', 'og:description', desc)
    setMetaTag('property', 'og:url', url)
    setMetaTag('name', 'twitter:title', ogTitle)
    setMetaTag('name', 'twitter:description', desc)
    setMetaTag('name', 'description', desc)
    setCanonical(url)

    return () => {
      // 다음 라우트가 즉시 덮어쓰지 않을 수 있으므로 정적 기본값으로 복원.
      document.title = DEFAULTS.title
      setMetaTag('property', 'og:title', `${DEFAULTS.title} — 약관 버전 관리·변조 방지 게시`)
      setMetaTag('property', 'og:description', DEFAULTS.description)
      setMetaTag('property', 'og:url', `${SITE_URL}/`)
      setMetaTag('name', 'twitter:title', `${DEFAULTS.title} — 약관 버전 관리·변조 방지 게시`)
      setMetaTag('name', 'twitter:description', DEFAULTS.description)
      setMetaTag('name', 'description', DEFAULTS.description)
      setCanonical(`${SITE_URL}/`)
    }
  }, [title, description, path])
}
