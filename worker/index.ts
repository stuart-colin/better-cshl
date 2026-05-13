import { Hono } from "hono";
import { cors } from "hono/cors";
import { withEdgeCacheJson } from "./lib/cache";
import { fetchCshl } from "./lib/fetchCshl";
import { errorResponse } from "./lib/errors";
import divisionsRoute from "./routes/divisions";
import teamsRoute from "./routes/teams";

type Bindings = {
  ASSETS: Fetcher;
};

type Variables = Record<string, never>;

const VERSION = "0.1.0";
const startedAt = new Date().toISOString();

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("/api/*", cors({ origin: "*", maxAge: 600 }));

app.get("/api/health", async (c) => {
  return c.json({
    ok: true,
    name: "better-cshl",
    version: VERSION,
    time: new Date().toISOString(),
    workerStartedAt: startedAt,
  });
});

app.get("/api/health/upstream", async (c) => {
  return withEdgeCacheJson(
    "health:upstream",
    60,
    async () => {
      const t0 = Date.now();
      const { url, fetchedAt } = await fetchCshl("/", { attempts: 1, timeoutMs: 5000 });
      return {
        ok: true,
        url,
        fetchedAt,
        latencyMs: Date.now() - t0,
      };
    },
    c.executionCtx,
  ).catch((err) => errorResponse(c, err));
});

app.route("/api/divisions", divisionsRoute);
app.route("/api/teams", teamsRoute);

app.onError((err, c) => errorResponse(c, err));

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
