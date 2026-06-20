// 공유 공통 유틸 — Web Share API(모바일/일부 데스크톱) 우선, 미지원/취소 시 클립보드 복사 폴백.
// 프레임워크 무관 순수 함수라 형제 앱(desk-platform)에서 그대로 벤더링했다(디자인 의존성 없음).

export interface ShareInput {
  /** 공유 제목(미지원 시 복사 텍스트에 포함). */
  title?: string
  /** 공유 설명. */
  text?: string
  /** 공유 URL. 생략 시 현재 location.href. */
  url?: string
}

/** 'shared'=네이티브 공유 완료, 'copied'=클립보드 복사 폴백, 'dismissed'=사용자 취소, 'unsupported'=둘 다 불가. */
export type ShareResult = 'shared' | 'copied' | 'dismissed' | 'unsupported'

/** title/text/url을 사람이 읽을 한 줄로(클립보드 폴백용). */
function toCopyText(input: ShareInput, url: string): string {
  return [input.title, input.text, url].filter(Boolean).join(' — ') || url
}

/** 텍스트를 클립보드에 복사한다(현대 API → execCommand 폴백). 성공 여부 반환. */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 아래 레거시 폴백으로.
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
  return false
}

/**
 * 콘텐츠를 공유한다. 네이티브 공유 시트가 있으면 그걸 쓰고, 없거나 실패하면 URL을 클립보드에 복사한다.
 * - 사용자가 네이티브 시트를 닫으면 `'dismissed'`(에러로 취급하지 않음).
 * - SSR/비브라우저 환경에서도 throw하지 않고 `'unsupported'`를 반환한다.
 */
export async function shareOrCopy(input: ShareInput = {}): Promise<ShareResult> {
  if (typeof navigator === 'undefined') return 'unsupported'
  const url = input.url ?? (typeof location !== 'undefined' ? location.href : '')
  const data: ShareData = { title: input.title, text: input.text, url }

  // 1) Web Share API
  if (typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
        await navigator.share(data)
        return 'shared'
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'dismissed'
      // 그 외 오류는 클립보드 폴백으로.
    }
  }

  // 2) 클립보드 복사 폴백
  return (await copyText(toCopyText(input, url))) ? 'copied' : 'unsupported'
}
