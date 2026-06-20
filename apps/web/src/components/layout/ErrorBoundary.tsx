import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** 바운더리 리셋(다시 시도) 시 함께 호출 — 외부 캐시·상태 리셋 연결용. */
  onReset?: () => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * 컴포넌트 레벨 에러 바운더리 — 렌더 throw(콘텐츠 빌드 파싱, 프로바이더 트리 예외 등)가
 * 전체 SPA 를 백스크린으로 만드는 것을 막는다.
 * 에러 바운더리는 클래스 컴포넌트로만 구현되므로 여기만 예외적으로 클래스를 쓴다.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 사용자에겐 원문을 노출하지 않되, 운영 모니터링 전송 지점 + 디버깅을 위해 콘솔엔 남긴다.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <main
          role="alert"
          className="grid min-h-screen place-items-center bg-bg px-4 text-text"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center">
            <h1 className="text-xl font-semibold text-text">
              문제가 발생했어요
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              예상치 못한 오류로 화면을 표시하지 못했어요. 다시 시도하거나 홈으로
              돌아가 주세요.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex h-9 items-center rounded-md border border-ink bg-ink px-4 text-xs font-semibold text-ink-fg transition hover:opacity-90"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => {
                  globalThis.location.href = "/";
                }}
                className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
              >
                홈으로
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
