import { defineConfig } from "tsup";

// ESM/CJS + d.ts 번들. socket.io-client 는 external(peer) — 소비자 측에서 해소한다.
// @realtimedesk/shared 는 타입만 쓰므로(런타임 값을 끌어오지 않음) external 로 둔다.
// 브라우저 클라이언트(client.ts)는 node:crypto 등을 import 하지 않으므로 번들 안전.
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared tsup.config 참고).
export default defineConfig((options) => ({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    server: "src/server.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: "es2022",
  external: ["socket.io-client", "@realtimedesk/shared"],
}));
