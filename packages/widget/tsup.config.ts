import { defineConfig } from "tsup";

// ESM/CJS + d.ts 번들. react·@realtimedesk/sdk·socket.io-client 는 external(peer/워크스페이스).
// IIFE(브라우저 <script>) 빌드는 별도 vite.iife.config.ts 가 담당(react·sdk 인라인).
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared/sdk tsup.config 참고).
export default defineConfig((options) => ({
  entry: {
    index: "src/index.ts",
    react: "src/react.tsx",
    vanilla: "src/vanilla.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: "es2020",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@realtimedesk/sdk",
    "@realtimedesk/sdk/client",
    "socket.io-client",
  ],
}));
