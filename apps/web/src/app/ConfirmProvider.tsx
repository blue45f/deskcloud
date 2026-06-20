import { useCallback, useRef, useState, type ReactNode } from 'react'

import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './ConfirmContext'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const requestConfirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve
        setOptions(opts)
      }),
    []
  )

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOptions(null)
  }, [])

  return (
    <ConfirmContext.Provider value={requestConfirm}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
        {options ? (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{options.title}</DialogTitle>
              {options.description ? (
                <DialogDescription>{options.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => settle(false)}>
                {options.cancelText ?? '취소'}
              </Button>
              <Button
                variant={options.danger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                autoFocus
              >
                {options.confirmText ?? '확인'}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </ConfirmContext.Provider>
  )
}
