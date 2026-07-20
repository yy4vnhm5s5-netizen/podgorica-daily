function normalizeRuntimeDataDirectory(directory = ".runtime") {
  const normalized = directory.replace(/\/+$/, "");
  return normalized || ".";
}

function resolveRuntimeCachePath(fileName: string, directory?: string) {
  return `${normalizeRuntimeDataDirectory(directory)}/cache/${fileName}`;
}

export { normalizeRuntimeDataDirectory, resolveRuntimeCachePath };
