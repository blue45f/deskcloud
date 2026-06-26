import { defineConfig } from "tsup";

// 헤드리스 플랫폼 브리지. react / react-dom / @apps-in-toss/web-framework 는 앱이 제공하므로
// external(번들 미포함). ./toss 서브엔트리는 토스 네이티브 의존을 쓰지만 웹 전용 앱은 임포트하지 않는다.
export default defineConfig((options) => ({
  entry: { index: "src/index.ts", toss: "src/toss.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  target: "es2023",
  external: ["react", "react-dom", "@apps-in-toss/web-framework"],
}));
