import { useEffect, useRef, useState } from "react";

/**
 * SPA 라우트 변경 a11y 보강: 새 페이지 타이틀을 aria-live 로 안내하고,
 * 본문(#main-content)으로 포커스를 옮기고, 상단으로 스크롤한다.
 * 이 앱은 react-router 없이 pushState/popstate + route 상태로 화면을 전환하므로
 * useLocation 대신 현재 route 키를 의존성으로 받는다.
 * 첫 진입(직접 연 위치)은 건너뛰고, prefers-reduced-motion 을 존중한다.
 * 타이틀은 각 라우트의 useDocumentTitle 이 설정하므로 rAF 한 프레임 뒤에 읽는다.
 */
export function RouteAnnouncer({ routeKey }: { routeKey: string }) {
  const [message, setMessage] = useState("");
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }

    const frame = requestAnimationFrame(() => {
      setMessage(`${document.title} 페이지로 이동했습니다`);

      document.getElementById("main-content")?.focus({ preventScroll: true });

      const prefersReducedMotion = globalThis.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      globalThis.scrollTo({
        top: 0,
        left: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [routeKey]);

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
