/**
 * The caller's real IP address, or undefined when it cannot be trusted.
 *
 * `X-Forwarded-For` is written by whoever sends the request, so it is not
 * evidence of anything on its own. A reverse proxy *appends* the address it
 * actually accepted the connection from, which means the rightmost entry is
 * the only one our own infrastructure vouches for; everything to its left was
 * supplied by the client and may be invented.
 *
 * This matters because the value keys the per-IP login limit. Taking the
 * header verbatim let an attacker send a different X-Forwarded-For on every
 * request, land in a fresh counter each time, and never trip the limit at
 * all — while still being counted, correctly, against the per-email one.
 *
 * Off unless TRUST_PROXY is set, because the header is only meaningful when
 * something we control is guaranteed to have rewritten it. On the office LAN
 * nothing sits in front of the app, no header arrives, and there is nothing
 * to read — which is exactly the behaviour this preserves.
 */
export function clientIp(headers: Headers): string | undefined {
  if (process.env.TRUST_PROXY !== "true") return undefined;

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return undefined;

  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  // Exactly one trusted proxy (Caddy) is assumed — see docker-compose.cloud.yml.
  // Behind two, this would need to skip one more from the right.
  return hops.at(-1);
}
