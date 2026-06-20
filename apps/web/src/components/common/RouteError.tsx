import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function RouteError() {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : null
  const message = isRouteErrorResponse(error)
    ? error.statusText || '페이지를 찾을 수 없습니다'
    : error instanceof Error
      ? error.message
      : '알 수 없는 오류가 발생했습니다'

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        {status ? <p className="font-mono text-5xl font-semibold text-accent">{status}</p> : null}
        <h1 className="mt-3 text-lg font-semibold text-balance text-text">{message}</h1>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          일시적인 문제일 수 있습니다. 다시 시도하거나 다른 페이지로 이동해 주세요.
        </p>
        <div className="mt-6 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
          <Button asChild>
            <Link to="/app">대시보드로 돌아가기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
