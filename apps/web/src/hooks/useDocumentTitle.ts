import { useEffect } from 'react'

const SUFFIX = 'ModerationDesk'

/** 페이지별 document.title 설정. (RouteAnnouncer 가 이 값을 읽어 스크린리더에 안내) */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX
  }, [title])
}
