// Link-integrity checker for AIDigestDesk catalog.
// Extracts every URL from the built content package (sources, learning resources,
// event schedules, and metadata sourceUrl/canonicalUrl fields) and probes each
// over the network. Reports dead, redirected, and unreachable links so editors
// can keep `링크 정보 정합성` true. Network failures never throw — they are recorded.

import { writeFileSync } from "node:fs";

const mod = await import("../dist/index.js");
const {
  sources,
  learningResources,
  eventScheduleItems,
  modelProfiles,
  aiCodingTools,
} = mod;

/** @type {Map<string, Set<string>>} url -> set of "where" labels */
const urlMap = new Map();
const add = (url, where) => {
  if (typeof url !== "string") return;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return;
  if (!urlMap.has(trimmed)) urlMap.set(trimmed, new Set());
  urlMap.get(trimmed).add(where);
};

const collectMetadata = (metadata, where) => {
  if (!metadata) return;
  add(metadata.sourceUrl, where);
  add(metadata.canonicalUrl, where);
  for (const u of metadata.sourceUrls ?? []) add(u, where);
  for (const u of metadata.canonicalUrls ?? []) add(u, where);
};

for (const s of sources ?? []) {
  add(s.url, `source:${s.id}`);
  collectMetadata(s.metadata, `source.meta:${s.id}`);
}
for (const r of learningResources ?? []) {
  add(r.url, `resource:${r.id}`);
  collectMetadata(r.metadata, `resource.meta:${r.id}`);
}
for (const e of eventScheduleItems ?? []) {
  add(e.url, `event:${e.id}`);
  collectMetadata(e.metadata, `event.meta:${e.id}`);
}
// model/tool specs sometimes embed URLs in specs/integrations text — scan strings.
const urlRe = /https?:\/\/[^\s"'<>)\]]+/g;
const scanStrings = (obj, where) => {
  const seen = JSON.stringify(obj);
  for (const m of seen.match(urlRe) ?? []) add(m.replace(/[.,;]+$/, ""), where);
};
for (const m of modelProfiles ?? []) scanStrings(m, `model:${m.id}`);
for (const t of aiCodingTools ?? []) scanStrings(t, `tool:${t.id}`);

const urls = [...urlMap.keys()].sort();
console.error(`[check-links] probing ${urls.length} unique URLs…`);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36 AIDigestDeskLinkCheck/1.0";

async function probe(url) {
  const attempt = async (method) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept: "*/*" },
      });
      return { status: res.status, finalUrl: res.url, ok: res.ok };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let r = await attempt("HEAD");
    // Many servers reject/!ok on HEAD; retry GET to be sure.
    if (!r.ok || r.status === 405 || r.status === 403 || r.status === 0) {
      try {
        r = await attempt("GET");
      } catch {
        /* keep HEAD result */
      }
    }
    return r;
  } catch (err) {
    return { status: 0, finalUrl: url, ok: false, error: String(err?.name || err) };
  }
}

const results = [];
const CONCURRENCY = 12;
let idx = 0;
async function worker() {
  while (idx < urls.length) {
    const i = idx++;
    const url = urls[i];
    const r = await probe(url);
    const redirected = r.finalUrl && r.finalUrl !== url && !r.finalUrl.startsWith(url);
    results.push({
      url,
      status: r.status,
      ok: r.ok,
      redirectedTo: redirected ? r.finalUrl : undefined,
      error: r.error,
      where: [...urlMap.get(url)],
    });
    if (results.length % 25 === 0) {
      console.error(`[check-links] ${results.length}/${urls.length}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

results.sort((a, b) => a.url.localeCompare(b.url));
const broken = results.filter((r) => !r.ok || r.status >= 400 || r.status === 0);
const redirects = results.filter((r) => r.ok && r.redirectedTo);

const report = {
  checkedAt: new Date().toISOString(),
  total: results.length,
  okCount: results.length - broken.length,
  brokenCount: broken.length,
  redirectCount: redirects.length,
  broken,
  redirects,
  results,
};
writeFileSync(
  new URL("../.tmp-link-report.json", import.meta.url),
  JSON.stringify(report, null, 2),
);

console.error("\n========== LINK INTEGRITY REPORT ==========");
console.error(`checked: ${report.total}  ok: ${report.okCount}  broken: ${report.brokenCount}  redirects: ${report.redirectCount}`);
if (broken.length) {
  console.error("\n--- BROKEN / UNREACHABLE ---");
  for (const b of broken) {
    console.error(`[${b.status || "ERR"}] ${b.url}  (${b.where.join(", ")})${b.error ? "  " + b.error : ""}`);
  }
}
if (redirects.length) {
  console.error("\n--- REDIRECTS (ok but moved) ---");
  for (const r of redirects) {
    console.error(`[${r.status}] ${r.url}\n        -> ${r.redirectedTo}  (${r.where.join(", ")})`);
  }
}
console.error("\nFull JSON: packages/content/.tmp-link-report.json");
