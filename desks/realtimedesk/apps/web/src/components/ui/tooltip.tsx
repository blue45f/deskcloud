import * as TP from '@radix-ui/react-tooltip'

import type { ReactNode } from 'react'

export const TooltipProvider = TP.Provider

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TP.Root delayDuration={200}>
      <TP.Trigger asChild>{children}</TP.Trigger>
      <TP.Portal>
        <TP.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-ink px-2 py-1 text-xs font-medium text-ink-fg shadow-md data-[state=delayed-open]:animate-[fade-in_120ms_ease-out]"
        >
          {content}
          <TP.Arrow className="fill-ink" />
        </TP.Content>
      </TP.Portal>
    </TP.Root>
  )
}
