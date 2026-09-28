// Finding and downloading Zen releases, for the scripts that check chrome.css
// against Zen.

import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const ZEN_REPO = "https://github.com/zen-browser/desktop";

/**
 * The newest release among Zen's tags (e.g. "1.22.3b"), ignoring other tags
 * such as "twilight-1".
 *
 * @param {Array<string>} tags
 * @returns {string | undefined}
 */
export function pickLatestRelease(tags) {
  const releases = tags.filter((tag) => /^\d+\.\d+(\.\d+)?[a-z]*$/.test(tag));
  const key = (tag) => tag.match(/\d+/g).map(Number);
  releases.sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      if ((ka[i] ?? 0) !== (kb[i] ?? 0)) return (ka[i] ?? 0) - (kb[i] ?? 0);
    }
    return 0;
  });
  return releases.at(-1);
}

/** @returns {string} the newest Zen release tag */
export function latestZenRelease() {
  const tags = execFileSync(
    "git",
    ["ls-remote", "--tags", "--refs", ZEN_REPO],
    { encoding: "utf8" },
  )
    .split("\n")
    .map((line) => line.split("refs/tags/")[1])
    .filter(Boolean);
  const latest = pickLatestRelease(tags);
  if (!latest) throw new Error("no Zen release tags found");
  return latest;
}

/**
 * Downloads and unpacks Zen's Linux x86-64 build of a release, unless it's
 * already in cacheDir.
 *
 * @param {string} version a release tag, e.g. "1.22.3b"
 * @param {string} cacheDir
 * @returns {Promise<string>} path of the zen executable
 */
export async function downloadZen(version, cacheDir) {
  const dir = join(cacheDir, `zen-${version}`);
  const binary = join(dir, "zen", "zen");
  try {
    await access(binary);
    return binary;
  } catch {
    // Not downloaded yet.
  }
  await mkdir(dir, { recursive: true });
  const archive = join(dir, "zen.tar.xz");
  const url = `${ZEN_REPO}/releases/download/${version}/zen.linux-x86_64.tar.xz`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not download ${url} (HTTP ${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  execFileSync("tar", ["-xJf", archive, "-C", dir]);
  await rm(archive);
  return binary;
}
