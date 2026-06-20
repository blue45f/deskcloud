// 라이브 E2E 검증: pk+memberId 연결 → 대화 join → REST 발송 → 상대 클라가 WS 수신
// → 리시트로 unread 갱신 → 비멤버 join 거부 → 잘못된 pk 핸드셰이크 거부 → typing 릴레이.
// 사용: node apps/api/scripts/verify-ws.mjs  (API 가 BASE_URL 에 떠 있어야 함, 데모 시드)
import { io } from 'socket.io-client'

const BASE = process.env.BASE_URL ?? 'http://localhost:4094'
const WS_PATH = process.env.CHAT_PATH ?? '/chat'
const PK = process.env.PK ?? 'pk_demo'
const ORIGIN = 'http://localhost:5294'

const log = (...a) => console.log('[verify]', ...a)
const fail = (m) => {
  console.error('[verify] ❌', m)
  process.exit(1)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(memberId, { key = PK, expectReject = false } = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      path: WS_PATH,
      transports: ['websocket'],
      auth: { key, memberId },
      extraHeaders: { Origin: ORIGIN },
      reconnection: false,
      timeout: 4000,
    })
    const t = setTimeout(() => {
      socket.close()
      if (expectReject) resolve({ rejected: true })
      else reject(new Error('연결 타임아웃'))
    }, 4500)
    socket.on('connect', () => {
      clearTimeout(t)
      if (!expectReject) resolve({ socket })
    })
    socket.on('disconnect', () => {
      if (expectReject) {
        clearTimeout(t)
        resolve({ rejected: true })
      }
    })
    socket.on('connect_error', () => {
      clearTimeout(t)
      if (expectReject) resolve({ rejected: true })
      else reject(new Error('connect_error'))
    })
  })
}

async function rest(path, { method = 'GET', key = PK, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-chat-key': key,
      Origin: ORIGIN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { ok: res.ok, status: res.status, json: res.ok ? await res.json() : await res.text() }
}

async function main() {
  // 0) 데모 대화(alice↔bob DM) 확보 — 어드민 sk 로 목록 조회 후 DM 하나 선택.
  const sk = process.env.SK ?? 'sk_demo'
  const list = await rest('/admin/conversations', { key: sk })
  if (!list.ok) fail(`어드민 대화 목록 실패 ${list.status}: ${list.json}`)
  const dm = list.json.find((c) => c.kind === 'dm' && c.memberIds.includes('alice') && c.memberIds.includes('bob'))
  if (!dm) fail('데모 DM(alice↔bob) 대화를 찾지 못함 — 시드 확인')
  log('0) 데모 DM 확보:', dm.id)

  // 1) alice·bob 연결(pk + memberId)
  const { socket: alice } = await connect('alice')
  const { socket: bob } = await connect('bob')
  log('1) alice·bob 연결 OK', alice.id, bob.id)

  // 2) 둘 다 대화 join(ack 확인)
  const aJoin = await alice.emitWithAck('join', { conversationId: dm.id })
  const bJoin = await bob.emitWithAck('join', { conversationId: dm.id })
  if (!aJoin?.ok || !bJoin?.ok) fail(`join ack 실패: ${JSON.stringify({ aJoin, bJoin })}`)
  log('2) join OK')

  // 3) bob 수신 대기 등록
  const received = new Promise((resolve) => bob.on('message', resolve))

  // 4) alice 가 REST 로 발송
  const sendRes = await rest(`/conversations/${dm.id}/messages`, {
    method: 'POST',
    body: { senderMemberId: 'alice', body: 'WS verify 메시지 ✅' },
  })
  if (!sendRes.ok) fail(`발송 실패 ${sendRes.status}: ${sendRes.json}`)
  if (sendRes.json.delivered < 1) fail('delivered 가 1 미만 — 구독자에게 전달되지 않음')
  const sentId = sendRes.json.message.id
  log('4) 발송 OK — delivered=', sendRes.json.delivered)

  // 5) bob 이 WS 로 수신
  const msg = await Promise.race([received, wait(4000).then(() => null)])
  if (!msg) fail('bob 이 message 이벤트를 받지 못함')
  if (msg.body !== 'WS verify 메시지 ✅') fail(`수신 본문 불일치: ${JSON.stringify(msg)}`)
  log('5) bob WS 수신 OK')

  // 6) bob unread 확인 → 읽음 → unread 0
  let bobConvs = await rest('/conversations?memberId=bob')
  const before = bobConvs.json.items.find((c) => c.id === dm.id)?.unreadCount ?? 0
  if (before < 1) fail(`발송 후 bob unread 가 0 — 기대 ≥1 (got ${before})`)
  log('6a) bob unread =', before)

  const readRes = await rest(`/conversations/${dm.id}/read`, {
    method: 'POST',
    body: { memberId: 'bob', lastReadMessageId: sentId },
  })
  if (!readRes.ok) fail(`읽음 실패 ${readRes.status}: ${readRes.json}`)
  if (readRes.json.unreadCount !== 0) fail(`읽음 후 unread 가 0 이 아님: ${readRes.json.unreadCount}`)
  bobConvs = await rest('/conversations?memberId=bob')
  const after = bobConvs.json.items.find((c) => c.id === dm.id)?.unreadCount ?? -1
  if (after !== 0) fail(`읽음 후 목록 unread 가 0 이 아님: ${after}`)
  log('6b) 읽음 → unread 0 OK')

  // 7) typing 릴레이 — alice typing → bob 수신
  const typingSeen = new Promise((resolve) => bob.on('typing', resolve))
  await alice.emitWithAck('typing', { conversationId: dm.id, typing: true })
  const typing = await Promise.race([typingSeen, wait(2000).then(() => null)])
  if (!typing || typing.memberId !== 'alice' || typing.typing !== true) {
    fail(`typing 릴레이 실패: ${JSON.stringify(typing)}`)
  }
  log('7) typing 릴레이 OK')

  // 8) 비멤버 join 거부 — mallory 는 DM 멤버가 아님
  const { socket: mallory } = await connect('mallory')
  const mAck = await mallory.emitWithAck('join', { conversationId: dm.id })
  if (mAck?.ok) fail('비멤버(mallory) join 이 거부되지 않음')
  log('8) 비멤버 join 거부 OK:', mAck.code)
  mallory.close()

  // 9) 잘못된 pk 핸드셰이크 거부
  const bad = await connect('alice', { key: 'pk_totally_wrong', expectReject: true })
  if (!bad.rejected) fail('잘못된 pk 가 거부되지 않음')
  log('9) 잘못된 pk 거부 OK')

  // 10) memberId 누락 핸드셰이크 거부
  const noMember = await connect(undefined, { expectReject: true })
  if (!noMember.rejected) fail('memberId 누락이 거부되지 않음')
  log('10) memberId 누락 거부 OK')

  alice.close()
  bob.close()
  log('✅ 모든 WS E2E 검증 통과')
  process.exit(0)
}

main().catch((e) => fail(e?.stack ?? String(e)))
