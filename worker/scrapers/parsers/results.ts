import type { Result, Team } from "@shared/schemas";
import { decodeEntities, normalizeWs, stripTags } from "./htmlUtils";

/**
 * The results "table" is actually a single `<div class="paragraph">` with each
 * game on its own `<br>`-separated line, e.g.
 *
 *   `Labatt Blue 6 Dirty Orrs 4`
 *   `Outlaws 2 Devil Dawgs 2 (T)`
 *
 * Team names contain spaces, so we can't naively split — we match each line
 * against known team names from the seed list, longest first.
 */

const RESULTS_RE = /RESULTS[\s\S]*?<div[^>]*paragraph[^>]*>([\s\S]*?)<\/div>/i;
const TAG_RE = /^(OT|T|SO|F)$/i;

export function parseResults(html: string, teams: Team[]): Result[] {
  const m = html.match(RESULTS_RE);
  if (!m) return [];

  const blob = m[1].replace(/<br\s*\/?>/gi, "\n");
  const text = decodeEntities(stripTags(blob));
  const lines = text
    .split(/\r?\n/)
    .map((l) => normalizeWs(l))
    .filter(Boolean);

  const sorted = [...teams].sort((a, b) => b.name.length - a.name.length);
  const out: Result[] = [];
  for (const line of lines) {
    const r = parseLine(line, sorted);
    if (r) out.push(r);
  }
  return out;
}

function parseLine(line: string, teams: Team[]): Result | null {
  const lower = line.toLowerCase();
  for (const t1 of teams) {
    const t1Lower = t1.name.toLowerCase();
    if (!lower.startsWith(t1Lower + " ")) continue;
    const rest1 = line.slice(t1.name.length).trim();
    const scoreMatch = rest1.match(/^(\d+)\s+(.+)$/);
    if (!scoreMatch) continue;
    const score1 = parseInt(scoreMatch[1], 10);
    const rest2 = scoreMatch[2];
    const rest2Lower = rest2.toLowerCase();

    for (const t2 of teams) {
      if (t2.slug === t1.slug) continue;
      const t2Lower = t2.name.toLowerCase();
      const exact = rest2Lower === t2Lower;
      const prefix = rest2Lower.startsWith(t2Lower + " ");
      if (!exact && !prefix) continue;
      const after = rest2.slice(t2.name.length).trim();
      const finalMatch = after.match(/^(\d+)\s*(?:\((OT|T|SO|F)\))?\s*$/i);
      if (!finalMatch) continue;
      const score2 = parseInt(finalMatch[1], 10);
      const tagRaw = finalMatch[2];
      const tag = tagRaw && TAG_RE.test(tagRaw) ? tagRaw.toUpperCase() : null;
      return {
        home: t1.name,
        homeSlug: t1.slug,
        homeLogoUrl: t1.logoUrl,
        homeScore: score1,
        away: t2.name,
        awaySlug: t2.slug,
        awayLogoUrl: t2.logoUrl,
        awayScore: score2,
        overtime: tag === "OT" || tag === "SO",
        tie: tag === "T",
      };
    }
  }
  return null;
}
