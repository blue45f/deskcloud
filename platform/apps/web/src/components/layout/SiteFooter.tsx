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
      { to: '/sitemap', label: '사이트맵' },
      { to: '/docs', label: '통합 가이드' },
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
              여러 SaaS 를 하나의 계정·빌링으로 묶는 DeskCloud 패밀리. 가입 한 번, 단일 SDK 설치로
              어떤 Desk든 앱 안에서 네이티브로 렌더합니다.
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
                    <Link
                      to={l.to}
                      className="text-sm text-text-muted transition-colors hover:text-text"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-8 text-[11px] text-text-subtle space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 leading-relaxed">
            <div>
              <p className="font-semibold text-text-muted">상호: 에이치준랩스</p>
              <p>대표자: 김희준 | 개인정보보호책임자: 김희준</p>
            </div>
            <div>
              <p>사업자등록번호: 355-07-03473</p>
              <p>주소: 서울특별시 송파구 가락로34길 13, 101호(방이동)</p>
            </div>
            <div>
              <p>이메일: blue45f@gmail.com</p>
              <p>전화번호: 010-3873-4197</p>
            </div>
            <div>
              <p>호스팅 서비스: Vercel (Frontend)</p>
              <p>플랫폼 형태: 멀티테넌트 SaaS 플랫폼 모노레포</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} DeskCloud (Beta) · @desk/platform. All rights reserved.</p>
            <p>결제는 TEST/STUB 모드 — 실제 청구가 발생하지 않습니다.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
