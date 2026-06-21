import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(
  repoRoot,
  "platform/packages/shared/src/workspace-desks.ts",
);
const defaultManifestUrl =
  "https://desk-platform.vercel.app/api/workspace-desks";

const manifestUrl = (
  process.env.DESKCLOUD_WORKSPACE_MANIFEST_URL ||
  process.env.PROD_WORKSPACE_MANIFEST_URL ||
  defaultManifestUrl
).replace(/\/$/, "");

const expected404Ids = (
  process.env.DESKCLOUD_WORKSPACE_EXCLUDED_IDS ??
  process.env.PROD_WORKSPACE_EXCLUDED_IDS ??
  "aidigestdesk"
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const expectedIds = await readWorkspaceDeskIds(sourcePath);
const manifest = await fetchJson(manifestUrl);
const issues = verifyManifest(manifest, expectedIds);

for (const id of expectedIds) {
  const item = await fetchJson(`${manifestUrl}/${encodeURIComponent(id)}`);
  if (item.id !== id) {
    issues.push(`GET /${id} returned id=${String(item.id)}`);
  }
}

for (const id of expected404Ids) {
  const status = await fetchStatus(`${manifestUrl}/${encodeURIComponent(id)}`);
  if (status !== 404) {
    issues.push(
      `excluded workspace Desk ${id} returned HTTP ${status}, expected 404`,
    );
  }
}

if (issues.length > 0) {
  console.error("DeskCloud production workspace manifest parity failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("DeskCloud production workspace manifest parity passed");
console.log(`manifest: ${manifestUrl}`);
console.log(`workspace desks: ${expectedIds.join(", ")}`);
console.log(
  `excluded ids returning 404: ${expected404Ids.join(", ") || "(none)"}`,
);

async function readWorkspaceDeskIds(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = findVariableDeclaration(sourceFile, "WORKSPACE_DESK_IDS");
  const initializer = declaration?.initializer
    ? unwrapExpression(declaration.initializer)
    : undefined;

  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    throw new Error(`Could not find WORKSPACE_DESK_IDS array in ${filePath}`);
  }

  return initializer.elements.map((element) => {
    if (!ts.isStringLiteralLike(element)) {
      throw new Error("WORKSPACE_DESK_IDS must contain only string literals");
    }
    return element.text;
  });
}

function unwrapExpression(expression) {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function findVariableDeclaration(sourceFile, name) {
  let found;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `GET ${url} failed with HTTP ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`GET ${url} did not return valid JSON: ${error.message}`);
  }
}

async function fetchStatus(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  await response.arrayBuffer();
  return response.status;
}

function verifyManifest(manifest, expectedIds) {
  const issues = [];

  if (!manifest || typeof manifest !== "object") {
    return ["manifest response is not an object"];
  }
  if (!Array.isArray(manifest.items)) {
    return ["manifest.items is not an array"];
  }

  const actualIds = manifest.items.map((item) => item.id);
  const missing = expectedIds.filter((id) => !actualIds.includes(id));
  const extra = actualIds.filter((id) => !expectedIds.includes(id));

  if (missing.length > 0) issues.push(`missing ids: ${missing.join(", ")}`);
  if (extra.length > 0) issues.push(`extra ids: ${extra.join(", ")}`);
  if (!String(manifest.controlPlane ?? "").includes("DeskCloud")) {
    issues.push("manifest.controlPlane does not identify DeskCloud");
  }
  if (
    !String(manifest.standaloneRuntimePolicy ?? "").includes("분리하지 않는다")
  ) {
    issues.push(
      "manifest.standaloneRuntimePolicy does not state the no-standalone policy",
    );
  }

  for (const item of manifest.items) {
    if (item.integrationStatus !== "workspace_integrated") {
      issues.push(
        `${item.id}: integrationStatus=${String(item.integrationStatus)}`,
      );
    }
    if (item.liveUrl !== null) {
      issues.push(`${item.id}: liveUrl must be null`);
    }
    if (item.workspacePath !== `desks/${item.id}`) {
      issues.push(`${item.id}: workspacePath=${String(item.workspacePath)}`);
    }
    if (item.adminPath !== `/dashboard?desk=${item.id}`) {
      issues.push(`${item.id}: adminPath=${String(item.adminPath)}`);
    }
    if (item.micrositePath !== `/desks/${item.id}`) {
      issues.push(`${item.id}: micrositePath=${String(item.micrositePath)}`);
    }
    if (
      typeof item.gatewayPath !== "string" ||
      !item.gatewayPath.startsWith("/")
    ) {
      issues.push(
        `${item.id}: invalid gatewayPath=${String(item.gatewayPath)}`,
      );
    }
  }

  return issues;
}
