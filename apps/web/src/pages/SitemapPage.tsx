import { Link } from 'react-router-dom'

import { Brand } from '@/components/layout/Brand'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const LINKS = [
  {
    label: '홈',
    to: '/',
    helper: '제품 소개와 주요 진입점',
  },
  {
    label: '가입',
    to: '/signup',
    helper: '공개 사용자가 바로 접근할 수 있는 경로',
  },
  {
    label: '문의',
    to: '/support',
    helper: '공개 사용자가 바로 접근할 수 있는 경로',
  },
  {
    label: '로그인',
    to: '/login',
    helper: '공개 사용자가 바로 접근할 수 있는 경로',
  },
  {
    label: '콘솔 홈',
    to: '/app',
    helper: '로그인 후 사용하는 운영 콘솔 경로',
  },
  {
    label: '설정',
    to: '/app/settings',
    helper: '로그인 후 사용하는 운영 콘솔 경로',
  },
  {
    label: '임베드',
    to: '/app/embed',
    helper: '로그인 후 사용하는 운영 콘솔 경로',
  },
  {
    label: '디자인 시스템',
    to: '/design',
    helper: '토큰, 컴포넌트, 제품 UI 스타일가이드',
  },
] as const

export default function SitemapPage() {
  useDocumentTitle('사이트맵')

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="ChatDesk 홈">
            <Brand />
          </Link>
          <nav
            aria-label="사이트맵 빠른 이동"
            className="flex items-center gap-3 text-sm font-medium"
          >
            <Link to="/" className="text-text-muted transition-colors hover:text-text">
              홈
            </Link>
            <Link to="/design" className="text-accent-strong transition-colors hover:text-accent">
              디자인 시스템
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-12 outline-none sm:px-6"
      >
        <p className="text-xs font-bold tracking-[0.18em] text-accent-strong uppercase">
          BETA Sitemap
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          ChatDesk 사이트맵
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
          공개 페이지, 콘솔 경로, 디자인 시스템까지 제품에서 제공하는 주요 경로를 한 화면에
          정리했습니다.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent hover:bg-accent-soft/45"
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <strong className="block text-sm font-semibold text-text">{link.label}</strong>
                  <small className="mt-1 block text-xs leading-5 text-text-muted">
                    {link.helper}
                  </small>
                </span>
                <span
                  aria-hidden
                  className="text-accent-strong transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
              <code className="mt-3 block rounded-md bg-surface-2 px-2 py-1 text-xs text-text-muted">
                {link.to}
              </code>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
