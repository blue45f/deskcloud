import * as DM from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'

import { cn } from '@/utils/cn'

export const Dropdown = DM.Root
export const DropdownTrigger = DM.Trigger

export const DropdownContent = forwardRef<
  ElementRef<typeof DM.Content>,
  ComponentPropsWithoutRef<typeof DM.Content>
>(function DropdownContent({ className, align = 'end', sideOffset = 6, ...props }, ref) {
  return (
    <DM.Portal>
      <DM.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-md outline-none data-[state=open]:animate-[fade-in_120ms_ease-out]',
          className
        )}
        {...props}
      />
    </DM.Portal>
  )
})

export const DropdownItem = forwardRef<
  ElementRef<typeof DM.Item>,
  ComponentPropsWithoutRef<typeof DM.Item> & { danger?: boolean }
>(function DropdownItem({ className, danger, ...props }, ref) {
  return (
    <DM.Item
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-text outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50',
        danger && 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger',
        className
      )}
      {...props}
    />
  )
})

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-2.5 py-1.5 text-xs text-text-subtle">{children}</DM.Label>
}
