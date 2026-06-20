import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * 위젯 데모(vite). 로컬 API(기본 :4092)에 붙어 채널 presence 를 띄운다.
 * 실행: pnpm --filter @realtimedesk/widget run dev:demo  (FREE 하이포트 5191 사용)
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: { port: 5191, host: "127.0.0.1" },
  build: { outDir: "dist", emptyOutDir: true },
});
