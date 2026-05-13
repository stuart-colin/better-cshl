/**
 * Writes `dist/client/_redirects` after Vite build.
 * Set NETLIFY_API_TARGET in Netlify (e.g. https://better-cshl.your-subdomain.workers.dev)
 * so /api/* is proxied to your Cloudflare Worker. No trailing slash.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "dist", "client");
const target = (process.env.NETLIFY_API_TARGET ?? "").replace(/\/$/, "");

const lines = [];
if (target) {
  lines.push(`/api/* ${target}/api/:splat 200`);
} else {
  console.warn(
    "[write-netlify-redirects] NETLIFY_API_TARGET is unset; /api will 404 on Netlify until you set it (Site settings → Environment variables).",
  );
}
lines.push("/* /index.html 200");

const file = path.join(outDir, "_redirects");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(file, `${lines.join("\n")}\n`);
console.log(`[write-netlify-redirects] wrote ${path.relative(process.cwd(), file)}`);
