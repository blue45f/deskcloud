import { useEffect } from "react";

const BASE = "AIDigestDesk";
const DEFAULT_TITLE = `${BASE} · 한국어 AI/LLM 큐레이션 포털`;

/**
 * 페이지(라우트)별 document.title 설정 — SPA 에서 탭·북마크·공유 타이틀을 화면 내용에 맞춘다.
 * title 이 비면 기본 타이틀로 둔다. 언마운트 시 기본값으로 복원해 잔존을 막는다.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
