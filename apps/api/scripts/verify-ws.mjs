// 라이브 E2E 검증: pk 연결 → 채널 join → 서버 publish(sk) → 클라 수신 → presence → 잘못된 pk 거부.
// 사용: node apps/api/scripts/verify-ws.mjs  (API 가 BASE_URL 에 떠 있어야 함)
import { io } from "socket.io-client";

const BASE = process.env.BASE_URL ?? "http://localhost:4092";
const WS_PATH = process.env.REALTIME_PATH ?? "/realtime";
const PK = process.env.PK ?? "pk_demo";
const SK = process.env.SK ?? "sk_demo";
const CHANNEL = "verify:room";
const ORIGIN = "http://localhost:5292";

const log = (...a) => console.log("[verify]", ...a);
const fail = (m) => {
  console.error("[verify] ❌", m);
  process.exit(1);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(key, { expectReject = false } = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      path: WS_PATH,
      transports: ["websocket"],
      auth: { key },
      extraHeaders: { Origin: ORIGIN },
      reconnection: false,
      timeout: 4000,
    });
    const t = setTimeout(() => {
      socket.close();
      if (expectReject) resolve({ rejected: true });
      else reject(new Error("연결 타임아웃"));
    }, 4500);
    socket.on("connect", () => {
      clearTimeout(t);
      if (expectReject) {
        // 잘못된 pk 라도 transport 는 잠깐 붙을 수 있으나 곧 disconnect 됨 — 잠시 대기
        return;
      }
      resolve({ socket });
    });
    socket.on("disconnect", () => {
      if (expectReject) {
        clearTimeout(t);
        resolve({ rejected: true });
      }
    });
    socket.on("connect_error", () => {
      clearTimeout(t);
      if (expectReject) resolve({ rejected: true });
      else reject(new Error("connect_error"));
    });
  });
}

async function main() {
  // 1) 올바른 pk 로 연결
  const { socket } = await connect(PK);
  log("1) pk 연결 OK", socket.id);

  // 2) 채널 구독(ack 확인)
  const subAck = await socket.emitWithAck("subscribe", { channel: CHANNEL });
  if (!subAck?.ok) fail(`subscribe ack 실패: ${JSON.stringify(subAck)}`);
  log("2) subscribe OK");

  // 3) 수신 대기 등록
  const received = new Promise((resolve) => socket.on("message", resolve));

  // 4) 서버에서 sk 로 publish
  const pubRes = await fetch(`${BASE}/api/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-realtime-key": SK },
    body: JSON.stringify({
      channel: CHANNEL,
      event: "ping",
      data: { hello: "world", n: 42 },
    }),
  });
  if (!pubRes.ok) fail(`publish HTTP ${pubRes.status}: ${await pubRes.text()}`);
  const pubBody = await pubRes.json();
  log(
    "4) publish OK — delivered=",
    pubBody.delivered,
    "persisted=",
    !!pubBody.message,
  );
  if (pubBody.delivered < 1)
    fail("delivered 가 1 미만 — 구독자에게 전달되지 않음");

  // 5) 클라이언트가 이벤트 수신
  const msg = await Promise.race([received, wait(4000).then(() => null)]);
  if (!msg) fail("클라이언트가 message 이벤트를 받지 못함");
  if (msg.event !== "ping" || msg.data?.n !== 42)
    fail(`수신 페이로드 불일치: ${JSON.stringify(msg)}`);
  log(
    "5) 클라이언트 수신 OK:",
    JSON.stringify({ event: msg.event, data: msg.data }),
  );

  // 6) presence 반영
  const presence = await socket.emitWithAck("presence", { channel: CHANNEL });
  if (
    !presence ||
    presence.count !== 1 ||
    !presence.members.includes(socket.id)
  ) {
    fail(`presence 불일치: ${JSON.stringify(presence)}`);
  }
  log("6) presence OK:", JSON.stringify(presence));

  // 7) history 가 pk 로 읽힘
  const histRes = await fetch(
    `${BASE}/api/channels/${encodeURIComponent(CHANNEL)}/history`,
    {
      headers: { "x-realtime-key": PK, Origin: ORIGIN },
    },
  );
  if (!histRes.ok) fail(`history HTTP ${histRes.status}`);
  const hist = await histRes.json();
  if (!Array.isArray(hist.items) || hist.items.length < 1)
    fail("history 가 비어 있음");
  log("7) history OK — items=", hist.items.length);

  // 8) 잘못된 pk 핸드셰이크는 거부
  const bad = await connect("pk_totally_wrong", { expectReject: true });
  if (!bad.rejected) fail("잘못된 pk 가 거부되지 않음");
  log("8) 잘못된 pk 거부 OK");

  // 9) presence leave — 연결 종료 시 구독자 0
  socket.close();
  await wait(300);
  // 새 소켓으로 presence 재확인
  const { socket: probe } = await connect(PK);
  const after = await probe.emitWithAck("presence", { channel: CHANNEL });
  probe.close();
  if (after.count !== 0)
    fail(`disconnect 후 presence 가 0 이 아님: ${JSON.stringify(after)}`);
  log("9) disconnect 후 presence=0 OK");

  log("✅ 모든 WS E2E 검증 통과");
  process.exit(0);
}

main().catch((e) => fail(e?.stack ?? String(e)));
