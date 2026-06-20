import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    babel({
      exclude: [
        /[\/\\]node_modules[\/\\]/,
        /\0rolldown\/runtime\.js/,
        /packages[\/\\]content[\/\\]dist[\/\\]/,
      ],
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // @heejun/deskcloud 의 realtime/chat 클라이언트는 optional peer(socket.io-client)를
  // 동적 import 한다. 우리는 auth/community/terms 만 쓰므로 dev 사전번들에서 제외해
  // 옵셔널 피어 미설치로 인한 dev 최적화 오류를 피한다(프로덕션은 tree-shaking).
  optimizeDeps: {
    exclude: ["@heejun/deskcloud"],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "content-catalog",
              test: /packages[\\/]content[\\/]dist[\\/]index/,
              priority: 3,
            },
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 2,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5297,
  },
  preview: {
    host: "127.0.0.1",
    port: 5297,
  },
});
