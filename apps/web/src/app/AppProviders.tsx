import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import ErrorBoundary from '@/components/common/ErrorBoundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { router } from '@/router'

import { queryClient } from './queryClient'
import { ThemeProvider } from './ThemeProvider'

/** 앱 루트 — Query · Theme · Tooltip · 에러바운더리 · 라우터를 배선한다. */
export default function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
