import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

const PRODUCT_LINKS = [
  { to: '/', label: '소개' },
  { to: '/pricing', label: '요금제' },
  { to: '/sitemap', label: '사이트맵' },
]

const ACCOUNT_LINKS = [
  { to: '/signup', label: '가입' },
  { to: '/login', label: '어드민 로그인' },
  { to: '/dashboard', label: '대시보드' },
]

const RESOURCE_LINKS = [
  { to: '/support', label: '문의' },
  { to: '/pricing', label: '플랜 한도' },
]

/** 사이트 푸터 — 사이트맵 + 상태 표시. 앱 셸 하단에 1회 마운트. */
export function SiteFooter(): ReactElement {
  const year = new Date().getFullYear()
  return (
    <footer className="fd-footer">
      <div className="fd-footer-inner">
        <div className="fd-footer-brand">
          <Link to="/" className="fd-brand">
            <span className="fd-brand-mark" aria-hidden="true">
              F
            </span>
            FileDesk
          </Link>
          <p className="fd-footer-tag">
            외부 온보딩형 멀티테넌트 파일 업로드/스토리지 모듈. 한 줄로 임베드하고, 키로 관리하세요.
          </p>
        </div>

        <nav className="fd-footer-col" aria-label="제품">
          <h4>제품</h4>
          <ul>
            {PRODUCT_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="fd-footer-col" aria-label="계정">
          <h4>계정</h4>
          <ul>
            {ACCOUNT_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="fd-footer-col" aria-label="리소스">
          <h4>리소스</h4>
          <ul>
            {RESOURCE_LINKS.map((l) => (
              <li key={l.label}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="fd-footer-bottom">
        <span>© {year} FileDesk · DeskCloud 형제 앱</span>
        <span className="fd-row">
          <span className="fd-footer-dot" aria-hidden="true" />
          모든 시스템 정상
        </span>
      </div>
    </footer>
  )
}
