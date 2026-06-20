import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * IIFE(브라우저 <script>) 빌드 — react/react-dom·@realtimedesk/sdk·socket.io-client 를
 * 인라인해 비-React 사이트도 단일 파일로 위젯을 띄울 수 있게 한다.
 * window.RealtimeDesk = { mount, init }.
 *
 * sdk/client 는 런타임 값(socket.io-client)을 쓰므로 번들에 포함되어야 한다 → external 로
 * 두지 않는다(워크스페이스 소스로 해소). server publisher 는 sk 노출 위험이 있어 IIFE 에
 * 포함하지 않는다(브라우저 진입점은 client 만 사용).
 */
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // tsup 산출물(dist/*.js)을 지우지 않도록
    lib: {
      entry: resolve(import.meta.dirname, "src/iife.ts"),
      name: "RealtimeDesk",
      formats: ["iife"],
      fileName: () => "realtime-widget.js",
    },
    minify: "esbuild",
    sourcemap: true,
    rollupOptions: {
      output: {
        extend: true, // window.RealtimeDesk 에 named export 를 펼침
        exports: "named",
      },
    },
  },
});
