import type { Game, Team } from "@shared/schemas";
import { tokenizeBlock } from "./htmlUtils";

/**
 * Parses the SCHEDULE section of a division page.
 *
 * Layout per week:
 *   <week number>
 *   [<date> <home> v <away> <time>] x N
 *
 * "Off" weeks look like `OFF` followed by `1 v 7` (no time).
 *
 * Times have no colon: 900 -> 9:00, 1010 -> 10:10. All games are evenings.
 */

const SCHEDULE_BLOCK_RE =
  /SCHEDULE[\s\S]*?<table[^>]*wsite-multicol-table[\s\S]*?<\/table>/i;
const PARAGRAPH_RE =
  /<div[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

const WEEK_RE =
  /^(\d{1,2})(?:\s+\(\d{1,2}\))?(?:\s+(NEW|PPD|TBD|UPDATED))?$/i;
const DATE_RE =
  /^(Sun|Mon|Tue|Wed|Thur|Thu|Fri|Sat)\.?\s+([A-Z][a-z]{2,3})\.?\s+(\d{1,2})$/;
const MATCHUP_RE = /^(\d{1,2})\s+v\s+(\d{1,2})(?:\s+(\d{3,4}))?$/;
const OFF_RE = /^(OFF|PPD)$/i;

export function parseSchedule(html: string, teams: Team[]): Game[] {
  const block = html.match(SCHEDULE_BLOCK_RE);
  if (!block) return [];
  const blockHtml = block[0];
  const byNumber = new Map(teams.map((t) => [t.number, t]));

  const games: Game[] = [];

  for (const para of blockHtml.matchAll(PARAGRAPH_RE)) {
    const tokens = tokenizeBlock(para[1]);
    let week = 0;
    let weekLabel: string | null = null;
    let pendingDate: string | null = null;
    let pendingColor: string | null = null;
    let off = false;
    let ppd = false;

    for (const tok of tokens) {
      const t = tok.text;

      const mu = t.match(MATCHUP_RE);
      if (mu && week > 0) {
        const homeNumber = parseInt(mu[1], 10);
        const awayNumber = parseInt(mu[2], 10);
        const time = mu[3] ? formatTime(mu[3]) : null;
        const home = byNumber.get(homeNumber);
        const away = byNumber.get(awayNumber);
        if (!home || !away) continue;
        games.push({
          week,
          weekLabel,
          homeNumber,
          awayNumber,
          home: home.name,
          homeSlug: home.slug,
          homeLogoUrl: home.logoUrl,
          away: away.name,
          awaySlug: away.slug,
          awayLogoUrl: away.logoUrl,
          date: pendingDate,
          time,
          rinkColor: pendingColor ?? tok.color,
          off,
          ppd,
        });
        off = false;
        ppd = false;
        continue;
      }

      if (OFF_RE.test(t)) {
        const upper = t.toUpperCase();
        off = upper === "OFF";
        ppd = upper === "PPD";
        pendingDate = null;
        pendingColor = tok.color;
        continue;
      }

      if (DATE_RE.test(t)) {
        pendingDate = t;
        pendingColor = tok.color;
        continue;
      }

      const wm = t.match(WEEK_RE);
      if (wm && wm[1].length <= 2 && parseInt(wm[1], 10) <= 30) {
        week = parseInt(wm[1], 10);
        weekLabel = wm[2] ? wm[2].toUpperCase() : null;
        pendingDate = null;
        pendingColor = null;
        off = false;
        ppd = false;
        continue;
      }
    }
  }

  games.sort((a, b) => a.week - b.week);
  return games;
}

function formatTime(raw: string): string {
  if (raw.length === 3) return `${raw[0]}:${raw.slice(1)}`;
  return `${raw.slice(0, 2)}:${raw.slice(2)}`;
}
