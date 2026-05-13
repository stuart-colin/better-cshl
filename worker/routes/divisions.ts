import { Hono } from "hono";
import { withEdgeCacheJson } from "../lib/cache";
import { errorResponse } from "../lib/errors";
import {
  DIVISIONS,
  scrapeDivision,
  type DivisionSlug,
} from "../scrapers/division";

// Bump when the response shape changes so stale caches don't poison the client.
const CACHE_VERSION = "v4";

const route = new Hono<{ Bindings: { ASSETS: Fetcher } }>();

route.get("/", (c) =>
  c.json({
    divisions: DIVISIONS.map((d) => ({ slug: d.slug, name: d.name })),
  }),
);

route.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const meta = DIVISIONS.find((d) => d.slug === slug);
  if (!meta) {
    return c.json(
      { error: "not_found", message: `unknown division: ${slug}` },
      404,
    );
  }
  const refresh = c.req.query("refresh") === "1";

  try {
    if (refresh) {
      return Response.json(await scrapeDivision(slug as DivisionSlug), {
        headers: { "X-Cache": "BYPASS" },
      });
    }
    return await withEdgeCacheJson(
      `division:${CACHE_VERSION}:${slug}`,
      300,
      () => scrapeDivision(slug as DivisionSlug),
      c.executionCtx,
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default route;
