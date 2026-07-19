function normalizeRuntimeDataDirectory(directory = process.env.RUNTIME_DATA_DIR ?? ".runtime") {
  const normalized = directory.replace(/\/+$/, "");
  return normalized || ".";
}

function resolveRuntimeCachePath(fileName: string, directory?: string) {
  return `${normalizeRuntimeDataDirectory(directory)}/cache/${fileName}`;
}

export { normalizeRuntimeDataDirectory, resolveRuntimeCachePath };
