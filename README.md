# better-cshl

A cleaner, faster, real-time view of the [Cranston Senior Hockey League](https://www.thecshl.com/).

Scrapes the official Weebly site on the Cloudflare edge, parses the messy HTML
into typed JSON, and serves a modern React UI on top.

## Stack

- **Frontend**: Vite + React 19 + TypeScript, [TanStack Router](https://tanstack.com/router) (file-based, type-safe), [TanStack Query](https://tanstack.com/query) (data + caching), Tailwind CSS v4.
- **Backend**: [Hono](https://hono.dev/) on Cloudflare Workers (single Worker also serves the SPA assets via the [`@cloudflare/vite-plugin`](https://www.npmjs.com/package/@cloudflare/vite-plugin)).
- **Parsing**: hand-rolled regex + a tiny streaming HTML tokenizer (`worker/scrapers/parsers/htmlUtils.ts`) — no `cheerio`/`jsdom` dependency in the Worker bundle.
- **Validation**: every parsed payload is run through [Zod](https://zod.dev/) so an upstream HTML change surfaces as a clean 502, not garbage UI.
- **Caching**: Cloudflare Cache API in front of each scrape, 5–10 minute TTL, with `X-Cache: HIT|MISS` headers for debugging.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite plugin runs the React SPA and the Worker
in a single process; both are served from the same origin.

To bypass the edge cache for a single request:

```
GET /api/divisions/central?refresh=1
```

## Build & deploy

```bash
npm run build        # type-check, then build SPA + Worker
npm run deploy       # build + `wrangler deploy`
```

`wrangler deploy` publishes to a free `*.workers.dev` subdomain. You'll need to
`wrangler login` once.

## API surface

| Method | Path                              | Description                                                                  |
| ------ | --------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`                     | liveness + version + start time                                              |
| GET    | `/api/health/upstream`            | round-trip latency to thecshl.com (cached 60s)                               |
| GET    | `/api/divisions`                  | list of 6 divisions: `{ slug, name }`                                        |
| GET    | `/api/divisions/:slug`            | `{ teams, standings, scrapedStandings, discrepancies, schedule, results, fetchedAt }` |
| GET    | `/api/divisions/:slug?refresh=1`  | same, but bypass cache (useful when iterating on scrapers)                   |
| GET    | `/api/teams`                      | full rosters dump for all divisions                                          |
| GET    | `/api/teams/by-division/:slug`    | rosters for one division                                                     |
| GET    | `/api/teams/:slug`                | one team's roster; slug matching is fuzzy so `country-creamers` finds `Country Creamery` |

All cache-friendly responses set `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.

## Standings: calculated vs. scraped

The site's published standings table has historically been blank or out of sync
with the actual game results. We don't trust it.

The `standings` field in `/api/divisions/:slug` is **always computed from the
results blob** (see [`worker/scrapers/computeStandings.ts`](worker/scrapers/computeStandings.ts)). Scoring is standard rec-league:

| Result        | Winner  | Loser    |
| ------------- | ------- | -------- |
| Regulation    | W, +2pt | L, +0pt  |
| OT / SO       | W, +2pt | OTL, +1pt |
| Tie           | T, +1pt | T, +1pt  |

The site's raw row is still surfaced as `scrapedStandings` (with `otlT` as the
combined column it uses on the page). Every non-null cell where they disagree
with us produces an entry in `discrepancies`, which the UI surfaces as an amber
banner above the standings table and a small warning icon on each affected
cell.

## What we're scraping

Division pages such as `https://www.thecshl.com/central-division.html` carry
four pieces of state we care about:

| Section            | Where it lives in the source HTML                                                  | Parser                                  |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------- |
| **Seed list**      | `<div class="paragraph">` containing `(1) Team A (2) Team B ...`                    | `worker/scrapers/parsers/seedList.ts`   |
| **Standings**      | `<table class="simple-table style-top">` with header `TEAM GP W L OTL/T PTS GF GA` | `worker/scrapers/parsers/standings.ts`  |
| **Results**        | `<div class="paragraph">` inside `RESULTS`, `<br>`-separated lines                  | `worker/scrapers/parsers/results.ts`    |
| **Schedule**       | `SCHEDULE ... <table class="wsite-multicol-table">`                                | `worker/scrapers/parsers/schedule.ts`   |

The schedule format is particularly hostile — day digits and team digits run
together (`Tue Apr 74 v 7 900` = "Tue Apr 7, team 4 v team 7, 9:00"). The parser
uses `<br>` boundaries + a per-line state machine to recover structure.

`https://www.thecshl.com/rosters.html` is a single page sectioned by
`<font size="6">DIVISION NAME</font>` headers; each section contains one
multi-column table per team with rows like `<#> <Name>` and `©` / `(G)` suffixes
for captains and goalies. Parsed in `worker/scrapers/rosters.ts`.

## When the upstream breaks

The site uses Weebly, which loves to mangle HTML in ways that look identical but
are subtly different (extra `<font>` wrappers, swapped class names, etc.).
Every parser throws a `ParseError(section, sample)` that surfaces as a 502 with
the offending substring; the UI shows a "the source page changed format"
message rather than crashing.

To diagnose, hit the failing endpoint with `?refresh=1`, then read the `sample`
field in the response. Often it's enough context to update a single regex.

For local iteration, dump a raw page into `scratch/` (gitignored):

```bash
mkdir -p scratch
curl -A "Mozilla/5.0" https://www.thecshl.com/central-division.html -o scratch/central.html
```

…and then re-run targeted parser tests in a Node REPL.

## Project layout

```
src/                          React SPA
  routes/                     file-based TanStack Router routes
  components/
    ui/                       hand-rolled shadcn-style primitives (Tabs, Card, Badge)
    StandingsTable.tsx
    ScheduleList.tsx
    ResultsList.tsx
  lib/
    api.ts                    typed fetch wrappers
    queries.ts                TanStack Query factories
worker/                       Cloudflare Worker
  index.ts                    Hono app, mounts /api/*
  routes/                     one Hono router per resource
  scrapers/
    division.ts               orchestrator for one division
    rosters.ts                full rosters scraper
    parsers/                  pure (html: string) => T parsers
  lib/
    fetchCshl.ts              upstream fetch + retries
    cache.ts                  Cache API wrapper
    errors.ts                 ParseError + JSON error response
shared/
  schemas.ts                  Zod schemas (worker imports for runtime)
  types.ts                    type-only re-exports for SPA
```

## Disclaimers

This project is unaffiliated with the Cranston Senior Hockey League. All data is
the property of the league. We just re-present it more legibly.
