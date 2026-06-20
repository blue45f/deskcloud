import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-surface', className)} {...props} />
}

export function CardHeader({
  className,
  children,
  action,
}: {
  className?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border px-5 py-4',
        className
      )}
    >
      <div className="min-w-0">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-sm font-semibold text-text', className)}>{children}</h3>
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-[0.8125rem] text-text-muted">{children}</p>
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-border px-5 py-3.5', className)} {...props} />
}
