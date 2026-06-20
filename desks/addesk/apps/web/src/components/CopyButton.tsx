import { useEffect, useRef, useState } from 'react'

import type { ReactElement } from 'react'

import { copyText } from '@/lib/share'

interface CopyButtonProps {
  /** 클립보드에 복사할 텍스트. */
  value: string
  /** 접근성 라벨(예: "설치 명령 복사"). */
  label: string
}

/**
 * 코드 스니펫용 원클릭 복사 버튼. 개발자 도구의 핵심 UX —
 * 임베드 스니펫을 손으로 드래그하지 않고 한 번에 복사한다.
 *
 * - 성공/실패를 aria-live 로 announce(스크린리더).
 * - 복사 완료 표시는 1.6초 후 원복(타이머 정리로 언마운트 누수 방지).
 */
export function CopyButton({ value, label }: CopyButtonProps): ReactElement {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onCopy = async (): Promise<void> => {
    const ok = await copyText(value)
    setState(ok ? 'copied' : 'error')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setState('idle'), 1600)
  }

  const text = state === 'copied' ? '복사됨' : state === 'error' ? '복사 실패' : '복사'

  return (
    <>
      <button
        type="button"
        className={`ax-code-copy${state === 'copied' ? ' ax-copied' : ''}`}
        onClick={() => void onCopy()}
        aria-label={label}
      >
        {text}
      </button>
      <span className="ax-visually-hidden" role="status" aria-live="polite">
        {state === 'copied'
          ? `${label} — 복사되었습니다`
          : state === 'error'
            ? '복사에 실패했습니다'
            : ''}
      </span>
    </>
  )
}
