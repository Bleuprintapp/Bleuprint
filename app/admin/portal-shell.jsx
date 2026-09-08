"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ARCHIVE_KEY = "bleuprint.passport.archive";
const BASE_ARCHIVE = [
  { id: "b4", type: "Position", title: "The model proposes. Passport decides.", status: "Approved", document: "Passport Brand Guide v1.0", location: "§2.1 · Positioning", approvedBy: "Kalena" },
  { id: "b5", type: "Rule", title: "Claims we never make", status: "Approved", document: "Passport Brand Guide v1.0", location: "§2.2 and §6.2 · Claim boundaries", approvedBy: "Kalena" },
  { id: "b6", type: "Rule", title: "The proof ladder", status: "Approved", document: "Passport Brand Guide v1.0", location: "§6.3 · Evidence labels", approvedBy: "Kalena" },
  { id: "a1", type: "Audience", title: "Teams deploying agents into sensitive workflows", status: "Approved", document: "Passport Brand Guide v1.0", location: "§2.1 · Primary audience", approvedBy: "Kalena" },
  { id: "a3", type: "Rule", title: "Stealth boundary", status: "Approved", document: "Passport Brand Guide v1.0", location: "§9.0 · Public disclosure", approvedBy: "Kalena + Paris" },
];

function readSavedArchive() {
  try { return JSON.parse(window.localStorage.getItem(ARCHIVE_KEY) || "[]"); } catch { return []; }
}

function readCalendarArchive() {
  try {
    const rows = JSON.parse(window.localStorage.getItem("bleuprint.passport.calendar") || "[]");
    return rows.filter(row => /approved|published|done/i.test(row.status || "")).map(row => ({
      id: `calendar-${row.id}`, type: `${row.channel} · ${row.format}`, title: row.title, status: row.status,
      document: "Week One content calendar", location: `${row.day} · ${row.time}`,
      approvedBy: row.status === "Approved" ? "Kalena" : "Completed in calendar",
    }));
  } catch { return []; }
}

export default function PortalShell({ member }) {
  const frameRef = useRef(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [tab, setTab] = useState("archive");
  const [saved, setSaved] = useState([]);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const refreshArchive = useCallback(() => setSaved([...readSavedArchive(), ...readCalendarArchive()]), []);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(({ state }) => {
        if (!active) return;
        if (Array.isArray(state?.archive)) window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(state.archive));
        if (Array.isArray(state?.calendar)) window.localStorage.setItem("bleuprint.passport.calendar", JSON.stringify(state.calendar));
      })
      .catch(() => {})
      .finally(() => { if (active) { refreshArchive(); setWorkspaceReady(true); } });
    return () => { active = false; };
  }, [refreshArchive]);

  const saveShared = useCallback(() => {
    const archive = readSavedArchive();
    let calendar = [];
    try { calendar = JSON.parse(window.localStorage.getItem("bleuprint.passport.calendar") || "[]"); } catch {}
    fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: { archive, calendar } }) }).catch(() => {});
  }, []);

  const captureApproval = useCallback(() => {
    const frame = frameRef.current;
    if (!frame?.contentDocument?.body?.innerText.includes("Approved by Kalena · v1")) return;
    const current = readSavedArchive();
    if (current.some(item => item.id === "campaign-five-bounds")) return;
    const at = new Date().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const item = {
      id: "campaign-five-bounds", type: "Campaign", title: "Five bounds · three expressions", status: "Approved",
      document: "Week One", location: "05 · Five bounds campaign", approvedBy: "Kalena", at,
      change: { document: "Week One", location: "05 · Campaign approval gate", previous: "Draft · waiting for judgment", current: "Approved · ready for BLKBOX package", by: "Kalena", at },
    };
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify([item, ...current]));
    refreshArchive();
  }, [refreshArchive]);

  const connectFrame = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document) return;
    document.addEventListener("click", () => window.setTimeout(() => { captureApproval(); refreshArchive(); saveShared(); }, 650));
  }, [captureApproval, refreshArchive, saveShared]);

  const archived = [...saved, ...BASE_ARCHIVE].filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index);
  const changes = archived.filter(item => item.change).map(item => item.change);

  return <main className="portal-experience-shell">
    <nav className="portal-quick-actions" aria-label={`Portal shortcuts for ${member?.name || "member"}`}>
      <button onClick={() => { refreshArchive(); setArchiveOpen(true); }}><span>↘</span>Archive</button>
      <a href="/admin/experience?open=campaign" target="bleuprint-portal"><span>+</span>Campaign generator</a>
    </nav>
    {workspaceReady ? <iframe ref={frameRef} onLoad={connectFrame} className="portal-experience-frame" src="/admin/experience" name="bleuprint-portal" title="Bleuprint Intelligence Portal — Passport" allow="clipboard-write" /> : null}
    {archiveOpen ? <div className="portal-archive-layer" onClick={() => setArchiveOpen(false)}>
      <section className="portal-archive" onClick={event => event.stopPropagation()}>
        <header><div><small>PASSPORT / RECORD</small><h1>Archive</h1><p>Approved and completed work stays connected to the document and exact place it came from.</p></div><button onClick={() => setArchiveOpen(false)} aria-label="Close archive">×</button></header>
        <nav><button className={tab === "archive" ? "active" : ""} onClick={() => setTab("archive")}>Approved + done <span>{archived.length}</span></button><button className={tab === "changes" ? "active" : ""} onClick={() => setTab("changes")}>Update history <span>{changes.length}</span></button></nav>
        {tab === "archive" ? <div className="archive-list">{archived.map(item => <article key={item.id}><i /><div><small>{item.type}</small><h2>{item.title}</h2><p><strong>{item.document}</strong><span>{item.location}</span></p></div><aside><b>{item.status}</b><span>{item.approvedBy}</span>{item.at ? <time>{item.at}</time> : null}</aside></article>)}</div>
          : <div className="change-list">{changes.length ? changes.map((change, index) => <article key={`${change.document}-${index}`}><header><div><small>DOCUMENT</small><strong>{change.document}</strong></div><div><small>WHERE</small><strong>{change.location}</strong></div></header><div><span>REMOVED / PREVIOUS</span><p>{change.previous}</p></div><div className="current"><span>ADDED / CURRENT</span><p>{change.current}</p></div><footer>{change.by} · {change.at}</footer></article>) : <div className="archive-empty"><span>NO RECORDED UPDATES YET</span><h2>Every approved change will show its document and exact location here.</h2><p>The record will preserve the previous value, current value, person, and timestamp.</p></div>}</div>}
      </section>
    </div> : null}
  </main>;
}
