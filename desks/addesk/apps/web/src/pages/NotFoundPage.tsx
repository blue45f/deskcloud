import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'

export function NotFoundPage(): ReactElement {
  useDocumentTitle('페이지를 찾을 수 없음')
  return (
    <section className="ax-hero">
      <h1 className="ax-enter ax-enter-1" style={{ fontSize: 64, marginBottom: 4 }}>
        <span className="ax-grad-text">404</span>
      </h1>
      <p className="ax-enter ax-enter-2">요청하신 페이지를 찾을 수 없습니다.</p>
      <Link to="/" className="ax-btn ax-btn-primary ax-btn-lg ax-enter ax-enter-2">
        홈으로 →
      </Link>
    </section>
  )
}
