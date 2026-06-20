/**
 * IIFE 브라우저 번들 전용 node:crypto 스텁.
 *
 * @chatdesk/shared 의 keys.ts(서버용 키 생성/해시)가 node:crypto 를 import 하지만,
 * 위젯/SDK 의 브라우저 경로는 그 함수들을 호출하지 않는다(상수·타입만 사용). 실제 코드는
 * 트리셰이킹으로 제거되므로 이 스텁의 export 들은 런타임에 도달하지 않는다.
 * 도달 시(예상치 못한 사용) 명확히 실패하도록 throw 한다.
 */
function unavailable(): never {
  throw new Error('node:crypto 는 브라우저 번들에서 사용할 수 없습니다(서버 전용 키 함수).')
}

export const createHash = unavailable
export const createHmac = unavailable
export const randomBytes = unavailable
export const timingSafeEqual = unavailable

export default {
  createHash: unavailable,
  createHmac: unavailable,
  randomBytes: unavailable,
  timingSafeEqual: unavailable,
}
