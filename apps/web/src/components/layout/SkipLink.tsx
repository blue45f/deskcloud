/**
 * 키보드 사용자가 헤더/내비를 건너뛰고 본문(#main-content)으로 바로 이동하는 링크.
 * 평소엔 sr-only 로 숨고 포커스를 받으면 좌상단에 나타난다. 트리의 첫 포커스 요소여야 한다.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-ink focus:bg-ink focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-ink-fg"
    >
      본문으로 건너뛰기
    </a>
  );
}
