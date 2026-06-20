import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('페이지를 찾을 수 없음')
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-5xl font-semibold text-accent-strong">404</p>
        <h1 className="mt-3 text-lg font-semibold text-balance text-text">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          주소가 바뀌었거나 삭제되었을 수 있습니다.
        </p>
        <div className="mt-6 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link to="/catalog">서비스 카탈로그</Link>
          </Button>
          <Button asChild>
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
