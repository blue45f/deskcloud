import { Link } from 'react-router-dom'

import { Brand } from '@/components/layout/Brand'

const COLUMNS = [
  {
    title: '제품',
    links: [
      { to: '/catalog', label: '서비스 카탈로그' },
      { to: '/pricing', label: '요금제' },
      { to: '/docs', label: '문서' },
    ],
  },
  {
    title: '시작하기',
    links: [
      { to: '/signup', label: '가입' },
      { to: '/login', label: '로그인' },
      { to: '/dashboard', label: '대시보드' },
    ],
  },
  {
    title: '리소스',
    links: [
      { to: '/design', label: '디자인 시스템' },
      { to: '/docs', label: '임베드 가이드' },
    ],
  },
] as const

/** 공개 페이지 공통 푸터. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Brand />
            <p className="mt-3 text-[0.8125rem] text-pretty text-text-muted">
              여러 SaaS 를 하나의 계정·빌링으로 묶는 DeskCloud 패밀리. 가입 한 번, 한 줄 임베드로
              어떤 Desk든 바로 붙입니다.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-xs font-semibold tracking-wide text-text-subtle uppercase">
                {col.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-text-muted transition-colors hover:text-text">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DeskCloud · @desk/platform</p>
          <p>결제는 TEST/STUB 모드 — 실제 청구가 발생하지 않습니다.</p>
        </div>
      </div>
    </footer>
  )
}
