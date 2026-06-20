import { Link } from 'react-router-dom'

import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('페이지를 찾을 수 없음')
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <div id="main-content" tabIndex={-1} className="max-w-md text-center outline-none">
        <Link to="/" aria-label="홈으로" className="inline-flex">
          <Brand />
        </Link>
        <p className="mt-8 font-mono text-5xl font-semibold text-accent">404</p>
        <h1 className="mt-3 text-lg font-semibold text-balance text-text">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          주소가 바뀌었거나 삭제되었을 수 있습니다.
        </p>
        <div className="mt-6 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link to="/">홈으로</Link>
          </Button>
          <Button asChild>
            <Link to="/app">대시보드</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
