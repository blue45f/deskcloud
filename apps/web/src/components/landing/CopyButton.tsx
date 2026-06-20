import type { ReactElement } from 'react'

import { useClipboard } from '@/app/useClipboard'

interface CopyButtonProps {
  /** 클립보드에 복사할 텍스트. */
  value: string
  /** 접근성 라벨(무엇을 복사하는지). */
  label?: string
}

/** 코드블록 우상단 복사 버튼 — 성공 시 "복사됨" 으로 잠깐 바뀐다. */
export function CopyButton({ value, label = '코드' }: CopyButtonProps): ReactElement {
  const { copied, copy } = useClipboard()
  return (
    <button
      type="button"
      className={copied ? 'ad-copy is-copied' : 'ad-copy'}
      onClick={() => void copy(value)}
      aria-label={copied ? `${label} 복사됨` : `${label} 복사`}
    >
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
      {copied ? '복사됨' : '복사'}
    </button>
  )
}
