// 이미지/썸네일 유도 유틸 — 순수 함수, 네트워크 호출 없음.
//
// 임의 페이지를 크롤링하는 대신, 결정적으로 얻을 수 있는 이미지만 만든다.
//   - 브랜드 파비콘: 도메인 기반 공개 파비콘 서비스
//   - 유튜브 썸네일: 영상 ID에서 직접 유도
//   - 도서 표지: ISBN에서 Open Library 표지
// 얻을 수 없으면 null을 반환하고, UI는 타입별 플레이스홀더(브랜드 글리프)를
// 보여준다. 깨진 <img>를 노출하지 않는다.

import type { ProviderId } from './catalog'

/** 제공사 → 대표 도메인. 선명한 브랜드 마크를 위해 명시적으로 둔다. */
export const providerDomains: Record<ProviderId, string> = {
  openai: 'openai.com',
  anthropic: 'claude.com',
  google: 'gemini.google',
  xai: 'x.ai',
  manus: 'manus.im',
  kimi: 'moonshot.ai',
  deepseek: 'deepseek.com',
  qwen: 'qwen.ai',
  zhipu: 'z.ai',
  mistral: 'mistral.ai',
  meta: 'meta.com',
  cursor: 'cursor.com',
}

/** URL에서 호스트(도메인)만 안전하게 추출. */
export function getDomainFromUrl(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    return host.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * 도메인 기반 브랜드 파비콘 URL. 공개 파비콘 서비스를 사용하므로 키가 필요 없고,
 * 실패 시 UI가 플레이스홀더로 대체한다.
 */
export function getBrandIconUrl(
  domainOrUrl: string | undefined | null,
  size: 32 | 64 | 128 = 64
): string | null {
  if (!domainOrUrl) return null
  const domain = domainOrUrl.includes('/')
    ? getDomainFromUrl(domainOrUrl)
    : domainOrUrl.replace(/^www\./, '')
  if (!domain) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`
}

export function getProviderIconUrl(
  providerId: ProviderId,
  size: 32 | 64 | 128 = 64
): string | null {
  const domain = providerDomains[providerId]
  return domain ? getBrandIconUrl(domain, size) : null
}

const YT_PATTERNS = [
  /[?&]v=([\w-]{11})/, // watch?v=ID
  /youtu\.be\/([\w-]{11})/, // youtu.be/ID
  /\/embed\/([\w-]{11})/, // /embed/ID
  /\/shorts\/([\w-]{11})/, // /shorts/ID
  /\/live\/([\w-]{11})/, // /live/ID
]

/** 유튜브 영상 URL에서 영상 ID 추출. 검색/채널 URL이면 null. */
export function getYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null
  if (!/youtube\.com|youtu\.be/.test(url)) return null
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export function getYouTubeThumbnail(url: string | undefined | null): string | null {
  const id = getYouTubeId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

/** ISBN(10/13)에서 Open Library 표지 URL. 하이픈/공백 허용. */
export function getOpenLibraryCover(
  isbn: string | undefined | null,
  size: 'S' | 'M' | 'L' = 'M'
): string | null {
  if (!isbn) return null
  const clean = isbn.replace(/[^0-9Xx]/g, '')
  if (clean.length !== 10 && clean.length !== 13) return null
  return `https://covers.openlibrary.org/b/isbn/${clean}-${size}.jpg`
}

export type ResolvedImage = {
  src: string
  /** 표시 비율 힌트 — 카드 레이아웃에서 사용. */
  ratio: 'video' | 'cover' | 'square'
  kind: 'youtube' | 'cover' | 'brand'
}

/**
 * 학습 리소스용 대표 이미지 결정.
 * 우선순위: 명시 imageUrl > 유튜브 썸네일 > 도서 표지(ISBN) > 도메인 브랜드 마크.
 */
export function resolveResourceImage(resource: {
  url: string
  type?: string
  imageUrl?: string
  isbn?: string
}): ResolvedImage | null {
  if (resource.imageUrl) {
    const ratio =
      resource.type === '도서' ? 'cover' : resource.type === '강좌/영상' ? 'video' : 'square'
    return { src: resource.imageUrl, ratio, kind: ratio === 'cover' ? 'cover' : 'youtube' }
  }
  const yt = getYouTubeThumbnail(resource.url)
  if (yt) return { src: yt, ratio: 'video', kind: 'youtube' }
  const cover = getOpenLibraryCover(resource.isbn)
  if (cover) return { src: cover, ratio: 'cover', kind: 'cover' }
  const brand = getBrandIconUrl(resource.url, 128)
  return brand ? { src: brand, ratio: 'square', kind: 'brand' } : null
}

/** 확장/도구 카드용 이미지 결정. 명시 이미지가 없으면 유튜브, 지정 도메인, URL 도메인 순으로 브랜드 이미지를 만든다. */
export function resolveDirectoryImage(item: {
  url: string
  imageUrl?: string
  thumbnailUrl?: string
  thumbnailDomain?: string
  thumbnailRatio?: ResolvedImage['ratio']
}): ResolvedImage | null {
  const explicit = item.thumbnailUrl ?? item.imageUrl
  if (explicit) {
    return {
      src: explicit,
      ratio: item.thumbnailRatio ?? 'square',
      kind: 'brand',
    }
  }

  const yt = getYouTubeThumbnail(item.url)
  if (yt) return { src: yt, ratio: 'video', kind: 'youtube' }

  const domain = item.thumbnailDomain ?? item.url
  const brand = getBrandIconUrl(domain, 128)
  return brand ? { src: brand, ratio: item.thumbnailRatio ?? 'square', kind: 'brand' } : null
}
