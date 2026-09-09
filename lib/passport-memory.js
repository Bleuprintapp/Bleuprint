const AREA_RULES = [
  ["Brand", /brand|mission|vision|position|voice|tone|promise|value proposition|proof|claim|stealth/i],
  ["Audience", /audience|customer|buyer|persona|segment|market|founder|operator|user/i],
  ["Content", /content|instagram|tiktok|linkedin|caption|reel|carousel|campaign|post|channel/i],
  ["Roadmap", /roadmap|phase|milestone|build|launch|priority|dependency|next step|timeline/i],
  ["Opportunities", /opportunit|grant|accelerator|cohort|fund|capital|application|detroit/i],
  ["Performance", /performance|metric|analytics|reach|engagement|conversion|pixel|capi|crm/i],
];

const normalize = value => String(value || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();

export function areaForText(value = "") {
  return AREA_RULES.find(([, pattern]) => pattern.test(value))?.[0] || "Reference";
}

function markdownSections(text) {
  const lines = String(text || "").split("\n");
  const sections = [];
  let current = { title: "Document overview", line: 1, body: [] };
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match) {
      if (normalize(current.body.join("\n"))) sections.push(current);
      current = { title: normalize(match[1]), line: index + 1, body: [] };
    } else current.body.push(lines[index]);
  }
  if (normalize(current.body.join("\n"))) sections.push(current);
  return sections;
}

function htmlSections(text) {
  const source = String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const heading = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const found = [...source.matchAll(heading)];
  if (!found.length) return [];
  return found.map((match, index) => ({
    title: normalize(match[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ")),
    line: index + 1,
    body: [source.slice((match.index || 0) + match[0].length, found[index + 1]?.index || source.length).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ")],
  }));
}

export function extractMemoryEntries({ name, contentType, rawText }) {
  const isHtml = /html/i.test(contentType || "") || /\.html?$/i.test(name || "");
  const sections = isHtml ? htmlSections(rawText) : markdownSections(rawText);
  return sections
    .map(section => {
      const body = normalize(section.body.join("\n")).slice(0, 2400);
      const title = normalize(section.title).slice(0, 180);
      return {
        area: areaForText(`${title} ${body.slice(0, 600)}`),
        entryType: /decision|approved|must|will not|never|required/i.test(`${title} ${body}`) ? "decision" : "fact",
        status: "extracted",
        title,
        body,
        sourceLocation: isHtml ? `Section: ${title}` : `Heading: ${title} · line ${section.line}`,
        evidence: body.slice(0, 500),
      };
    })
    .filter(entry => entry.title && entry.body.length >= 24)
    .slice(0, 80);
}

export function mentionedEmails(text = "") {
  const value = String(text || "");
  const mentions = [];
  if (/@(?:kalena|kgardner)\b/i.test(value)) mentions.push("kgardner@discoverultrium.com");
  if (/@paris\b/i.test(value)) mentions.push("paris@ultriumtechnologies.com");
  return [...new Set(mentions)];
}

export async function createMentionNotifications(sql, { workspaceId = "passport", actor, text, title, body, link }) {
  const recipients = mentionedEmails(text).filter(email => email !== actor);
  for (const email of recipients) {
    await sql`
      INSERT INTO bleuprint_notifications (workspace_id, recipient_email, actor_email, title, body, link)
      VALUES (${workspaceId}, ${email}, ${actor}, ${title}, ${body}, ${link || "/admin"})
    `;
  }
  return recipients;
}
