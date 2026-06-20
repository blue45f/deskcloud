import { useEffect, useState } from 'react'

/**
 * Apps-in-Toss(토스 인앱) WebView 감지 유틸.
 *
 * 토스 앱의 WebView 는 user-agent 에 `toss` 토큰을 실어 보내므로, 이를 근거로
 * 인앱 여부를 추정한다. 일반 모바일/데스크톱 브라우저에서는 false 가 된다.
 * 별도 SDK 의존성 없이 점진 도입할 수 있도록 navigator 만 참조한다.
 *
 * 정밀한 인앱 브리지 호출이 아니라 "인앱이면 UI 를 가볍게 조정" 수준의 휴리스틱이다.
 */

/**
 * 현재 실행 환경이 토스 인앱(WebView)인지 추정한다.
 * SSR/프리렌더 등 navigator 가 없는 환경에서도 안전하게 false 를 반환한다.
 */
export function isTossInApp(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (!ua) return false
  return /toss/i.test(ua)
}

/**
 * isTossInApp() 의 React 훅 버전.
 *
 * 첫 렌더는 false 로 시작하고 마운트 후 effect 에서 실제 값을 채운다 — 이렇게 하면
 * SSR/하이드레이션 시 서버(false)와 클라이언트 마크업이 어긋나지 않는다.
 */
export function useTossInApp(): boolean {
  const [inApp, setInApp] = useState(false)
  useEffect(() => {
    setInApp(isTossInApp())
  }, [])
  return inApp
}
