import { defineConfig } from "tsup";

/**
 * Two entry points:
 *   - src/index.ts  → browser entry (publishable pk_ clients)  → '@heejun/deskcloud'
 *   - src/server.ts → server entry (secret sk_ admin clients)  → '@heejun/deskcloud/server'
 *
 * Both ship ESM + CJS + .d.ts, fully tree-shakeable, no code splitting so each
 * entry is a single self-contained file per format.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  treeshake: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: "es2022",
  // socket.io-client is an optional peer used only by realtime/chat clients.
  external: ["socket.io-client"],
});
