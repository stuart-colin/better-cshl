import type { Result, Team } from "@shared/schemas";
import { decodeEntities, normalizeWs, stripTags } from "./htmlUtils";
import { fuzzyMatchTeamNorm, normalizeTeamKey } from "./teamNameMatch";

/**
 * The results "table" is actually a single `<div class="paragraph">` with each
 * game on its own `<br>`-separated line, e.g.
 *
 *   `Labatt Blue 6 Dirty Orrs 4`
 *   `Outlaws 2 Devil Dawgs 2 (T)`
 *
 * Team names contain spaces, so we can't naively split — we match each line
 * against known team names from the seed list, longest first.
 *
 * Fallback: sometimes the uploader shortens a name (`Edgewood` vs
 * `Edgewood Hawks`). We split at the first/second score token and map each
 * name run to the **unique** seed whose full name equals or starts with that
 * run (plus space). If two teams share the same prefix, we skip — no guess.
 *
 * When that still fails, we use the same tight Levenshtein match as the
 * standings table (`Healthy Sratches` → Healthy Scratches).
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
  const direct = parseLineFullPrefix(line, teams);
  if (direct) return direct;
  return parseLineUniquePrefix(line, teams);
}

/** Original strategy: full canonical name at start of line, longest team first. */
function parseLineFullPrefix(line: string, teams: Team[]): Result | null {
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
      return buildResult(t1, t2, score1, score2, tag);
    }

    const awaySplit = splitNameScoreTail(rest2);
    if (awaySplit) {
      const t2f = resolveTeamFromNameWords(
        awaySplit.nameWords,
        teams,
        t1.slug,
      );
      if (t2f) {
        const tagM = awaySplit.tail
          .trim()
          .match(/^\((OT|T|SO|F)\)\s*$/i);
        const tagRaw = tagM?.[1];
        const tag = tagRaw && TAG_RE.test(tagRaw) ? tagRaw.toUpperCase() : null;
        if (awaySplit.tail.trim() !== "" && tag == null) continue;
        return buildResult(t1, t2f, score1, awaySplit.score, tag);
      }
    }
  }
  return null;
}

/**
 * Split `segment` at the first all-digit token = score; everything before is
 * the team name (word run), everything after is `tail` (opponent + rest, or
 * tag-only after second score).
 */
function splitNameScoreTail(segment: string): {
  nameWords: string[];
  score: number;
  tail: string;
} | null {
  const words = normalizeWs(segment).split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (/^\d+$/.test(words[i])) {
      if (i === 0) return null;
      const score = parseInt(words[i], 10);
      const nameWords = words.slice(0, i);
      const tail = words.slice(i + 1).join(" ").trim();
      return { nameWords, score, tail };
    }
  }
  return null;
}

function matchUniquePrefixTeam(
  nameWords: string[],
  teams: Team[],
  excludeSlug?: string,
): Team | null {
  if (nameWords.length === 0) return null;
  const joined = nameWords.join(" ").toLowerCase();
  const matches = teams.filter((t) => {
    if (excludeSlug && t.slug === excludeSlug) return false;
    const n = t.name.toLowerCase();
    return n === joined || n.startsWith(joined + " ");
  });
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}

function resolveTeamFromNameWords(
  nameWords: string[],
  teams: Team[],
  excludeSlug?: string,
): Team | null {
  const strict = matchUniquePrefixTeam(nameWords, teams, excludeSlug);
  if (strict) return strict;
  const joined = nameWords.join(" ").trim();
  if (!joined) return null;
  return fuzzyMatchTeamNorm(normalizeTeamKey(joined), teams, {
    excludeSlug,
  });
}

function parseLineUniquePrefix(line: string, teams: Team[]): Result | null {
  const lineN = normalizeWs(line);
  const first = splitNameScoreTail(lineN);
  if (!first) return null;

  const t1 = resolveTeamFromNameWords(first.nameWords, teams);
  if (!t1) return null;

  const second = splitNameScoreTail(first.tail);
  if (!second) return null;

  const t2 = resolveTeamFromNameWords(second.nameWords, teams, t1.slug);
  if (!t2) return null;

  const tagM = second.tail
    .trim()
    .match(/^\((OT|T|SO|F)\)\s*$/i);
  const tagRaw = tagM?.[1];
  const tag = tagRaw && TAG_RE.test(tagRaw) ? tagRaw.toUpperCase() : null;
  if (second.tail.trim() !== "" && tag == null) return null;

  return buildResult(t1, t2, first.score, second.score, tag);
}

function buildResult(
  t1: Team,
  t2: Team,
  homeScore: number,
  awayScore: number,
  tag: string | null,
): Result {
  return {
    home: t1.name,
    homeSlug: t1.slug,
    homeLogoUrl: t1.logoUrl,
    homeScore,
    away: t2.name,
    awaySlug: t2.slug,
    awayLogoUrl: t2.logoUrl,
    awayScore,
    overtime: tag === "OT" || tag === "SO",
    tie: tag === "T",
  };
}
