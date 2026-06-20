import type { AdminPostDto } from '@communitydesk/shared'

/**
 * 검수 큐의 클라이언트 측 빠른 검색 — 서버 필터(게시판·상태·태그)로 좁힌 현재 페이지
 * 안에서, 입력한 키워드로 제목·작성자·본문·태그를 부분 일치(대소문자 무시)로 거른다.
 * 공백으로 나눈 모든 토큰을 만족(AND)해야 한다.
 */
export function matchesPostSearch(post: AdminPostDto, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const haystack = [post.title ?? '', post.authorName, post.body, post.tags.join(' ')]
    .join(' ')
    .toLowerCase()

  return tokens.every((t) => haystack.includes(t))
}

/** 키워드로 거른 글 목록(빈 키워드면 원본 그대로). */
export function filterPostsBySearch(posts: AdminPostDto[], query: string): AdminPostDto[] {
  if (!query.trim()) return posts
  return posts.filter((p) => matchesPostSearch(p, query))
}
