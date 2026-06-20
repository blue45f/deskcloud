import { useCallback, useEffect, useRef, useState } from 'react'

interface ClipboardApi {
  /** 마지막 복사가 성공했는지(2초 후 자동 리셋). */
  copied: boolean
  /** 텍스트를 클립보드에 복사. 실패해도 throw 하지 않고 false 를 돌려준다. */
  copy: (text: string) => Promise<boolean>
}

/**
 * 클립보드 복사 + "복사됨" 피드백 상태 훅.
 *
 * navigator.clipboard 미지원(구형/비-HTTPS)이면 textarea + execCommand 폴백을 시도한다.
 * 언마운트 후 setState 경합을 막기 위해 mounted 가드를 둔다.
 */
export function useClipboard(resetMs = 2000): ClipboardApi {
  const [copied, setCopied] = useState(false)
  const mounted = useRef(true)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current !== undefined) window.clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let ok: boolean
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          ok = true
        } else {
          ok = legacyCopy(text)
        }
      } catch {
        ok = legacyCopy(text)
      }
      if (mounted.current && ok) {
        setCopied(true)
        if (timer.current !== undefined) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          if (mounted.current) setCopied(false)
        }, resetMs)
      }
      return ok
    },
    [resetMs]
  )

  return { copied, copy }
}

/** navigator.clipboard 가 없을 때의 동기 폴백. */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok: boolean
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}
