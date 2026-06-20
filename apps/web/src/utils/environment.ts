export type BrowserLocaleContext = {
  isDomestic: boolean;
  locale: string;
  timeZone: string;
};

export type LocaleAwareFilterDefaults = {
  eventAreaScope: "all" | "국내" | "국외";
  eventRegion: "all" | "국내" | "북미" | "유럽" | "글로벌";
  eventLanguage: "all" | "한국어" | "영어" | "다국어";
  communityLanguage: "all" | "한국어" | "영어";
  resourceLanguage: "koreanOrCaption" | "all" | "한국어" | "영어";
};

const DOMESTIC_TIMEZONE_HINTS = ["asia/seoul", "asia/pyongyang", "asia/jeju"] as const;
const KOREAN_LOCALE_PATTERNS = [
  "ko",
  "ko-kr",
  "ko_kr",
  "ko-krx",
] as const;

export function getBrowserLocaleContext(): BrowserLocaleContext {
  if (typeof Intl === "undefined") {
    return { isDomestic: false, locale: "", timeZone: "" };
  }

  const candidateLocales = [
    ...((typeof navigator !== "undefined" && Array.from(navigator.languages ?? [])) || []),
    Intl.DateTimeFormat().resolvedOptions().locale || "",
    "",
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  const locale =
    candidateLocales.find((value) => value.length > 0) ??
    Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase() ??
    "";

  let timeZone = "";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
  } catch {
    timeZone = "";
  }

  const hasKoreanLocaleHint = candidateLocales.some((value) =>
    KOREAN_LOCALE_PATTERNS.some(
      (localePattern) =>
        value.startsWith(`${localePattern}-`) || value === localePattern,
    ),
  );
  const isKoreanTimeZone = DOMESTIC_TIMEZONE_HINTS.some((tzHint) =>
    timeZone.includes(tzHint),
  );

  return {
    isDomestic: hasKoreanLocaleHint || isKoreanTimeZone,
    locale,
    timeZone,
  };
}

export function getLocaleAwareFilterDefaults(
  browserContext: BrowserLocaleContext = getBrowserLocaleContext(),
): LocaleAwareFilterDefaults {
  const isDomesticUser = browserContext.isDomestic;

  return {
    eventAreaScope: isDomesticUser ? "국내" : "국외",
    eventRegion: isDomesticUser ? "국내" : "all",
    eventLanguage: isDomesticUser ? "한국어" : "영어",
    communityLanguage: isDomesticUser ? "한국어" : "영어",
    resourceLanguage: isDomesticUser ? "koreanOrCaption" : "영어",
  };
}
