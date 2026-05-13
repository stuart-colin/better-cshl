/**
 * Fetches HTML pages from thecshl.com.
 *
 * - Realistic UA so we look like a normal browser to the Weebly host.
 * - Bounded retries with exponential backoff for transient upstream errors.
 * - Throws UpstreamError on permanent failure so routes can return a clean 502.
 */

const BASE_URL = "https://www.thecshl.com";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 better-cshl/0.1";

export class UpstreamError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.url = url;
  }
}

export interface FetchCshlResult {
  html: string;
  url: string;
  fetchedAt: string;
}

interface FetchCshlOptions {
  attempts?: number;
  timeoutMs?: number;
}

export async function fetchCshl(
  path: string,
  options: FetchCshlOptions = {},
): Promise<FetchCshlResult> {
  const { attempts = 3, timeoutMs = 10_000 } = options;
  const url = path.startsWith("http") ? path : new URL(path, BASE_URL).toString();

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status >= 500 && attempt < attempts) {
          lastErr = new UpstreamError(`HTTP ${res.status}`, res.status, url);
        } else {
          throw new UpstreamError(`HTTP ${res.status}`, res.status, url);
        }
      } else {
        const html = await res.text();
        return {
          html,
          url,
          fetchedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      lastErr = err;
      if (err instanceof UpstreamError && err.status < 500) throw err;
    } finally {
      clearTimeout(timer);
    }
    const backoff = 200 * 2 ** (attempt - 1);
    await new Promise((r) => setTimeout(r, backoff));
  }

  if (lastErr instanceof Error) throw lastErr;
  throw new UpstreamError("Unknown upstream failure", 0, url);
}
