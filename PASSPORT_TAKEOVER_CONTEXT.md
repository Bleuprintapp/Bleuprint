# Bleuprint Passport — Takeover Context

**Last updated:** 9 September 2026  
**Repository:** `Bleuprintapp/Bleuprint`  
**Branch:** `main`  
**Current live release:** commit `4c9e972` — `Activate clean Passport workspace`  
**Live admin:** `https://www.bleuprintco.com/admin`  
**Archive:** `https://www.bleuprintco.com/admin?open=archive`

## 1. The actual goal

Bleuprint is not a to-do list and not a generic AI dashboard. It is the operating intelligence layer for the ventures Bleuprint runs, beginning with Passport.

It should:

1. Understand the whole business, not merely the current request.
2. Turn source documents, research, decisions, calendars, assets, conversations, and metrics into structured brand intelligence.
3. Preserve the difference between an explicit source fact, a confirmed decision, an AI suggestion, a conflict, and an unresolved question.
4. Identify what changed, what is missing, what conflicts, and what deserves attention.
5. Recommend the next strategic move with evidence.
6. Create useful work: briefs, scripts, campaigns, captions, calendars, creative direction, reports, and client-ready documents.
7. Remember approved decisions, with provenance, so Kalena and Paris do not have to re-explain the brand.
8. Send approved work to BLKBOX later for execution, tracking, automation, and accountability.

The desired operating loop is:

```text
Canonical source folder
        ↓
Source ingestion + exact provenance
        ↓
Live memory / roadmap / content / opportunities / performance
        ↓
Mismatch and missing-context checks
        ↓
Team assignment, discussion, resolution, approval
        ↓
Approved write-back to canonical source
        ↓
Archive + change history + notifications
```

Passport is the first real client/venture using the system. The structure must become reusable for additional ventures under Bleuprint.

## 2. Product and design direction

### Required experience

- Keep the current Bleuprint portal’s spatial, “zoom into the blueprint” feel.
- It should feel like moving through a neural network / business map, not a conventional SaaS dashboard or a to-do list.
- Panels should float above the map and preserve blurred context behind them.
- Avoid sharp generic cards, generic branches, unrelated Passport logo motifs, or fake visual affordances.
- Users must be able to zoom from the whole strategy to one working record.

### Critical correction

The center map in `app/admin/experience/portal.html` is a visual prototype. It contains hard-coded example cards and historic local-state behavior. It is **not** the shared database interface.

The bottom workspaces are the current shared interface:

- Memory
- Roadmap
- Content
- Signals
- Performance
- Archive

The release at `4c9e972` adds a small honest notice explaining that the center is a blueprint map and the workspaces below are where shared records save. Do not present any static center-card action such as “Just update,” “Hand to Paris,” a mock comment, or “Writes to…” as a real write-back.

The eventual solution is to replace or fully bind the center prototype to the server-backed records. Do not add more visual overlays to fake functionality.

## 3. What is live and real now

### Access and deployment

- Production is `https://www.bleuprintco.com/admin`.
- Authentication uses the project’s member/session system, not Clerk UI.
- The latest deployment was force-promoted because an old **Clerk DNS Configuration** Vercel requirement still blocks ordinary production promotion. This was a deployment requirement issue, not a Next build failure.
- The latest build passed and the live portal was checked with no console errors.

### Active Passport sources

The demo workspace was archived, not deleted. The active Passport workspace was populated only with these selected local files:

1. `/Users/gardner/Desktop/Passport/00_Canonical/PASSPORT_CANONICAL_CONTEXT.md`
2. `/Users/gardner/Desktop/Passport/01_Brand/PASSPORT_BRAND_GUIDE_v1_2026-09-07.html`
3. `/Users/gardner/Desktop/Passport/00_Canonical/PASSPORT_MISSION_INITIATIVE_PLAN.md`
4. `/Users/gardner/Desktop/Passport/00_Canonical/PASSPORT_BUILD_ROADMAP_v2_2026-09-08.md`
5. `/Users/gardner/Desktop/Passport/02_Content/PASSPORT_LAUNCH_WEEK_PLAN_v1_2026-09-07.md`
6. `/Users/gardner/Desktop/Passport/02_Content/week-2026-09-07/CAPTIONS.md`

The active calendar contains **11 Week One content rows** (5 LinkedIn, 3 Instagram, 3 TikTok), derived from the selected launch-week source.

### Source and memory handling

The live data model distinguishes:

- `confirmed`: content from a selected document of record
- `extracted`: explicit content found in a source, not automatically approved
- `suggested`: a team-added or future generated proposal
- `conflict`: an identified discrepancy
- `needs_decision`: something requiring human judgment

Each memory entry retains:

- source document name
- heading/line or source location
- evidence excerpt
- creation/update actor and time

Important policy: **uploading a document must never silently turn AI inference into brand truth.** Routing/extraction is allowed; authority and final decisions require human confirmation.

### Live workspaces

#### Memory

- Upload readable text, Markdown, HTML, CSV, and JSON files.
- Extracts and classifies entries into Brand, Audience, Content, Roadmap, Opportunities, Performance, or Reference.
- Allows manually adding, editing, confirming, and archiving memory entries.
- Lets a team member mark a source as the document of record for its category.
- Shows provenance in the UI.

#### Roadmap

- Server-backed state for completion, bottlenecks, questions, attachments, and archive.
- Both Kalena and Paris can archive completed roadmap work.
- `@Kalena` / `@Paris` mentions in saved workspace text create in-app notifications.

#### Content

- Server-backed calendar and campaign records.
- The calendar is editable: date, title, format, time, status, campaign build, and archive.
- “Open next post” selects from saved calendar rows; it is only useful when the actual calendar is the active source.
- A campaign is meant to inherit its parent calendar row and separate Instagram, TikTok, and LinkedIn work.
- Content archive stores the previous status and can restore the row.

#### Signals

- The analyzer checks real shared records for missing proof labels, stealth disclosures, missing core records, mismatches, incomplete assets/copy, orphaned campaign rows, and production-readiness gaps.
- Issues can be assigned, resolved, bypassed with a reason, archived, and optionally recorded as a specific impact on memory.
- A resolution must record actor/time. A reason can be optional when the user deliberately chooses “just update.”

#### Archive

- Open from the bottom bar or `/admin?open=archive`.
- Shows approved/done work, archived records, and change history.
- Documents, memory, issues, and archived content rows can be restored.
- At the time of this handoff, the archived demo workspace contributes **20 archived records**. It is recoverable and should not be deleted casually.

#### Performance

- Has a real place in the data model and can show Buffer state and missing scheduled coverage.
- It is not yet a complete performance system. It has no established automated metrics pipeline yet.

## 4. Important limits: do not claim these are connected

### Microsoft / OneDrive

**Not connected.** The six active sources were indexed from local Desktop paths as an initialization step. The application cannot watch the user’s desktop and it cannot update the connected OneDrive folder yet.

The intended canonical location is the shared OneDrive/SharePoint folder previously supplied by Kalena, under `kgardner@discoverultrium.com` and shared with Paris.

Correct future behavior:

```text
OneDrive folder changed
  → Microsoft Graph delta scan
  → Bleuprint stores snapshot and extracted entries
  → comparison/mismatch record created as needed
  → human reviews and approves a specific change
  → approved update writes to a versioned or explicitly selected OneDrive file
```

Never auto-overwrite canonical source documents. Drafts, proposed updates, and approved write-backs need separate states.

### Buffer

- `BUFFER_API_KEY` was added to Vercel by Kalena.
- The app has `/api/buffer/sync`, but a meaningful end-to-end sync with actual Buffer profiles and the live calendar has not been verified.
- Do not say Buffer is fully connected until a real scheduled/published post is matched against a calendar record and a metric/event is visible in the portal.

### CRM

**Not built.** There is no CRM in the current product. Do not describe the source registry, calendar, or portal memory as a CRM.

For the first CRM phase, use a simple, explicit `Contacts / Organizations / Opportunities / Interactions` model. Microsoft Lists could be a low-cost canonical store if OneDrive/SharePoint is already the team’s home. Do not introduce a separate CRM platform until the team decides it is needed.

### Notifications

- In-app notifications exist for mentions and updates.
- Email notifications do not yet send. Records currently carry an `email_state` that honestly says a connector is still required.
- Intended recipients: `kgardner@discoverultrium.com` and `paris@ultriumtechnologies.com`.

### AI bots

No ChatGPT, Claude, Copilot, or agent bot is directly connected to Bleuprint yet. The system currently uses deterministic extraction and checking, not hidden autonomous intelligence. This is intentional: it prevents fabricated certainty.

## 5. Architecture and important files

### Repository root

`/Users/gardner/.codex/.chatgpt-projects/g-p-6a99fc977df481919cb3d34faecd1eb8/bleuprint-deploy`

### Server-side storage

- Neon Postgres is the operational store.
- Vercel Blob is used when available for uploaded binary/source files; readable sources can fall back to database text storage.
- The database schema lives in `lib/db.js`.

Core tables:

- `bleuprint_workspace_state`
- `bleuprint_documents`
- `bleuprint_memory_entries`
- `bleuprint_mismatches`
- `bleuprint_audit_events`
- `bleuprint_notifications`
- `bleuprint_performance_metrics`
- `bleuprint_source_snapshots`

### Key application files

| Purpose | File |
|---|---|
| Outer server-backed portal shell | `app/admin/portal-shell.jsx` |
| Real workspace panels | `app/admin/workspace-panels.jsx` |
| Static visual map / prototype | `app/admin/experience/portal.html` |
| Prototype bridge and safety fixes | `app/admin/experience/route.js` |
| Shared portal styling | `app/portal.css` |
| Database schema | `lib/db.js` |
| Deterministic source extraction | `lib/passport-memory.js` |
| Calendar parsing and seed plan | `lib/passport-content.js` |
| Upload/source API | `app/api/sources/route.js` |
| Shared calendar/campaign API | `app/api/workspace/route.js` |
| Analyzer API | `app/api/analyze/route.js` |
| Issues API | `app/api/issues/route.js` |
| Archive API | `app/api/archive/route.js` |
| Performance API | `app/api/performance/route.js` |
| Buffer sync API | `app/api/buffer/sync/route.js` |
| Connector status API | `app/api/connectors/route.js` |

### Clean activation script

`scripts/archive-demo-and-bootstrap-passport.mjs` was run once on 9 September 2026.

It did the following without deleting records:

- preserved the previous workspace state in `archive_snapshot_demo_2026_09_09`
- soft-archived active demo documents and memory
- archived open/assigned demo issues
- cleared active calendar/campaign state
- indexed only the six selected real Passport sources
- seeded the 11-row Week One calendar
- recorded an audit event

Do **not** re-run this script on a live workspace. It is an initialization/migration script, not a recurring sync.

There are older untracked helper scripts and generated workbook outputs. They were not committed and should not be added accidentally. In particular, do not run any script that uses SQL `DELETE` to “clean” the workspace.

## 6. Current user-facing truth

The portal is usable today for:

- reviewing source-backed Passport memory
- editing memory with explicit provenance
- editing the shared content calendar
- creating campaigns from calendar rows
- assigning/resolving/archiving real issues
- archiving and restoring records
- seeing in-app mention notifications

It is **not** yet usable for:

- automatic folder ingestion from OneDrive
- canonical document write-back
- email notifications
- real Buffer-derived publishing/performance monitoring
- a CRM workflow
- direct ChatGPT/Claude/Copilot agent action
- treating the center prototype card as an editor

## 7. Required next implementation order

Work in this order. Do not redesign the visual system first.

### Phase A — Complete the functional feedback loop

1. Make each selected map node open a server-backed record list/detail view, rather than a static demo card.
2. Make real comments/discussion save to the database and create notifications from `@mentions`.
3. Make `Resolve`, `Bypass`, `Archive`, and `Restore` visible from the relevant source/issue/detail context, not only from a separate panel.
4. Extend the history view to show **previous value → new value**, actor, time, document, and exact source location for calendar/memory/source changes.
5. Ensure each content campaign is permanently linked to its calendar row and preserves approval/archive state.
6. Add explicit empty states. Bleuprint must say “no source exists yet” rather than inventing a schedule, performance result, or strategy fact.

Acceptance check:

```text
Upload a real source → see extracted entries with source locations →
confirm one entry → edit a content row → build campaign → archive it →
restore it → see every event in history with actor and timestamp.
```

### Phase B — Microsoft / OneDrive authorization

Use Microsoft Graph delegated access. Kalena will need to create/authorize a Microsoft Entra application one time.

Recommended narrow first permission set:

- `User.Read`
- `Files.ReadWrite`
- optional later: `Mail.Send` for email notifications

Avoid tenant-wide SharePoint permissions or broad application permissions unless the team has a clear reason and an admin approves them.

Add:

- `/api/microsoft/connect`
- `/api/microsoft/callback`
- encrypted token storage, with refresh support
- folder selection UI for the Passport canonical folder
- Graph delta polling/webhook strategy
- source snapshot + diff creation
- a review queue for changed files
- manual “sync now” first; scheduled sync only after that works

Required user experience:

- “Last synced from OneDrive at…”
- each entry says whether it is current, changed, stale, or not yet indexed
- no automatic write-back
- an approved draft can be exported or explicitly written to a selected canonical file
- a write-back has a preview, actor, reason, source link, and version record

### Phase C — Content / Buffer / performance

1. Discover Buffer channels/profile identifiers through the existing API key.
2. Map each Buffer profile to Instagram, TikTok, or LinkedIn.
3. Add a stable external post ID to a calendar row once scheduled/published.
4. Sync only status and available analytics into performance records.
5. Define meaningful metrics by platform: reach, views, watch time, saves, shares, clicks, comments, follower change, and LinkedIn impressions/engagement.
6. Show a three-day warning when the calendar has no planned work.

Never auto-publish substantive content. Passport’s existing canonical policy requires human approval for substantive posts.

### Phase D — CRM and opportunities

Build only after Phase B is stable.

Minimum CRM records:

- Person / organization
- Relationship type
- Opportunity / program / grant / accelerator
- Stage, deadline, owner, source URL, eligibility evidence
- Last interaction / next action
- linked Passport documents and campaign context

For this week, the Opportunity area should focus on Detroit startup accelerators, first-time founder grants, and high-signal quick opportunities. It needs a source, deadline, eligibility, owner, next action, and evidence; not an unverified “opportunity” suggestion.

## 8. Files still worth creating

Store these in the eventual OneDrive Passport folder, not as arbitrary portal text.

1. `PASSPORT_SOURCE_REGISTRY.md` — documents, owner, authority, location, update cadence, supersedes.
2. `PASSPORT_DECISION_LOG.md` — decision, reason, impact, owner, date, linked source/change.
3. `PASSPORT_OPPORTUNITY_TRACKER.xlsx` — opportunity, deadline, eligibility, evidence, owner, stage, next action.
4. `PASSPORT_PERFORMANCE_REVIEW.xlsx` — exported/backup performance record, not the manual primary workflow.
5. `PASSPORT_CRM_REGISTER.xlsx` or a Microsoft List — only when CRM Phase D starts.
6. `PASSPORT_CONTENT_CALENDAR.xlsx` — a structured calendar for automation, while the portal remains the more usable visual interface.

Excel is not intended to be the experience. It is the reliable interchange format for OneDrive, Microsoft Copilot, Buffer mapping, and automation. The portal should render it as a useful experience.

## 9. Guardrails for the next builder

1. No broad reset, rewrite, or new visual concept without explicit approval.
2. No fake “connected,” “synced,” “AI analyzed,” “saved,” “published,” or “write-back” language.
3. Do not destroy existing data. Archive and retain a restore path.
4. Do not silently modify canonical source files.
5. Do not infer authority, ownership, dates, proof, approval, or brand facts from a document unless it explicitly says them.
6. Every automated finding must carry evidence, source name, source location, severity, and a recommended resolution.
7. Every source change must visibly state what changed, where, by whom, when, and whether it affected strategy/memory.
8. Both Kalena and Paris can edit/archive; sensitive publishing and external contact still requires a defined approval gate.
9. Keep the current visual language, but replace static internal behavior with server-backed records rather than layering more patches over the prototype.
10. Verify production after every deploy. This Vercel project currently needs a manual force-promotion due to the legacy Clerk DNS requirement.

## 10. Immediate handoff prompt

Use this as the first instruction for the next builder:

> Read `PASSPORT_TAKEOVER_CONTEXT.md` in full before changing code. Preserve the current visual direction and do not redesign the portal. Treat `app/admin/experience/portal.html` as a static visual map, not a source of operational truth. Build only the next smallest server-backed feedback-loop capability: map node → real record list/detail → real discussion/issue/archive/history. Do not claim Microsoft, Buffer, CRM, email, or AI-agent integration exists until it has been verified end-to-end. Do not delete existing records; archive and preserve restore paths. Every source-derived entry must retain document name, exact location, status (confirmed/extracted/suggested/conflict/needs decision), and actor/time provenance.
