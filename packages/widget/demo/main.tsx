/**
 * 위젯 데모 진입점. 폼 입력을 읽어 <PresenceBar> 를 (재)마운트하고,
 * useRealtime 훅으로 최근 메시지 로그도 함께 보여준다.
 * 소스(src/*)를 직접 import 하므로 빌드 산출물 없이도 동작한다.
 */
import { StrictMode, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

import { PresenceBar } from "../src/react";
import { useRealtime } from "../src/useRealtime";

function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
}

function MessageLog(props: {
  channel: string;
  publishableKey: string;
  endpoint: string;
}): ReactElement {
  const { status, messages } = useRealtime(props.channel, {
    publishableKey: props.publishableKey,
    endpoint: props.endpoint,
    maxMessages: 20,
  });
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <strong>useRealtime — 최근 메시지</strong>{" "}
      <span className="hint">(status: {status})</span>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
        {messages.length === 0 ? (
          <li className="hint">
            아직 메시지가 없습니다. 서버에서 sk 로 publish 해 보세요.
          </li>
        ) : (
          messages.map((m) => (
            <li key={m.id}>
              <code>{m.event}</code> · {JSON.stringify(m.data)}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Demo(): ReactElement {
  const [config, setConfig] = useState({
    channel: "room:42",
    publishableKey: "pk_demo",
    endpoint: "http://localhost:4092",
    accent: "#2f5fe0",
    nonce: 0,
  });

  const sync = (): void =>
    setConfig((c) => ({
      channel: readInput("channel") || "room:42",
      publishableKey: readInput("publishableKey") || "pk_demo",
      endpoint: readInput("endpoint") || "http://localhost:4092",
      accent: readInput("accent") || "#2f5fe0",
      nonce: c.nonce + 1,
    }));

  if (
    typeof window !== "undefined" &&
    !(window as { __rtBound?: boolean }).__rtBound
  ) {
    (window as { __rtBound?: boolean }).__rtBound = true;
    for (const id of ["channel", "publishableKey", "endpoint", "accent"]) {
      document.getElementById(id)?.addEventListener("change", sync);
    }
  }

  return (
    <div key={config.nonce}>
      <div style={{ margin: "20px 0" }}>
        <PresenceBar
          channel={config.channel}
          publishableKey={config.publishableKey}
          endpoint={config.endpoint}
          accent={config.accent}
        />
      </div>
      <MessageLog
        channel={config.channel}
        publishableKey={config.publishableKey}
        endpoint={config.endpoint}
      />
    </div>
  );
}

const host = document.getElementById("app") ?? document.body;
createRoot(host).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
