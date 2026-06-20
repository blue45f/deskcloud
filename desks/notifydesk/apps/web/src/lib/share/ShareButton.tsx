import { Check, Share2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { shareOrCopy, type ShareInput, type ShareResult } from './shareOrCopy'

import { Button, type ButtonProps } from '@/components/ui/button'

type ShareButtonProps = ShareInput &
  Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
    /** 기본 라벨(공유 가능 상태). */
    label?: string
    /** 복사 폴백 성공 시 잠시 보여줄 라벨. */
    copiedLabel?: string
  }

/**
 * NotifyDesk 톤에 맞춘 공유 버튼 — desk-platform 의 portable `shareOrCopy` 를 프로젝트
 * Button + sonner 토스트에 배선했다. 네이티브 공유 시트가 있으면 그걸 쓰고, 없으면 링크를
 * 클립보드에 복사하고 잠시 "복사됨" 상태 + 토스트로 안내한다.
 */
export function ShareButton({
  label = '공유',
  copiedLabel = '링크 복사됨',
  variant = 'secondary',
  size = 'lg',
  className,
  ...input
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleClick = useCallback(async () => {
    const result: ShareResult = await shareOrCopy(input)
    if (result === 'copied') {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
      toast.success(copiedLabel)
    } else if (result === 'unsupported') {
      toast.error('이 브라우저에서는 공유할 수 없습니다.')
    }
  }, [input, copiedLabel])

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void handleClick()}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check className="size-4" aria-hidden /> {copiedLabel}
        </>
      ) : (
        <>
          <Share2 className="size-4" aria-hidden /> {label}
        </>
      )}
    </Button>
  )
}
