import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ConfirmProvider } from './ConfirmProvider'
import { queryClient } from './queryClient'
import { useTheme } from './ThemeContext'
import { ThemeProvider } from './ThemeProvider'

import ErrorBoundary from '@/components/common/ErrorBoundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import { router } from '@/router'

function AppToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} position="top-right" richColors closeButton />
}

export default function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          <ConfirmProvider>
            <ErrorBoundary>
              <RouterProvider router={router} />
            </ErrorBoundary>
            <AppToaster />
          </ConfirmProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
