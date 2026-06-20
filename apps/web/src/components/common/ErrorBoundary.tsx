import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}
interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = (): void => this.setState({ hasError: false, error: null })

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-text">문제가 발생했습니다</h2>
          <p className="mt-2 text-sm text-text-muted">
            {this.state.error?.message ?? '알 수 없는 오류가 발생했습니다.'}
          </p>
          <Button className="mt-5" onClick={this.reset}>
            다시 시도
          </Button>
        </div>
      </div>
    )
  }
}
