/**
 * 의존성 없는 최소 마크다운 → 안전 HTML 변환.
 *
 * 위젯이 임베드되는 외부 사이트에 그대로 주입되므로 XSS 안전이 최우선이다:
 *  1) 먼저 모든 입력을 HTML 이스케이프(raw HTML 태그는 절대 통과시키지 않음)
 *  2) 이스케이프된 텍스트 위에서만 화이트리스트 인라인/블록 마크다운을 재구성
 *  3) 링크는 http/https/mailto 만 허용(javascript: 등은 제거) + rel/target 강제
 *
 * 풀 CommonMark 가 아니라 체인지로그에 충분한 부분집합: 제목·목록·강조·코드·링크·단락.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** HTML 특수문자 이스케이프 — raw HTML 주입 차단의 1차 방어선. */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]!)
}

/** 안전한 링크 스킴만 허용(이미 이스케이프된 href 기준). */
function safeHref(href: string): string | null {
  const trimmed = href.trim()
  // 이스케이프 후라 콜론이 살아있음. 스킴 화이트리스트.
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  return null
}

/** 이스케이프된 한 줄에 인라인 마크다운(코드·강조·링크) 적용. */
function inline(escaped: string): string {
  let s = escaped

  // 인라인 코드 `code` (다른 인라인 처리 전에)
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)

  // 링크 [text](href)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const safe = safeHref(href)
    if (!safe) return text
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`
  })

  // 굵게 **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, t: string) => `<strong>${t}</strong>`)
  // 기울임 *text* (굵게 이후)
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, (_m, pre: string, t: string) => `${pre}<em>${t}</em>`)

  return s
}

/**
 * 마크다운 문자열을 새니타이즈된 HTML 로 변환한다(순수 함수).
 * raw HTML 은 전부 이스케이프되어 무력화되므로 위젯에 안전하게 주입할 수 있다.
 */
export function markdownToSafeHtml(markdown: string): string {
  const escaped = escapeHtml(markdown.replace(/\r\n?/g, '\n'))
  const lines = escaped.split('\n')
  const html: string[] = []

  let listType: 'ul' | 'ol' | null = null
  let paragraph: string[] = []
  let inCode = false
  let codeBuf: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }
  const closeList = (): void => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  for (const line of lines) {
    // 코드펜스 ```
    if (/^```/.test(line.trim())) {
      if (inCode) {
        html.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        flushParagraph()
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }

    const trimmed = line.trim()

    // 빈 줄 → 단락/목록 종료
    if (trimmed === '') {
      flushParagraph()
      closeList()
      continue
    }

    // 제목 # … ######
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      closeList()
      const level = Math.min(6, heading[1]!.length)
      html.push(`<h${level}>${inline(heading[2]!)}</h${level}>`)
      continue
    }

    // 순서 없는 목록 - / *
    const ul = /^[-*]\s+(.*)$/.exec(trimmed)
    if (ul) {
      flushParagraph()
      if (listType !== 'ul') {
        closeList()
        html.push('<ul>')
        listType = 'ul'
      }
      html.push(`<li>${inline(ul[1]!)}</li>`)
      continue
    }

    // 순서 있는 목록 1.
    const ol = /^\d+\.\s+(.*)$/.exec(trimmed)
    if (ol) {
      flushParagraph()
      if (listType !== 'ol') {
        closeList()
        html.push('<ol>')
        listType = 'ol'
      }
      html.push(`<li>${inline(ol[1]!)}</li>`)
      continue
    }

    // 일반 텍스트 → 단락 누적
    closeList()
    paragraph.push(trimmed)
  }

  if (inCode) html.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
  flushParagraph()
  closeList()

  return html.join('\n')
}
