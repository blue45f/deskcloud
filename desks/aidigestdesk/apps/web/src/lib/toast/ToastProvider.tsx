import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ToastContext, type ToastApi, type ToastInput, type ToastTone } from './context'

import type { ReactNode } from 'react'

type ActiveToast = {
  id: string
  message: string
  tone: ToastTone
}

const toneStyles: Record<ToastTone, { className: string; icon: typeof Info }> = {
  neutral: { className: 'border-border bg-surface text-text', icon: Info },
  success: {
    className: 'border-accent/40 bg-accent/10 text-text',
    icon: CheckCircle2,
  },
  error: {
    className: 'border-accent-4/40 bg-accent-4/10 text-text',
    icon: XCircle,
  },
}

const DEFAULT_DURATION_MS = 2600

/**
 * 앱 전역 토스트 호스트. 우하단에 쌓이며 자동 닫힘 + 수동 닫기. 스크린리더용 aria-live 영역을 둔다.
 * 타이머는 언마운트/제거 시 정리하고, 최대 4개만 유지해 과밀을 막는다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const counterRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (input: ToastInput | string) => {
      const normalized: ToastInput = typeof input === 'string' ? { message: input } : input
      counterRef.current += 1
      const id = `toast-${counterRef.current}`
      const tone = normalized.tone ?? 'neutral'

      setToasts((current) => [...current, { id, message: normalized.message, tone }].slice(-4))

      const duration = normalized.durationMs ?? DEFAULT_DURATION_MS
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
      return id
    },
    [dismiss]
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:px-6"
        role="region"
        aria-label="알림"
      >
        <div className="sr-only" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <p key={`sr-${toast.id}`}>{toast.message}</p>
          ))}
        </div>
        {toasts.map((toast) => {
          const style = toneStyles[toast.tone]
          const Icon = style.icon
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur ${style.className}`}
            >
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${
                  toast.tone === 'success'
                    ? 'text-accent'
                    : toast.tone === 'error'
                      ? 'text-accent-4'
                      : 'text-text-subtle'
                }`}
                aria-hidden
              />
              <p className="min-w-0 flex-1 font-medium leading-5">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="알림 닫기"
                className="-mr-1 -mt-0.5 grid size-6 shrink-0 place-items-center rounded text-text-subtle transition hover:text-text"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
