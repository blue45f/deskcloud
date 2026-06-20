import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

const LINKS = [
  { label: '소개', to: '/', helper: 'FileDesk 제품 개요와 업로드 흐름' },
  { label: '요금제', to: '/pricing', helper: '스토리지와 전송량 기준 플랜' },
  { label: '문의', to: '/support', helper: '공개 문의 접수와 최근 문의' },
  { label: '가입', to: '/signup', helper: '새 테넌트와 키 발급' },
  { label: '어드민 로그인', to: '/login', helper: 'Secret key 기반 관리자 진입' },
  { label: '대시보드', to: '/dashboard', helper: '버킷, 파일, 사용량 운영' },
  { label: '디자인 시스템', to: '/design', helper: '토큰, 컴포넌트, 업로드 UI 스타일가이드' },
]

export function SitemapPage(): ReactElement {
  useDocumentTitle('사이트맵')

  return (
    <>
      <section className="fd-hero">
        <span className="fd-badge fd-public">BETA</span>
        <h1>
          FileDesk <span className="fd-hero-em">사이트맵</span>
        </h1>
        <p>공개 소개, 문의, 어드민, 디자인 시스템 링크를 한 화면에 정리했습니다.</p>
      </section>

      <section className="fd-section">
        <div className="fd-sitemap-grid">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="fd-sitemap-link">
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
