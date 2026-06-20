import { Component } from 'react'

import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * 앱 최상위 에러 바운더리.
 *
 * 렌더 중 예외가 나면 React 는 트리 전체를 언마운트해 빈 화면(흰 화면)이 된다.
 * 이 컴포넌트가 그 예외를 잡아 친절한 폴백 UI로 대체하고, "다시 시도"(상태 리셋)와
 * "홈으로"(전체 리로드) 회복 경로를 제공한다. 시각 시스템은 기존 fd-* 토큰만 사용한다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[FileDesk] 처리되지 않은 렌더 오류', error, info)
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false })
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="fd-shell">
        <main className="fd-main">
          <section className="fd-hero" role="alert">
            <h1 style={{ fontSize: 30 }}>문제가 발생했어요</h1>
            <p>
              화면을 그리는 중에 예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가
              계속되면 문의 게시판으로 알려 주세요.
            </p>
            <div className="fd-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="fd-btn fd-btn-primary" onClick={this.handleReset}>
                다시 시도
              </button>
              <a className="fd-btn" href="/">
                홈으로
              </a>
              <a className="fd-btn" href="/support">
                문의하기
              </a>
            </div>
          </section>
        </main>
      </div>
    )
  }
}
