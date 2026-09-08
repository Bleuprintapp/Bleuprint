# Bleuprint Intelligence Portal — connection map

## Deployment-ready now

- The complete Passport prototype is mounted at `/admin` behind the existing Clerk login.
- Its document bundle is served through an authenticated, non-indexed, no-store route rather than the public asset directory.
- Spatial navigation, decisions, discussions, content generation demonstrations, calendar editing, local folder access, discrepancy comparison, approvals, and BLKBOX package preview run in the browser.
- Browser state is device-local until the shared backend is connected.

## Required production connections

1. Shared Postgres state for members, sources, objects, decisions, notes, signals, artifacts, calendar slots, audit rows, and BLKBOX packages.
2. A second Clerk member role for the Passport client view. Internal reasoning must remain limited to Bleuprint members.
3. A server-side model endpoint for evidence-grounded answers and artifact generation. Provider keys must never enter the browser bundle.
4. Google Drive and Microsoft 365 read-only OAuth connectors, change cursors, file extraction, and scheduled synchronization.
5. An authenticated AI-bot event endpoint that records the producing bot, client, source lineage, and changed material.
6. A BLKBOX webhook and receipt ID for approved, schedule-only execution packages.
7. Durable asset storage for uploaded images, video, and generated exports.
8. Realtime updates so decisions, approvals, and discussions appear for Kalena and Paris without refresh.

## Non-negotiable controls

- Read-only source access by default.
- Explicit permission for each write-back.
- Exact-match file edits only; a mismatch fails without changing the source.
- Append-only decisions and audit history.
- Named, timestamped human approval.
- BLKBOX receives `schedule_only` packages and never publishes without approval.
- Every recommendation and artifact keeps its source lineage, assumptions, proof rung, and affected outputs.
