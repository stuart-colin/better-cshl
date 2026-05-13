/**
 * Extracts the row of team logos at the top of a division page.
 *
 * The CSHL site lays each team's logo out in a `<div class="wsite-image">`
 * wrapper containing a single `<img src="...">`. The first N such images on
 * the page correspond, in order, to the seed list. We deliberately filter
 * out the league logo image so it doesn't bleed into the team list.
 *
 * Weebly serves three flavors of every uploaded image:
 *   - `/editor/{stem}_N.png`     ~5-25KB  (downscaled thumbnail)
 *   - `/published/{stem}_N.png`  ~5-25KB  (downscaled thumbnail)
 *   - `/{stem}_orig.png`        full res (the original upload)
 *
 * We always rewrite to the `_orig` form so the UI renders crisp logos on
 * retina displays (and the underlying PNGs keep their alpha channel intact).
 */

const WSITE_IMG_RE =
  /<div[^>]*class="[^"]*wsite-image[^"]*"[^>]*>[\s\S]*?<img[^>]*\ssrc="([^"]+)"/gi;

const LEAGUE_LOGO_HINT = /cshl[-_]?(?:white|logo)/i;
const BASE = "https://www.thecshl.com";

export function parseTeamLogos(html: string, teamCount: number): Array<string | null> {
  const out: Array<string | null> = [];
  for (const m of html.matchAll(WSITE_IMG_RE)) {
    const src = m[1];
    if (!src) continue;
    if (LEAGUE_LOGO_HINT.test(src)) continue;
    out.push(toOriginal(absolutize(src)));
    if (out.length >= teamCount) break;
  }
  while (out.length < teamCount) out.push(null);
  return out;
}

function absolutize(src: string): string {
  if (/^https?:/i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `${BASE}${src}`;
  return `${BASE}/${src}`;
}

/**
 * Rewrite a Weebly thumbnail URL to its `_orig` source. Idempotent — URLs
 * that are already `_orig` or don't match a known thumbnail pattern are
 * returned unchanged.
 */
export function toOriginal(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.search = "";
  let path = u.pathname;
  path = path.replace(/\/(?:editor|published)\//, "/");
  const file = path.slice(path.lastIndexOf("/") + 1);
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  if (/_orig\.[a-z]+$/i.test(file)) {
    u.pathname = dir + file;
    return u.toString();
  }
  const m = file.match(/^(.+?)(?:_\d+)?\.([a-z]+)$/i);
  if (!m) return url;
  u.pathname = `${dir}${m[1]}_orig.${m[2]}`;
  return u.toString();
}
