import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseCsv } from "@/lib/csv";

/**
 * Reads rows out of a Google Sheet, by whichever route the admin configured
 * for that sheet.
 *
 * No googleapis dependency: the whole of what we need is one signed JWT
 * exchanged for an access token, then a single GET. Pulling in the full
 * client library for that would add tens of megabytes to an image that has
 * to build and run on an office mini PC.
 */

export class GoogleSheetsError extends Error {}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const REQUEST_TIMEOUT_MS = 30_000;

type ServiceAccountKey = { client_email: string; private_key: string };

let cachedKey: ServiceAccountKey | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * The service-account JSON, from an env var or a mounted file.
 *
 * Deliberately not cached on failure — a missing key is usually a
 * half-finished setup, and the admin fixing it should not have to restart
 * the container for the next attempt to see it.
 */
function loadServiceAccountKey(): ServiceAccountKey {
  if (cachedKey) return cachedKey;

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  let raw: string | undefined = inline;

  if (!raw && path) {
    try {
      raw = readFileSync(/*turbopackIgnore: true*/ path, "utf8");
    } catch {
      throw new GoogleSheetsError(`Could not read the Google service account key at ${path}`);
    }
  }
  if (!raw) {
    throw new GoogleSheetsError(
      "No Google service account configured — set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_FILE, or use a published CSV link instead."
    );
  }

  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GoogleSheetsError("The Google service account key is not valid JSON.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new GoogleSheetsError("The service account key is missing client_email or private_key.");
  }
  // Keys pasted into an env var arrive with literal \n instead of newlines.
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");

  cachedKey = parsed;
  return parsed;
}

/** The service account's email — shown in the UI so the admin knows who to share the sheet with. */
export function getServiceAccountEmail(): string | null {
  try {
    return loadServiceAccountKey().client_email;
  } catch {
    return null;
  }
}

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function getAccessToken(): Promise<string> {
  // Reused until a minute before expiry rather than minted per request — a
  // poll over several sheets would otherwise cost one token exchange each.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const key = loadServiceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  let signature: string;
  try {
    signature = b64url(signer.sign(key.private_key));
  } catch {
    throw new GoogleSheetsError("Could not sign with the service account private key — is the key complete?");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GoogleSheetsError(`Google rejected the service account sign-in (${res.status}). ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new GoogleSheetsError("Google returned no access token.");

  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

/** Rows as a grid of strings, header included, exactly as the sheet has them. */
export type SheetGrid = string[][];

async function readViaServiceAccount(spreadsheetId: string, sheetName?: string | null): Promise<SheetGrid> {
  const token = await getAccessToken();
  // An unqualified range means "the whole of the first tab", which is what
  // an admin who left the tab name blank means.
  const range = encodeURIComponent(sheetName ? `${sheetName}` : "A:Z");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?majorDimension=ROWS`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 403) {
    throw new GoogleSheetsError(
      `The service account can't open that sheet. Share it with ${getServiceAccountEmail() ?? "the service account"} as a Viewer.`
    );
  }
  if (res.status === 404) throw new GoogleSheetsError("No sheet with that ID — check the link you pasted.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GoogleSheetsError(`Google Sheets returned ${res.status}. ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

async function readViaPublishedCsv(csvUrl: string): Promise<SheetGrid> {
  const res = await fetch(csvUrl, { redirect: "follow", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    throw new GoogleSheetsError(
      `That published link returned ${res.status}. Re-publish the sheet (File → Share → Publish to web → CSV).`
    );
  }
  const text = await res.text();
  // A sheet that was un-published serves the Google sign-in page, which is
  // HTML — without this the admin would see "0 rows" and no reason why.
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new GoogleSheetsError("That link returned a web page, not CSV — the sheet is probably no longer published.");
  }
  return parseCsv(text);
}

export function fetchSheetGrid(config: {
  accessMode: string;
  spreadsheetId?: string | null;
  sheetName?: string | null;
  csvUrl?: string | null;
}): Promise<SheetGrid> {
  if (config.accessMode === "PUBLISHED_CSV") {
    if (!config.csvUrl) throw new GoogleSheetsError("No published CSV link is set for this sheet.");
    return readViaPublishedCsv(config.csvUrl);
  }
  if (!config.spreadsheetId) throw new GoogleSheetsError("No spreadsheet ID is set for this sheet.");
  return readViaServiceAccount(config.spreadsheetId, config.sheetName);
}

/**
 * Pulls the spreadsheet id out of whatever the admin pasted — the full
 * browser URL is what they actually have, not the bare id.
 */
export function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return (match ? match[1] : input).trim();
}
