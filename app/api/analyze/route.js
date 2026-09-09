import { NextResponse } from "next/server";
import { getServerMember } from "../../../lib/server-member";
import { ensureSchema, getSql } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORKSPACE = "passport";
const PROOF_LABELS = [
  "Scenario",
  "Lab demonstration",
  "Sourced report",
  "Design partner result",
  "Customer case",
  "No claim",
];
const PROOF_PATTERN = /\b(?:scenario|lab demonstration|sourced report|design partner result|customer case|no claim)\b/i;
const PROOF_PATTERN_GLOBAL = /\b(?:scenario|lab demonstration|sourced report|design partner result|customer case|no claim)\b/gi;
const PLACEHOLDER_PATTERN = /\[(?:OUTLET|DATE)\]/i;
const STEALTH_PATTERNS = [
  ["founder", /\b(?:founder|co-founder|founding team)\b/i],
  ["customer", /\b(?:customer|client|production customer)\b/i],
  ["investor", /\b(?:investor|funded|funding|raised|backed by|venture-backed)\b/i],
  ["architecture", /\b(?:architecture|infrastructure|tech stack|built on|powered by)\b/i],
  ["partnership", /\b(?:partnered with|partnership|strategic partner|design partner)\b/i],
];
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function asArray(value) {
  if (typeof value === "string") {
    try { return asArray(JSON.parse(value)); } catch { return []; }
  }
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function compactText(parts) {
  return parts.flat(Infinity).filter(value => typeof value === "string" && value.trim()).join("\n").trim();
}

function objectText(value, ignored = new Set(), seen = new Set()) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) return compactText(value.map(item => objectText(item, ignored, seen)));
  return compactText(Object.entries(value).filter(([key]) => !ignored.has(key)).map(([, item]) => objectText(item, ignored, seen)));
}

function isSubstantive(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length >= 80 || clean.split(" ").filter(Boolean).length >= 14;
}

function stealthRisks(text) {
  // Evidence labels themselves are required and are not treated as disclosure claims.
  const copyWithoutLabels = String(text || "").replace(PROOF_PATTERN_GLOBAL, "");
  return [...new Set(STEALTH_PATTERNS.filter(([, pattern]) => pattern.test(copyWithoutLabels)).map(([kind]) => kind))];
}

function hasValue(value) {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasValue);
  if (!value || typeof value !== "object") return false;
  if (value.state && /uploading|failed|temporary/i.test(String(value.state))) return false;
  return Boolean(value.pathname || value.url || value.downloadUrl || value.name || value.id || value.state === "stored");
}

function platformName(value) {
  const name = normalized(value);
  if (name.includes("instagram") || name === "ig") return "Instagram";
  if (name.includes("tiktok") || name === "tt") return "TikTok";
  if (name.includes("linkedin") || name === "li") return "LinkedIn";
  return String(value || "Unknown output");
}

function platformPrefix(platform) {
  return platform === "Instagram" ? "ig" : platform === "TikTok" ? "tt" : "li";
}

function campaignLabel(campaign) {
  return String(campaign?.theme || campaign?.title || campaign?.name || campaign?.id || "Untitled campaign");
}

function campaignRows(calendar, campaign) {
  const id = String(campaign?.id || "");
  const calendarId = String(campaign?.calendarId || "");
  const campaignKey = String(campaign?.campaignKey || "");
  const calendarIds = new Set(asArray(campaign?.calendarIds).map(String));
  return calendar.filter(row => {
    const rowId = String(row?.id || ""), rowKey = String(row?.campaignKey || row?.campaignId || row?.campaign_id || "");
    return (calendarId && rowId === calendarId) || calendarIds.has(rowId) || (campaignKey && rowKey === campaignKey) || (id && rowKey === id);
  });
}

function outputFor(campaign, platform) {
  const outputs = campaign?.outputs && typeof campaign.outputs === "object" ? campaign.outputs : {};
  const prefix = platformPrefix(platform);
  return outputs[platform.toLowerCase()] ?? outputs[platform] ?? outputs[prefix];
}

function platformCopy(campaign, platform, rows = []) {
  const prefix = platformPrefix(platform);
  const copy = campaign?.copy && typeof campaign.copy === "object" ? campaign.copy : {};
  const selectedCopy = Object.entries(copy)
    .filter(([key]) => key.toLowerCase() === prefix || key.toLowerCase().startsWith(prefix))
    .map(([, value]) => objectText(value));
  const output = outputFor(campaign, platform);
  const outputCopy = objectText(output, new Set(["type", "format", "structure", "assets", "media", "files"]));
  const rowCopy = rows
    .filter(row => platformName(row?.channel || row?.platform) === platform)
    .map(row => compactText([row.title, row.copy, row.caption, row.script, row.body, row.text, row.description, row.proof, row.proofLabel]));
  return compactText([campaign?.theme, campaign?.title, campaign?.proof, campaign?.proofLabel, selectedCopy, outputCopy, rowCopy]);
}

function platformAssets(campaign, platform) {
  const prefix = platformPrefix(platform);
  const assets = campaign?.assets && typeof campaign.assets === "object" ? campaign.assets : {};
  return Object.entries(assets).filter(([key]) => key.toLowerCase() === prefix || key.toLowerCase().startsWith(prefix));
}

function outputFormat(campaign, platform, rows = []) {
  const output = outputFor(campaign, platform);
  return normalized(output?.type || output?.format || rows.find(row => platformName(row?.channel || row?.platform) === platform)?.format || "text");
}

function expectedPlatforms(campaign) {
  const outputs = campaign?.outputs && typeof campaign.outputs === "object" ? campaign.outputs : {};
  const expected = new Set();
  for (const key of Object.keys(outputs)) expected.add(platformName(key));
  if (outputFor(campaign, "Instagram")) expected.add("Instagram");
  if (outputFor(campaign, "LinkedIn")) expected.add("LinkedIn");
  // A null TikTok output beside an Instagram Reel means one shared video, not no TikTok handoff.
  if (Object.prototype.hasOwnProperty.call(outputs, "tiktok") || Object.prototype.hasOwnProperty.call(outputs, "TikTok") || outputFor(campaign, "TikTok")) expected.add("TikTok");
  const declaredPlatforms = asArray(campaign?.platforms || campaign?.channels);
  for (const platform of declaredPlatforms) expected.add(platformName(platform));
  if (!expected.size) for (const platform of ["Instagram", "TikTok", "LinkedIn"]) expected.add(platform);
  return [...expected].filter(platform => platform !== "Unknown output");
}

function productionGaps(campaign, platform, rows = []) {
  const prefix = platformPrefix(platform);
  const format = outputFormat(campaign, platform, rows);
  const output = outputFor(campaign, platform) || {};
  const copy = campaign?.copy && typeof campaign.copy === "object" ? campaign.copy : {};
  const assets = Object.fromEntries(platformAssets(campaign, platform));
  const gaps = [];
  const carousel = /carousel/.test(format);
  const video = /reel|video|motion|talking/.test(format);

  if (platform === "LinkedIn") {
    if (!hasValue(copy.li || copy.linkedin || output.copy || output.text || output.caption)) gaps.push("LinkedIn copy");
    if (/carousel|image|video/.test(format) && !Object.values(assets).some(hasValue) && !hasValue(output.assets) && !hasValue(output.slides?.map(slide => slide.asset))) gaps.push(`${format} asset`);
    return gaps;
  }

  if (platform === "TikTok" && outputFor(campaign, platform) == null && /reel|video/.test(outputFormat(campaign, "Instagram", rows))) {
    const instagramAssets = Object.fromEntries(platformAssets(campaign, "Instagram"));
    if (!hasValue(instagramAssets.igVideo || instagramAssets.video)) gaps.push("shared Instagram Reel file");
    if (!hasValue(copy.ttCaption || copy.tiktokCaption || copy.igCaption)) gaps.push("TikTok handoff caption");
    return gaps;
  }

  if (carousel) {
    if (Array.isArray(output.slides) && output.slides.length) {
      const missingAssets = [], missingCopy = [];
      output.slides.forEach((slide, index) => { if (!hasValue(slide?.asset)) missingAssets.push(index + 1); if (!hasValue(slide?.copy)) missingCopy.push(index + 1); });
      if (missingAssets.length) gaps.push(`slide assets ${missingAssets.join(", ")}`);
      if (missingCopy.length) gaps.push(`slide copy ${missingCopy.join(", ")}`);
      if (!hasValue(output.caption || copy[`${prefix}Caption`])) gaps.push("caption");
      return gaps;
    }
    const structure = asArray(outputFor(campaign, platform)?.structure);
    const count = Math.max(1, structure.length || 5);
    const missingAssets = [];
    const missingCopy = [];
    for (let index = 0; index < count; index += 1) {
      if (!hasValue(assets[`${prefix}${index}`] || assets[`${prefix}Slide${index + 1}`])) missingAssets.push(index + 1);
      if (!hasValue(copy[`${prefix}${index}`] || copy[`${prefix}Slide${index + 1}`])) missingCopy.push(index + 1);
    }
    if (missingAssets.length) gaps.push(`slide assets ${missingAssets.join(", ")}`);
    if (missingCopy.length) gaps.push(`slide copy ${missingCopy.join(", ")}`);
    if (!hasValue(copy[`${prefix}Caption`])) gaps.push("caption");
  } else if (video) {
    if (!hasValue(assets[`${prefix}Video`] || assets[`${prefix}Reel`] || assets.video || output.assets)) gaps.push("video file");
    if (!hasValue(copy[`${prefix}Script`] || copy[`${prefix}Copy`] || output.script)) gaps.push("script or shot notes");
    if (!hasValue(copy[`${prefix}Caption`] || output.caption)) gaps.push("caption");
  } else {
    if (!hasValue(copy[`${prefix}Caption`] || copy[prefix] || output.copy || output.text || output.caption)) gaps.push("copy");
    if (/image|photo|graphic/.test(format) && !Object.values(assets).some(hasValue) && !hasValue(output.assets)) gaps.push("image asset");
  }
  return gaps;
}

function rowProductionGaps(row, campaign) {
  const platform = platformName(row?.channel || row?.platform);
  if (campaign) return productionGaps(campaign, platform, [row]);
  const format = normalized(row?.format);
  const text = compactText([objectText(row?.copy), row?.caption, row?.script, row?.body, row?.text, row?.description]);
  const asset = row?.asset || row?.assets || row?.media || row?.file || row?.fileUrl || row?.assetUrl || row?.videoUrl || row?.imageUrl;
  const gaps = [];
  if (!hasValue(text)) gaps.push(platform === "LinkedIn" ? "LinkedIn copy" : "caption or script");
  if (/carousel|reel|video|motion|image|photo|graphic/.test(format) && !hasValue(asset)) gaps.push(`${format || "media"} asset`);
  return gaps;
}

const RECORD_MATCHERS = {
  "brand foundation": /brand foundation|brand guide|brand strategy|positioning|identity/,
  "content plan": /content plan|content calendar|social plan|posting schedule|week one/,
  roadmap: /roadmap|build plan|launch plan/,
};

function recordCandidates(documents, category) {
  return documents.filter(document => document.is_record && RECORD_MATCHERS[category].test(normalized(`${document.document_type} ${document.name}`)));
}

function recordFor(documents, category) {
  return recordCandidates(documents, category)[0];
}

function evidenceFor(records, kind, fallbackDocument, fallbackLocation) {
  const document = kind === "brand" ? records.brand : kind === "content" ? records.content : records.roadmap;
  return { document: document?.name || fallbackDocument, location: fallbackLocation };
}

function addCheck(checks, seen, input) {
  const evidence = input.evidence || { document: input.evidenceDocument, location: input.evidenceLocation };
  const check = {
    id: input.id,
    code: input.code,
    severity: input.severity || "medium",
    title: input.title,
    message: input.message,
    affectedOutput: input.affectedOutput || "Passport workspace",
    evidenceDocument: evidence?.document || "Bleuprint workspace",
    evidenceLocation: evidence?.location || "Current shared state",
    evidence: {
      document: evidence?.document || "Bleuprint workspace",
      location: evidence?.location || "Current shared state",
    },
    recommendation: input.recommendation,
    requiresJudgment: Boolean(input.requiresJudgment),
  };
  const fingerprint = `${check.code}|${check.affectedOutput}|${check.message}`;
  if (seen.has(fingerprint)) return;
  seen.add(fingerprint);
  checks.push(check);
}

export async function POST(request) {
  const member = await getServerMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const submitted = await request.json().catch(() => ({}));
  await ensureSchema();
  const sql = getSql();
  const [workspaceRows, documents, mismatches] = await Promise.all([
    sql`SELECT state_key, state_value FROM bleuprint_workspace_state WHERE workspace_id = ${WORKSPACE} AND state_key IN ('calendar', 'campaigns')`,
    sql`SELECT id, name, document_type, destination, context, is_record, extraction_state, uploaded_at FROM bleuprint_documents WHERE workspace_id = ${WORKSPACE} ORDER BY uploaded_at DESC`,
    sql`SELECT m.id, m.document_id, m.record_document_id, m.mismatch_type, m.detail, m.source_location, m.status, m.created_at, d.name AS document_name, r.name AS record_name FROM bleuprint_mismatches m JOIN bleuprint_documents d ON d.id = m.document_id LEFT JOIN bleuprint_documents r ON r.id = m.record_document_id WHERE m.workspace_id = ${WORKSPACE} AND m.status = 'open' ORDER BY m.created_at DESC`,
  ]);
  const shared = Object.fromEntries(workspaceRows.map(row => [row.state_key, row.state_value]));
  const sharedCalendar = asArray(shared.calendar);
  const sharedCampaigns = asArray(shared.campaigns);
  const calendar = sharedCalendar.length ? sharedCalendar : asArray(submitted.calendar);
  const campaigns = sharedCampaigns.length ? sharedCampaigns : asArray(submitted.campaigns);
  const sourceMode = sharedCalendar.length || sharedCampaigns.length ? "shared workspace" : "submitted fallback";
  const records = {
    brand: recordFor(documents, "brand foundation"),
    content: recordFor(documents, "content plan"),
    roadmap: recordFor(documents, "roadmap"),
  };
  const brandEvidence = evidenceFor(records, "brand", "Passport Brand Guide", "§6.3 · Evidence labels");
  const contentEvidence = evidenceFor(records, "content", "Shared content calendar", "Campaign and platform handoffs");
  const checks = [];
  const seen = new Set();

  for (const [category, label, recommendation] of [
    ["brand", "brand foundation", "Upload the approved brand guide and mark it as the document of record."],
    ["content", "content plan", "Upload the current content calendar or Week One plan and mark it as the document of record."],
    ["roadmap", "roadmap", "Upload the current roadmap and mark it as the document of record."],
  ]) {
    const candidates = recordCandidates(documents, label);
    if (candidates.length > 1) addCheck(checks, seen, {
      id: `record-duplicate-${category}`,
      code: "multiple_documents_of_record",
      severity: "high",
      title: `More than one ${label} is marked authoritative`,
      message: `${candidates.map(item => item.name).join(", ")} are all marked as documents of record. Bleuprint will not guess which one wins.`,
      affectedOutput: "Live memory",
      evidence: { document: "Bleuprint Memory", location: `${label} · document-of-record status` },
      recommendation: "Open Live memory and reconfirm the single approved source. The other record flags will be cleared automatically.",
      requiresJudgment: true,
    });
    if (!records[category]) addCheck(checks, seen, {
      id: `record-${category}`,
      code: "missing_document_of_record",
      severity: category === "brand" ? "high" : "medium",
      title: `No ${label} document of record`,
      message: `Bleuprint cannot treat any uploaded ${label} source as approved truth yet.`,
      affectedOutput: "Live memory",
      evidence: { document: "Bleuprint Memory", location: `${label} · document-of-record status` },
      recommendation,
      requiresJudgment: true,
    });
  }

  for (const mismatch of mismatches) {
    addCheck(checks, seen, {
      id: `mismatch-${mismatch.id}`,
      code: `open_${mismatch.mismatch_type}`,
      severity: mismatch.mismatch_type === "explicit_value_change" ? "high" : "medium",
      title: mismatch.mismatch_type === "explicit_value_change" ? "An explicit source value changed" : "Source authority needs confirmation",
      message: mismatch.detail,
      affectedOutput: mismatch.document_name,
      evidence: { document: mismatch.record_name || mismatch.document_name, location: mismatch.source_location || "Uploaded source comparison" },
      recommendation: mismatch.mismatch_type === "explicit_value_change" ? "Compare the new value with the current record and explicitly choose which value remains authoritative." : "Select the approved source for this category as its document of record.",
      requiresJudgment: true,
    });
  }

  if (!calendar.length) addCheck(checks, seen, {
    id: "calendar-empty",
    code: "empty_calendar",
    severity: "high",
    title: "The shared content calendar is empty",
    message: "There is no dated production plan for Instagram, TikTok, or LinkedIn.",
    affectedOutput: "Content calendar",
    evidence: contentEvidence,
    recommendation: "Import the approved calendar or add the next planned post before generating production work.",
    requiresJudgment: false,
  });

  const detroitNow = new Date(new Date().toLocaleString("en-US", { timeZone:"America/Detroit" }));
  detroitNow.setHours(0,0,0,0);
  const runwayDate = new Date(detroitNow); runwayDate.setDate(runwayDate.getDate() + 3);
  const linkedInDates = calendar.filter(row => platformName(row?.channel || row?.platform) === "LinkedIn" && !/blocked/i.test(String(row?.status))).map(row => new Date(`${row.date || row.day}T12:00:00`)).filter(date => !Number.isNaN(date.getTime())).sort((a,b)=>a-b);
  const lastLinkedIn = linkedInDates.at(-1);
  if (!lastLinkedIn || lastLinkedIn < runwayDate) addCheck(checks, seen, {
    id: "linkedin-runway",
    code: "linkedin_calendar_runway_low",
    severity: "medium",
    title: "LinkedIn planning runway is under three days",
    message: lastLinkedIn ? `The final scheduled LinkedIn post is ${lastLinkedIn.toLocaleDateString("en-US", { month:"short", day:"numeric" })}; nothing follows it in the shared calendar.` : "No dated LinkedIn post is currently planned.",
    affectedOutput: "LinkedIn content calendar",
    evidence: contentEvidence,
    recommendation: "Plan the next LinkedIn post before the current schedule runs out.",
    requiresJudgment: false,
  });

  const campaignById = new Map(campaigns.filter(item => item?.id).map(item => [String(item.id), item]));

  for (const campaign of campaigns) {
    const label = campaignLabel(campaign);
    const rows = campaignRows(calendar, campaign);
    const expected = expectedPlatforms(campaign);
    const campaignEvidence = {
      document: asArray(campaign?.evidence)[0] || records.content?.name || "Shared campaign record",
      location: `${label} · campaign ${campaign?.id || "without ID"}`,
    };

    if (!rows.length) addCheck(checks, seen, {
      id: `campaign-calendar-${campaign?.id || label}`,
      code: "campaign_without_calendar_entries",
      severity: "high",
      title: "Campaign is not placed on the calendar",
      message: `${label} exists as a campaign, but it has no shared calendar entries.`,
      affectedOutput: label,
      evidence: campaignEvidence,
      recommendation: "Add dated calendar handoffs for every intended platform before production begins.",
      requiresJudgment: false,
    });

    for (const platform of expected) {
      const platformRows = rows.filter(row => platformName(row?.channel || row?.platform) === platform);
      const output = outputFor(campaign, platform);
      const isSharedTikTok = platform === "TikTok" && output == null && /reel|video/.test(outputFormat(campaign, "Instagram", rows));
      if (!output && !isSharedTikTok) addCheck(checks, seen, {
        id: `output-${campaign?.id}-${platform}`,
        code: "missing_platform_workspace",
        severity: "high",
        title: `${platform} production workspace is missing`,
        message: `${label} expects a ${platform} handoff, but no ${platform} output record exists.`,
        affectedOutput: `${label} · ${platform}`,
        evidence: campaignEvidence,
        recommendation: `Create the ${platform} output inside this campaign or explicitly remove ${platform} from the campaign plan.`,
        requiresJudgment: true,
      });
      if (!platformRows.length) addCheck(checks, seen, {
        id: `handoff-${campaign?.id}-${platform}`,
        code: "missing_calendar_handoff",
        severity: "medium",
        title: `${platform} calendar handoff is missing`,
        message: isSharedTikTok ? `${label} uses the Instagram Reel for TikTok, but TikTok still needs its own dated calendar handoff.` : `${label} has a ${platform} workspace but no ${platform} calendar entry.`,
        affectedOutput: `${label} · ${platform}`,
        evidence: campaignEvidence,
        recommendation: `Add a dated ${platform} entry linked to campaign ${campaign?.id || label}.`,
        requiresJudgment: false,
      });

      const gaps = productionGaps(campaign, platform, rows);
      if (gaps.length) addCheck(checks, seen, {
        id: `production-${campaign?.id}-${platform}`,
        code: "incomplete_platform_production",
        severity: platformRows.some(row => /approved|scheduled/i.test(String(row?.status))) ? "high" : "medium",
        title: `${platform} production is incomplete`,
        message: `${label} is missing ${gaps.join("; ")}.`,
        affectedOutput: `${label} · ${platform}`,
        evidence: campaignEvidence,
        recommendation: `Complete the missing ${platform} production fields before approval or scheduling.`,
        requiresJudgment: false,
      });

      const text = platformCopy(campaign, platform, rows);
      if (PLACEHOLDER_PATTERN.test(text)) addCheck(checks, seen, {
        id: `placeholder-${campaign?.id}-${platform}`,
        code: "unresolved_source_placeholder",
        severity: "high",
        title: "Source placeholders are still visible",
        message: `${label} · ${platform} still contains [OUTLET] or [DATE].`,
        affectedOutput: `${label} · ${platform}`,
        evidence: { document: brandEvidence.document, location: "§6.3 · Sourced report requirements" },
        recommendation: "Replace both placeholders with the verified outlet and publication date, then link or retain the original source.",
        requiresJudgment: true,
      });
      if (isSubstantive(text) && !PROOF_PATTERN.test(text)) addCheck(checks, seen, {
        id: `proof-${campaign?.id}-${platform}`,
        code: "missing_proof_label",
        severity: "high",
        title: "Proof label is missing",
        message: `${label} · ${platform} contains substantive public-facing copy without one of the approved proof labels.`,
        affectedOutput: `${label} · ${platform}`,
        evidence: brandEvidence,
        recommendation: `Add the accurate label on the asset and in the copy: ${PROOF_LABELS.join(", ")}.`,
        requiresJudgment: true,
      });
      const risky = stealthRisks(text);
      if (risky.length) addCheck(checks, seen, {
        id: `stealth-${campaign?.id}-${platform}`,
        code: "stealth_disclosure_risk",
        severity: "medium",
        title: "Stealth-boundary language needs review",
        message: `${label} · ${platform} mentions ${risky.join(", ")} information that may disclose more than Passport has approved publicly.`,
        affectedOutput: `${label} · ${platform}`,
        evidence: { document: records.brand?.name || "Passport Brand Guide", location: "§9.0 · Public disclosure / stealth boundary" },
        recommendation: "Confirm the statement is already public and specifically approved; otherwise generalize or remove the identifying claim.",
        requiresJudgment: true,
      });
    }
  }

  for (const row of calendar) {
    const campaignId = String(row?.campaignId || row?.campaign_id || "");
    const campaign = campaignById.get(campaignId) || campaigns.find(item => campaignRows([row], item).length);
    const platform = platformName(row?.channel || row?.platform);
    const affected = `${row?.title || "Untitled post"} · ${platform} · ${row?.date || row?.day || "unscheduled"}`;
    const rowEvidence = { document: records.content?.name || "Shared content calendar", location: `${row?.date || row?.day || "No date"} · ${platform}` };

    if (!campaign) addCheck(checks, seen, {
      id: `orphan-row-${row?.id || affected}`,
      code: "calendar_entry_without_campaign",
      severity: "medium",
      title: campaignId ? "Calendar entry lost its campaign connection" : "Calendar entry needs a campaign record",
      message: campaignId ? `${affected} points to campaign ${campaignId}, but that shared campaign record does not exist.` : `${affected} has no shared campaign record yet.`,
      affectedOutput: affected,
      evidence: rowEvidence,
      recommendation: "Open this post from Content to create or reconnect its shared campaign record.",
      requiresJudgment: true,
    });

    if (/approved|scheduled/i.test(String(row?.status))) {
      const gaps = rowProductionGaps(row, campaign);
      if (gaps.length) addCheck(checks, seen, {
        id: `ready-production-${row?.id || affected}`,
        code: "ready_item_missing_production",
        severity: "high",
        title: `${row?.status} item is not production-ready`,
        message: `${affected} is marked ${row.status}, but it is missing ${gaps.join("; ")}.`,
        affectedOutput: affected,
        evidence: rowEvidence,
        recommendation: "Add the missing production files and copy, or move the item back to Draft until they are complete.",
        requiresJudgment: false,
      });
    }

    if (!campaign) {
      const text = compactText([row?.title, objectText(row?.copy), row?.caption, row?.script, row?.body, row?.text, row?.description, row?.proof, row?.proofLabel]);
      if (PLACEHOLDER_PATTERN.test(text)) addCheck(checks, seen, {
        id: `row-placeholder-${row?.id || affected}`,
        code: "unresolved_source_placeholder",
        severity: "high",
        title: "Source placeholders are still visible",
        message: `${affected} still contains [OUTLET] or [DATE].`,
        affectedOutput: affected,
        evidence: { document: brandEvidence.document, location: "§6.3 · Sourced report requirements" },
        recommendation: "Replace both placeholders with the verified outlet and publication date before approval.",
        requiresJudgment: true,
      });
      if (isSubstantive(text) && !PROOF_PATTERN.test(text)) addCheck(checks, seen, {
        id: `row-proof-${row?.id || affected}`,
        code: "missing_proof_label",
        severity: "high",
        title: "Proof label is missing",
        message: `${affected} contains substantive copy without an approved proof label.`,
        affectedOutput: affected,
        evidence: brandEvidence,
        recommendation: `Add the accurate label: ${PROOF_LABELS.join(", ")}.`,
        requiresJudgment: true,
      });
      const risky = stealthRisks(text);
      if (risky.length) addCheck(checks, seen, {
        id: `row-stealth-${row?.id || affected}`,
        code: "stealth_disclosure_risk",
        severity: "medium",
        title: "Stealth-boundary language needs review",
        message: `${affected} mentions ${risky.join(", ")} information that may not be approved for public disclosure.`,
        affectedOutput: affected,
        evidence: { document: records.brand?.name || "Passport Brand Guide", location: "§9.0 · Public disclosure / stealth boundary" },
        recommendation: "Confirm the statement is public and approved; otherwise generalize or remove it.",
        requiresJudgment: true,
      });
    }
  }

  checks.sort((left, right) => (SEVERITY_ORDER[left.severity] ?? 9) - (SEVERITY_ORDER[right.severity] ?? 9));
  const summary = checks.reduce((counts, check) => ({ ...counts, [check.severity]: counts[check.severity] + 1 }), { high: 0, medium: 0, low: 0 });
  const findings = checks.length
    ? checks.map(check => `${check.title}: ${check.message}`)
    : ["No proof-label, source-placeholder, stealth-boundary, production, handoff, record, or source-mismatch issues were found in the current shared plan."];

  return NextResponse.json({
    title: `${checks.length} alignment finding${checks.length === 1 ? "" : "s"}`,
    findings,
    checks,
    summary,
    sources: documents.map(document => document.name).slice(0, 10),
    analyzedAt: new Date().toISOString(),
    dataSource: sourceMode,
  });
}
