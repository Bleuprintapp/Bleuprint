import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "../../../lib/db";
import { getServerMember } from "../../../lib/server-member";
import { sourceRoadmap } from "../../../lib/roadmap-source";
import { buildThisWeek } from "../../../lib/this-week";

export const dynamic = "force-dynamic";
const WORKSPACE = "passport";

// The plan document that carries dated commitments. Matched by name so that
// re-indexing the folder does not break the link.
const PLAN_PATTERN = "%MISSION_INITIATIVE_PLAN%";

export async function GET() {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSchema();
  const sql = getSql();

  const [stateRows, issues, memory, planRows, phases] = await Promise.all([
    sql`SELECT state_key, state_value FROM bleuprint_workspace_state WHERE workspace_id = ${WORKSPACE} AND state_key IN ('calendar','roadmap')`,
    sql`SELECT id, mismatch_type, detail, source_location, status, assigned_to FROM bleuprint_mismatches WHERE workspace_id = ${WORKSPACE} AND status IN ('open','assigned')`,
    sql`SELECT id, title, status, source_name, archived_at FROM bleuprint_memory_entries WHERE workspace_id = ${WORKSPACE} AND archived_at IS NULL AND status IN ('needs_decision','conflict')`,
    sql`SELECT name, extracted_text FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} AND archived_at IS NULL AND name ILIKE ${PLAN_PATTERN} ORDER BY uploaded_at DESC LIMIT 1`,
    sourceRoadmap().catch(() => []),
  ]);

  const state = Object.fromEntries(stateRows.map(row => [row.state_key, row.state_value]));
  const plan = planRows[0] || null;

  const result = buildThisWeek({
    phases,
    roadmapState: state.roadmap || {},
    calendar: Array.isArray(state.calendar) ? state.calendar : [],
    issues,
    memory,
    planText: plan?.extracted_text || "",
  });

  // Say where the week came from, so a wrong focus is traceable to a document
  // rather than looking like the system inventing a priority.
  return NextResponse.json({
    ...result,
    sources: {
      roadmap: phases.length ? `${phases.length} dated phases` : "not readable",
      plan: plan ? plan.name : null,
      planMissing: plan ? null : "The mission initiative plan is not indexed, so dated milestones are not being read.",
    },
  });
}
