#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const filePath = new URL("../src/catalog.ts", import.meta.url);
const text = await readFile(filePath, "utf8");

const snapshotDateMatch = text.match(/SNAPSHOT_DATE\s*=\s*'([^']+)'/);
const snapshotDate = snapshotDateMatch?.[1] ?? "2026-06-18";
const snapshotAt = new Date(`${snapshotDate}T00:00:00Z`);

const sectionStart = text.indexOf(
  "export const eventScheduleItems: EventScheduleItem[] = [",
);
if (sectionStart < 0) {
  throw new Error("eventScheduleItems 섹션을 찾지 못했습니다.");
}
const sectionEnd = text.indexOf("\nexport const benchmarkEntries: BenchmarkEntry[] = [", sectionStart);
if (sectionEnd < 0) {
  throw new Error("benchmarkEntries 섹션 경계를 찾지 못했습니다.");
}

const section = text.slice(sectionStart, sectionEnd);
const entries = [...section.matchAll(/\{[\s\S]*?\n\s*\},/g)].map((match) =>
  match[0],
);

const errors = [];
const warnings = [];
const duplicates = new Map();
const urlSet = new Map();
const urlCounts = new Map();

const parseRawField = (entry, key) => {
  const re = new RegExp(`\\b${key}:\\s*([^,\\n]+)`);
  const m = entry.match(re);
  if (!m) return "";
  return m[1].trim();
};

const EVENT_URL_CHECK_ENABLED =
  process.env.CHECK_EVENT_URLS !== "0" &&
  process.env.SKIP_EVENT_URL_VALIDATION !== "1";
const EVENT_URL_CHECK_TIMEOUT_MS = Number(
  process.env.EVENT_URL_CHECK_TIMEOUT_MS || "4500",
);
const EVENT_URL_CHECK_CONCURRENCY = Number(
  process.env.EVENT_URL_CHECK_CONCURRENCY || "8",
);

const normalizeString = (value) =>
  value.replace(/^['\"]|['\"]$/g, "").trim();

const parseDate = (value) => {
  if (!value) return null;
  const v = normalizeString(value);
  if (!v) return null;
  if (v === "SNAPSHOT_DATE") return new Date(`${snapshotDate}T00:00:00Z`);
  const dt = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(dt.valueOf()) ? null : dt;
};

const parseSourceIds = (entry) => {
  const sourceBlock = entry.match(/sourceIds:\s*\[[\s\S]*?\]/)?.[0] ?? "[]";
  return sourceBlock
    .replace(/^sourceIds:\s*/, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((x) => normalizeString(x))
    .filter(Boolean);
};

const normalizeTextForCompare = (value) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeEventTitleForCompare = (value) => normalizeTextForCompare(value);
const normalizeUrlForCompare = (value) =>
  value
    .replace(/#.*$/, "")
    .replace(/\/$/, "")
    .trim()
    .toLowerCase();

const tokenSetFromTitle = (value) =>
  new Set(normalizeEventTitleForCompare(value).split(" ").filter(Boolean));

const withTimeout = (signalMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, signalMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
};

const calculateTitleMatchScore = (leftTitle, rightTitle) => {
  const left = normalizeEventTitleForCompare(leftTitle);
  const right = normalizeEventTitleForCompare(rightTitle);
  if (!left || !right) return 0;
  if (left === right) return 100;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const rightSet = tokenSetFromTitle(right);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const coverage = overlap / Math.max(leftTokens.length, rightTokens.length);
  const base = coverage * 80;

  let containmentBonus = 0;
  if (left.includes(right) || right.includes(left)) containmentBonus = 10;
  return base + containmentBonus;
};

const tecaMappedEvents = [];
const TECA_MATCH_THRESHOLD = 65;
const eventUrlChecks = [];

for (const entry of entries) {
  const id = normalizeString(parseRawField(entry, "id"));
  const title = normalizeString(parseRawField(entry, "title"));
  const organizer = normalizeString(parseRawField(entry, "organizer"));
  const type = normalizeString(parseRawField(entry, "type"));
  const region = normalizeString(parseRawField(entry, "region"));
  const format = normalizeString(parseRawField(entry, "format"));
  const language = normalizeString(parseRawField(entry, "language"));
  const status = normalizeString(parseRawField(entry, "status"));
  const startRaw = normalizeString(parseRawField(entry, "startDate"));
  const endRaw = normalizeString(parseRawField(entry, "endDate"));
  const url = normalizeString(parseRawField(entry, "url"));
  const sourceIds = parseSourceIds(entry);
  const timeLabel = normalizeString(parseRawField(entry, "timeLabel"));

  if (!id) errors.push("id 누락");
  if (!title) errors.push(`id ${id || "<unknown>"}: title 누락`);
  if (!organizer)
    errors.push(`id ${id}: organizer 누락 (${title || "<title-empty>"})`);
  if (!type) errors.push(`id ${id}: type 누락 (${title})`);
  if (!region) errors.push(`id ${id}: region 누락 (${title})`);
  if (!format) errors.push(`id ${id}: format 누락 (${title})`);
  if (!language) errors.push(`id ${id}: language 누락 (${title})`);
  if (!status) errors.push(`id ${id}: status 누락 (${title})`);
  if (!startRaw)
    errors.push(`id ${id}: startDate 누락 (${title})`);
  if (!url) errors.push(`id ${id}: url 누락 (${title})`);

  if (sourceIds.length === 0)
    warnings.push(`id ${id}: sourceIds가 비어 있음 (${title})`);

  const startAt = parseDate(startRaw);
  const endAt = parseDate(endRaw || startRaw);

  if (!startAt) errors.push(`id ${id}: startDate 파싱 실패 (${startRaw})`);
  if (!endAt)
    errors.push(`id ${id}: endDate 파싱 실패 (${endRaw || startRaw})`);
  if (startAt && endAt && endAt < startAt)
    errors.push(`id ${id}: endDate가 startDate보다 빠름 (${startRaw} ~ ${endRaw})`);

  const startCount = duplicates.get(id) ?? 0;
  duplicates.set(id, startCount + 1);

  if (url) {
    const normalizedUrl = normalizeUrlForCompare(url);
    urlSet.set(normalizedUrl, url);
    const nextCount = (urlCounts.get(normalizedUrl) ?? 0) + 1;
    urlCounts.set(normalizedUrl, nextCount);

    eventUrlChecks.push({
      id,
      title,
      url,
    });
  }

  if (status === "진행중" && startAt && startAt > snapshotAt) {
    warnings.push(
      `id ${id}: 상태가 진행중인데 startDate가 ${snapshotDate} 이후입니다. (${startRaw})`,
    );
  }

  if (status === "진행예정" && startRaw === snapshotDate && !timeLabel) {
    warnings.push(
      `id ${id}: 상태 진행예정인데 시작일이 오늘(${snapshotDate})입니다. (${startRaw})`,
    );
  }

  if (status === "진행예정" && startAt && endAt) {
    if (endAt < snapshotAt) {
      warnings.push(
        `id ${id}: 상태 진행예정인데 종료일이 이미 지났습니다. (${endRaw || startRaw})`,
      );
    }
  }

  if (status === "종료" && endAt && endAt >= snapshotAt) {
    warnings.push(
      `id ${id}: 상태 종료인데 종료일이 ${snapshotDate} 이후입니다. (${endRaw || startRaw})`,
    );
  }

  if (status === "모집중" && !endAt) {
    warnings.push(`id ${id}: 상태 모집중인데 endDate 누락. 종료 추적이 어려움.`);
  }

  if (sourceIds.includes("teca-hackathon-db")) {
    tecaMappedEvents.push({
      id,
      title,
      titleForCompare: normalizeEventTitleForCompare(title),
      url,
      normalizedUrl: normalizeUrlForCompare(url),
      startRaw,
      endRaw,
      status,
      sourceIds,
    });
  }
}

for (const [id, count] of duplicates) {
  if (count > 1) warnings.push(`id 중복: ${id} (${count}건)`);
}

for (const [normalizedUrl, count] of urlCounts) {
  if (count <= 1) continue;
  const rawUrl = urlSet.get(normalizedUrl) ?? normalizedUrl;
  warnings.push(`url 중복 (${count}건): ${rawUrl}`);
}

const tecaResult = await compareWithTecaData(tecaMappedEvents);
const urlValidationWarnings = await validateEventUrls(eventUrlChecks);

const statusLine = `이벤트 항목: ${entries.length}건`; 
console.log(statusLine);
console.log(`SNAPSHOT_DATE: ${snapshotDate}`);

if (errors.length > 0) {
  console.log(`\n[ERROR] ${errors.length}건`);
  for (const item of errors) console.log(`- ${item}`);
}

if (warnings.length > 0 || tecaResult.warnings.length > 0) {
  const totalWarnings = [
    ...warnings,
    ...tecaResult.warnings,
    ...urlValidationWarnings,
  ];
  console.log(`\n[WARN] ${totalWarnings.length}건`);
  for (const item of totalWarnings) console.log(`- ${item}`);
}

const totalIssues = errors.length;
if (totalIssues > 0) {
  throw new Error(`이벤트 검증 실패: ${totalIssues}건의 에러`);
}

console.log("\n[PASS] 이벤트 스케줄 정합성 검사 통과");

async function compareWithTecaData(tecaEvents) {
  if (tecaEvents.length === 0) {
    return { warnings: ["TECA 연동 이벤트 항목이 없습니다."], matches: 0 };
  }

  const tecaScript = await loadTecaScript();
  if (!tecaScript.success) {
    return {
      warnings: [
        "TECA 페이지 스크립트 접근 실패(네트워크 제한/변경). TECA 교차검증은 스킵됩니다.",
      ],
      matches: 0,
    };
  }

  const tecaByUrl = parseTecaHackathons(tecaScript.text);
  const warnings = [];
  let matched = 0;
  let unmatched = 0;

  for (const event of tecaEvents) {
    const tecaCandidates = tecaByUrl.get(event.normalizedUrl) ?? [];
    const bestMatch = selectBestTecaMatch(event, tecaCandidates);

    if (!bestMatch) {
      unmatched += 1;
      warnings.push(`TECA 미반영: ${event.title} (${event.url})`);
      continue;
    }

    const {
      candidate,
      score,
      reason,
    } = bestMatch;

    if (score < TECA_MATCH_THRESHOLD) {
      unmatched += 1;
      warnings.push(
        `TECA 매칭 신뢰도 낮음: catalog=${event.title}, teca=${candidate.title}, score=${score}, url=${event.url}${reason ? `, 이유=${reason}` : ""}`,
      );
      continue;
    }

    if (event.title !== candidate.title) {
      warnings.push(
        `TECA 제목 불일치: catalog=${event.title}, teca=${candidate.title}, url=${event.url}`,
      );
    }
    if (event.startRaw !== candidate.startDate) {
      warnings.push(
        `TECA 시작일 불일치: catalog=${event.startRaw || "<empty>"}, teca=${
          candidate.startDate
        }, title=${event.title}`,
      );
    }
    if ((event.endRaw || event.startRaw) !== candidate.endDate) {
      warnings.push(
        `TECA 종료일 불일치: catalog=${event.endRaw || event.startRaw}, teca=${
          candidate.endDate
        }, title=${event.title}`,
      );
    }
    matched += 1;
  }

  if (unmatched > 0) {
    warnings.unshift(
      `TECA 교차검증 매칭 불일치: ${unmatched}건 (총 ${tecaEvents.length}건)`,
    );
  }
  warnings.unshift(`TECA 교차검증 매칭: ${matched}/${tecaEvents.length}건`);

  return {
    warnings,
    matches: matched,
  };
}

function selectBestTecaMatch(event, candidates) {
  if (candidates.length === 0) return null;

  let best = { candidate: null, score: -1, reason: "" };

  for (const candidate of candidates) {
    const titleScore = calculateTitleMatchScore(
      event.titleForCompare,
      candidate.titleForCompare,
    );
    const dateMatchScore = getDateMatchScore(
      event.startRaw,
      event.endRaw,
      candidate.startDate,
      candidate.endDate,
    );
    const score = titleScore + dateMatchScore;
    const reason = buildMatchReason(
      event.title,
      candidate.title,
      event.startRaw,
      candidate.startDate,
      event.endRaw,
      candidate.endDate,
      dateMatchScore,
    );

    if (score > best.score) {
      best = { candidate, score, reason };
    }
  }

  return best.score < 40 ? null : best;
}

function buildMatchReason(
  catalogTitle,
  tecaTitle,
  catalogStart,
  tecaStart,
  catalogEnd,
  tecaEnd,
  dateScore,
) {
  const reasons = [];
  if (dateScore === 0) {
    reasons.push("날짜 미매칭");
  }
  if (!isTitleOverlap(catalogTitle, tecaTitle)) {
    reasons.push("제목 유사도 낮음");
  }
  return reasons.join("; ");
}

function isTitleOverlap(catalogTitle, tecaTitle) {
  return calculateTitleMatchScore(catalogTitle, tecaTitle) >= 60;
}

function getDateMatchScore(
  catalogStartDate,
  catalogEndDate,
  tecaStartDate,
  tecaEndDate,
) {
  const catalogStart = catalogStartDate || "";
  const catalogEnd = catalogEndDate || catalogStartDate || "";
  let score = 0;

  if (tecaStartDate && catalogStart === tecaStartDate) score += 40;
  if (tecaEndDate && catalogEnd && catalogEnd === tecaEndDate) score += 20;

  return score;
}

async function loadTecaScript() {
  const url = "https://page.teca-official.co.kr/script.js";
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "AIDigestDesk/0.1 (internal-verifier)",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      text: await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseTecaHackathons(scriptText) {
  const hackBlockMatch = scriptText.match(/const Hackathon\s*=\s*\{([\s\S]*?)\n\};/);
  if (!hackBlockMatch) return new Map();

  const map = new Map();
  const records = [...hackBlockMatch[1].matchAll(/\n\s*([A-Z0-9_]+):\s*\{([^}]*)\},/g)];

  for (const match of records) {
    const body = `{${match[2]}}`;
    const rawLink = body.match(/\blink:\s*([^,\n]+)/)?.[1] ?? "";
    const link = normalizeString(rawLink);
    if (!link) continue;

    const title = normalizeString(body.match(/\bname:\s*([^,\n]+)/)?.[1] ?? "");
    const recruitStart = normalizeString(
      body.match(/\brecruitStart:\s*([^,\n]+)/)?.[1] ?? "",
    );
    const recruitEnd = normalizeString(
      body.match(/\brecruitEnd:\s*([^,\n]+)/)?.[1] ?? "",
    );

    const normalizedLink = normalizeUrlForCompare(link);
    const existing = map.get(normalizedLink) ?? [];
    const item = {
      title,
      titleForCompare: normalizeEventTitleForCompare(title),
      startDate: convertKoreanDateToISO(recruitStart),
      endDate: convertKoreanDateToISO(recruitEnd),
    };
    map.set(normalizedLink, [...existing, item]);
  }

  return map;
}

function convertKoreanDateToISO(value) {
  const match = value.match(/(\d{1,2})월\s*(\d{1,2})일\s*(\d{4})/);
  if (!match) return value;

  const month = String(Number(match[1])).padStart(2, "0");
  const day = String(Number(match[2])).padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

async function validateEventUrls(items) {
  if (!EVENT_URL_CHECK_ENABLED) return [];
  if (items.length === 0) return [];

  const warnings = [];
  const unique = deduplicateByUrl(items);
  const queue = [...unique];
  const workerCount = Math.max(1, EVENT_URL_CHECK_CONCURRENCY);
  const workers = Array.from({ length: workerCount }, () => runUrlWorker(queue, warnings));
  await Promise.all(workers);

  return warnings;
}

async function runUrlWorker(queue, warnings) {
  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    const result = await checkSingleUrl(item);
    if (result) warnings.push(result);
  }
}

function deduplicateByUrl(items) {
  const map = new Map();
  for (const item of items) {
    const url = item.url.trim();
    if (!url) continue;
    if (!map.has(url)) {
      map.set(url, item);
    }
  }
  return [...map.values()];
}

async function checkSingleUrl(item) {
  const rawUrl = item.url.trim();
  if (!isValidHttpUrl(rawUrl)) {
    return `이벤트 링크 형식 오류: ${rawUrl} (id=${item.id}, title=${item.title})`;
  }

  const headResult = await requestWithRetry(rawUrl);
  if (headResult.ok) return null;

  if (headResult.status >= 400) {
    return `이벤트 링크 응답 비정상: ${rawUrl} (${headResult.status}) id=${item.id}, title=${item.title}`;
  }

  const fallbackResult = await requestWithRetry(rawUrl, true);
  if (!fallbackResult.ok) {
    return `이벤트 링크 접근 실패: ${rawUrl} (${fallbackResult.error}) id=${item.id}, title=${item.title}`;
  }

  return null;
}

function isValidHttpUrl(rawUrl) {
  if (!rawUrl) return false;
  if (!/^https?:\/\//i.test(rawUrl)) return false;
  try {
    new URL(rawUrl);
    return true;
  } catch {
    return false;
  }
}

async function requestWithRetry(url, useGetFallback = false) {
  const method = useGetFallback ? "GET" : "HEAD";
  const startHeaders = {
    "user-agent": "AIDigestDesk/0.1 (internal-verifier)",
  };

  try {
    const { signal, clear } = withTimeout(
      EVENT_URL_CHECK_TIMEOUT_MS,
    );
    const response = await fetch(url, {
      method,
      redirect: "follow",
      headers: startHeaders,
      signal,
    });
    const ok = response.ok || response.status === 405;
    const status = response.status;
    clear();
    return {
      ok: useGetFallback ? response.ok : ok,
      status,
    };
  } catch (error) {
    if (!useGetFallback) {
      return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
    }

    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
