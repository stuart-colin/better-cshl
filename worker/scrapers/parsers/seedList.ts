import { ParseError } from "../../lib/errors";
import type { Team } from "@shared/schemas";
import { decodeEntities, normalizeWs, slugify, stripTags } from "./htmlUtils";

/**
 * Pulls the `(1) Team A (2) Team B ... (8) Team H` line from a division page.
 *
 * The list is the schedule's source of truth: every matchup row references
 * team numbers 1-8, and the standings table writes names in uppercase, so we
 * use this to look up the canonical mixed-case display name.
 *
 * We narrow the search to the `<div class="paragraph">` that contains the
 * sequence `(1)` ... `(8)` so trailing page content (e.g. "CENTRAL DIVISION
 * TEAM GP W L ...") can't bleed into the team-8 capture.
 */

const PARAGRAPH_RE =
  /<div[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

// "End of name" stop words — page headings that may appear immediately after
// the seed list when it isn't wrapped in its own paragraph.
const STOP_WORDS = [
  "DIVISION",
  "SCHEDULE",
  "RESULTS",
  "TEAM ",
  "ROSTERS",
];

const MAX_TEAMS = 12;
const MIN_TEAMS = 4;

export function parseSeedList(html: string): Team[] {
  const scope = findSeedScope(html) ?? html;
  const text = normalizeWs(decodeEntities(stripTags(scope)));

  const teams: Team[] = [];
  for (let n = 1; n <= MAX_TEAMS; n++) {
    const marker = `(${n})`;
    const idx = text.indexOf(marker);
    if (idx < 0) {
      if (teams.length >= MIN_TEAMS) break;
      throw new ParseError(
        `seed marker ${marker} not found (only ${teams.length} teams)`,
        "seedList",
        text.slice(0, 400),
      );
    }
    const after = idx + marker.length;
    const nextMarker = `(${n + 1})`;
    let end = text.indexOf(nextMarker, after);
    if (end < 0) end = findNameEnd(text, after);

    const name = normalizeWs(text.slice(after, end));
    if (!name) {
      throw new ParseError(`empty name for ${marker}`, "seedList", text);
    }
    teams.push({ number: n, name, slug: slugify(name), logoUrl: null });
  }

  const numbers = new Set(teams.map((t) => t.number));
  if (numbers.size !== teams.length) {
    throw new ParseError("duplicate team numbers", "seedList", text);
  }
  return teams.sort((a, b) => a.number - b.number);
}

function findSeedScope(html: string): string | null {
  for (const m of html.matchAll(PARAGRAPH_RE)) {
    const inner = m[1];
    const text = normalizeWs(decodeEntities(stripTags(inner)));
    if (
      text.includes("(1)") &&
      text.includes("(2)") &&
      text.includes("(3)") &&
      text.includes("(4)")
    ) {
      return inner;
    }
  }
  return null;
}

function findNameEnd(text: string, after: number): number {
  let best = Math.min(text.length, after + 80);
  for (const sw of STOP_WORDS) {
    const i = text.indexOf(sw, after);
    if (i > after && i < best) best = i;
  }
  return best;
}
