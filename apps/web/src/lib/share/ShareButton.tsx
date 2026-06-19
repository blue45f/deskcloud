// 공유 버튼 — shareOrCopy를 호출하고 결과를 짧게 피드백한다. 디자인 의존성 없는 portable 컴포넌트.
// 각 앱은 className/children으로 자기 디자인 토큰에 맞춘다.
import { useCallback, useRef, useState, type ReactNode } from 'react'

import { shareOrCopy, type ShareInput, type ShareResult } from './shareOrCopy'

type ShareButtonProps = ShareInput & {
  className?: string
  /** 기본 라벨(공유 가능 상태). */
  children?: ReactNode
  /** 복사 폴백 성공 시 잠시 보여줄 라벨. */
  copiedLabel?: ReactNode
  /** 결과 콜백(토스트 등 앱별 후처리). */
  onShared?: (result: ShareResult) => void
}

/**
 * 클릭 시 네이티브 공유 시트 또는 클립보드 복사를 수행한다. 복사 폴백이면 1.6초간 `copiedLabel`을 노출하고
 * `aria-live`로 안내한다. 결과는 onShared로도 전달한다.
 */
export function ShareButton({
  className,
  children = '공유',
  copiedLabel = '링크 복사됨',
  onShared,
  ...input
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleClick = useCallback(async () => {
    const result = await shareOrCopy(input)
    onShared?.(result)
    if (result === 'copied') {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    }
  }, [input, onShared])

  return (
    <button type="button" className={className} onClick={handleClick} aria-live="polite">
      {copied ? copiedLabel : children}
    </button>
  )
}
