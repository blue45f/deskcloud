import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium outline-none transition-[background-color,color,border-color,box-shadow,opacity] duration-150 select-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-ink-fg shadow-xs hover:bg-ink-hover',
        secondary:
          'border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2',
        outline: 'border border-border text-text hover:bg-surface-2',
        ghost: 'text-text-muted hover:bg-surface-2 hover:text-text',
        accent: 'bg-accent text-accent-fg shadow-xs hover:bg-accent-strong',
        danger: 'bg-danger text-white shadow-xs hover:opacity-90',
      },
      size: {
        sm: 'h-8 gap-1 px-3 text-[0.8125rem]',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-5 text-[0.95rem]',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)
