import type { ReactNode } from "react";
import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { divisionQuery } from "@/lib/queries";
import { ApiException } from "@/lib/api";
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
  component: DivisionLayout,
  errorComponent: DivisionErrorBoundary,
  pendingComponent: DivisionPending,
});

function DivisionLayout() {
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

      <div className="flex flex-col gap-4">
        <nav
          role="tablist"
          aria-label="Division views"
          className="inline-flex h-10 w-fit items-center justify-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
        >
          <DivisionTabLink slug={slug} to="/divisions/$slug">
            Standings
          </DivisionTabLink>
          <DivisionTabLink slug={slug} to="/divisions/$slug/schedule">
            Schedule & Results
          </DivisionTabLink>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}

function DivisionTabLink({
  slug,
  to,
  children,
}: {
  slug: string;
  to: "/divisions/$slug" | "/divisions/$slug/schedule";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: true }}
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      activeProps={{
        className:
          "bg-background text-foreground shadow-sm hover:text-foreground",
        "aria-selected": true,
      }}
      inactiveProps={{ "aria-selected": false }}
      role="tab"
    >
      {children}
    </Link>
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
