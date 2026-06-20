import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('페이지를 찾을 수 없음')
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen place-items-center bg-bg p-6"
    >
      <div className="max-w-sm text-center">
        <p className="font-mono text-6xl font-bold text-accent">404</p>
        <h1 className="mt-3 text-lg font-semibold text-balance text-text">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          요청하신 주소가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="mt-6 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link to="/">홈으로</Link>
          </Button>
          <Button asChild>
            <Link to="/app">대시보드로 이동</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
