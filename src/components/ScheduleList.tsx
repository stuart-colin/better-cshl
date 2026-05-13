import { Link } from "@tanstack/react-router";
import type { Game, Result } from "@shared/types";
import { useMemo } from "react";
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
  return RINK_BY_COLOR[lower] ?? RINK_BY_COLOR[rgbToHex(color)] ?? null;
}

function rgbToHex(c: string): string {
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return c.toLowerCase();
  const hex = [m[1], m[2], m[3]]
    .map((n) => parseInt(n, 10).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`.toLowerCase();
}

export function ScheduleList({ games, results }: Props) {
  const { byWeek, leftoverResults } = useMemo(
    () => buildWeeksWithResults(games, results),
    [games, results],
  );

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
        <section key={week} className="space-y-3">
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

function GameRow({ row }: { row: ScheduleRow }) {
  const { game, display } = row;
  const rink = game.off || game.ppd ? null : lookupRink(game.rinkColor);
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
        "flex flex-wrap items-center gap-x-3 gap-y-2",
        "sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)_10.75rem_minmax(0,7rem)] sm:items-center sm:gap-x-3 sm:gap-y-0",
      )}
    >
      <div className="w-[5.5rem] shrink-0 text-xs text-muted-foreground tabular-nums sm:w-auto">
        {game.off ? (
          <span className="text-red-300">OFF</span>
        ) : game.ppd ? (
          <span className="text-amber-300">PPD</span>
        ) : (
          game.date ?? "TBD"
        )}
      </div>

      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:basis-auto sm:flex-1">
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

      <div className="ml-auto grid min-w-0 w-full max-w-[10.75rem] shrink-0 grid-cols-[4.5rem_5.75rem] items-center gap-x-1.5 sm:ml-0 sm:max-w-none">
        <div className="flex min-h-[1.125rem] justify-end gap-1">
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
        <div className="text-right text-xs text-muted-foreground tabular-nums sm:text-sm">
          {timeLabel}
        </div>
      </div>

      <div className="flex min-w-0 max-w-full basis-full justify-end sm:basis-auto sm:max-w-none sm:justify-end">
        {rink ? (
          <span
            className={cn(
              "inline-flex max-w-full min-w-0 truncate items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
              rink.className,
            )}
            title={rink.full}
          >
            {rink.short}
          </span>
        ) : hideOffPpdPlaceholders ? null : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
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
