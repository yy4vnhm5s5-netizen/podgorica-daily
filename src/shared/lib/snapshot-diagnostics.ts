import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { readJsonCache } from "./cache.ts";

type SnapshotFileState = "available" | "missing" | "unreadable";
type RelevantTimestampTimeZone = "Europe/Podgorica" | "UTC";

interface FileSnapshotDiagnostic {
  cachePath: string;
  currentPodgoricaTime: string;
  currentUtcTime: string;
  displayableRecordCount: number;
  earliestRelevantTimestamp?: string;
  exists: boolean;
  fetchedAt?: string;
  latestRelevantTimestamp?: string;
  relevantTimestampTimeZone: RelevantTimestampTimeZone;
  state: SnapshotFileState;
  totalRecordCount: number;
}

interface CreateFileSnapshotDiagnosticOptions<TSnapshot, TRecord> {
  cachePath: string;
  getDisplayableRecordCount: (records: readonly TRecord[], now: Date) => number;
  getFetchedAt: (snapshot: TSnapshot) => string | undefined;
  getRecords: (snapshot: TSnapshot) => readonly TRecord[];
  getRelevantTimestamp: (record: TRecord) => string | undefined;
  now?: Date;
  relevantTimestampTimeZone: RelevantTimestampTimeZone;
  fileExists?: (cachePath: string) => Promise<boolean>;
  readSnapshot?: (cachePath: string) => Promise<TSnapshot | null>;
}

async function createFileSnapshotDiagnostic<TSnapshot, TRecord>({
  cachePath,
  fileExists = doesFileExist,
  getDisplayableRecordCount,
  getFetchedAt,
  getRecords,
  getRelevantTimestamp,
  now = new Date(),
  readSnapshot = readJsonCache<TSnapshot>,
  relevantTimestampTimeZone,
}: CreateFileSnapshotDiagnosticOptions<TSnapshot, TRecord>): Promise<FileSnapshotDiagnostic> {
  const [exists, snapshot] = await Promise.all([
    fileExists(cachePath).catch(() => false),
    readSnapshot(cachePath).catch(() => null),
  ]);
  const base = {
    cachePath,
    currentPodgoricaTime: formatPodgoricaTime(now),
    currentUtcTime: now.toISOString(),
    relevantTimestampTimeZone,
  };

  if (!snapshot) {
    return {
      ...base,
      displayableRecordCount: 0,
      exists,
      state: exists ? "unreadable" : "missing",
      totalRecordCount: 0,
    };
  }

  try {
    const records = getRecords(snapshot);
    if (!Array.isArray(records)) throw new Error("Snapshot records are not an array.");

    const timestamps = records
      .map(getRelevantTimestamp)
      .filter((timestamp): timestamp is string => Boolean(timestamp))
      .toSorted();
    const fetchedAt = getFetchedAt(snapshot);

    return {
      ...base,
      displayableRecordCount: getDisplayableRecordCount(records, now),
      ...(timestamps[0] ? { earliestRelevantTimestamp: timestamps[0] } : {}),
      exists,
      ...(fetchedAt ? { fetchedAt } : {}),
      ...(timestamps.at(-1) ? { latestRelevantTimestamp: timestamps.at(-1) } : {}),
      state: "available",
      totalRecordCount: records.length,
    };
  } catch {
    return {
      ...base,
      displayableRecordCount: 0,
      exists,
      state: "unreadable",
      totalRecordCount: 0,
    };
  }
}

function emitSnapshotDiagnostics(snapshots: Record<string, FileSnapshotDiagnostic>) {
  console.info(JSON.stringify({ event: "snapshot-diagnostics", snapshots }));
}

async function doesFileExist(path: string) {
  await access(path, constants.F_OK);
  return true;
}

function formatPodgoricaTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Podgorica",
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second} Europe/Podgorica`;
}

export {
  createFileSnapshotDiagnostic,
  emitSnapshotDiagnostics,
  type FileSnapshotDiagnostic,
  type RelevantTimestampTimeZone,
  type SnapshotFileState,
};
