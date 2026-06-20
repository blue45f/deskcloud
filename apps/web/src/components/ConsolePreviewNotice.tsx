import { ArrowRight, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * 백엔드 미연결 빌드(공개 쇼케이스)에서 가입/로그인/대시보드 대신 보여주는 안내.
 * 연결 에러를 노출하는 대신, 콘솔이 곧 열린다는 의도된 상태로 표시한다.
 */
export function ConsolePreviewNotice({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <Badge tone="accent" size="sm">
        비공개 프리뷰
      </Badge>
      <h1 className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-tight text-text">
        <Clock className="size-5 text-accent-fg" aria-hidden />
        {title}
      </h1>
      <p className="mt-3 text-sm text-pretty text-text-muted">
        DeskCloud 콘솔(가입·로그인·사용량/빌링 대시보드)은 백엔드 연결 후 활성화됩니다. 그동안
        아래에서 서비스 카탈로그·요금제·문서·라이브 디자인 시스템을 둘러보실 수 있습니다.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/catalog">
            서비스 카탈로그 <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/pricing">요금제</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/docs">문서</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/sitemap">사이트맵</Link>
        </Button>
      </div>
    </div>
  )
}
