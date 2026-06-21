import { createContext } from 'react'

export interface RealtimeSocket {
  connected: boolean
  emit: (event: string, ...args: unknown[]) => void
  on: (event: string, listener: (...args: unknown[]) => void) => void
  off: (event: string, listener: (...args: unknown[]) => void) => void
}

export const RealtimeSocketContext = createContext<RealtimeSocket | null>(null)
