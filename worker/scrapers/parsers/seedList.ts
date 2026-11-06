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
 * Numbers can have gaps when a team is removed mid-season (e.g. `(3) RI Chiefs
 * (5) Scotti's Salumeria`). Each remaining team keeps its original number so
 * schedule rows like `5 v 6` still resolve correctly.
 *
 * We narrow the search to the `<div class="paragraph">` with the most seed
 * markers so trailing page content (e.g. "CENTRAL DIVISION TEAM GP W L ...")
 * can't bleed into the last team's capture.
 */

const PARAGRAPH_RE =
  /<div[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

/**
 * A seed marker is `(n)` not preceded by a digit — schedule week headers like
 * `1 (3)` or `2 (1)` must not count.
 */
const SEED_MARKER_RE = /(^|[^\d\s])\s*\((\d{1,2})\)/g;

// "End of name" stop words — page headings that may appear immediately after
// the seed list when it isn't wrapped in its own paragraph.
const STOP_WORDS = [
  "DIVISION",
  "SCHEDULE",
  "RESULTS",
  "TEAM ",
  "ROSTERS",
];

const MIN_TEAMS = 4;

interface SeedMarker {
  number: number;
  start: number;
  end: number;
}

export function parseSeedList(html: string): Team[] {
  const scope = findSeedScope(html) ?? html;
  const text = normalizeWs(decodeEntities(stripTags(scope)));
  const markers = findSeedMarkers(text);

  if (markers.length < MIN_TEAMS) {
    throw new ParseError(
      `only ${markers.length} seed markers found`,
      "seedList",
      text.slice(0, 400),
    );
  }

  const teams: Team[] = markers.map((marker, i) => {
    const next = markers[i + 1];
    const end = next ? next.start : findNameEnd(text, marker.end);
    const name = normalizeWs(text.slice(marker.end, end));
    if (!name) {
      throw new ParseError(
        `empty name for (${marker.number})`,
        "seedList",
        text,
      );
    }
    return {
      number: marker.number,
      name,
      slug: slugify(name),
      logoUrl: null,
    };
  });

  return teams;
}

/** Strictly increasing `(n)` markers starting at `(1)`; tolerates gaps. */
function findSeedMarkers(text: string): SeedMarker[] {
  const out: SeedMarker[] = [];
  for (const m of text.matchAll(SEED_MARKER_RE)) {
    const number = parseInt(m[2], 10);
    const last = out[out.length - 1];
    if (!last ? number !== 1 : number <= last.number) continue;
    const start = m.index + m[0].indexOf("(");
    out.push({ number, start, end: m.index + m[0].length });
  }
  return out;
}

function findSeedScope(html: string): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const m of html.matchAll(PARAGRAPH_RE)) {
    const inner = m[1];
    const text = normalizeWs(decodeEntities(stripTags(inner)));
    const count = findSeedMarkers(text).length;
    if (count >= MIN_TEAMS && count > bestCount) {
      best = inner;
      bestCount = count;
    }
  }
  return best;
}

function findNameEnd(text: string, after: number): number {
  let best = Math.min(text.length, after + 80);
  for (const sw of STOP_WORDS) {
    const i = text.indexOf(sw, after);
    if (i > after && i < best) best = i;
  }
  return best;
}
