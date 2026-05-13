import { RostersSchema, type Player, type Rosters, type TeamRoster } from "@shared/schemas";
import { ParseError } from "../lib/errors";
import { fetchCshl } from "../lib/fetchCshl";
import {
  decodeEntities,
  normalizeWs,
  slugify,
  stripTags,
} from "./parsers/htmlUtils";
import { DIVISIONS } from "./division";

const DIVISION_HEADER_RE =
  /<font[^>]*size="6"[^>]*>\s*([A-Z][A-Z\s]+DIVISION(?:\s+[IV]+)?)/gi;

const PARAGRAPH_RE =
  /<div[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

const DIVISION_NAME_TO_SLUG = new Map<string, { slug: string; name: string }>(
  DIVISIONS.map((d) => [d.name.toUpperCase(), { slug: d.slug, name: d.name }]),
);

export async function scrapeRosters(): Promise<Rosters> {
  const { html, fetchedAt } = await fetchCshl("/rosters.html");

  const sections = splitByDivision(html);
  if (sections.length === 0) {
    throw new ParseError("no division headers found", "rosters");
  }

  const teams: TeamRoster[] = [];
  const seenSlugs = new Set<string>();
  for (const section of sections) {
    const meta = DIVISION_NAME_TO_SLUG.get(section.divisionUpper) ?? null;
    for (const paragraphHtml of section.paragraphs) {
      const team = parseTeamFromParagraph(paragraphHtml, meta);
      if (!team) continue;
      let slug = team.slug;
      let suffix = 2;
      while (seenSlugs.has(slug)) {
        slug = `${team.slug}-${suffix++}`;
      }
      seenSlugs.add(slug);
      teams.push({ ...team, slug });
    }
  }

  if (teams.length === 0) {
    throw new ParseError("no team paragraphs parsed", "rosters");
  }

  return RostersSchema.parse({ fetchedAt, teams });
}

interface DivisionSection {
  divisionUpper: string;
  paragraphs: string[];
}

function splitByDivision(html: string): DivisionSection[] {
  const headers = [...html.matchAll(DIVISION_HEADER_RE)].map((m) => ({
    name: normalizeWs(m[1]).toUpperCase(),
    start: m.index ?? 0,
  }));
  if (headers.length === 0) return [];

  const sections: DivisionSection[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].start;
    const end = i + 1 < headers.length ? headers[i + 1].start : html.length;
    const slice = html.slice(start, end);
    const paragraphs: string[] = [];
    for (const p of slice.matchAll(PARAGRAPH_RE)) {
      paragraphs.push(p[1]);
    }
    sections.push({
      divisionUpper: headers[i].name,
      paragraphs,
    });
  }
  return sections;
}

function parseTeamFromParagraph(
  paragraphHtml: string,
  divisionMeta: { slug: string; name: string } | null,
): TeamRoster | null {
  const withBreaks = paragraphHtml.replace(/<br\s*\/?>/gi, "\n");
  const text = decodeEntities(stripTags(withBreaks));
  const lines = text
    .split(/\r?\n/)
    .map((l) => normalizeWs(l))
    .filter(Boolean);

  if (lines.length < 2) return null;

  const teamName = sanitizeTeamName(lines[0]);
  if (!isPlausibleTeamName(teamName)) return null;

  const players: Player[] = [];
  for (let i = 1; i < lines.length; i++) {
    const p = parsePlayerLine(lines[i]);
    if (p) players.push(p);
  }
  if (players.length === 0) return null;

  return {
    slug: slugify(teamName),
    name: teamName,
    divisionSlug: divisionMeta?.slug ?? null,
    divisionName: divisionMeta?.name ?? null,
    logoUrl: null,
    players,
  };
}

function sanitizeTeamName(s: string): string {
  return normalizeWs(s.replace(/[©(G)\d-]+$/g, "")) || s;
}

function isPlausibleTeamName(s: string): boolean {
  if (!s || s.length > 60) return false;
  if (/^\d/.test(s)) return false;
  if (/division/i.test(s)) return false;
  if (s.toLowerCase().startsWith("rosters")) return false;
  return /[a-zA-Z]/.test(s);
}

const NUMBER_TOKEN_RE = /^([-XxXxx\d/]+|XX{1,3})$/;

function parsePlayerLine(line: string): Player | null {
  const original = line;
  let s = normalizeWs(line);
  if (!s) return null;

  const isCaptain = /©/.test(s);
  const isGoalie = /\(G\)/i.test(s);
  s = s.replace(/©/g, "").replace(/\(G\)/gi, "");
  s = normalizeWs(s);
  if (!s) return null;

  const spaceIdx = s.indexOf(" ");
  if (spaceIdx > 0) {
    const number = s.slice(0, spaceIdx);
    const name = normalizeWs(s.slice(spaceIdx + 1));
    if (isPlausibleNumber(number) && isPlausibleName(name)) {
      return {
        number: number === "-" ? "" : number,
        name,
        isCaptain,
        isGoalie,
      };
    }
  }

  // Fallback: rosterer forgot the number (common for late-add goalies).
  // Only accept lines that explicitly carry a (G) tag so we don't pick up
  // stray paragraph text as a player.
  if (/\(G\)/i.test(original) && isPlausibleName(s)) {
    return { number: "", name: s, isCaptain, isGoalie };
  }

  return null;
}

function isPlausibleNumber(token: string): boolean {
  if (!token) return false;
  if (token.length > 5) return false;
  if (NUMBER_TOKEN_RE.test(token)) return true;
  if (/^[\d/]+$/.test(token)) return true;
  if (/^[Xx]+$/.test(token)) return true;
  return false;
}

function isPlausibleName(name: string): boolean {
  if (name.length < 2 || name.length > 60) return false;
  if (!/[a-zA-Z]/.test(name)) return false;
  return true;
}
