import { Link } from 'react-router-dom'

import type { ReactElement } from 'react'

import { useDocumentTitle } from '@/app/useDocumentTitle'


export function NotFoundPage(): ReactElement {
  useDocumentTitle('페이지를 찾을 수 없음')
  return (
    <section className="fd-hero">
      <h1 style={{ fontSize: 32 }}>404</h1>
      <p>요청하신 페이지를 찾을 수 없습니다.</p>
      <Link to="/" className="fd-btn fd-btn-primary">
        홈으로
      </Link>
    </section>
  )
}
