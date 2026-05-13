import type { Context } from "hono";
import { UpstreamError } from "./fetchCshl";

export class ParseError extends Error {
  readonly section: string;
  readonly sample: string | undefined;

  constructor(message: string, section: string, sample?: string) {
    super(message);
    this.name = "ParseError";
    this.section = section;
    this.sample = sample;
  }
}

export function errorResponse(c: Context, err: unknown): Response {
  if (err instanceof UpstreamError) {
    return c.json(
      {
        error: "upstream_failed",
        message: err.message,
        upstream: { url: err.url, status: err.status },
      },
      502,
    );
  }
  if (err instanceof ParseError) {
    return c.json(
      {
        error: "parse_failed",
        message: err.message,
        section: err.section,
        sample: err.sample?.slice(0, 200),
      },
      502,
    );
  }
  console.error("Unhandled error in route:", err);
  return c.json(
    {
      error: "internal_error",
      message: err instanceof Error ? err.message : String(err),
    },
    500,
  );
}
