import {
  generateHapticFeedback,
  getAnonymousKey,
  getOperationalEnvironment,
  getSchemeUri,
  openURL,
  share as tossShare,
} from "@apps-in-toss/web-framework";

import {
  copyTextToClipboard,
  webPlatformBridge,
  type HapticType,
  type PlatformBridge,
  type PlatformEnv,
  type ShareInput,
} from "./index";

// 공유 햅틱 종류 → 토스 네이티브 종류 매핑(토스는 tickWeak/confetti 사용).
const HAPTIC_MAP: Record<HapticType, "tickWeak" | "confetti"> = {
  tickWeak: "tickWeak",
  confetti: "confetti",
  success: "confetti",
  error: "tickWeak",
};

function readTossEnv(): PlatformEnv {
  try {
    return getOperationalEnvironment();
  } catch {
    return "web";
  }
}

export interface TossPlatformBridgeOptions {
  /** false 반환 시 햅틱 억제(예: 효과음 음소거 연동). 기본: 항상 활성. */
  hapticEnabled?: () => boolean;
  /**
   * 공유 메시지 조립 커스터마이즈. 기본: title/text/url 줄바꿈 결합.
   * 토스 네이티브 공유는 단일 message 문자열만 받으므로 앱 톤에 맞게 조립할 수 있다.
   */
  formatShareMessage?: (input: ShareInput) => string;
}

/**
 * 토스 PlatformBridge 구현. @apps-in-toss/web-framework 를 래핑하고, 토스 밖(웹/샌드박스
 * 프리뷰)에서는 모두 안전하게 웹 폴백한다(try/catch). 앱별 차이(음소거 연동·공유 문구)는
 * options 로 주입하고, 그 외 동작은 표준을 그대로 쓴다.
 *
 * @example
 * const bridge = createTossPlatformBridge({ hapticEnabled: () => !isSoundMuted() });
 * <PlatformContext.Provider value={bridge}>…</PlatformContext.Provider>
 */
export function createTossPlatformBridge(
  options: TossPlatformBridgeOptions = {},
): PlatformBridge {
  const env = readTossEnv();
  const isInToss = env !== "web";
  const hapticEnabled = options.hapticEnabled ?? (() => true);
  const formatShareMessage =
    options.formatShareMessage ??
    ((input) =>
      [input.title, input.text, input.url].filter(Boolean).join("\n"));

  return {
    env,
    isInToss,
    async share(input) {
      if (isInToss) {
        try {
          await tossShare({
            message: formatShareMessage(input) || (input.url ?? ""),
          });
          return "shared";
        } catch {
          // 토스 공유 실패 → 웹 폴백으로 진행.
        }
      }
      return webPlatformBridge.share(input);
    },
    haptic(type = "tickWeak") {
      try {
        if (!isInToss || !hapticEnabled()) return;
        generateHapticFeedback({ type: HAPTIC_MAP[type] });
      } catch {
        /* 미지원 환경 무시 */
      }
    },
    copyText: copyTextToClipboard,
    openExternal(url) {
      if (isInToss) {
        openURL(url).catch(() => {});
      } else if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    async getStableUserKey() {
      try {
        const result = await getAnonymousKey();
        if (result && typeof result === "object" && result.type === "HASH") {
          return result.hash;
        }
        return null;
      } catch {
        return null;
      }
    },
    getEntryRoute() {
      try {
        return getSchemeUri();
      } catch {
        return null;
      }
    },
  };
}
