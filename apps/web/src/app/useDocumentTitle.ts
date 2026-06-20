import { useEffect } from 'react'

/** 페이지별 document.title 설정(접근성·탭 식별). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · AuthDesk` : 'AuthDesk'
  }, [title])
}
