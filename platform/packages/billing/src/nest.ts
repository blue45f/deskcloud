// @desk/billing/nest — NestJS 어댑터. 사용량 한도 가드·데코레이터·리졸버 토큰.
// Desk 가 라우트에 @EnforceLimit('metric') 을 붙이고 UsageLimitResolver 를 주입하면
// "작업 전" 한도 강제(hard-cap 차단 / soft-cap 경고)가 공통화된다.
export * from './nest/usage-limit.guard'
