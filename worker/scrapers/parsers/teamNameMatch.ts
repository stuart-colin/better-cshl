import type { Team } from "@shared/schemas";

/** Lowercase letters+digits only — stable for comparing site typos to seeds. */
export function normalizeTeamKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Max edit distance for fuzzy name match (single-char typos, small slips). */
const FUZZY_MAX_DIST = 2;
/** Avoid short-name false positives ("A" vs "B"). */
const FUZZY_MIN_KEY_LEN = 8;

/**
 * Pick the single seed team whose normalized name is closest in Levenshtein
 * distance to `norm`, when that distance is ≤ FUZZY_MAX_DIST and strictly
 * better than the second-best (no tie).
 */
export function fuzzyMatchTeamNorm(
  norm: string,
  teams: Team[],
  opts?: { excludeSlug?: string },
): Team | null {
  if (norm.length < FUZZY_MIN_KEY_LEN) return null;

  let best: Team | null = null;
  let bestD = Infinity;
  let secondD = Infinity;

  for (const t of teams) {
    if (opts?.excludeSlug && t.slug === opts.excludeSlug) continue;
    const tn = normalizeTeamKey(t.name);
    if (tn.length < FUZZY_MIN_KEY_LEN) continue;
    const d = levenshtein(norm, tn);
    if (d < bestD) {
      secondD = bestD;
      bestD = d;
      best = t;
    } else if (d < secondD) {
      secondD = d;
    }
  }

  if (!best || bestD > FUZZY_MAX_DIST) return null;
  if (secondD !== Infinity && secondD <= bestD) return null;
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}
