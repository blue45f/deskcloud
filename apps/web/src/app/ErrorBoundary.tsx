import { Component } from 'react'

import type { ErrorInfo, ReactElement, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * 최상위 에러 바운더리 — 렌더 중 발생한 예외를 잡아 빈 화면 대신 친절한 폴백을
 * 보여준다. "다시 시도"로 바운더리를 리셋하고, 그래도 안 되면 새로고침을 안내한다.
 * 라우터의 errorElement(로더/액션 에러)와 함께 런타임 렌더 에러까지 덮는다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AuthDesk] 렌더 중 오류:', error, info)
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false })
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <section className="ad-hero" role="alert">
        <h1 style={{ fontSize: 28 }}>문제가 발생했습니다</h1>
        <p className="ad-muted">
          화면을 표시하는 중 예기치 못한 오류가 생겼습니다. 다시 시도하거나, 계속 문제가 있으면
          페이지를 새로고침해 주세요.
        </p>
        <div className="ad-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="ad-btn ad-btn-primary" onClick={this.handleReset}>
            다시 시도
          </button>
          <button
            type="button"
            className="ad-btn"
            onClick={() => {
              window.location.reload()
            }}
          >
            새로고침
          </button>
        </div>
      </section>
    )
  }
}

/** 라우터 errorElement용 — 라우트 로더/렌더 에러 시 동일한 폴백 UI 를 보여준다. */
export function RouteErrorBoundary(): ReactElement {
  return (
    <section className="ad-hero" role="alert">
      <h1 style={{ fontSize: 28 }}>페이지를 불러오지 못했습니다</h1>
      <p className="ad-muted">
        요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <div className="ad-row" style={{ justifyContent: 'center' }}>
        <a className="ad-btn ad-btn-primary" href="/">
          홈으로
        </a>
        <button
          type="button"
          className="ad-btn"
          onClick={() => {
            window.location.reload()
          }}
        >
          새로고침
        </button>
      </div>
    </section>
  )
}
