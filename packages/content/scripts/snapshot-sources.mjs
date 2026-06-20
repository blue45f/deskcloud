#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSourceSnapshotStore,
  snapshotSources,
  summarizeSnapshotRecords,
} from "../dist/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const outputPath = resolve(packageRoot, "data/source-snapshots.json");
const timeoutMs = parsePositiveIntegerEnv("SOURCE_SNAPSHOT_TIMEOUT_MS", 15_000);
const sourceIds = parseSourceIdsEnv("SOURCE_SNAPSHOT_IDS");

const previous = await readPreviousSnapshot(outputPath);
const snapshotRecords = await snapshotSources({
  previous,
  timeoutMs,
  sourceIds,
  requestInit: {
    headers: {
      "user-agent":
        "AIDigestDesk/0.1 source monitor (+https://local.aidigestdesk)",
    },
  },
});
const records = mergeSnapshotRecords(previous, snapshotRecords, sourceIds);
const store = createSourceSnapshotStore(records);
const summary = summarizeSnapshotRecords(snapshotRecords);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(store, null, 2)}\n`);

console.log(
  [
    `Source snapshot complete: ${summary.total} sources`,
    `new=${summary.new}`,
    `changed=${summary.changed}`,
    `unchanged=${summary.unchanged}`,
    `failed=${summary.failed}`,
    `stored=${records.length}`,
    `timeoutMs=${timeoutMs}`,
    `output=${outputPath}`,
  ].join(" "),
);

async function readPreviousSnapshot(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function parsePositiveIntegerEnv(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSourceIdsEnv(name) {
  const rawValue = process.env[name];
  if (!rawValue) return undefined;

  const ids = rawValue
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : undefined;
}

function mergeSnapshotRecords(previous, snapshotRecords, sourceIds) {
  if (!sourceIds || sourceIds.length === 0) return snapshotRecords;

  const previousRecords = previous
    ? "records" in previous
      ? previous.records
      : previous
    : [];
  const merged = new Map(
    previousRecords.map((record) => [record.sourceId, record]),
  );

  for (const record of snapshotRecords) {
    merged.set(record.sourceId, record);
  }

  return [...merged.values()];
}
