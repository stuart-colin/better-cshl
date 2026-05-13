import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { divisionQuery } from "@/lib/queries";
import { ApiException } from "@/lib/api";
import { StandingsTable } from "@/components/StandingsTable";
import { ScheduleList } from "@/components/ScheduleList";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/divisions/$slug")({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(divisionQuery(params.slug));
    } catch (err) {
      if (err instanceof ApiException && err.status === 404) {
        throw notFound();
      }
      throw err;
    }
  },
  component: DivisionPage,
  errorComponent: DivisionErrorBoundary,
  pendingComponent: DivisionPending,
});

function DivisionPage() {
  const { slug } = Route.useParams();
  const { data: division, refetch, isRefetching } = useSuspenseQuery(
    divisionQuery(slug),
  );

  const fetchedAgo = useFetchedAgo(division.fetchedAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All divisions
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated {fetchedAgo}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/80 disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3 w-3", isRefetching && "animate-spin")}
            />
            Refresh
          </button>
          <a
            href={division.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {division.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {division.teams.length} teams · {division.schedule.length} scheduled
          games · {division.results.length} played
        </p>
      </header>

      <Tabs defaultValue="standings">
        <TabsList>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="schedule">Schedule & Results</TabsTrigger>
        </TabsList>

        <TabsContent value="standings">
          <StandingsTable
            rows={division.standings}
            scraped={division.scrapedStandings}
            discrepancies={division.discrepancies}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleList games={division.schedule} results={division.results} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DivisionPending() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-10 w-72 animate-pulse rounded bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function DivisionErrorBoundary({ error }: { error: Error }) {
  const apiErr = error instanceof ApiException ? error : null;
  const isParseFailure = apiErr?.payload?.error === "parse_failed";
  const isUpstreamFailure = apiErr?.payload?.error === "upstream_failed";

  return (
    <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="text-lg font-semibold">
        {isParseFailure
          ? "The source page changed format"
          : isUpstreamFailure
            ? "Couldn't reach the source"
            : "Something went wrong"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {isParseFailure
          ? "thecshl.com modified their HTML in a way we don't know how to read. The scraper needs an update."
          : isUpstreamFailure
            ? "thecshl.com isn't responding right now. Try again in a minute."
            : error.message}
      </p>
      {apiErr?.payload?.section && (
        <p className="text-xs text-muted-foreground font-mono">
          Section: {apiErr.payload.section}
        </p>
      )}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </Link>
    </div>
  );
}

function useFetchedAgo(iso: string): string {
  const fetched = new Date(iso).getTime();
  const now = Date.now();
  const ms = now - fetched;
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}
