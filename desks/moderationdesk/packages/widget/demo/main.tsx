/**
 * 위젯 데모 진입점. 댓글 목록에 <ReportButton> 을, 작성칸에 <ModerationBadge> 를 붙인다.
 * 소스(src/*.tsx)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'

import { ModerationBadge } from '../src/badge'
import { ReportButton } from '../src/react'

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
}

const SAMPLE_COMMENTS = [
  { id: 'c_1', text: '좋은 글 잘 봤습니다. 도움이 많이 됐어요!' },
  { id: 'c_2', text: '여기 광고 링크 클릭하면 돈 벌어요 → spam.example' },
  { id: 'c_3', text: '동의합니다. 다음 편도 기대할게요.' },
]

function CommentRow({ id, text, pk, endpoint }: {
  id: string
  text: string
  pk: string
  endpoint: string
}): ReactElement {
  return (
    <div className="comment">
      <p>{text}</p>
      <ReportButton
        subjectType="comment"
        subjectId={id}
        publishableKey={pk}
        endpoint={endpoint}
        bare
        onSubmitted={(r) => console.info('[demo] reported', id, r)}
      />
    </div>
  )
}

function Composer({ pk, endpoint }: { pk: string; endpoint: string }): ReactElement {
  const [text, setText] = useState('')
  return (
    <>
      <textarea
        rows={2}
        placeholder="댓글을 입력해 보세요…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #d7dae0' }}
      />
      <div style={{ marginTop: 8, minHeight: 26 }}>
        <ModerationBadge text={text} publishableKey={pk} endpoint={endpoint} />
      </div>
    </>
  )
}

function Demo(): ReactElement {
  const [config] = useState({
    pk: readInput('pk') || 'pk_demo',
    endpoint: readInput('endpoint') || 'http://localhost:4092',
  })

  return (
    <>
      {SAMPLE_COMMENTS.map((c) => (
        <CommentRow key={c.id} id={c.id} text={c.text} pk={config.pk} endpoint={config.endpoint} />
      ))}
      <div style={{ marginTop: 28 }}>
        <Composer pk={config.pk} endpoint={config.endpoint} />
      </div>
    </>
  )
}

// 댓글 목록은 #comments, 작성칸+배지는 #badge-slot 자리에 그린다(데모 HTML 구조).
const commentsHost = document.getElementById('comments')
if (commentsHost) {
  createRoot(commentsHost).render(
    <StrictMode>
      <Demo />
    </StrictMode>
  )
}
