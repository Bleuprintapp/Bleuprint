#!/usr/bin/env node
/* Move the calendar and campaigns out of the JSON blobs and into rows.
 *
 *   node scripts/migrate-content-rows.mjs            dry run, prints what would happen
 *   node scripts/migrate-content-rows.mjs --apply    writes rows, keeps the blobs
 *
 * The same migration can be run from the browser by the owner at
 * /api/admin/migrate-content-rows, which needs no Node on the Mac.
 *
 * Safe to run more than once: rows that already exist are left alone.
 * Nothing is deleted. The original blobs are copied under archive keys
 * before anything is written, and the live keys are not touched, so the
 * old code keeps working until it is switched over.
 */
if (!process.execArgv.includes("--no-warnings") && !process.env.BLEU_MIGRATE_CHILD) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], { stdio: "inherit", env: { ...process.env, BLEU_MIGRATE_CHILD: "1" } });
  process.exit(r.status ?? 1);
}
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { migrateContentRows } from "../lib/migrate-content-rows.js";

const APPLY = process.argv.includes("--apply");

// Load .env.local ourselves so the command is just `node scripts/migrate-content-rows.mjs`.
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* no .env.local; fall through to the check below */ }
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set and .env.local was not found next to the repo."); process.exit(1); }

try {
  const result = await migrateContentRows(neon(url), { apply: APPLY });
  console.log(result.lines.join("\n"));
  if (!APPLY) console.log("Re-run with --apply to write.");
} catch (error) {
  const reason = error?.cause?.message || error?.message || String(error);
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(reason)) {
    console.error("Could not reach the database from this computer.");
    console.error("Reason:", reason);
    console.error("Run this from Terminal on the Mac on a normal internet connection, or use /api/admin/migrate-content-rows in the browser.");
  } else {
    console.error("The migration stopped before finishing. Nothing partial is left behind that a re-run cannot pick up.");
    console.error("Reason:", reason);
  }
  process.exit(1);
}
