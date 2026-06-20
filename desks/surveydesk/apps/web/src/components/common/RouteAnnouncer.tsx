import { useRouteAnnouncer } from '@/hooks/useRouteAnnouncer'

export default function RouteAnnouncer() {
  const message = useRouteAnnouncer()
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
