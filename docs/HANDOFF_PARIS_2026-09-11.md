# Bleuprint Portal — Handoff to Paris

**Written 11 Sep 2026. From Kalena's build session with Claude, for Paris, who takes the build over from here.**

This is the one document to read, and the one document to paste into whatever AI you build with. It says what the portal is, exactly where the code stands, what to do next in what order, what must never change, and where every other document lives. Where it disagrees with an older document, this one wins.

---

## 0. Paste this into your AI first

> You are taking over the Bleuprint portal build. The full handoff is below. Read all of it before writing code. The build order in section 3 is settled; do not reorder it or redesign settled things. The nine constraints in section 8 survive every change. Nothing is called connected, synced, saved or published until it has been verified end to end. No `DELETE` anywhere, ever. Canonical source documents are never auto-overwritten; a person approves first. Before each item, state the first action you will take, then do it. Commit with clear messages. Every Vercel deploy shows "Checks Failed" because of a legacy Clerk DNS requirement; that is not a build failure, promote it and verify production.

---

## 1. What this is

Bleuprint is Kalena Gardner's Detroit brand strategy studio. The portal at `https://www.bleuprintco.com/admin` is the operating intelligence layer for the ventures Bleuprint runs. Passport (AI-agent authorization, an Ultrium subsidiary) is the first venture inside it, and the structure must become reusable for the next one.

The portal exists to make one loop readable: a decision is logged → content goes out under it → the post is measured (reach, then site visits, then leads, then deals) → drop-off shows where people leave → outreach is refined → the decision log is read against the outcomes so the decisions that worked are visible and repeatable. Every connector is a link in that chain.

It keeps the difference between a source fact, a confirmed decision, an AI suggestion, a conflict and an open question. It is not a to-do list and not a generic AI dashboard.

Members: Kalena (`kgardner@discoverultrium.com`, owner) and Paris (`paris@ultriumtechnologies.com`, strategist). Both are hardcoded in `lib/members.js`.

---

## 2. Where the code stands, 11 Sep 2026

**Repo** `Bleuprintapp/Bleuprint`, branch `main`. **Production** Vercel project `bleuprint`, domain `www.bleuprintco.com`.
**Kalena's local clone** `~/.codex/.chatgpt-projects/g-p-6a99fc977df481919cb3d34faecd1eb8/bleuprint-deploy` (her Mac has git but no Node).

| Commit | What | State |
|---|---|---|
| `381d5e6` | Microsoft delegated authorization (OAuth, token encryption, status that proves the token works) | Live |
| `6ec3642` | This Week, derived from dated plan documents | Live |
| `256d4bb` `3bb41ef` | Content row tables (`lib/content-schema.js`) and migration script | Live |
| `aad59f8` | Migration prints a plain message when the database is unreachable | Live |
| `9827469` | Migration runs from the browser, owner only: `/api/admin/migrate-content-rows` | **Live, promoted 10 Sep evening** |

**Dry run has been executed against production** and returned: `12 calendar rows · 1 campaign · LinkedIn 5, Instagram 4, TikTok 3 · 1 campaign output, 0 orphans`. **The apply has not been run.** Nothing has been written to the new tables yet. See section 3, item 1.

### Stack

Next.js 16 (Turbopack) on Vercel. Neon Postgres through `@neondatabase/serverless` (HTTP driver, tagged-template `sql`). Vercel Blob for uploads with database text fallback. Bespoke auth: `lib/server-member.js` reads a `bleuprint_session` cookie, hashes it, looks it up in `bleuprint_sessions`. Clerk is legacy and only causes the "Checks Failed" noise.

### Tables

Existing: `bleuprint_workspace_state` (key/value JSON per workspace; `calendar` and `campaigns` keys are the old blobs), `bleuprint_documents`, `bleuprint_memory_entries`, `bleuprint_mismatches`, `bleuprint_audit_events`, `bleuprint_notifications`, `bleuprint_performance_metrics`, `bleuprint_source_snapshots`, `bleuprint_members`, `bleuprint_sessions`, `bleuprint_connector_tokens`, `bleuprint_connector_folders`.

New, created on first apply by `ensureContentSchema` in `lib/content-schema.js`:

- `bleuprint_content_rows` — one row per post per platform. Keeps every old blob field losslessly (`caption_a`/`caption_b` from the old `copy.a`/`copy.b`, `date_text` plus a parsed `scheduled_on`, `source_document`/`source_location`, `buffer_post_id`/`buffer_status`/`buffer_due_at`, `archived_at`).
- `bleuprint_campaigns` — a campaign spans several rows. Approval on a campaign stamps every row beneath it.
- `bleuprint_campaign_outputs` — one per campaign per row, `content_row_id NOT NULL` (the required link is output → row; a row may exist before its campaign).
- `bleuprint_record_revisions` — `record_type, record_id, field, previous_value, next_value, actor_email, reason, source_name, source_location, created_at`. Every accepted field change writes one.

### Key files

| Purpose | File |
|---|---|
| Portal shell (fetches 9 endpoints every 10s) | `app/admin/portal-shell.jsx` |
| All panels, incl. `MicrosoftConnection`, `ThisWeekPanel`, `CampaignPanel` | `app/admin/workspace-panels.jsx` |
| Compiled 1.08 MB visual prototype (static map, to be replaced) | `app/admin/experience/portal.html` |
| Styling and tokens | `app/portal.css` |
| Schema for the old tables | `lib/db.js` |
| Content row schema and blob→row mapping | `lib/content-schema.js` |
| Migration logic, shared by script and route | `lib/migrate-content-rows.js` |
| This Week derivation | `lib/this-week.js`, `lib/roadmap-source.js` |
| Microsoft OAuth, token encryption, Graph fetch | `lib/microsoft.js` |
| Whole-array workspace save (the overwrite defect lives here) | `app/api/workspace/route.js` |
| Buffer inbound, unverified, read only | `app/api/buffer/sync/route.js` |
| APIs | `app/api/{sources,workspace,memory,roadmap,analyze,issues,archive,performance,connectors,notifications,this-week,buffer/sync,microsoft/*,admin/migrate-content-rows}` |

### Known defects (fix as part of items 1 to 3, do not build on top of them)

1. Calendar and campaigns are whole JSON arrays; every edit rewrites the whole array with no version check, so two people editing means the later save silently wins.
2. `portal-shell.jsx` listens for a `bleuprint:state-changed` postMessage from the static prototype and saves whatever it is handed to key `bleuprint.passport.calendar`, unvalidated.
3. `app/api/workspace/route.js` passes `JSON.stringify(value)` to `createMentionNotifications`, so any row containing `@paris` notifies Paris on every save of anything.
4. There is no comments table.

---

## 3. Next steps, in order

Each item says when it is done. Do not start the next one until the "done when" is true in production.

**1 · Apply the content row migration, then switch the app to read rows.**
The route is owner-only. Either Kalena opens `https://www.bleuprintco.com/api/admin/migrate-content-rows?apply=yes&confirm=12` while signed in (it writes 12 rows, 1 campaign, 1 output, copies both blobs to `archive_calendar_blob_<date>` and `archive_campaigns_blob_<date>`, and prints `original blobs still present: yes`), or you widen the role check in `app/api/admin/migrate-content-rows/route.js` to include `strategist` and run it yourself. Then change the read paths (`/api/workspace` consumers, `CampaignPanel`, This Week) to read `bleuprint_content_rows` instead of the `calendar` blob. Keep the blob readable.
*Done when:* the portal shows the same 12 rows from the new table, the blob keys still exist untouched, and `bleuprint_record_revisions` has one `migrated` row per content row.

**2 · Row-level saves with conflict detection.**
`PATCH /api/content/[id]` with body `{ changes, expectedUpdatedAt, reason }`. If `expectedUpdatedAt` is older than the row's `updated_at`, return `409` with the current row and `updated_by`. Every accepted field change writes a revision. Editable fields are the `CONTENT_ROW_EDITABLE` list in `lib/content-schema.js`.
*Done when:* two browsers editing the same row produce a readable conflict message naming the other editor, never a silent overwrite.

**3 · Cut the prototype write path and scope mention scanning.**
Remove the `bleuprint:state-changed` handler in `portal-shell.jsx` (the prototype becomes read-only). Change mention scanning to run only over the fields that actually changed (`detail.changes`), not the serialized state.
*Done when:* editing any row no longer notifies Paris unless the changed text contains `@paris`, and the prototype cannot alter the calendar.

**4 · Buffer outbound.**
Push one content row into Buffer's queue (GraphQL, `api.buffer.com`, Bearer `BUFFER_API_KEY` in Vercel), store the returned post id on `buffer_post_id`, let the existing sync pull status and metrics back into `bleuprint_performance_metrics`. There is no Buffer MCP; this is a direct API integration. The inbound sync has never run successfully; verify it first.
*Done when:* one row scheduled from the portal appears in Buffer's queue, and its status and reach come back onto the row without anyone typing them.

**5 · Carousel pipeline through Canva.**
Canva is connected with `search-brand-templates` (`dataset: non_empty`), `get-brand-template-dataset`, `autofill-design`, `export-design`, and the tagging chain `create-brand-template-draft` → tag elements with `autofill_field_label` → `publish-brand-template`. Existing designs get tagged, not rebuilt. The portal owns which format and what text goes in each slot; Canva owns rendering. **Start with Format 02, "Keep the Human in Charge"** (7 slides, most fixed structure, largest backlog). See section 7.
*Done when:* a Format 02 row's slot text autofills a tagged template and exports a PNG set without anyone opening Canva.

**6 · The four rooms.** This Week (built), Work (content + performance, one room, because a post and its result are the same row at two moments), Record (signals + change history + decisions, one room), Ask Bleu. Connections move into a Settings drawer under the member's name. Roadmap stops being a room; it is the input to This Week.

**7 · Rebuild the centre map small.** Replace `app/admin/experience/portal.html` with a hand-written component drawing real nodes linked to real records. This is the only way the overlapping bubbles and the stray bottom tab get fixed.

**8 · Microsoft folder sync.** Authorization done. Build: folder picker → Graph delta scan → source snapshot and diff → review queue → "last synced at" → per-entry state (current / changed / stale / not indexed). Manual "sync now" first; scheduled only after that works. Approved write-back to a canonical file carries a preview, actor, reason, source link and version record. **Never automatic.**

**9 · Ask Bleu and the in-app alignment engine.** One brain, exposed twice: a chat surface and a nightly in-app check that flags working files against the canonical context and decision log (quote both sides, severity, suggested fix, never edits). Also the content and brand strategy agent, connected to the canonical context, content calendar, decision log, brand strategy summary, and, once item 4 works, platform analytics. One model key goes into Vercel here (Claude via API is approved). Copilot is a reader of the same OneDrive files, never the engine.

**10 · Scout inside the app.** The weekly opportunity scan (currently a Cowork routine, section 6) becomes a portal feature writing to a CRM-shaped opportunity table.

**11 · Site analytics, CRM, Stripe.** In that order: visit, lead, deal. The content engine's measurement table (section 7) is the spec for the events: Meta Pixel and Conversions API with the same `event_id`, fired from the existing signup route handlers, Lead event first.

**0 · Intake (goals capture).** Runs in parallel with the above; Kalena is defining the questions. Every engagement starts with: mission in one sentence, who it is for and not for, what may never be claimed and what proof is accepted, ninety-day goals with dates, channels and cadence, who approves, what "converting" means and where it is measured, palette/type/imagery rules, the two or three things the founder would never change. Stored as records with provenance, not a form.

---

## 4. Environment, all of it known

- **Every Vercel deploy shows "Checks Failed."** Legacy Clerk DNS Configuration requirement, not a build failure. Vercel → project `bleuprint` → Deployments → the row's `⋯` menu → **Promote** (the confirmation names the requirement) → then open production and verify. Instant Rollback is in the same menu.
- **Kalena's Mac has no Node.** Anything that must run against the database runs either on Vercel (as an owner-only route, the pattern in `app/api/admin/`) or on your machine.
- **The Cowork VM that mounts the repo** cannot run `next build` (no npm registry, macOS binaries), cannot reach Neon, and has no GitHub credentials. Vercel's build is the real check.
- **Higgsfield CDN is blocked** from sandboxes; generated images are saved by hand into `public/`.
- **Env vars in Vercel Production:** `DATABASE_URL` and the Neon set · `BUFFER_API_KEY` · `MS_CLIENT_ID` · `MS_TENANT_ID` · `MS_REDIRECT_URI` (`https://www.bleuprintco.com/api/microsoft/callback`) · `MS_CLIENT_SECRET` (Secret). Code reads `MS_*` with `MICROSOFT_*` fallback. Entra app is single tenant under Ultrium, delegated `User.Read Files.ReadWrite offline_access`; `offline_access` is required or the connection dies in an hour. The client secret was rotated on 10 Sep after being pasted in a chat; never paste secrets in chat.
- **Access you need from Kalena (her clicks):** GitHub → `Bleuprintapp/Bleuprint` → Settings → Collaborators → add Paris. Vercel → team `bleuprint` → Settings → Members → invite Paris. Neon is reachable through Vercel's env vars; no separate login needed.

---

## 5. Connectors and where each one sits in the chain

| Connector | State | Link in the chain |
|---|---|---|
| Microsoft 365 (OneDrive) | Authorized, verified token; sync not built | Canonical folder |
| Canva | Connected (Cowork MCP); in-app pipeline not built | Carousel rendering |
| Buffer | Key in Vercel; inbound unverified; outbound not built | Post → reach, platform analytics |
| Meta Pixel + CAPI | Not built | Reach → visit → email |
| Site analytics | Not connected | Page drop-off |
| CRM | Not built | Visit → lead |
| Stripe | Not connected | Lead → deal |

---

## 6. What runs outside the app today

Two scheduled Claude routines, bound to Kalena's Mac with `/Users/gardner/Desktop/Passport` attached, both now **daily**:

- **Scout**, 7am ET. Verifies the six seeded rows in `04_Capital/PASSPORT_OPPORTUNITY_TRACKER.xlsx` against program pages (max 8 searches), adds only fully verified rows, writes `00_Canonical/SCOUT_<date>.md`.
- **Alignment check**, 7pm ET. Reads files changed in the last 26 hours against `00_Canonical/PASSPORT_CANONICAL_CONTEXT.md` and `DECISION_LOG.md`, writes `00_Canonical/ALIGNMENT_<date>.md` with two-sided quoted findings. Flags only, never edits.

The agents have no memory of their own; they open the Desktop files fresh every run. Keeping `00_Canonical` current is what keeps them current. Item 9 brings the same brain into the app reading database records.

**The Desktop folder `/Users/gardner/Desktop/Passport` is canonical.** OneDrive mirrors it until item 8 exists. `00_Canonical/` holds `PASSPORT_CANONICAL_CONTEXT.md`, `DECISION_LOG.md`, `OPEN_QUESTIONS.md`, `FILE_REGISTRY.md`; `02_Content/` holds the content calendar and the new content engine tracker; `04_Capital/` the opportunity tracker; `03_Assets/Plates/` four background plates.

---

## 7. The content engine, 10 Sep, and what it changes for the backend

Kalena's content strategy was revised in a separate session and filed as `PASSPORT_CONTENT_ENGINE_v1_20260910.md` (project doc `claude/passport-content-engine.md`) plus a tracker `02_Content/PASSPORT_CONTENT_ENGINE_TRACKER_v1_2026-09-10.xlsx` with sheets Posting schedule, Formats, Funnel setup, Weekly loop, Legend. It supersedes the teaser arc and the launch-week grid. It covers 11 to 26 Sep: 14 posts, three fixed carousel formats (01 The Incident, Tuesday; 02 Keep the Human in Charge, Thursday; 03 The Receipt, Saturday), one proof label per asset, one next step in two places, one permanent keyword per format (`BRIEF`, `PROMPTS`, `CHECK`).

What this means for the build:

1. **The 12 rows in the database are the old Week One plan.** After item 1, the tracker's Posting schedule sheet is the source for the next batch of rows. Import it (one row per date × platform) rather than retyping. Keep the 12 old rows; archive the ones the engine retired.
2. **Two columns the row model lacks:** a format code (`01`, `02`, `03`, `funnel`, `field note`, `legacy`) and a `next_step` (the keyword or action that goes on the last slide and caption line one). Add both to `bleuprint_content_rows` and `CONTENT_ROW_EDITABLE`. Proof label already fits `proof`.
3. **The tracker's result columns** (Reach, Keyword comments, Emails captured) are what Buffer sync (item 4) and the Meta events (item 11) populate. They are not typed by hand; until the connectors exist the portal shows them as missing, not zero.
4. **Canva pipeline (item 5) targets Format 02 first**, exactly as the engine says: 7 slides, structure "mistake → what people write instead → why it does not hold → the fix as copyable text → what it looks like when it fires → which of the five bounds → next step card". Slot names come from that structure.
5. **The measurement table** in the engine (PageView, ViewContent, Lead, CompleteRegistration, custom VerifyReceipt and PilotRequest; Pixel and CAPI sharing `event_id`) is the spec for item 11. Pixel plus Lead first, CAPI second.
6. **The weekly loop** (Monday, twenty minutes; step six is "write the decision in the decision log with the numbers beside it") is the Record room's core use case in item 6. Design Record around that row.
7. Keyword-comment automation (auto DM on `BRIEF`/`PROMPTS`/`CHECK`) is an external Instagram/TikTok automation tool, not portal code. The portal only needs to store which keyword each row carries.

---

## 8. Constraints that survive every change

1. Uploading a document never silently turns AI inference into brand truth. Routing and extraction are fine; authority needs a person.
2. Nothing is described as connected until it has been verified end to end.
3. Never show a number without a source.
4. Canonical source documents are never auto-overwritten. Drafts, proposals and approved write-backs are separate states.
5. Archive and keep a restore path. No `DELETE` to clean a workspace. Never re-run `scripts/archive-demo-and-bootstrap-passport.mjs` on a live workspace.
6. Empty states say what is missing rather than drawing a zero.
7. Every automated finding carries evidence, source name, source location, severity and a recommended resolution.
8. Both Kalena and Paris can edit and archive. Publishing and external contact pass an approval gate.
9. No fake "connected", "synced", "AI analyzed", "saved", "published" or "write-back" language anywhere in the UI.

Plus: Passport is in stealth. Nothing in the portal contacts anyone, submits anything or posts anywhere without the approval gate.

---

## 9. Design, the short version

Full detail in `bleuprint-portal-design-language.md` (project doc), including a Corrections section of mistakes already made. Warm photographic plate, glass cards of varied sizes stacked and offset over it, a top bar with the profile, headline sitting directly on the photograph, a small update bubble that flies in. A scrollable field, not a carousel. Opening a card is a lateral sweep with directional motion blur from real per-frame velocity, not a modal and not a scale-up. Logo is the Bleuprint gold crown at `public/assets/brand/bleuprint-mark.jpg`, not the emerald ring in `portal.css` and not Passport's dial. Cards are varied rectangles, never uniform thin rows. Headline width capped. Images inside the small cards; the photograph stays the background. Plates swappable from `03_Assets/Plates/`. Kalena keeps latitude to refine; build tokens, swappable plates and data-driven card sizes so she can. Latest approved mock: the "Bleuprint Hub" artifact (v3).

---

## 10. Open, waiting on a person

- The migration apply (section 3, item 1): Kalena opens the address, or the role check is widened for Paris.
- Intake questions (item 0): Kalena is refining the proposed list.
- Content engine open calls 4 to 9 in `passport-content-engine.md` section 6 (Saturday carousel slide 8, motion cards, the Mon 14 reveal, pinning a comment on the posted explainer, the NBC citation). Kalena's calls, not build work.
- No canonical OneDrive folder has been picked for Microsoft sync; the Desktop folder is canonical until item 8.
- The mark's centre dot: SVG reads 11.2% of radius, spec says 17.6%. Paris's call.
- Deferred on purpose: client sales deck, full scope spec, competitive analysis. After there is a working product to describe.

---

## 11. Where the other documents live

All in the claude.ai project **YourPassport**, folder `claude/`:

| Doc | Role |
|---|---|
| `bleuprint-portal-handoff-paris.md` | This file. Read first. |
| `passport-portal-fable-brief.md` | Original build brief, 10 Sep. Section 2 status is superseded by this file; sections 3 to 8 still apply. |
| `bleuprint-portal-build-backlog.md` | Running list beneath the brief; updated as items close. Update it when you close one. |
| `bleuprint-portal-design-language.md` | Full design spec with Corrections. |
| `passport-content-engine.md` | The 10 Sep content strategy, 44 captions in its artifact. |
| `passport-canonical-context.md`, `passport-brand-strategy-summary.md`, `passport-positioning-decision-memo.md` | What Passport is and may claim. |
| `passport-mission-initiative-plan.md`, `passport-build-out-roadmap.md` | Dated plans that drive This Week. |
| `passport-build-status.md`, `passport-phase-a-plan.md` | Earlier status; historical. |

The venture's files live on Kalena's Desktop at `/Users/gardner/Desktop/Passport`, mirrored to OneDrive.
