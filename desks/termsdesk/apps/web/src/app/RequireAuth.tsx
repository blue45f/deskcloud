import { Navigate } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner } from '@/components/ui/feedback'
import { useSession } from '@/services/auth'

export default function RequireAuth() {
  const { data, isLoading, isError } = useSession()

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner className="size-6" />
      </div>
    )
  }
  if (isError || !data) return <Navigate to="/login" replace />

  return <AppLayout session={data} />
}
