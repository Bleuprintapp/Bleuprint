export const SOURCE_ASSUMPTION_POLICY = "Extract explicit text only. Do not infer authority, status, ownership, dates, or intent. Human review required before a source becomes a document of record.";

const linkedInPosts = [
  {
    id: "week-one-li-01",
    date: "2026-09-07",
    title: "The permission gap",
    time: "08:30 ET",
    pillar: "Pillar 1",
    proof: "Scenario",
    format: "Text only, or the Permission visual from the first set",
    brief: "First post on the new company page. It opens on the problem rather than the company. No product, no launch language.",
    copy: {
      a: "Your support agent can issue a refund.\n\nWho decided its limit?\n\nMost teams can answer the first half of that. The agent has a key, a role, a set of tools it can reach. Ask the second half and the answers get vague. It was in the prompt. It inherited a service account. Someone wired it up during a sprint two quarters ago.\n\nIdentity tells you who an agent is. It says nothing about what that agent was permitted to do, who permitted it, or how anyone would demonstrate that six months from now.\n\nThat space between capability and authority is where the risk sits.\n\nScenario, illustrative.",
      b: "Every team deploying agents has answered one question carefully: what can this thing access?\n\nFewer have answered the one underneath it: what is it allowed to do with that access, and who decided?\n\nAn API key opens a door. The decision about what may happen past it was made somewhere else, usually without a record. When an agent moves money, changes a record, or sends something on your behalf, someone authorized that boundary, and right now that authorization usually lives in a prompt, a config file, or a conversation nobody wrote down.\n\nAutomation should never sever action from authority.\n\nScenario, illustrative."
    }
  },
  {
    id: "week-one-li-02",
    date: "2026-09-08",
    title: "The proof gap",
    time: "08:30 ET",
    pillar: "Pillar 2",
    proof: "Scenario",
    format: "Text only, or the Proof visual",
    brief: "Follows Monday directly. Monday asks who decided. Tuesday asks what survives afterward.",
    copy: {
      a: "An agent ran last night. Something moved that should not have moved.\n\nWhat can you show?\n\nLogs record what happened. Prompts record what was asked. Screenshots record what one person saw on one screen. In an incident review, none of those establish that the action was authorized, by whom, or inside what limits.\n\nThe useful question in that room is narrow: was this permitted, and can someone outside the system that took the action verify it?\n\nIf the answer depends on trusting the same stack that made the mistake, an auditor will treat it as a claim.\n\nScenario, illustrative.",
      b: "Ask your team what proof you would hand an auditor if an agent took an action nobody expected.\n\nMost answers land on logs. Logs are a record of events written by the system under review. They tell you what the system believes happened.\n\nEvidence is different. It is a signed, durable record that a specific decision was authorized, bounded, and attributable, readable by someone who does not have to trust the system that produced it.\n\nOne of those survives a hard question. The other explains it.\n\nScenario, illustrative."
    }
  },
  {
    id: "week-one-li-03",
    date: "2026-09-09",
    title: "The public verifier",
    time: "09:00 ET",
    pillar: "Pillar 6",
    proof: "Lab demonstration",
    format: "Screen recording, 30 to 45 seconds, plus link in the first comment",
    brief: "Matches the verifier walkthrough already scheduled for today in the sprint. Show the tool working. Say nothing about architecture.",
    copy: {
      a: "We built the verifier as a public tool, because a proof you can only check inside our system is a promise.\n\nPaste a decision receipt. It checks the signature, shows what was authorized, what limits applied, and who held the authority at the time. It runs whether or not you use anything else we make.\n\nWalkthrough is in the comments.\n\nThe receipt proves the authorization decision. It does not claim the downstream system executed the outcome, and we will keep saying that plainly.\n\nLab demonstration, reproduced by our team.",
      b: "A short walkthrough of the public verifier.\n\nYou give it a decision receipt. It returns four things: whether the signature holds, what action was authorized, what bounds were set, and who the authority was.\n\nWe made it public and independent on purpose. Evidence that can only be checked by the vendor who issued it asks you to trust the vendor twice.\n\nLink in the comments. It works without an account.\n\nLab demonstration, reproduced by our team."
    }
  },
  {
    id: "week-one-li-04",
    date: "2026-09-10",
    title: "Sourced report",
    time: "08:30 ET",
    pillar: "Pillar 5",
    proof: "Sourced report",
    format: "The 56 second news clip, outlet and date on screen the whole time",
    brief: "Fill in the outlet name and publication date from the clip before this goes anywhere. The proof rule applies to us before it applies to anyone else.",
    copy: {
      a: "[OUTLET], [DATE]: an AI agent deleted a company's database, then apologized.\n\nThe apology is the part that travels. The part that matters to anyone running agents against production systems is narrower.\n\nWhat was that agent permitted to do? Who set that boundary, and when? What record of the authorization survived the incident, and could anyone read it without trusting the system that failed?\n\nAn agent doing something destructive is a story. An agent doing something destructive that nobody authorized and nobody can reconstruct is a category of risk.\n\nSourced report. Full clip credited to [OUTLET], [DATE].",
      b: "[OUTLET] reported on [DATE] that an AI agent deleted a company's entire database and then apologized for it.\n\nWorth separating two failures there.\n\nThe first is the action. That gets the attention.\n\nThe second is quieter: at no point did a bounded, recorded, attributable authorization stand between the agent and the database. Which means after the fact, the questions an incident review needs answered have no source to answer them.\n\nThe first failure is a bug. The second is a missing layer.\n\nSourced report. Clip credited to [OUTLET], [DATE]."
    }
  },
  {
    id: "week-one-li-05",
    date: "2026-09-11",
    title: "Five bounds",
    time: "08:00 ET",
    pillar: "Pillar 1",
    proof: "Scenario",
    format: "Carousel or a single Scope visual",
    brief: "Closes the week on the control model. This is the most saveable post of the five, so give it the strongest visual.",
    copy: {
      a: "Permission for an agent is a sentence with five parts.\n\nWhich resource.\nWhich action.\nUp to what value.\nAt what risk level.\nFor how long.\n\nLeave any one of them unstated and the permission is unlimited in that dimension. Most agent deployments we see specify the first two and leave the last three to inference.\n\n\"Can access the payments API\" is a resource and an action. It is silent on amount, risk, and expiry, which is where the expensive surprises come from.\n\nBound the action. Name the approver. Keep the proof.\n\nScenario, illustrative.",
      b: "If you are writing permissions for an agent this quarter, five questions are worth answering explicitly before it ships.\n\nWhat can it reach?\nWhat can it do there?\nUp to what amount?\nAt what risk threshold does a person get involved?\nWhen does this expire?\n\nAny question left blank becomes an assumption, and assumptions inside an autonomous system are permissions nobody remembers granting.\n\nGive agents permission. Keep people accountable.\n\nScenario, illustrative."
    }
  }
];

const instagramPosts = [
  {
    id: "week-one-ig-01", date: "2026-09-08", title: "The reveal, part one", time: "12:00 ET", pillar: "Teaser arc", proof: "No claim", format: "reel", productionFormat: "Reel, 9:16, 8 seconds, original audio",
    brief: "The mark animates in, spins, settles. Then one line of on-screen text. Nothing else. No URL, no product, no explanation in the caption.", screen: "Do you trust your AI agents?", copy: { a: "Are AI agents trustworthy?", b: "Agents can act now. Do you trust yours?" }, sourceAsset: "Paris exports the live mark animation, or a clean screen capture of it. This one should come from the real thing."
  },
  {
    id: "week-one-ig-02", date: "2026-09-10", title: "Who decided its limit?", time: "12:00 ET", pillar: "Pillar 1", proof: "Scenario", format: "reel", productionFormat: "Motion text card, 9:16, 7 seconds",
    brief: "Second question in the arc. Same world as the deck: deep ground, gold contour lines, one cyan gate. Text appears in two beats.", screen: "Your agent can issue a refund. / Who decided its limit?", copy: { a: "Your agent can issue a refund. Who decided its limit?\n\nScenario, illustrative.", b: "It has the API key. Who set the amount?\n\nScenario, illustrative." }, sourceAsset: "Generated from the brand guide spec below, or built by you. Paris only if the generated version misses the gate."
  },
  {
    id: "week-one-ig-03", date: "2026-09-12", title: "What can you show?", time: "10:00 ET", pillar: "Pillar 2", proof: "Scenario", format: "reel", productionFormat: "Motion text card, 9:16, 7 seconds",
    brief: "Third question. Closes the week without answering anything. The answers start the week after.", screen: "An agent ran last night. / Something moved. / What can you show?", copy: { a: "Logs say what happened. What proves it was allowed?\n\nScenario, illustrative.", b: "An agent ran last night. What can you show?\n\nScenario, illustrative." }, sourceAsset: "Generated from the spec below, or built by you."
  }
];

const tiktokPosts = [
  {
    id: "week-one-tt-01", date: "2026-09-08", title: "The reveal, part one", time: "19:00 ET", pillar: "Teaser arc", proof: "No claim", format: "reel", productionFormat: "Same 8 second reveal, native upload, original audio",
    brief: "Same asset as Instagram. TikTok caption is shorter and lowercase. No hashtags beyond one or two that describe the topic.", screen: "Do you trust your AI agents?", copy: { a: "are AI agents trustworthy?", b: "your AI agent can take actions now. do you trust it?" }, sourceAsset: "Same file as IG 01.", sharedAssetWith: "week-one-ig-01"
  },
  {
    id: "week-one-tt-02", date: "2026-09-10", title: "Who decided its limit?", time: "19:00 ET", pillar: "Pillar 1", proof: "Scenario", format: "reel", productionFormat: "Same motion card, 7 seconds",
    brief: "Same asset as IG 02. Caption carries the question and the label, nothing more.", screen: "Your agent can issue a refund. / Who decided its limit?", copy: { a: "your agent can issue a refund. who decided its limit? (scenario)", b: "it has the key. who set the amount? (scenario)" }, sourceAsset: "Same file as IG 02.", sharedAssetWith: "week-one-ig-02"
  },
  {
    id: "week-one-tt-03", date: "2026-09-12", title: "What can you show?", time: "19:00 ET", pillar: "Pillar 2", proof: "Scenario", format: "reel", productionFormat: "Same motion card, 7 seconds",
    brief: "Same asset as IG 03.", screen: "An agent ran last night. / Something moved. / What can you show?", copy: { a: "an agent ran last night. what can you show? (scenario)", b: "logs say what happened. what proves it was allowed? (scenario)" }, sourceAsset: "Same file as IG 03.", sharedAssetWith: "week-one-ig-03"
  }
];

const campaignSlug = value => String(value || "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const finalize = (row, channel) => {
  const campaignKey = `week-one-${campaignSlug(row.title)}`;
  return {
    ...row,
    day: row.date,
    channel,
    status: "Draft",
    week: "Week One",
    campaignId: campaignKey,
    campaignKey,
    sourceDocument: "week-one.html"
  };
};

export const PASSPORT_WEEK_ONE_CALENDAR = [
  ...linkedInPosts.map(row => finalize({ ...row, productionFormat: row.format, format: /carousel/i.test(row.format) ? "carousel" : /screen recording|clip|video/i.test(row.format) ? "video" : "text" }, "LinkedIn")),
  ...instagramPosts.map(row => finalize(row, "Instagram")),
  ...tiktokPosts.map(row => finalize(row, "TikTok"))
];

const headerAliases = {
  date: ["date", "publish date", "scheduled date", "schedule date"],
  day: ["day"],
  channel: ["channel", "platform", "network"],
  format: ["format", "post type", "content type", "media type"],
  title: ["title", "topic", "post", "post title", "content", "campaign"],
  time: ["time", "publish time", "scheduled time"],
  status: ["status", "stage"]
};

function normalizeHeader(value) {
  return String(value || "").replace(/\uFEFF/g, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function headerKey(value) {
  const normalized = normalizeHeader(value);
  return Object.entries(headerAliases).find(([, aliases]) => aliases.includes(normalized))?.[0] || null;
}

function parseDelimited(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function decodeHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHtmlTable(text) {
  const table = text.match(/<table\b[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match =>
    [...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell => decodeHtml(cell[1]))
  ).filter(row => row.length);
}

function normalizeExplicitDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const numeric = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  const parsedWithYear = /\b\d{4}\b/.test(text) ? new Date(text) : null;
  return parsedWithYear && !Number.isNaN(parsedWithYear.getTime()) ? parsedWithYear.toISOString().slice(0, 10) : "";
}

function rowsFromTable(table, sourceName) {
  if (table.length < 2) return [];
  const keys = table[0].map(headerKey);
  const recognized = new Set(keys.filter(Boolean));
  if (!recognized.has("channel") || !recognized.has("title") || (!recognized.has("date") && !recognized.has("day"))) return [];
  const sourceSlug = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "calendar";
  return table.slice(1).map((values, index) => {
    const source = {};
    values.forEach((value, column) => { if (keys[column]) source[keys[column]] = value.trim(); });
    const rawDay = source.date || source.day || "";
    const campaignKey = `calendar-${sourceSlug}-${campaignSlug(source.title)}`;
    return {
      id: `calendar-${sourceSlug}-${index + 1}`,
      date: normalizeExplicitDate(rawDay),
      day: normalizeExplicitDate(rawDay) || rawDay,
      channel: source.channel,
      format: source.format || "unspecified",
      title: source.title,
      time: source.time || "",
      status: source.status || "Draft",
      campaignId: campaignKey,
      campaignKey,
      sourceDocument: sourceName
    };
  }).filter(row => row.channel && row.title && row.day);
}

export function calendarRowsFromUpload({ name = "", contentType = "", rawText = "" } = {}) {
  const weekOne = /week[\s_-]*one/i.test(name) || (/Passport Week One Posts/i.test(rawText) && /The permission gap/i.test(rawText));
  if (weekOne) return PASSPORT_WEEK_ONE_CALENDAR.map(row => ({ ...row, copy: row.copy ? { ...row.copy } : undefined }));
  const csv = contentType === "text/csv" || /\.csv$/i.test(name);
  if (csv) return rowsFromTable(parseDelimited(rawText), name);
  const html = /html/i.test(contentType) || /\.html?$/i.test(name);
  const calendarLike = /content[\s_-]*calendar|posting[\s_-]*schedule|calendar/i.test(name) || /content calendar|posting schedule/i.test(rawText.slice(0, 30000));
  return html && calendarLike ? rowsFromTable(parseHtmlTable(rawText), name) : [];
}
