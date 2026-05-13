import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { LeagueLogo } from "@/components/LeagueLogo";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-lg"
          >
            <LeagueLogo className="h-9 w-auto" />
            Better<span className="text-muted-foreground"> CSHL</span>
          </Link>
          <nav className="text-sm text-muted-foreground">
            <a
              href="https://www.thecshl.com/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              official site
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 py-6 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4">
          Data scraped from{" "}
          <a
            href="https://www.thecshl.com/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            thecshl.com
          </a>
          . Unaffiliated.
        </div>
      </footer>

      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </>
      )}
    </div>
  );
}
