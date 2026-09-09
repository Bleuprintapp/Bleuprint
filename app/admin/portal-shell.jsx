"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContentPanel, MemoryPanel, RoadmapPanel, WorkspaceModal } from "./workspace-panels";

const ARCHIVE_KEY = "bleuprint.passport.archive";
const BASE_ARCHIVE = [];

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
  const [panel, setPanel] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [tab, setTab] = useState("archive");
  const [saved, setSaved] = useState([]);
  const [sources, setSources] = useState([]), [mismatches, setMismatches] = useState([]);
  const [calendar, setCalendar] = useState([]), [campaigns, setCampaigns] = useState([]);
  const [roadmap, setRoadmap] = useState(null), [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState("Shared with Kalena + Paris");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const refreshArchive = useCallback(() => setSaved([...readSavedArchive(), ...readCalendarArchive()]), []);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/workspace", { cache: "no-store" }), fetch("/api/sources", { cache:"no-store" }), fetch("/api/roadmap", { cache:"no-store" })])
      .then(async responses => Promise.all(responses.map(response => response.ok ? response.json() : Promise.reject())))
      .then(([{ state }, sourceData, roadmapData]) => {
        if (!active) return;
        if (Array.isArray(state?.archive)) window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(state.archive));
        if (Array.isArray(state?.calendar)) window.localStorage.setItem("bleuprint.passport.calendar", JSON.stringify(state.calendar));
        setCalendar(state?.calendar || []); setCampaigns(state?.campaigns || []);
        setSources(sourceData.documents || []); setMismatches(sourceData.mismatches || []); setRoadmap(roadmapData);
        fetch("/api/analyze", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ calendar:state?.calendar || [], campaigns:state?.campaigns || [] }) }).then(response=>response.ok?response.json():null).then(data=>{if(active&&data)setAnalysis(data);}).catch(()=>{});
      })
      .catch(() => {})
      .finally(() => { if (active) { refreshArchive(); setWorkspaceReady(true); } });
    return () => { active = false; };
  }, [refreshArchive]);

  const saveContent = useCallback(async (nextCalendar, nextCampaigns) => {
    setCalendar(nextCalendar); setCampaigns(nextCampaigns); setStatus("Saving shared workspace…");
    window.localStorage.setItem("bleuprint.passport.calendar", JSON.stringify(nextCalendar));
    const newlyApproved = nextCalendar.filter(row => /approved|published|done/i.test(row.status || ""));
    const current = readSavedArchive();
    const additions = newlyApproved.filter(row => !current.some(item => item.id === `calendar-${row.id}`)).map(row => ({ id:`calendar-${row.id}`, type:`${row.channel} · ${row.format}`, title:row.title, status:row.status, document:"Shared content calendar", location:`${row.date || row.day} · ${row.time}`, approvedBy:member.name, at:new Date().toLocaleString() }));
    const at = new Date().toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
    const fields = ["status","title","date","day","time","format","channel"];
    const rowChanges = nextCalendar.flatMap(row => {
      const previous = calendar.find(item => item.id === row.id); if (!previous) return [];
      return fields.filter(field => String(previous[field] || "") !== String(row[field] || "")).map(field => ({
        id:`change-${row.id}-${field}-${Date.now()}`, type:"Update", title:`${row.title} · ${field} updated`, status:"Recorded",
        document:row.sourceDocument || "Shared content calendar", location:`${row.date || row.day} · ${row.channel} · ${field}`, approvedBy:member.name, at,
        change:{ document:row.sourceDocument || "Shared content calendar", location:`${row.date || row.day} · ${row.channel} · ${field}`, previous:String(previous[field] || "Not set"), current:String(row[field] || "Not set"), by:member.name, at }
      }));
    });
    const campaignChanges = nextCampaigns.flatMap(item => {
      const previous = campaigns.find(candidate => candidate.id === item.id);
      if (previous && JSON.stringify(previous) === JSON.stringify(item)) return [];
      const platforms = Object.keys(item.outputs || {}).join(", ") || "No platform output";
      return [{ id:`change-${item.id}-${Date.now()}`, type:"Update", title:`${item.title} · campaign ${previous ? "updated" : "created"}`, status:"Recorded", document:"Shared campaign record", location:`Campaign · ${item.title} · ${platforms}`, approvedBy:member.name, at, change:{ document:"Shared campaign record", location:`Campaign · ${item.title} · ${platforms}`, previous:previous ? `${previous.status || "Draft"} · ${Object.keys(previous.outputs || {}).join(", ")}` : "No shared campaign record", current:`${item.status || "Draft"} · ${platforms}`, by:member.name, at } }];
    });
    const archive = [...campaignChanges, ...rowChanges, ...additions, ...current]; window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)); setSaved([...archive,...readCalendarArchive()]);
    const response = await fetch("/api/workspace", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({state:{calendar:nextCalendar,campaigns:nextCampaigns,archive}}) });
    setStatus(response.ok ? `Saved by ${member.name} · just now` : "Could not save shared changes");
  }, [calendar, campaigns, member.name]);

  useEffect(() => {
    function receivePortalMessage(event) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "bleuprint:open-panel" && ["memory","roadmap","content"].includes(event.data.panel)) setPanel(event.data.panel);
      if (event.data?.type === "bleuprint:state-changed" && event.data.key === "bleuprint.passport.calendar") {
        try { const rows=JSON.parse(event.data.value); if(Array.isArray(rows)) saveContent(rows,campaigns); } catch {}
      }
    }
    window.addEventListener("message", receivePortalMessage);
    return () => window.removeEventListener("message", receivePortalMessage);
  }, [campaigns, saveContent]);

  const refreshSources = useCallback(async () => { const response=await fetch("/api/sources",{cache:"no-store"}); if(response.ok){const data=await response.json();setSources(data.documents||[]);setMismatches(data.mismatches||[]);} },[]);
  const uploadSource = useCallback(async file => { setStatus(`Reading ${file.name}…`); const body=new FormData();body.append("file",file);const response=await fetch("/api/sources",{method:"POST",body});const data=await response.json();if(!response.ok){setStatus(data.error||"Upload failed");return null;}setSources(data.documents||[]);setMismatches(data.mismatches||[]);const workspace=await fetch("/api/workspace",{cache:"no-store"}).then(r=>r.json());if(Array.isArray(workspace.state?.calendar)){setCalendar(workspace.state.calendar);window.localStorage.setItem("bleuprint.passport.calendar",JSON.stringify(workspace.state.calendar));}setStatus(`${file.name} added to Passport memory`);return (data.documents||[]).find(item=>item.name===file.name)||null; },[]);
  const updateSource = useCallback(async (id, changes) => { setStatus("Updating shared memory…"); const response=await fetch("/api/sources",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,...changes})});const data=await response.json();if(response.ok){setSources(data.documents||[]);setMismatches(data.mismatches||[]);setStatus("Memory updated for Kalena + Paris");}else setStatus(data.error||"Memory update failed"); },[]);
  const saveRoadmap = useCallback(async next => { setRoadmap(current=>({...current,state:next}));setStatus("Saving roadmap…");const response=await fetch("/api/roadmap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(next)});setStatus(response.ok?`Roadmap updated by ${member.name}`:"Roadmap could not save"); },[member.name]);
  const runAnalysis = useCallback(async (nextCalendar=calendar,nextCampaigns=campaigns) => { setStatus("Checking Passport alignment…");const response=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({calendar:nextCalendar,campaigns:nextCampaigns})});const data=await response.json();setAnalysis(data);setStatus(response.ok?"Alignment check complete":"Alignment check failed");return data; },[calendar,campaigns]);

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
    window.setTimeout(() => { try { const rows=JSON.parse(window.localStorage.getItem("bleuprint.passport.calendar")||"[]"); if(rows.length&&!calendar.length) saveContent(rows,campaigns); } catch {} },1200);
  }, [captureApproval, refreshArchive, saveShared, calendar.length, campaigns, saveContent]);

  const archived = [...saved.filter(item => item.type !== "Update"), ...BASE_ARCHIVE].filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index);
  const changes = saved.filter(item => item.change).map(item => item.change);

  return <main className="portal-experience-shell">
    <nav className="portal-system-actions" aria-label="Passport workspaces">
      <button onClick={() => setPanel("memory")}><span>◎</span>Memory<small>{sources.length}</small></button>
      <button onClick={() => setPanel("roadmap")}><span>↗</span>Roadmap<small>{roadmap?.phases?.flatMap(item=>item.tasks).filter(item=>!roadmap.state?.done?.[item.id]).length || 0}</small></button>
      <button onClick={() => setPanel("content")}><span>+</span>Content<small>{analysis?.summary?.high ? `${analysis.summary.high}!` : calendar.length}</small></button>
    </nav>
    <nav className="portal-account-actions"><a href="/account">{member?.name || "Account"}</a><button onClick={() => { refreshArchive(); setArchiveOpen(true); }}>Archive</button></nav>
    {workspaceReady ? <iframe ref={frameRef} onLoad={connectFrame} className="portal-experience-frame" src="/admin/experience" name="bleuprint-portal" title="Bleuprint Intelligence Portal — Passport" allow="clipboard-write" /> : null}
    {panel === "memory" ? <WorkspaceModal title="Live memory" kicker="PASSPORT / SOURCES" close={() => setPanel(null)} wide><MemoryPanel sources={sources} mismatches={mismatches} onUpload={uploadSource} onRefresh={refreshSources} onUpdate={updateSource} status={status}/></WorkspaceModal> : null}
    {panel === "roadmap" ? <WorkspaceModal title="Build roadmap" kicker="PASSPORT / OPERATING ORDER" close={() => setPanel(null)} wide actions={<a className="original-link" href="/hq/passport/roadmap.html" target="_blank" rel="noreferrer">Original roadmap ↗</a>}><RoadmapPanel roadmap={roadmap} onSave={saveRoadmap} onUpload={uploadSource} onOpenContent={() => setPanel("content")} member={member}/></WorkspaceModal> : null}
    {panel === "content" ? <WorkspaceModal title="Content" kicker="PASSPORT / CURRENT WEEK" close={() => setPanel(null)} wide actions={<a className="original-link" href="/hq/passport/week-one.html" target="_blank" rel="noreferrer">Original Week One ↗</a>}><ContentPanel calendar={calendar} campaigns={campaigns} onSave={saveContent} onUpload={uploadSource} onAnalyze={runAnalysis} analysis={analysis} status={status}/></WorkspaceModal> : null}
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
