import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import AppProviders from '@/app/AppProviders'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root element를 찾을 수 없습니다')

createRoot(root).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>
)
