import { REALTIME_EVENTS, type RealtimeRoomAck } from '@termsdesk/shared'
import { useContext, useEffect } from 'react'

import { RealtimeSocketContext } from './realtime-context'

export function useRealtimeRequestRoom(requestId: string | undefined): void {
  const socket = useContext(RealtimeSocketContext)

  useEffect(() => {
    if (!socket || !requestId) return

    const join = () => {
      socket.emit(REALTIME_EVENTS.requestJoin, { requestId }, (_ack: RealtimeRoomAck) => undefined)
    }

    if (socket.connected) join()
    socket.on('connect', join)

    return () => {
      socket.off('connect', join)
      if (socket.connected) {
        socket.emit(REALTIME_EVENTS.requestLeave, { requestId }, () => undefined)
      }
    }
  }, [requestId, socket])
}
