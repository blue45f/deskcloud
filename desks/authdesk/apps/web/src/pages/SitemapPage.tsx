import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

const LINKS = [
  { label: '소개', to: '/', helper: 'AuthDesk 제품 개요와 인증 흐름' },
  { label: '요금제', to: '/pricing', helper: 'Free/Pro 플랜과 사용량 한도' },
  { label: '문의', to: '/support', helper: '공개 문의 접수와 답변 상태' },
  { label: '콘솔 로그인', to: '/login', helper: 'Secret key 기반 운영자 진입' },
  { label: '가입', to: '/signup', helper: '새 테넌트와 인증 설정 생성' },
  { label: '대시보드', to: '/dashboard', helper: '회원, 세션, 인증 이벤트 관리' },
  { label: '디자인 시스템', to: '/design', helper: '토큰, 컴포넌트, 인증 UI 스타일가이드' },
]

export function SitemapPage(): ReactElement {
  useDocumentTitle('사이트맵')

  return (
    <>
      <section className="ad-hero">
        <span className="ad-badge ad-accentish">BETA</span>
        <h1>
          AuthDesk <span className="ad-grad">사이트맵</span>
        </h1>
        <p>제품 소개, 문의, 콘솔, 디자인 시스템으로 가는 경로를 한 화면에 모았습니다.</p>
      </section>

      <section className="ad-section">
        <div className="ad-sitemap-grid">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="ad-sitemap-link">
              <span>
                <strong>{link.label}</strong>
                <small>{link.helper}</small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
