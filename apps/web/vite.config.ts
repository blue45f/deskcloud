import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 포트폴리오 내 다른 프로젝트와 겹치지 않도록 6091 사용(피하기: 5173-5174 등).
export default defineConfig({
  plugins: [react()],
  server: { port: 6091, strictPort: true },
  preview: { port: 6091, strictPort: true },
})
