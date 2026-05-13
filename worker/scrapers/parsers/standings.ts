import { ParseError } from "../../lib/errors";
import type { ScrapedStandingsRow, Team } from "@shared/schemas";
import {
  decodeEntities,
  normalizeWs,
  slugify,
  stripTags,
} from "./htmlUtils";
import { fuzzyMatchTeamNorm, normalizeTeamKey } from "./teamNameMatch";

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

  const fuzzy = fuzzyMatchTeamNorm(norm, teams);
  if (fuzzy) return fuzzy.name;
  return raw;
}
