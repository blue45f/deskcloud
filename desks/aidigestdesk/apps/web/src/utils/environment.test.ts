import { describe, expect, it } from "vitest";

import { getLocaleAwareFilterDefaults, type BrowserLocaleContext } from "./environment";

describe("getLocaleAwareFilterDefaults", () => {
  it("한국어 환경이면 자료/이벤트 기본값이 국내 기준으로 지정된다", () => {
    const browserContext: BrowserLocaleContext = {
      isDomestic: true,
      locale: "ko-KR",
      timeZone: "Asia/Seoul",
    };

    const defaults = getLocaleAwareFilterDefaults(browserContext);

    expect(defaults).toEqual({
      eventAreaScope: "국내",
      eventRegion: "국내",
      eventLanguage: "한국어",
      communityLanguage: "한국어",
      resourceLanguage: "koreanOrCaption",
    });
  });

  it("비국내 환경이면 이벤트/커뮤니티는 영어 우선으로 지정된다", () => {
    const browserContext: BrowserLocaleContext = {
      isDomestic: false,
      locale: "en-US",
      timeZone: "America/Los_Angeles",
    };

    const defaults = getLocaleAwareFilterDefaults(browserContext);

    expect(defaults).toEqual({
      eventAreaScope: "국외",
      eventRegion: "all",
      eventLanguage: "영어",
      communityLanguage: "영어",
      resourceLanguage: "영어",
    });
  });
});
