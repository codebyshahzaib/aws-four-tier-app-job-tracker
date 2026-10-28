import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import "./style.css";

const API = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
const statuses = ["Wishlist","Applied","Screening","Interview","Offer","Rejected","Withdrawn"];
const empty = { company:"", job_title:"", location:"", employment_type:"Full-time", application_date:new Date().toISOString().slice(0,10), status:"Applied", job_url:"", salary_range:"", interview_date:"", follow_up_date:"", notes:"" };

function App() {
  const [page, setPage] = useState("Dashboard"), [stats, setStats] = useState(null), [apps, setApps] = useState([]), [form, setForm] = useState(empty), [editing, setEditing] = useState(null), [search, setSearch] = useState(""), [error, setError] = useState(""), [fieldErrors, setFieldErrors] = useState({});
  const load = () => Promise.all([axios.get(`${API}/dashboard/stats`), axios.get(`${API}/applications`, {params:{search:search||undefined,page_size:100}})]).then(([s,a])=>{setStats(s.data);setApps(a.data.items);setError("")}).catch(()=>setError("Could not reach the API. Check that the API is running and try again."));
  useEffect(()=>{load()},[search]);
  const save = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value]));
    payload.notes = form.notes || "";
    try {
      await (editing ? axios.patch(`${API}/applications/${editing}`,payload) : axios.post(`${API}/applications`,payload));
      setForm(empty);
      setEditing(null);
      setPage("Applications");
      load();
    } catch (requestError) {
      const response = requestError.response;
      if (!response) {
        setError("Could not reach the API. Check that the API is running and try again.");
        return;
      }
      if (response.status === 422 && Array.isArray(response.data?.detail)) {
        const errors = {};
        response.data.detail.forEach(({loc, msg}) => {
          const field = loc?.at(-1);
          if (typeof field === "string" && field !== "body") errors[field] = msg;
        });
        setFieldErrors(errors);
        setError("Please correct the highlighted fields and try again.");
      } else {
        setError(response.data?.detail || "The application could not be saved. Please try again.");
      }
    }
  };
  const remove = async id => { if(confirm("Delete this application?")) { await axios.delete(`${API}/applications/${id}`); load(); } };
  const nav = ["Dashboard","Applications","Add Application"];
  return <div className="shell"><aside><div className="brand"><span>◆</span> Trackly</div><p className="caption">JOB SEARCH WORKSPACE</p>{nav.map(item=><button className={page===item?"active":""} onClick={()=>{setPage(item);if(item==="Add Application"){setForm(empty);setEditing(null);setFieldErrors({});setError("")}}} key={item}>{item==="Dashboard"?"▦":item==="Applications"?"☷":"＋"} {item}</button>)}<div className="aside-bottom">Your workspace<br/><strong>Local development</strong></div></aside><main><header><div><div className="eyebrow">OVERVIEW</div><h1>{page}</h1></div><div className="header-actions"><input placeholder="Search applications..." value={search} onChange={e=>setSearch(e.target.value)}/><button className="primary" onClick={()=>{setForm(empty);setEditing(null);setFieldErrors({});setError("");setPage("Add Application")}}>＋ Add application</button></div></header>{error&&<div className="error">{error}</div>}{page==="Dashboard"&&<Dashboard stats={stats} apps={apps} />}{page==="Applications"&&<Applications apps={apps} edit={id=>{const a=apps.find(x=>x.id===id);setForm({...a,job_url:a.job_url||"",interview_date:a.interview_date||"",follow_up_date:a.follow_up_date||""});setEditing(id);setFieldErrors({});setError("");setPage("Add Application")}} remove={remove}/>} {page==="Add Application"&&<Form form={form} setForm={setForm} save={save} editing={editing} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors}/>}</main></div>
}

function Dashboard({stats,apps}) { if(!stats)return <div className="loading">Loading your workspace…</div>; const cards=[["Total applications",stats.total,"↗"],["Submitted this month",stats.this_month,"▣"],["Interviews scheduled",stats.interviews,"◷"],["Offers received",stats.offers,"★"]]; return <><section className="cards">{cards.map(([label,value,icon])=><div className="card" key={label}><div className="card-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>Updated just now</small></div>)}</section><section className="grid"><div className="panel chart"><div className="panel-heading"><div><h2>Application pipeline</h2><p>Current status of your applications</p></div></div><ResponsiveContainer width="100%" height={260}><BarChart data={Object.entries(stats.distribution).map(([name,value])=>({name,value}))}><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="#6c63ff" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div><div className="panel"><div className="panel-heading"><div><h2>Recent applications</h2><p>Your latest activity</p></div><button className="link" onClick={()=>location.reload()}>Refresh</button></div>{apps.slice(0,5).map(a=><div className="recent" key={a.id}><div className="avatar">{a.company[0]}</div><div><strong>{a.job_title}</strong><p>{a.company} · {a.location}</p></div><Badge status={a.status}/></div>)}{!apps.length&&<div className="empty">No applications yet. Add your first one.</div>}</div></section></> }
function Badge({status}) {return <span className={"badge "+status.toLowerCase()}>{status}</span>}
function Applications({apps,edit,remove}) {return <div className="panel table-panel"><div className="panel-heading"><div><h2>All applications</h2><p>Track every opportunity in one place</p></div><span className="count">{apps.length} results</span></div>{!apps.length?<div className="empty">No matching applications found.</div>:<div className="table-wrap"><table><thead><tr><th>Company / role</th><th>Location</th><th>Applied</th><th>Status</th><th></th></tr></thead><tbody>{apps.map(a=><tr key={a.id}><td><strong>{a.company}</strong><small>{a.job_title}</small></td><td>{a.location}</td><td>{a.application_date}</td><td><Badge status={a.status}/></td><td><button className="icon-btn" onClick={()=>edit(a.id)}>Edit</button><button className="icon-btn danger" onClick={()=>remove(a.id)}>Delete</button></td></tr>)}</tbody></table></div>}</div>}
function Form({form,setForm,save,editing,fieldErrors,setFieldErrors}) {
  const update=e=>{const {name,value}=e.target;setForm({...form,[name]:value});if(fieldErrors[name])setFieldErrors({...fieldErrors,[name]:undefined})};
  const field=(name,label,control)=><label className={fieldErrors[name]?"invalid":""}>{label}{control}{fieldErrors[name]&&<small className="field-error">{fieldErrors[name]}</small>}</label>;
  return <div className="panel form-panel"><div className="panel-heading"><div><h2>{editing?"Edit application":"Add application"}</h2><p>Keep the details that help you follow up confidently.</p></div></div><form onSubmit={save}><div className="form-grid">
    {field("company","Company name",<input required type="text" name="company" value={form.company} placeholder="Tkxel" onChange={update}/>)}{field("job_title","Job title",<input required type="text" name="job_title" value={form.job_title} placeholder="Associate DevOps Engineer" onChange={update}/>)}{field("location","Location",<input required type="text" name="location" value={form.location} placeholder="Islamabad" onChange={update}/>)}{field("employment_type","Employment type",<input required type="text" name="employment_type" value={form.employment_type} placeholder="Full-time" onChange={update}/>)}{field("application_date","Application date",<input required type="date" name="application_date" value={form.application_date} onChange={update}/>)}{field("job_url","Job posting URL",<input type="url" name="job_url" value={form.job_url} placeholder="https://example.com/job" onChange={update}/>)}{field("status","Status",<select name="status" value={form.status} onChange={update}>{statuses.map(s=><option key={s}>{s}</option>)}</select>)}{field("interview_date","Interview date",<input type="date" name="interview_date" value={form.interview_date} onChange={update}/>)}{field("follow_up_date","Follow-up date",<input type="date" name="follow_up_date" value={form.follow_up_date} onChange={update}/>)}{field("notes","Notes",<textarea className="wide" name="notes" rows="5" value={form.notes} placeholder="Add recruiter details, follow-up reminders, or next steps…" onChange={update}/>)} </div><div className="form-actions"><button type="button" className="secondary" onClick={()=>history.back()}>Cancel</button><button className="primary">{editing?"Save changes":"Create application"}</button></div></form></div>
}

createRoot(document.getElementById("root")).render(<App/>);
