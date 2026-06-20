import { Component } from 'react'

import type { ErrorInfo, ReactElement, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** 친절한 폴백 — 앱 CSS 토큰만 사용(외부 프레임워크 0). 새로고침/홈 이동 제공. */
function ErrorFallback({ onReset }: { onReset: () => void }): ReactElement {
  return (
    <main role="alert" className="ax-main">
      <section
        className="ax-card"
        style={{ maxWidth: 520, margin: '64px auto 0', textAlign: 'center' }}
      >
        <h1 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
          문제가 발생했습니다
        </h1>
        <p className="ax-muted" style={{ margin: '0 0 20px' }}>
          예기치 못한 오류로 화면을 표시하지 못했습니다. 다시 시도하거나 잠시 후 새로고침해 주세요.
        </p>
        <div className="ax-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="ax-btn ax-btn-primary" onClick={onReset}>
            다시 시도
          </button>
          <a className="ax-btn" href="/">
            홈으로
          </a>
        </div>
      </section>
    </main>
  )
}

/**
 * 최상위 에러 바운더리 — 렌더 중 던져진 예외로 SPA 전체가 빈 화면이 되는 것을 막는다.
 *
 * 라우터의 errorElement는 라우트 트리 내부 예외만 잡으므로, lazy 청크 로드 실패나
 * provider 트리 예외 등 그 밖에서 새어 나오는 렌더 throw를 여기서 가둔다.
 * (에러 바운더리는 React 규약상 클래스 컴포넌트여야 한다.)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 모니터링 훅 포인트. 내부 정보를 사용자에게 노출하지 않고 디버깅용으로만 기록.
    console.error('처리되지 않은 렌더 오류:', error, info.componentStack)
  }

  private readonly handleReset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback onReset={this.handleReset} />
    }
    return this.props.children
  }
}
