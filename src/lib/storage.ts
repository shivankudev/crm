import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

/**
 * Object storage abstraction — §1: "Local disk or S3-compatible (MinIO)".
 * Only the local driver is implemented; STORAGE_DRIVER=s3 (against the
 * optional `docker compose --profile storage` MinIO service) is a future
 * enhancement — swap this module's internals without touching callers,
 * which only deal in storage keys, never filesystem paths.
 *
 * The `turbopackIgnore` comments below tell Next's build tracer not to
 * follow these dynamic `path.*` calls into a full-project file trace —
 * STORAGE_LOCAL_PATH is a deploy-time env var, not something that should
 * pull arbitrary source files into the serverless bundle.
 */

const DRIVER = process.env.STORAGE_DRIVER ?? "local";
const LOCAL_ROOT = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.STORAGE_LOCAL_PATH ?? "./storage"
);

export type StoredFile = { key: string; fileName: string; mimeType: string | null };

function assertLocalDriver() {
  if (DRIVER !== "local") {
    throw new Error(`Storage driver "${DRIVER}" is not implemented yet — only "local" is supported.`);
  }
}

/** Namespaced, unguessable key — e.g. "dealers/<dealerId>/<uuid>-<filename>". */
function buildKey(namespace: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `${namespace}/${randomUUID()}-${safeName}`;
}

export async function saveFile(
  namespace: string,
  fileName: string,
  data: Buffer
): Promise<{ key: string }> {
  assertLocalDriver();
  const key = buildKey(namespace, fileName);
  const fullPath = path.join(/*turbopackIgnore: true*/ LOCAL_ROOT, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
  return { key };
}

export async function readFileByKey(key: string): Promise<Buffer> {
  assertLocalDriver();
  assertKeyIsSafe(key);
  return readFile(path.join(/*turbopackIgnore: true*/ LOCAL_ROOT, key));
}

export async function deleteFileByKey(key: string): Promise<void> {
  assertLocalDriver();
  assertKeyIsSafe(key);
  await unlink(path.join(/*turbopackIgnore: true*/ LOCAL_ROOT, key)).catch(() => undefined);
}

/** Keys are built server-side only, but re-check before touching the filesystem. */
function assertKeyIsSafe(key: string) {
  const resolved = path.resolve(/*turbopackIgnore: true*/ LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
}
