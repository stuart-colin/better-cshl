/**
 * Edge cache wrapper around the Cloudflare Cache API.
 *
 * Cache API requires a Request as the key. We synthesize one from an opaque
 * string so callers never have to think about URLs.
 *
 * Hits set `X-Cache: HIT`, misses set `X-Cache: MISS`. The TTL is encoded into
 * the cached response's Cache-Control header (that's what Cloudflare honors).
 */

const CACHE_HOST = "https://cache.better-cshl.internal";

function keyToRequest(cacheKey: string): Request {
  const encoded = encodeURIComponent(cacheKey);
  return new Request(`${CACHE_HOST}/${encoded}`, { method: "GET" });
}

export async function withEdgeCache(
  cacheKey: string,
  ttlSeconds: number,
  produce: () => Promise<Response>,
  ctx: ExecutionContext,
): Promise<Response> {
  const cache = caches.default;
  const req = keyToRequest(cacheKey);

  const hit = await cache.match(req);
  if (hit) {
    const out = new Response(hit.body, hit);
    out.headers.set("X-Cache", "HIT");
    return out;
  }

  const fresh = await produce();

  if (fresh.ok) {
    const toStore = new Response(fresh.clone().body, fresh);
    toStore.headers.set(
      "Cache-Control",
      `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`,
    );
    if (!toStore.headers.has("X-Fetched-At")) {
      toStore.headers.set("X-Fetched-At", new Date().toISOString());
    }
    ctx.waitUntil(cache.put(req, toStore));
  }

  const out = new Response(fresh.body, fresh);
  out.headers.set("X-Cache", "MISS");
  if (!out.headers.has("X-Fetched-At")) {
    out.headers.set("X-Fetched-At", new Date().toISOString());
  }
  return out;
}

/**
 * Convenience: cache a JSON producer. The producer returns a value; the wrapper
 * handles JSON serialization, content-type, and TTL. Failures bypass the cache.
 */
export async function withEdgeCacheJson<T>(
  cacheKey: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
  ctx: ExecutionContext,
): Promise<Response> {
  return withEdgeCache(
    cacheKey,
    ttlSeconds,
    async () => {
      const data = await produce();
      return Response.json(data, {
        headers: {
          "X-Fetched-At": new Date().toISOString(),
        },
      });
    },
    ctx,
  );
}
