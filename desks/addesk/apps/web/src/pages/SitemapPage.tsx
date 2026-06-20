import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

interface SitemapSection {
  title: string
  description: string
  links: { label: string; to: string; helper: string }[]
}

const SECTIONS: SitemapSection[] = [
  {
    title: '공개 페이지',
    description: '제품 소개와 가격, 문의 흐름을 빠르게 확인합니다.',
    links: [
      { label: '소개', to: '/', helper: '광고 서빙과 분석 흐름' },
      { label: '요금제', to: '/pricing', helper: 'Free/Pro 한도와 기능' },
      { label: '문의', to: '/support', helper: '공개 문의 접수와 최근 문의' },
      { label: '디자인 시스템', to: '/design', helper: '토큰, 컴포넌트, 위젯 스타일가이드' },
    ],
  },
  {
    title: '어드민',
    description: '테넌트 키로 로그인한 뒤 캠페인과 슬롯을 운영합니다.',
    links: [
      { label: '어드민 로그인', to: '/login', helper: 'Secret key 기반 관리자 진입' },
      { label: '가입', to: '/signup', helper: '새 테넌트와 초기 키 발급' },
      { label: '대시보드', to: '/dashboard', helper: '캠페인, 크리에이티브, 슬롯, CTR' },
    ],
  },
]

export function SitemapPage(): ReactElement {
  useDocumentTitle('사이트맵')

  return (
    <>
      <section className="ax-hero" style={{ paddingBottom: 8 }}>
        <span className="ax-badge ax-on ax-enter ax-enter-1">BETA</span>
        <h1 className="ax-enter ax-enter-1" style={{ fontSize: 32 }}>
          AdDesk <span className="ax-grad-text">사이트맵</span>
        </h1>
        <p className="ax-enter ax-enter-2">
          공개 소개, 문의, 어드민, 디자인 시스템을 한 화면에서 찾을 수 있습니다.
        </p>
      </section>

      <section className="ax-section">
        <div className="ax-sitemap-grid">
          {SECTIONS.map((section) => (
            <article key={section.title} className="ax-card ax-card-i">
              <h2 style={{ margin: 0 }}>{section.title}</h2>
              <p className="ax-muted" style={{ margin: '6px 0 18px', fontSize: 14 }}>
                {section.description}
              </p>
              <div className="ax-stack">
                {section.links.map((link) => (
                  <Link key={link.to} to={link.to} className="ax-sitemap-link">
                    <span>
                      <strong>{link.label}</strong>
                      <small>{link.helper}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
