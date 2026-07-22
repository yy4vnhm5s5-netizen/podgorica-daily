import { existsSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceDirectory = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const pathname = fileURLToPath(new URL(specifier.slice(2), sourceDirectory));
    const resolvedPath = extname(pathname)
      ? pathname
      : ([".ts", ".tsx", ".js", ".jsx"]
          .map((extension) => `${pathname}${extension}`)
          .find(existsSync) ?? pathname);
    return nextResolve(pathToFileURL(resolvedPath).href, context);
  }

  return nextResolve(specifier, context);
}
