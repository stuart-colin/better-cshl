import { Link } from "@tanstack/react-router";
import type { Game, Result } from "@shared/types";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Badge } from "./ui/badge";
import { TeamLogo } from "./TeamLogo";
import { goalNumberClass } from "@/lib/gameScoreAccent";
import { cn } from "@/lib/utils";

interface Props {
  games: Game[];
  /** When set, each schedule row is paired with a result by team matchup (first unused wins). */
  results?: Result[];
}

interface RinkInfo {
  short: string;
  full: string;
  className: string;
}

const CRANSTON: RinkInfo = {
  short: "Cranston Vets",
  full: "Cranston Veterans Memorial Ice Rink",
  className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
};

const RINK_BY_COLOR: Record<string, RinkInfo> = {
  "#da8044": {
    short: "Benny Magiera",
    full: "Benny Magiera Memorial Ice Rink",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  },
  "#4caac9": {
    short: "Warburton",
    full: "Warburton Arena",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  },
  "#3a96b8": {
    short: "Warburton",
    full: "Warburton Arena",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  },
  "#dab844": {
    short: "Thayer",
    full: "Thayer Arena",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  },
  "#da4444": {
    short: "Off",
    full: "Make-up game (rescheduled)",
    className: "border-red-500/40 bg-red-500/10 text-red-200",
  },
};

function lookupRink(color: string | null): RinkInfo | null {
  if (!color) return CRANSTON;
  const lower = color.toLowerCase();
  if (
    lower === "rgb(255, 255, 255)" ||
    lower === "rgb(255,255,255)" ||
    lower === "#ffffff" ||
    lower === "#fff"
  ) {
    return CRANSTON;
  }
  const mapped =
    RINK_BY_COLOR[lower] ?? RINK_BY_COLOR[rgbToHex(color)] ?? null;
  if (mapped) return mapped;

  // Schedulers often pick a slightly off white/grey for Cranston Vets (#ecf2f4, etc.)
  // instead of plain white or no color — treat light neutrals as Cranston, not unknown.
  const rgb = parseColorToRgb(color);
  if (rgb && isMutedCranstonScheduleColor(rgb)) return CRANSTON;

  return null;
}

function rgbToHex(c: string): string {
  const rgb = parseColorToRgb(c);
  if (!rgb) return c.toLowerCase();
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function parseColorToRgb(color: string): [number, number, number] | null {
  const trimmed = color.trim();
  const rgbM = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbM) {
    return [
      parseInt(rgbM[1], 10),
      parseInt(rgbM[2], 10),
      parseInt(rgbM[3], 10),
    ];
  }
  let hex = trimmed.toLowerCase();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/.test(hex)) return null;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** Very light, low-saturation colors used on the site for Cranston Vets rows. */
function isMutedCranstonScheduleColor([r, g, b]: [number, number, number]): boolean {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const avg = (r + g + b) / 3;
  return min >= 175 && avg >= 215 && max - min <= 48;
}

const SCHEDULE_DATE_RE =
  /^(?:Sun|Mon|Tue|Wed|Thur|Thu|Fri|Sat)\.?\s+([A-Za-z]{3,4})\.?\s+(\d{1,2})$/;

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function ScheduleList({ games, results }: Props) {
  const { byWeek, leftoverResults } = useMemo(
    () => buildWeeksWithResults(games, results),
    [games, results],
  );

  const currentWeek = useMemo(
    () => findCurrentWeekNumber(byWeek),
    [byWeek],
  );
  const scrollAnchorWeek = useMemo(
    () => findScrollAnchorWeek(byWeek, currentWeek),
    [byWeek, currentWeek],
  );
  const didScroll = useRef(false);

  useLayoutEffect(() => {
    if (didScroll.current || scrollAnchorWeek == null) return;
    const el = document.getElementById(`schedule-week-${scrollAnchorWeek}`);
    if (!el) return;
    didScroll.current = true;
    el.scrollIntoView({ block: "start" });
  }, [scrollAnchorWeek, byWeek]);

  if (games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No schedule published yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {byWeek.map(([week, rows]) => (
        <section
          key={week}
          id={`schedule-week-${week}`}
          className="scroll-mt-20 space-y-3"
        >
          {currentWeek != null && week === currentWeek && <ScheduleNowDivider />}
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
              Week {week}
            </h3>
            {rows[0]?.game.weekLabel && (
              <Badge variant="outline" className="text-[10px]">
                {rows[0].game.weekLabel}
              </Badge>
            )}
          </div>
          <ul className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
            {rows.map((row, i) => (
              <GameRow key={`${week}-${i}`} row={row} />
            ))}
          </ul>
        </section>
      ))}

      {results && leftoverResults.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Other results
          </h3>
          <p className="text-xs text-muted-foreground">
            These games could not be matched to a schedule line (e.g. make-ups
            or numbering changes).
          </p>
          <ul className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
            {leftoverResults.map((r, i) => (
              <UnmatchedResultRow key={i} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type ScheduleRow = {
  game: Game;
  display: {
    homeScore: number;
    awayScore: number;
    overtime: boolean;
    tie: boolean;
  } | null;
};

function buildWeeksWithResults(
  games: Game[],
  results: Result[] | undefined,
): {
  byWeek: [number, ScheduleRow[]][];
  leftoverResults: Result[];
} {
  const map = new Map<number, ScheduleRow[]>();
  const pool =
    results?.map((r) => ({ r, used: false })) ?? [];

  for (const g of games) {
    let display: ScheduleRow["display"] = null;
    if (results && !g.off && !g.ppd) {
      const idx = pool.findIndex(
        (p) =>
          !p.used &&
          ((p.r.homeSlug === g.homeSlug && p.r.awaySlug === g.awaySlug) ||
            (p.r.homeSlug === g.awaySlug && p.r.awaySlug === g.homeSlug)),
      );
      if (idx !== -1) {
        pool[idx].used = true;
        display = toSchedulePerspective(g, pool[idx].r);
      }
    }

    const row: ScheduleRow = { game: g, display };
    const arr = map.get(g.week) ?? [];
    arr.push(row);
    map.set(g.week, arr);
  }

  const leftoverResults = pool.filter((p) => !p.used).map((p) => p.r);
  const byWeek = [...map.entries()].sort((a, b) => a[0] - b[0]);
  return { byWeek, leftoverResults };
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseScheduleDateString(raw: string, ref: Date): Date | null {
  const m = normalizeWs(raw).match(SCHEDULE_DATE_RE);
  if (!m) return null;
  const monthKey = m[1].slice(0, 3).toLowerCase();
  const month = MONTH_INDEX[monthKey];
  if (month === undefined) return null;
  const day = parseInt(m[2], 10);
  if (!Number.isFinite(day)) return null;

  let year = ref.getFullYear();
  let candidate = startOfLocalDay(new Date(year, month, day));
  const refDay = startOfLocalDay(ref).getTime();
  const msBehind = refDay - candidate.getTime();
  const msAhead = candidate.getTime() - refDay;
  const rollMs = 120 * 86_400_000;
  if (msBehind > rollMs) candidate = startOfLocalDay(new Date(year + 1, month, day));
  else if (msAhead > rollMs)
    candidate = startOfLocalDay(new Date(year - 1, month, day));
  return candidate;
}

function weekDateBounds(
  rows: ScheduleRow[],
  ref: Date,
): { min: Date; max: Date } | null {
  const dates: Date[] = [];
  for (const row of rows) {
    if (!row.game.date || row.game.off || row.game.ppd) continue;
    const d = parseScheduleDateString(row.game.date, ref);
    if (d) dates.push(d);
  }
  if (dates.length === 0) return null;
  let min = dates[0]!;
  let max = dates[0]!;
  for (const d of dates) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

/** Week that contains today, or the next upcoming week; last week if season ended. */
function findCurrentWeekNumber(
  byWeek: [number, ScheduleRow[]][],
): number | null {
  if (byWeek.length === 0) return null;
  const ref = new Date();
  const today = startOfLocalDay(ref).getTime();

  const ranges = byWeek
    .map(([week, rows]) => {
      const bounds = weekDateBounds(rows, ref);
      return bounds ? { week, ...bounds } : null;
    })
    .filter((w): w is { week: number; min: Date; max: Date } => w != null);

  if (ranges.length === 0) return byWeek[0]![0];

  for (const w of ranges) {
    if (w.min.getTime() <= today && today <= w.max.getTime()) return w.week;
  }

  for (const w of ranges) {
    if (w.min.getTime() >= today) return w.week;
  }

  return ranges[ranges.length - 1]!.week;
}

/** Week section to align to top of viewport (one week before current). */
function findScrollAnchorWeek(
  byWeek: [number, ScheduleRow[]][],
  currentWeek: number | null,
): number | null {
  if (currentWeek == null) return null;
  const idx = byWeek.findIndex(([w]) => w === currentWeek);
  if (idx < 0) return byWeek[0]?.[0] ?? null;
  if (idx === 0) return byWeek[0]![0];
  return byWeek[idx - 1]![0];
}

function ScheduleNowDivider() {
  return (
    <div
      className="flex items-center gap-3 pb-1 pt-0.5"
      aria-label="Current point in the schedule"
    >
      <div className="h-px flex-1 bg-sky-500/50" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-sky-400/90">
        Now
      </span>
      <div className="h-px flex-1 bg-sky-500/50" />
    </div>
  );
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function toSchedulePerspective(
  game: Game,
  r: Result,
): ScheduleRow["display"] {
  if (r.homeSlug === game.homeSlug && r.awaySlug === game.awaySlug) {
    return {
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      overtime: r.overtime,
      tie: r.tie,
    };
  }
  return {
    homeScore: r.awayScore,
    awayScore: r.homeScore,
    overtime: r.overtime,
    tie: r.tie,
  };
}

function ScheduleGameDateMark({ game }: { game: Game }) {
  return game.off ? (
    <span className="text-red-300">OFF</span>
  ) : game.ppd ? (
    <span className="text-amber-300">PPD</span>
  ) : (
    (game.date ?? "TBD")
  );
}

function ScheduleGameBadges({
  display,
}: {
  display: ScheduleRow["display"];
}) {
  return (
    <div className="flex min-h-[1.125rem] justify-end gap-1 sm:justify-end">
      {display?.overtime && (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          OT
        </Badge>
      )}
      {display?.tie && (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          Tie
        </Badge>
      )}
    </div>
  );
}

function ScheduleRinkChip({
  rink,
  hideOffPpdPlaceholders,
}: {
  rink: RinkInfo | null;
  hideOffPpdPlaceholders: boolean;
}) {
  if (rink) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 truncate items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
          rink.className,
        )}
        title={rink.full}
      >
        {rink.short}
      </span>
    );
  }
  if (hideOffPpdPlaceholders) return null;
  return <span className="text-[10px] text-muted-foreground">—</span>;
}

function ScheduleGameTeams({
  game,
  display,
}: {
  game: Game;
  display: ScheduleRow["display"];
}) {
  const homeWins =
    display !== null && display.homeScore > display.awayScore;
  const awayWins =
    display !== null && display.awayScore > display.homeScore;
  const accentCtx = display
    ? {
        homeScore: display.homeScore,
        awayScore: display.awayScore,
        overtime: display.overtime,
        tie: display.tie,
      }
    : null;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:min-w-0 sm:flex-1">
      <Link
        to="/teams/$slug"
        params={{ slug: game.homeSlug }}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium hover:underline underline-offset-2 decoration-muted-foreground/40",
          display && (homeWins ? "font-semibold" : "text-muted-foreground"),
        )}
      >
        <TeamLogo src={game.homeLogoUrl} name={game.home} size="xs" />
        <span className="inline-flex min-w-0 items-baseline gap-1.5 leading-snug">
          <span className="truncate">{game.home}</span>
          {display && (
            <span
              className={cn(
                "shrink-0 tabular-nums",
                accentCtx && goalNumberClass("home", accentCtx),
              )}
            >
              {display.homeScore}
            </span>
          )}
        </span>
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground">vs</span>
      <Link
        to="/teams/$slug"
        params={{ slug: game.awaySlug }}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium hover:underline underline-offset-2 decoration-muted-foreground/40",
          display && (awayWins ? "font-semibold" : "text-muted-foreground"),
        )}
      >
        <TeamLogo src={game.awayLogoUrl} name={game.away} size="xs" />
        <span className="inline-flex min-w-0 items-baseline gap-1.5 leading-snug">
          <span className="truncate">{game.away}</span>
          {display && (
            <span
              className={cn(
                "shrink-0 tabular-nums",
                accentCtx && goalNumberClass("away", accentCtx),
              )}
            >
              {display.awayScore}
            </span>
          )}
        </span>
      </Link>
    </div>
  );
}

function GameRow({ row }: { row: ScheduleRow }) {
  const { game, display } = row;
  const rink = game.off || game.ppd ? null : lookupRink(game.rinkColor);

  const timeLabel =
    game.off || game.ppd
      ? ""
      : game.time
        ? `${game.time} PM`
        : "Time TBD";

  const hideOffPpdPlaceholders = game.off || game.ppd;

  return (
    <li
      className={cn(
        "px-4 py-3",
        "sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)_10.75rem_minmax(0,7rem)] sm:items-center sm:gap-x-3 sm:gap-y-0",
      )}
    >
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex min-w-0 w-full items-center justify-between gap-x-3">
          <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
            <ScheduleGameDateMark game={game} />
          </div>
          <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-x-2">
            {timeLabel !== "" && (
              <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {timeLabel}
              </div>
            )}
            <div className="min-w-0 flex justify-end">
              <ScheduleRinkChip
                rink={rink}
                hideOffPpdPlaceholders={hideOffPpdPlaceholders}
              />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 w-full items-center justify-between gap-x-3">
          <ScheduleGameTeams game={game} display={display} />
          <div className="shrink-0 pl-2">
            <ScheduleGameBadges display={display} />
          </div>
        </div>
      </div>

      <div className="hidden sm:contents">
        <div className="w-[5.5rem] shrink-0 text-xs text-muted-foreground tabular-nums sm:w-auto">
          <ScheduleGameDateMark game={game} />
        </div>
        <ScheduleGameTeams game={game} display={display} />
        <div className="ml-auto grid min-w-0 w-full max-w-[10.75rem] shrink-0 grid-cols-[4.5rem_5.75rem] items-center gap-x-1.5 sm:ml-0 sm:max-w-none">
          <ScheduleGameBadges display={display} />
          <div className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
            {timeLabel}
          </div>
        </div>
        <div className="flex min-w-0 max-w-full basis-full justify-end sm:basis-auto sm:max-w-none sm:justify-end">
          <ScheduleRinkChip
            rink={rink}
            hideOffPpdPlaceholders={hideOffPpdPlaceholders}
          />
        </div>
      </div>
    </li>
  );
}

function UnmatchedResultRow({ r }: { r: Result }) {
  const homeWins = r.homeScore > r.awayScore;
  const awayWins = r.awayScore > r.homeScore;
  const ctx = {
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    overtime: r.overtime,
    tie: r.tie,
  };
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
      <div className="grid grid-cols-[1fr_3rem_1fr] items-center gap-3 text-sm">
        <Link
          to="/teams/$slug"
          params={{ slug: r.homeSlug }}
          className={cn(
            "inline-flex items-center justify-end gap-2 min-w-0 hover:underline underline-offset-2 decoration-muted-foreground/40",
            homeWins ? "font-semibold" : "text-muted-foreground",
          )}
        >
          <span className="truncate text-right">{r.home}</span>
          <TeamLogo src={r.homeLogoUrl} name={r.home} size="xs" />
        </Link>
        <span className="text-center tabular-nums font-mono text-base">
          <span className={goalNumberClass("home", ctx)}>
            {r.homeScore}
          </span>
          <span className="text-muted-foreground mx-1">-</span>
          <span className={goalNumberClass("away", ctx)}>
            {r.awayScore}
          </span>
        </span>
        <Link
          to="/teams/$slug"
          params={{ slug: r.awaySlug }}
          className={cn(
            "inline-flex items-center gap-2 min-w-0 hover:underline underline-offset-2 decoration-muted-foreground/40",
            awayWins ? "font-semibold" : "text-muted-foreground",
          )}
        >
          <TeamLogo src={r.awayLogoUrl} name={r.away} size="xs" />
          <span className="truncate">{r.away}</span>
        </Link>
      </div>
      <div>
        {r.overtime && <Badge variant="outline">OT</Badge>}
        {r.tie && <Badge variant="outline">Tie</Badge>}
      </div>
    </li>
  );
}
