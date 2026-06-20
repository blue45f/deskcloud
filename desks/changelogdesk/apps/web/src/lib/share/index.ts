/**
 * 공유 유틸 — 형제 앱 desk-platform 의 share 헬퍼를 이 레포에 맞춰 차용.
 * Web Share API(모바일/지원 브라우저)를 우선 쓰고, 미지원이면 클립보드 복사로 폴백한다.
 *
 * 반환값으로 어떤 경로를 탔는지 알려 호출 측이 토스트 문구를 고를 수 있게 한다.
 *  - 'shared'  : 네이티브 공유 시트 사용
 *  - 'copied'  : 클립보드 복사 폴백
 *  - 'cancelled': 사용자가 공유 시트를 닫음(AbortError)
 *  - 'unavailable': 둘 다 불가
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable'

export interface SharePayload {
  title?: string
  text?: string
  url: string
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'AbortError'
  )
}

export async function shareLink(payload: SharePayload): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  if (nav?.share) {
    try {
      await nav.share(payload)
      return 'shared'
    } catch (err) {
      if (isAbortError(err)) return 'cancelled'
      // 공유 실패(권한 등) → 복사 폴백으로 진행.
    }
  }

  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(payload.url)
      return 'copied'
    } catch {
      return 'unavailable'
    }
  }

  return 'unavailable'
}
