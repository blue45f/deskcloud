import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const workspaceRoot = process.cwd();
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const defaultRouteTargets = [
  "/",
  "/catalog",
  "/pricing",
  "/docs",
  "/design",
  "/sitemap",
  "/login",
  "/signup",
  "/admin/inquiries",
  "/desks/termsdesk",
  "/desks/surveydesk",
  "/desks/changelogdesk",
  "/desks/reviewdesk",
  "/desks/mediadesk",
  "/desks/notifydesk",
  "/desks/moderationdesk",
  "/desks/realtimedesk",
  "/desks/searchdesk",
  "/desks/communitydesk",
  "/desks/chatdesk",
  "/desks/addesk",
  "/desks/authdesk",
  "/desks/filedesk",
  "/desks/seo-gateway",
  "/desks/remote-devtools",
  "/dashboard",
];

const catalogDeskRoutes = [
  "/desks/addesk",
  "/desks/authdesk",
  "/desks/changelogdesk",
  "/desks/chatdesk",
  "/desks/communitydesk",
  "/desks/filedesk",
  "/desks/mediadesk",
  "/desks/moderationdesk",
  "/desks/notifydesk",
  "/desks/realtimedesk",
  "/desks/remote-devtools",
  "/desks/reviewdesk",
  "/desks/searchdesk",
  "/desks/seo-gateway",
  "/desks/surveydesk",
  "/desks/termsdesk",
];

const consoleIgnore = [/favicon/i, /ResizeObserver loop/i];

const mode = process.argv[2] ?? "all";

const includeTermsDeskChecks = boolFlag(
  process.env.DESKCLOUD_VERIFY_TERMSDESK,
  false,
);

const termsdeskRuntimeDefault =
  process.env.TERMSDESK_RUNTIME_BASE ?? "https://termsdesk.vercel.app";

const commandNames = {
  all: includeTermsDeskChecks
    ? ["prod-routes", "dashboard", "termsdesk"]
    : ["prod-routes", "dashboard"],
  routes: ["prod-routes"],
  dashboard: ["dashboard"],
  termsdesk: ["termsdesk"],
  none: [],
};

if (!commandNames[mode]) {
  console.error(
    `Unknown mode: ${mode}. Use: all | routes | dashboard | termsdesk`,
  );
  process.exit(1);
}

const baseUrl =
  process.env.DESKCLOUD_BASE_URL ||
  process.env.DESKCLOUD_PROD_URL ||
  "https://desk-platform.vercel.app";

const screenshotDir = process.env.DESKCLOUD_SCREENSHOT_DIR
  ? path.resolve(process.env.DESKCLOUD_SCREENSHOT_DIR)
  : path.join(workspaceRoot, ".local", "verification");

const commandOutput = [];
const failures = [];

const playwright = await loadPlaywright();
const browser = await launchBrowser(playwright);

try {
  if (commandNames[mode].includes("prod-routes")) {
    commandOutput.push(await verifyProductionRoutes(browser));
  }

  if (commandNames[mode].includes("dashboard")) {
    commandOutput.push(await verifyDashboardFlow(browser));
  }

  if (commandNames[mode].includes("termsdesk")) {
    commandOutput.push(await verifyTermsDeskFlow(browser));
  }
} finally {
  await browser.close();
}

await fs.mkdir(screenshotDir, { recursive: true });
await fs.writeFile(
  path.join(screenshotDir, "verify-production-summary.json"),
  JSON.stringify(
    {
      mode,
      baseUrl,
      results: commandOutput,
      failures: failures.length,
      timestamp: new Date().toISOString(),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  for (const issue of failures) {
    console.error(`FAIL: ${issue}`);
  }
  process.exit(1);
}

console.log(`PASS: production verification (${mode})`);
for (const output of commandOutput) {
  if (output?.summary) {
    console.log(output.summary);
  }
}

async function verifyProductionRoutes(browser) {
  const localFailures = [];
  const routes = parseList(
    process.env.DESKCLOUD_VERIFY_ROUTES,
    defaultRouteTargets,
  );
  const viewports = parseViewports(process.env.DESKCLOUD_VERIFY_VIEWPORTS, [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]);
  const timeoutMs = Number.parseInt(
    process.env.DESKCLOUD_ROUTE_TIMEOUT_MS ?? "45000",
    10,
  );
  const results = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    for (const route of routes) {
      const result = await checkPublicRoute({
        page,
        baseUrl,
        route,
        timeoutMs,
      });
      if (!result.ok) {
        localFailures.push(`${result.route} (${viewport.name})`);
        failures.push(
          `route check failed: ${result.route} (${viewport.name}) ${result.issues.join(
            " ; ",
          )}`,
        );
        const screenshotPath = path.join(
          screenshotDir,
          `route-${viewport.name}-${safePath(route)}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotPath;
      }
      if (route === "/dashboard" && viewport.name === "desktop") {
        const screenshotPath = path.join(
          screenshotDir,
          "route-desktop-dashboard.png",
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.dashboardScreenshot = screenshotPath;
      }
      if (route === "/dashboard" && viewport.name === "mobile") {
        const screenshotPath = path.join(
          screenshotDir,
          "route-mobile-dashboard.png",
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.dashboardScreenshotMobile = screenshotPath;
      }
      results.push({ ...result, viewport: viewport.name });
    }

    await context.close();
  }

  const passed = results.filter((item) => item.ok).length;
  const summary = `route-check: checked=${results.length} passed=${passed} failed=${localFailures.length}`;
  commandOutput.push(`route-check summary: ${summary}`);
  return {
    name: "prod-routes",
    summary,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
    screenshotDir,
  };
}

async function verifyDashboardFlow(browser) {
  const localFailures = [];
  const isAuthMode =
    process.env.DESKCLOUD_DASHBOARD_AUTH === "1" ||
    (!process.env.DESKCLOUD_DASHBOARD_AUTH &&
      /localhost|127\.0\.0\.1/.test(baseUrl));
  const needsMock = boolFlag(
    process.env.DESKCLOUD_DASHBOARD_MOCK_API,
    isAuthMode,
  );
  const token =
    process.env.DESKCLOUD_DASHBOARD_TOKEN ?? "sk_local_playwright_smoke";
  const timeoutMs = Number.parseInt(
    process.env.DESKCLOUD_DASHBOARD_TIMEOUT_MS ?? "30000",
    10,
  );
  const targets = [
    {
      name: "dashboard-desktop",
      path: "/dashboard#integration-verification",
      viewport: { width: 1440, height: 1200 },
      texts: isAuthMode
        ? [
            "전수 통합 검증",
            "실행 증거 트랙",
            "Workspace control-plane",
            "TermsDesk 런타임",
            "어드민 경계",
          ]
        : ["로그인", "시작하기", "콘솔 로그인"],
      expectedToFail: false,
      screenshot: "dashboard-desktop-integration-verification.png",
    },
    {
      name: "dashboard-mobile",
      path: "/dashboard#integration-verification",
      viewport: { width: 390, height: 1100 },
      texts: isAuthMode
        ? ["전수 통합 검증", "실행 증거 트랙", "정적 계약", "렌더드 라우트"]
        : ["로그인", "시작하기", "콘솔 로그인"],
      expectedToFail: false,
      screenshot: "dashboard-mobile-integration-verification.png",
    },
    {
      name: "docs-matrix",
      path: "/docs#verification-matrix",
      viewport: { width: 1280, height: 1000 },
      texts: ["전수 검증 매트릭스", "운영 증거 트랙"],
      screenshot: "docs-verification-matrix.png",
    },
  ];

  const routeResults = [];
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  for (const target of targets) {
    const page = await context.newPage({ viewport: target.viewport });
    const result = {
      path: target.path,
      viewport: `${target.viewport.width}x${target.viewport.height}`,
      issues: [],
    };
    const consoleIssues = [];
    const onConsole = (message) => {
      if (["error", "warning"].includes(message.type())) {
        const text = message.text();
        if (!shouldIgnoreConsole(text))
          consoleIssues.push(`${message.type()}: ${text}`);
      }
    };
    const onPageError = (error) =>
      consoleIssues.push(`pageerror: ${error.message}`);
    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    if (isAuthMode) {
      await page.addInitScript((adminToken) => {
        window.localStorage.setItem("dc-tenant-token", adminToken);
      }, token);

      if (needsMock) {
        await page.route("**/api/workspace-desks", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              sourceOfTruth: "local rendered smoke",
              controlPlane: "DeskCloud admin console",
              standaloneRuntimePolicy:
                "분리하지 않는다. DeskCloud control-plane에서 검증한다.",
              items: [],
            }),
          }),
        );
      }
    }

    let response = null;
    try {
      response = await page.goto(`${baseUrl}${target.path}`, {
        timeout: timeoutMs,
        waitUntil: "networkidle",
      });
    } catch (error) {
      result.issues.push(`navigation failure: ${error.message}`);
    }

    if (response && !response.ok() && response.status() !== 401) {
      result.issues.push(`HTTP ${response.status()}`);
    }

    const body = await safeText(page, "body");
    for (const expectedText of target.texts) {
      if (!body.includes(expectedText)) {
        result.issues.push(`missing text: "${expectedText}"`);
      }
    }

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    if (overflow > 2) {
      result.issues.push(`horizontal overflow ${overflow}px`);
    }

    if (consoleIssues.length > 0) {
      result.issues.push(`console issue(s): ${consoleIssues.join(" | ")}`);
    }

    const screenshotPath = path.join(screenshotDir, target.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;
    result.ok = result.issues.length === 0 || !!target.expectedToFail;
    routeResults.push(result);

    if (!result.ok) {
      localFailures.push(target.name);
      failures.push(
        `dashboard flow failed: ${target.name} ${result.issues.join(" ; ")}`,
      );
    }
    await page.unroute("**/api/workspace-desks");
    await page.unroute("**/api/workspace-desks/*");
    await page.close();
  }

  await context.close();

  const passed = routeResults.filter((item) => item.ok).length;
  const summary = `dashboard-check: checked=${routeResults.length} passed=${passed} failed=${localFailures.length}`;
  return {
    name: "dashboard",
    summary,
    total: routeResults.length,
    passed,
    failed: routeResults.length - passed,
    isAuthMode,
    results: routeResults,
  };
}

async function verifyTermsDeskFlow(browser) {
  const localFailures = [];
  const runtimeBase = termsdeskRuntimeDefault;
  const timeoutMs = Number.parseInt(
    process.env.TERMSDESK_TIMEOUT_MS ?? "45000",
    10,
  );
  const results = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const commonIssues = [];

  const onConsole = (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!/401|Unauthorized/i.test(text)) commonIssues.push(text);
    }
  };
  page.on("console", onConsole);

  await runTermsCatalogFlow(
    page,
    `${baseUrl}`,
    runtimeBase,
    timeoutMs,
    results,
  );

  const runDirect = boolFlag(process.env.TERMSDESK_VERIFY_DIRECT_FLOW, true);
  if (runDirect) {
    const directPage = await context.newPage({
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: true,
    });
    const directIssues = [];
    const onDirectConsole = (message) => {
      if (message.type() === "error") {
        const text = message.text();
        if (!/401|Unauthorized/i.test(text)) directIssues.push(text);
      }
    };
    directPage.on("console", onDirectConsole);

    await runTermsDirectDemoFlow(
      directPage,
      runtimeBase,
      timeoutMs,
      results,
      directIssues,
    );
    directPage.off("console", onDirectConsole);
    directPage.removeAllListeners("pageerror");
    await directPage.close();
  }

  page.off("console", onConsole);
  page.removeAllListeners("pageerror");
  await page.close();
  await context.close();

  for (const result of results) {
    if (!result.ok) {
      localFailures.push(result.name);
      failures.push(
        `termsdesk flow failed: ${result.name} ${result.issues.join(" ; ")}`,
      );
    }
  }

  const passed = results.filter((item) => item.ok).length;
  const summary = `termsdesk-check: checked=${results.length} passed=${passed} failed=${localFailures.length}`;
  return {
    name: "termsdesk",
    summary,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };

  async function runTermsCatalogFlow(
    runtimePage,
    catalogUrl,
    runtimeHost,
    timeout,
    out,
  ) {
    const result = {
      name: "catalog-to-runtime",
      issues: [],
    };

    const routePath = "/catalog";
    let response = null;
    try {
      response = await runtimePage.goto(`${catalogUrl}${routePath}`, {
        timeout,
        waitUntil: "networkidle",
      });
    } catch (error) {
      result.issues.push(`catalog navigation failure: ${error.message}`);
      result.ok = false;
      out.push(result);
      return;
    }

    if (!response?.ok()) {
      result.issues.push(`catalog status ${response?.status() ?? "unknown"}`);
    }

    try {
      await runtimePage
        .locator('a[href="/desks/termsdesk"]')
        .first()
        .click({ timeout: 10_000 });
      await runtimePage.waitForURL("**/desks/termsdesk", { timeout: 15_000 });
      await runtimePage.waitForLoadState("networkidle");
    } catch (error) {
      result.issues.push(
        `failed to open termsdesk microsite: ${error.message}`,
      );
      result.ok = false;
      out.push(result);
      return;
    }

    result.micrositeUrl = runtimePage.url();
    result.micrositeTitle = await safeText(runtimePage, "title");

    const ctaText = /의뢰 중계 열기|의뢰 중계/;
    const popupPromise = runtimePage
      .waitForEvent("popup", { timeout: 12_000 })
      .catch(() => null);
    try {
      await runtimePage.getByRole("link", { name: ctaText }).first().click({
        timeout: 10_000,
      });
    } catch {
      try {
        await runtimePage.getByRole("button", { name: ctaText }).first().click({
          timeout: 5_000,
        });
      } catch (error) {
        result.issues.push(`failed to click mediation cta: ${error.message}`);
        result.ok = false;
        out.push(result);
        return;
      }
    }

    const popup = await popupPromise;
    const appPage = popup ?? runtimePage;
    await appPage.waitForLoadState("domcontentloaded");
    await appPage.waitForTimeout(2_000);

    const appIssues = [];
    const onPopupConsole = (message) => {
      if (message.type() === "error") {
        const text = message.text();
        if (!/401|Unauthorized/i.test(text)) appIssues.push(text);
      }
    };
    appPage.on("console", onPopupConsole);

    if (/\/login$/.test(appPage.url())) {
      const demoButton = appPage.getByRole("button", {
        name: /로그인 없이|데모|Demo/i,
      });
      if (!(await demoButton.isVisible().catch(() => false))) {
        result.issues.push("login page without visible demo button");
      } else {
        await demoButton.click({ timeout: 10_000 });
        await appPage.waitForURL("**/app", { timeout });
        await appPage.waitForLoadState("networkidle");
      }
    }

    try {
      await appPage.goto(`${runtimeHost}/app/marketplace`, {
        timeout,
        waitUntil: "networkidle",
      });
    } catch (error) {
      result.issues.push(
        `runtime marketplace navigation failed: ${error.message}`,
      );
    }

    const runtimeApi = await appPage.evaluate(async () => {
      const response = await fetch("/api/marketplace").catch(() => null);
      if (!response || !response.ok) {
        return { ok: false, status: response?.status ?? 0, count: null };
      }
      const json = await response.json().catch(() => null);
      return {
        ok: response.ok,
        status: response.status,
        count: Array.isArray(json?.items) ? json.items.length : null,
      };
    });

    const body = await safeText(appPage, "body");
    if (!body || /404|페이지를 찾을 수 없음/.test(body)) {
      result.issues.push("runtime body is missing marketplace content");
    }

    const overlay = await appPage.evaluate(() =>
      [
        "vite-error-overlay",
        "[data-nextjs-dialog-overlay]",
        "[data-nextjs-dialog]",
        "#webpack-dev-server-client-overlay",
      ].some((selector) => document.querySelector(selector)),
    );
    if (overlay) {
      result.issues.push(
        "framework overlay detected on termsdesk runtime page",
      );
    }

    if (runtimeApi.count == null || typeof runtimeApi.count !== "number") {
      result.issues.push(
        `marketplace api invalid: status=${runtimeApi.status} count=${String(
          runtimeApi.count,
        )}`,
      );
    }

    result.issues.push(...commonIssues);
    result.issues.push(...appIssues);
    result.runtimeLandingUrl = appPage.url();
    result.runtimeMarketplaceUrl = `${runtimeHost}/app/marketplace`;
    result.marketplaceApi = runtimeApi;
    result.ok = result.issues.length === 0;

    const screenshotPath = path.join(
      screenshotDir,
      "termsdesk-catalog-to-runtime.png",
    );
    await appPage.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;
    out.push(result);

    appPage.off("console", onPopupConsole);
  }

  async function runTermsDirectDemoFlow(
    directPage,
    runtimeHost,
    timeout,
    out,
    directIssues,
  ) {
    const result = {
      name: "direct-runtime-demo",
      issues: [],
    };

    try {
      await directPage.goto(`${runtimeHost}/app/marketplace`, {
        timeout,
        waitUntil: "networkidle",
      });
      await directPage.waitForTimeout(1_500);
    } catch (error) {
      result.issues.push(`direct entry failed: ${error.message}`);
      result.ok = false;
      out.push(result);
      return;
    }

    if (/\/login$/.test(directPage.url())) {
      const demoButton = directPage.getByRole("button", {
        name: /로그인 없이|데모|Demo/i,
      });
      if (await demoButton.isVisible().catch(() => false)) {
        await demoButton.click({ timeout: 10_000 });
        await directPage.waitForURL("**/app", { timeout });
        await directPage.waitForLoadState("networkidle");
      } else {
        result.issues.push("no visible demo button on direct marketplace");
      }
    }

    try {
      await directPage.goto(`${runtimeHost}/app/marketplace`, {
        timeout,
        waitUntil: "networkidle",
      });
    } catch (error) {
      result.issues.push(`direct marketplace reopen failed: ${error.message}`);
    }

    const marketplaceApi = await directPage.evaluate(async () => {
      const response = await fetch("/api/marketplace").catch(() => null);
      if (!response || !response.ok) {
        return { ok: false, status: response?.status ?? 0, count: null };
      }
      const json = await response.json().catch(() => null);
      return {
        ok: response.ok,
        status: response.status,
        count: Array.isArray(json?.items) ? json.items.length : null,
      };
    });

    const body = await safeText(directPage, "body");
    if (!body || /404|페이지를 찾을 수 없음/.test(body)) {
      result.issues.push("direct flow shows missing marketplace body");
    }

    const overlay = await directPage.evaluate(() =>
      [
        "vite-error-overlay",
        "[data-nextjs-dialog-overlay]",
        "[data-nextjs-dialog]",
        "#webpack-dev-server-client-overlay",
      ].some((selector) => document.querySelector(selector)),
    );
    if (overlay) {
      result.issues.push("framework overlay detected on direct runtime page");
    }

    result.marketplaceApi = marketplaceApi;
    result.issues.push(...directIssues);
    result.ok = result.issues.length === 0;
    const screenshotPath = path.join(
      screenshotDir,
      "termsdesk-direct-demo.png",
    );
    await directPage.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;
    out.push(result);
  }
}

function parseViewports(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return value
      .split(",")
      .map((raw) => {
        if (!raw.includes("x")) {
          return undefined;
        }
        const [w, h] = raw.split("x").map((n) => Number.parseInt(n.trim(), 10));
        if (!Number.isFinite(w) || !Number.isFinite(h)) {
          return undefined;
        }
        return { name: raw.trim(), width: w, height: h };
      })
      .filter(Boolean);
  } catch {
    return fallback;
  }
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
}

function boolFlag(value, defaultValue = false) {
  if (value == null || value === "") {
    return defaultValue;
  }
  const lower = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(lower)) return true;
  if (["0", "false", "no", "off"].includes(lower)) return false;
  return defaultValue;
}

function shouldIgnoreConsole(text) {
  return consoleIgnore.some((rule) => rule.test(text));
}

async function checkPublicRoute({ page, baseUrl, route, timeoutMs }) {
  const issues = [];
  const consoleIssues = [];
  const pageErrors = [];
  const onConsole = (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!shouldIgnoreConsole(text)) consoleIssues.push(text);
    }
  };
  const onPageError = (error) => pageErrors.push(error.message);

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  let response = null;
  try {
    response = await page.goto(`${baseUrl}${route}`, {
      timeout: timeoutMs,
      waitUntil: "networkidle",
    });
  } catch (error) {
    issues.push(`navigation error: ${error.message}`);
  }

  const status = response ? response.status() : 0;
  if (status && (status < 200 || status >= 400)) {
    issues.push(`HTTP ${status}`);
  }

  const title = await safeText(page, "title");
  const bodyTextLength = await safeNumber(
    page
      .locator("body")
      .innerText()
      .then((text) => text.trim().length),
  );
  const rootChildCount = await safeNumber(page.locator("#root > *").count(), 0);
  const overlay = await page.evaluate(() =>
    [
      "vite-error-overlay",
      "[data-nextjs-dialog-overlay]",
      "[data-nextjs-dialog]",
      "#webpack-dev-server-client-overlay",
    ].some((selector) => document.querySelector(selector)),
  );

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const scrollWidth = doc.scrollWidth;
    const clientWidth = doc.clientWidth;
    const offenders = [];

    if (scrollWidth > clientWidth + 2) {
      const nodes = Array.from(document.body?.querySelectorAll("*") ?? []);
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style.position !== "fixed" &&
          Math.ceil(rect.right) > clientWidth + 2
        ) {
          offenders.push({
            tag: node.tagName.toLowerCase(),
            className: String(node.className).slice(0, 120),
            right: Math.ceil(rect.right),
            viewport: clientWidth,
          });
        }
        if (offenders.length > 5) {
          break;
        }
      }
    }

    return { scrollWidth, clientWidth, offenders };
  });

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  if (bodyTextLength < 80) {
    issues.push(`body text too short (${bodyTextLength})`);
  }
  if (route === "/catalog") {
    const catalogDeskLinks = await page.evaluate((expected) => {
      const uniqueLinks = Array.from(
        document.querySelectorAll('a[href^="/desks/"]'),
      ).map((a) => a.getAttribute("href"));
      const set = new Set(uniqueLinks.filter(Boolean));
      const missing = expected.filter((path) => !set.has(path));
      return { links: [...set], missing, count: set.size };
    }, catalogDeskRoutes);

    if (catalogDeskLinks.missing.length > 0) {
      issues.push(
        `catalog desk links missing: ${catalogDeskLinks.missing.join(", ")}`,
      );
    }
    if (catalogDeskLinks.count < catalogDeskRoutes.length) {
      issues.push(
        `catalog desk link count low: ${catalogDeskLinks.count}/${catalogDeskRoutes.length}`,
      );
    }
  }
  if (rootChildCount <= 0) {
    issues.push("no #root children");
  }
  if (overlay) {
    issues.push("framework overlay present");
  }
  if (
    overflow.offenders.length > 0 ||
    overflow.scrollWidth > overflow.clientWidth + 2
  ) {
    issues.push(
      `horizontal overflow ${overflow.scrollWidth - overflow.clientWidth}px, offenders=${
        overflow.offenders.length
      }`,
    );
  }
  if (consoleIssues.length > 0) {
    issues.push(`console error(s): ${consoleIssues.join(" | ")}`);
  }
  if (pageErrors.length > 0) {
    issues.push(`pageerror(s): ${pageErrors.join(" | ")}`);
  }

  return {
    route,
    title,
    status,
    bodyTextLength,
    rootChildCount,
    overflow,
    issues,
    ok: issues.length === 0,
  };
}

async function safeText(page, selector) {
  if (selector === "title") {
    try {
      return await page.title();
    } catch {
      return "";
    }
  }

  try {
    return await page.locator(selector).innerText();
  } catch {
    return "";
  }
}

async function safeNumber(value, fallback = 0) {
  try {
    const v = await value;
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  } catch {}
  return fallback;
}

function safePath(route) {
  if (!route || route === "/") return "home";
  return route.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function launchBrowser(playwright) {
  const headless = process.env.DESKCLOUD_HEADLESS !== "0";
  const forceChromium = process.env.DESKCLOUD_FORCE_CHROMIUM === "1";
  const browserChannel = process.env.DESKCLOUD_BROWSER_CHANNEL;
  const useSystemChrome = !forceChromium && (await exists(chromePath));
  const launchOptions = { headless };

  if (useSystemChrome) {
    launchOptions.executablePath = chromePath;
  } else if (browserChannel) {
    launchOptions.channel = browserChannel;
  }

  return playwright.chromium.launch(launchOptions);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadPlaywright() {
  const require = createRequire(
    path.join(workspaceRoot, "desks/remote-devtools/client/package.json"),
  );
  const pkg = require("playwright");
  return pkg;
}
