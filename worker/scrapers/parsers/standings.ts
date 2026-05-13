import { ParseError } from "../../lib/errors";
import type { ScrapedStandingsRow, Team } from "@shared/schemas";
import {
  decodeEntities,
  normalizeWs,
  slugify,
  stripTags,
} from "./htmlUtils";

/**
 * Locates the standings `<table class="simple-table ...">` whose header row
 * starts with `TEAM` and extracts one row per team in display order (which is
 * the standings rank once the season has games).
 *
 * Stat cells contain literal `-` characters before any games are played; we
 * surface those as `null` so the UI can render an "—" placeholder.
 */

const TABLE_RE =
  /<table[^>]*class="[^"]*simple-table[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;

export function parseScrapedStandings(
  html: string,
  teams: Team[],
): ScrapedStandingsRow[] {
  let tableInner: string | null = null;
  for (const m of html.matchAll(TABLE_RE)) {
    const inner = m[1];
    const tokens = new Set(
      normalizeWs(stripTags(inner.slice(0, 2000)))
        .toUpperCase()
        .split(" "),
    );
    if (
      tokens.has("TEAM") &&
      tokens.has("GP") &&
      tokens.has("W") &&
      tokens.has("L") &&
      tokens.has("PTS")
    ) {
      tableInner = inner;
      break;
    }
  }
  if (!tableInner) {
    throw new ParseError("standings table not found", "standings");
  }

  const rows = [...tableInner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rows.length < 2) {
    throw new ParseError("standings table has no body rows", "standings");
  }

  const out: ScrapedStandingsRow[] = [];
  for (const row of rows.slice(1)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      normalizeWs(decodeEntities(stripTags(c[1]))),
    );
    if (cells.length < 8) continue;
    const [rawName, gp, w, l, otlT, pts, gf, ga] = cells;
    const canonical = canonicalTeamName(rawName, teams);
    out.push({
      team: canonical,
      slug: slugify(canonical),
      gp: toStat(gp),
      w: toStat(w),
      l: toStat(l),
      otlT: toStat(otlT),
      pts: toStat(pts),
      gf: toStat(gf),
      ga: toStat(ga),
    });
  }

  return out;
}

function toStat(s: string): number | null {
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Lowercase letters+digits only — stable for comparing site typos to seeds. */
function normalizeTeamKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map a standings table label onto the seed list. Exact normalized match first;
 * then a tight Levenshtein match so upstream typos (e.g. COUNTRTY) still
 * reconcile to the correct slug.
 */
function canonicalTeamName(raw: string, teams: Team[]): string {
  const norm = normalizeTeamKey(raw);
  for (const t of teams) {
    const tn = normalizeTeamKey(t.name);
    if (tn === norm) return t.name;
  }

  const fuzzy = fuzzyMatchTeam(norm, teams);
  if (fuzzy) return fuzzy.name;
  return raw;
}

/** Max edit distance for fuzzy name match (1 handles common single-char typos). */
const FUZZY_MAX_DIST = 2;
/** Avoid short-name false positives ("A" vs "B"). */
const FUZZY_MIN_KEY_LEN = 8;

function fuzzyMatchTeam(norm: string, teams: Team[]): Team | null {
  if (norm.length < FUZZY_MIN_KEY_LEN) return null;

  let best: Team | null = null;
  let bestD = Infinity;
  let secondD = Infinity;

  for (const t of teams) {
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
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}
