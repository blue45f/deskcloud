import { Check, Share2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import { shareOrCopy, type ShareInput } from '@/lib/share'

type ShareButtonProps = ShareInput &
  Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
    /** 기본 라벨. */
    label?: string
    /** 복사 폴백 성공 시 잠시 보여줄 라벨. */
    copiedLabel?: string
  }

/**
 * 공유 버튼 — 네이티브 공유 시트(모바일) 우선, 미지원/취소 시 클립보드 복사 폴백.
 * 앱 디자인 토큰(Button)과 sonner 토스트로 결과를 알린다. 순수 로직은 lib/share/shareOrCopy.
 */
export function ShareButton({
  label = '공유',
  copiedLabel = '링크 복사됨',
  variant = 'secondary',
  size = 'md',
  className,
  ...input
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleClick = useCallback(async () => {
    const result = await shareOrCopy(input)
    if (result === 'copied') {
      setCopied(true)
      toast.success('링크를 클립보드에 복사했어요')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } else if (result === 'unsupported') {
      toast.error('이 브라우저에서는 공유할 수 없어요')
    }
  }, [input])

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
