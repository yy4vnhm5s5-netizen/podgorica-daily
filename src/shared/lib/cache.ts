import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type CacheFreshnessStatus = "fresh" | "stale" | "unavailable";

interface CacheFileSystem {
  mkdir(path: string, options: { recursive: true }): Promise<void>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
  writeFile(path: string, contents: string, encoding: "utf8"): Promise<void>;
}

const nodeFileSystem: CacheFileSystem = {
  mkdir: async (path, options) => {
    await mkdir(path, options);
  },
  readFile,
  rename,
  rm,
  writeFile,
};

async function ensureCacheDirectory(
  cachePath: string,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  await fileSystem.mkdir(dirname(cachePath), { recursive: true });
}

function calculateCacheFreshness(
  fetchedAt: Date | undefined,
  now = new Date(),
  maxAgeMinutes = 90,
): CacheFreshnessStatus {
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return "unavailable";
  return now.getTime() - fetchedAt.getTime() <= maxAgeMinutes * 60_000 ? "fresh" : "stale";
}

async function readJsonCache<T>(
  cachePath: string,
  fileSystem: CacheFileSystem = nodeFileSystem,
): Promise<T | null> {
  try {
    return JSON.parse(await fileSystem.readFile(cachePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJsonCache<T>(
  snapshot: T,
  cachePath: string,
  fileSystem: CacheFileSystem = nodeFileSystem,
) {
  const temporaryPath = `${cachePath}.tmp`;
  try {
    await ensureCacheDirectory(cachePath, fileSystem);
    await fileSystem.writeFile(temporaryPath, JSON.stringify(snapshot), "utf8");
    await fileSystem.rename(temporaryPath, cachePath);
  } catch {
    await fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw new Error("Cache could not be updated.");
  }
}

export {
  calculateCacheFreshness,
  ensureCacheDirectory,
  nodeFileSystem,
  readJsonCache,
  writeJsonCache,
  type CacheFileSystem,
  type CacheFreshnessStatus,
};
