/**
 * Vercel 서버리스 함수 엔트리.
 *
 * 모든 요청(`/health`, `/api/*`, `/api/docs`)이 `vercel.json` 의 rewrite 로 이 함수에 도달한다.
 * 빌드 시 `nest build` 가 `src/serverless.ts` → `dist/serverless.js`(CommonJS)로 컴파일하므로,
 * 여기서는 컴파일된 산출물에서 초기화된 Express 핸들러를 받아 요청을 위임한다.
 *
 * NestFactory 부트스트랩은 첫(cold) 인보케이션에서 1회만 수행되고, 이후 웜 인보케이션은
 * 캐시된 Express 인스턴스를 재사용한다(getApp 내부 캐시).
 */
import { getApp } from '../dist/serverless.js'

import type { IncomingMessage, ServerResponse } from 'node:http'

// dist 산출물(nest build) — 빌드 후에 존재. 런타임에 로드.

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp()
  app(req, res)
}
