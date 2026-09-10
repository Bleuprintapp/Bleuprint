"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArchivePanel, ContentPanel, IssuesPanel, MemoryPanel, PerformancePanel, RoadmapPanel, WorkspaceModal } from "./workspace-panels";

const getJson = async url => {
  const response = await fetch(url, { cache:"no-store" });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
};

export default function PortalShell({ member }) {
  const frameRef = useRef(null);
  const [panel,setPanel]=useState(null);
  const [sources,setSources]=useState([]), [mismatches,setMismatches]=useState([]), [memory,setMemory]=useState([]);
  const [calendar,setCalendar]=useState([]), [campaigns,setCampaigns]=useState([]), [roadmap,setRoadmap]=useState(null);
  const [issues,setIssues]=useState([]), [notifications,setNotifications]=useState([]), [archive,setArchive]=useState({documents:[],memory:[],issues:[],events:[],content:[]});
  const [analysis,setAnalysis]=useState(null), [performance,setPerformance]=useState({metrics:[],upcoming:[],missing:[],buffer:{state:"needs-api-key"}}), [connectors,setConnectors]=useState([]);
  const [status,setStatus]=useState("Connecting the shared Passport workspace…"), [ready,setReady]=useState(false);
  const [microsoft,setMicrosoft]=useState(null), [microsoftNotice,setMicrosoftNotice]=useState(null);

  const refreshOperational = useCallback(async ({ quiet=false }={}) => {
    try {
      const [workspace,sourceData,roadmapData,memoryData,issueData,notificationData,performanceData,connectorData,archiveData]=await Promise.all([
        getJson("/api/workspace"), getJson("/api/sources"), getJson("/api/roadmap"), getJson("/api/memory"), getJson("/api/issues"),
        getJson("/api/notifications"), getJson("/api/performance"), getJson("/api/connectors"), getJson("/api/archive"),
      ]);
      setCalendar(Array.isArray(workspace.state?.calendar)?workspace.state.calendar:[]);
      setCampaigns(Array.isArray(workspace.state?.campaigns)?workspace.state.campaigns:[]);
      setSources(sourceData.documents||[]); setMismatches(sourceData.mismatches||[]); setRoadmap(roadmapData);
      setMemory(memoryData.entries||[]); setIssues(issueData.issues||[]); setNotifications(notificationData.notifications||[]);
      setPerformance(performanceData); setConnectors(connectorData.connectors||[]); setArchive(archiveData);
      if(!quiet)setStatus(`Shared workspace current · ${member.name}`);
    } catch {
      if(!quiet)setStatus("The shared workspace could not refresh. Your current view is still open.");
    } finally { setReady(true); }
  },[member.name]);

  const refreshMicrosoft=useCallback(async()=>{
    try{setMicrosoft(await getJson("/api/microsoft/status"));}
    catch{setMicrosoft({state:"unavailable",detail:"The Microsoft connection status could not be read just now."});}
  },[]);

  useEffect(()=>{
    refreshOperational();
    refreshMicrosoft();
    const params=new URLSearchParams(window.location.search);
    const requested=params.get("open");
    if(["memory","roadmap","content","issues","performance","archive"].includes(requested))setPanel(requested);
    const microsoftResult=params.get("microsoft");
    if(microsoftResult){
      setMicrosoftNotice({ok:microsoftResult==="connected",reason:params.get("reason")||""});
      setPanel("memory");
      params.delete("microsoft");params.delete("reason");
      const rest=params.toString();
      window.history.replaceState({},"",`${window.location.pathname}${rest?`?${rest}`:""}`);
    }
    const timer=window.setInterval(()=>refreshOperational({quiet:true}),10000);
    return()=>window.clearInterval(timer);
  },[refreshOperational,refreshMicrosoft]);

  const saveContent=useCallback(async(nextCalendar,nextCampaigns)=>{
    const now=new Date().toISOString();
    const stamped=nextCalendar.map(row=>{
      const before=calendar.find(item=>item.id===row.id);
      return !before||JSON.stringify(before)===JSON.stringify(row)?row:{...row,updatedAt:now,updatedBy:member.name};
    });
    setCalendar(stamped);setCampaigns(nextCampaigns);setStatus("Saving for Kalena + Paris…");
    try{window.localStorage.setItem("bleuprint.passport.calendar",JSON.stringify(stamped));}catch{}
    const response=await fetch("/api/workspace",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({state:{calendar:stamped,campaigns:nextCampaigns}})});
    setStatus(response.ok?`Saved by ${member.name} · just now`:"Shared changes did not save");
    if(response.ok)await refreshOperational({quiet:true});
    return response.ok;
  },[calendar,member.name,refreshOperational]);

  const refreshSources=useCallback(async()=>{
    const [sourceData,memoryData,issueData]=await Promise.all([getJson("/api/sources"),getJson("/api/memory"),getJson("/api/issues")]);
    setSources(sourceData.documents||[]);setMismatches(sourceData.mismatches||[]);setMemory(memoryData.entries||[]);setIssues(issueData.issues||[]);
  },[]);
  const uploadSource=useCallback(async file=>{
    setStatus(`Reading ${file.name}…`);const body=new FormData();body.append("file",file);
    const response=await fetch("/api/sources",{method:"POST",body});const data=await response.json();
    if(!response.ok){setStatus(data.error||"Upload failed");return null;}
    await refreshOperational({quiet:true});
    setStatus(`${file.name} added · ${data.extractedEntries||0} explicit sections routed with source labels`);
    return (data.documents||[]).find(item=>item.name===file.name)||null;
  },[refreshOperational]);
  const updateSource=useCallback(async(id,changes)=>{
    setStatus("Updating shared source memory…");const response=await fetch("/api/sources",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,...changes})});
    const data=await response.json();setStatus(response.ok?"Source authority updated":data.error||"Source update failed");if(response.ok)await refreshOperational({quiet:true});
  },[refreshOperational]);
  const archiveSource=useCallback(async id=>{
    const response=await fetch(`/api/sources?id=${id}`,{method:"DELETE"});const data=await response.json();
    setStatus(response.ok?"Source moved to Archive":data.error||"Could not archive source");if(response.ok)await refreshOperational({quiet:true});
  },[refreshOperational]);
  const createMemory=useCallback(async value=>{
    const response=await fetch("/api/memory",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});const data=await response.json();
    setStatus(response.ok?"Memory added with team provenance":data.error||"Could not add memory");if(response.ok)setMemory(data.entries||[]);return response.ok;
  },[]);
  const updateMemory=useCallback(async(id,value)=>{
    const response=await fetch("/api/memory",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,...value})});const data=await response.json();
    setStatus(response.ok?(value.action==="archive"?"Memory moved to Archive":"Memory updated"):data.error||"Could not update memory");if(response.ok){setMemory(data.entries||[]);await refreshOperational({quiet:true});}return response.ok;
  },[refreshOperational]);
  const saveRoadmap=useCallback(async next=>{
    setRoadmap(current=>({...current,state:next}));setStatus("Saving roadmap…");const response=await fetch("/api/roadmap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(next)});
    setStatus(response.ok?`Roadmap updated by ${member.name}`:"Roadmap could not save");if(response.ok)await refreshOperational({quiet:true});
  },[member.name,refreshOperational]);
  const runAnalysis=useCallback(async(nextCalendar=calendar,nextCampaigns=campaigns)=>{
    setStatus("Checking sources, proof, handoffs, and production readiness…");const response=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({calendar:nextCalendar,campaigns:nextCampaigns})});
    const data=await response.json();setAnalysis(data);setStatus(response.ok?"Alignment check complete":"Alignment check failed");if(response.ok)await refreshOperational({quiet:true});return data;
  },[calendar,campaigns,refreshOperational]);
  const updateIssue=useCallback(async(id,value)=>{
    const response=await fetch("/api/issues",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,...value})});const data=await response.json();
    setStatus(response.ok?`Issue ${value.status}`:data.error||"Issue update failed");if(response.ok){setIssues(data.issues||[]);await refreshOperational({quiet:true});}return response.ok;
  },[refreshOperational]);
  const restoreArchive=useCallback(async(type,id)=>{
    const response=await fetch("/api/archive",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({type,id})});
    setStatus(response.ok?"Restored to the active workspace":"Restore failed");if(response.ok)await refreshOperational({quiet:true});
  },[refreshOperational]);
  const syncBuffer=useCallback(async()=>{
    setStatus("Checking Buffer for scheduled and published posts…");const response=await fetch("/api/buffer/sync",{method:"POST"});const data=await response.json();
    setStatus(response.ok?`${data.posts} Buffer posts checked`:data.error||"Buffer sync failed");if(response.ok)await refreshOperational({quiet:true});return response.ok;
  },[refreshOperational]);
  const readNotifications=useCallback(async()=>{await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({all:true})});setNotifications(current=>current.map(item=>({...item,read_at:item.read_at||new Date().toISOString()})));},[]);

  useEffect(()=>{
    function receive(event){
      if(event.origin!==window.location.origin||event.source!==frameRef.current?.contentWindow)return;
      if(event.data?.type==="bleuprint:open-panel"&&["memory","roadmap","content","issues","performance","archive"].includes(event.data.panel))setPanel(event.data.panel);
      if(event.data?.type==="bleuprint:state-changed"&&event.data.key==="bleuprint.passport.calendar")try{const rows=JSON.parse(event.data.value);if(Array.isArray(rows))saveContent(rows,campaigns);}catch{}
    }
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[campaigns,saveContent]);

  const openIssues=issues.filter(item=>["open","assigned"].includes(item.status));
  const unread=notifications.filter(item=>!item.read_at).length;
  const archivedCount=(archive.documents?.length||0)+(archive.memory?.length||0)+(archive.issues?.length||0)+(archive.archivedContent?.length||0);
  const common={close:()=>setPanel(null),wide:true};
  return <main className="portal-experience-shell">
    <p className="portal-record-notice">Blueprint map · use the workspaces below for shared updates, archive, and source-backed records.</p>
    <nav className="portal-system-actions" aria-label="Passport workspaces">
      <button onClick={()=>setPanel("memory")}><span>◎</span>Memory<small>{memory.length}</small></button>
      <button onClick={()=>setPanel("roadmap")}><span>↗</span>Roadmap<small>{roadmap?.phases?.flatMap(item=>item.tasks).filter(item=>!roadmap.state?.done?.[item.id]&&!roadmap.state?.archived?.[item.id]).length||0}</small></button>
      <button onClick={()=>setPanel("content")}><span>+</span>Content<small>{calendar.filter(row=>row.status!=="Archived").length}</small></button>
      <button onClick={()=>setPanel("issues")}><span>!</span>Signals<small>{openIssues.length}</small></button>
      <button onClick={()=>setPanel("performance")}><span>↟</span>Performance<small>{performance.metrics?.length||0}</small></button>
      <button onClick={()=>setPanel("archive")}><span>⌁</span>Archive<small>{archivedCount}</small></button>
    </nav>
    <nav className="portal-account-actions"><button className={unread?"has-alert":""} onClick={()=>{setPanel("issues");readNotifications();}}>Updates{unread?<b>{unread}</b>:null}</button><a href="/account">{member.name}</a></nav>
    {ready?<iframe ref={frameRef} className="portal-experience-frame" src="/admin/experience" name="bleuprint-portal" title="Bleuprint Intelligence Portal — Passport" allow="clipboard-write"/>:null}
    {panel==="memory"?<WorkspaceModal title="Live memory" kicker="PASSPORT / SOURCES + PROVENANCE" {...common}><MemoryPanel sources={sources} entries={memory} mismatches={mismatches} connectors={connectors} microsoft={microsoft} microsoftNotice={microsoftNotice} onDismissMicrosoftNotice={()=>setMicrosoftNotice(null)} onUpload={uploadSource} onRefresh={refreshSources} onUpdate={updateSource} onArchiveSource={archiveSource} onCreateMemory={createMemory} onUpdateMemory={updateMemory} status={status}/></WorkspaceModal>:null}
    {panel==="roadmap"?<WorkspaceModal title="Build roadmap" kicker="PASSPORT / OPERATING ORDER" {...common} actions={<a className="original-link" href="/hq/passport/roadmap.html" target="_blank" rel="noreferrer">Designed view ↗</a>}><RoadmapPanel roadmap={roadmap} onSave={saveRoadmap} onUpload={uploadSource} onOpenContent={()=>setPanel("content")} member={member}/></WorkspaceModal>:null}
    {panel==="content"?<WorkspaceModal title="Content" kicker="PASSPORT / CALENDAR → CAMPAIGN" {...common} actions={<a className="original-link" href="/hq/passport/week-one.html" target="_blank" rel="noreferrer">Designed week ↗</a>}><ContentPanel calendar={calendar} campaigns={campaigns} onSave={saveContent} onUpload={uploadSource} onAnalyze={runAnalysis} analysis={analysis} status={status} onOpenIssues={()=>setPanel("issues")} buffer={performance.buffer} onBufferSync={syncBuffer}/></WorkspaceModal>:null}
    {panel==="issues"?<WorkspaceModal title="Signals" kicker="PASSPORT / RESOLVE + RECORD" {...common}><IssuesPanel issues={issues} notifications={notifications} onUpdate={updateIssue} onReadNotifications={readNotifications} member={member}/></WorkspaceModal>:null}
    {panel==="performance"?<WorkspaceModal title="Performance" kicker="PASSPORT / PUBLISHING → LEARNING" {...common}><PerformancePanel performance={performance} calendar={calendar} connectors={connectors} onSyncBuffer={syncBuffer} status={status}/></WorkspaceModal>:null}
    {panel==="archive"?<WorkspaceModal title="Archive" kicker="PASSPORT / HISTORY + RESTORE" {...common}><ArchivePanel archive={archive} onRestore={restoreArchive}/></WorkspaceModal>:null}
  </main>;
}
