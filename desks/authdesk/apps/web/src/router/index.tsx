import { createBrowserRouter } from 'react-router-dom'

import { AppLayout } from '@/app/AppLayout'
import { RouteErrorBoundary } from '@/app/ErrorBoundary'
import { RequireAuth } from '@/app/RequireAuth'
import { DashboardPage } from '@/pages/DashboardPage'
import { DesignPage } from '@/pages/DesignPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PricingPage } from '@/pages/PricingPage'
import { SignupPage } from '@/pages/SignupPage'
import { SitemapPage } from '@/pages/SitemapPage'
import { SupportPage } from '@/pages/SupportPage'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/pricing', element: <PricingPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/support', element: <SupportPage /> },
      { path: '/design', element: <DesignPage /> },
      { path: '/sitemap', element: <SitemapPage /> },
      {
        path: '/dashboard',
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
