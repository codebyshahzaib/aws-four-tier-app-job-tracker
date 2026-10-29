import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import "./style.css";

const API = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
const statuses = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];
const employmentTypes = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"];
const blankApplication = () => ({
  company: "", job_title: "", location: "", employment_type: "Full-time",
  application_date: new Date().toISOString().slice(0, 10), status: "Applied",
  job_url: "", salary_range: "", interview_date: "", follow_up_date: "", notes: "",
});

function App() {
  const [page, setPage] = useState("Dashboard");
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [listMeta, setListMeta] = useState({ total: 0, page: 1, page_size: 10 });
  const [filters, setFilters] = useState({ search: "", status: "", location: "", employment_type: "", sort: "application_date", order: "desc", page: 1 });
  const [form, setForm] = useState(blankApplication());
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const notify = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadDashboard = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch {
      setError("Could not load dashboard statistics. Check that the API is running.");
    }
  };

  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/applications`, { params: { ...filters, search: filters.search || undefined, status: filters.status || undefined, location: filters.location || undefined, employment_type: filters.employment_type || undefined } });
      setApplications(response.data.items);
      setListMeta(response.data);
      setError("");
    } catch {
      setError("Could not load applications. Check that the API is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { loadApplications(); }, [filters]);

  const changeFilter = (name, value) => setFilters(current => ({ ...current, [name]: value, ...(name === "page" ? {} : { page: 1 }) }));
  const openNew = () => { setForm(blankApplication()); setEditing(null); setFieldErrors({}); setError(""); setPage("Add Application"); };
  const openEdit = application => { setForm({ ...application, job_url: application.job_url || "", salary_range: application.salary_range || "", interview_date: application.interview_date || "", follow_up_date: application.follow_up_date || "" }); setEditing(application.id); setFieldErrors({}); setError(""); setPage("Add Application"); };
  const openDetails = application => { setSelected(application); setPage("Details"); };

  const save = async event => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value]));
    payload.notes = form.notes || "";
    try {
      const response = editing ? await axios.patch(`${API}/applications/${editing}`, payload) : await axios.post(`${API}/applications`, payload);
      setSelected(response.data);
      setForm(blankApplication());
      setEditing(null);
      await Promise.all([loadDashboard(), loadApplications()]);
      setPage("Details");
      notify(editing ? "Application updated." : "Application added.");
    } catch (requestError) {
      const response = requestError.response;
      if (!response) {
        setError("Could not reach the API. Check that the API is running.");
      } else if (response.status === 422 && Array.isArray(response.data?.detail)) {
        const errors = {};
        response.data.detail.forEach(({ loc, msg }) => { const field = loc?.at(-1); if (typeof field === "string" && field !== "body") errors[field] = msg; });
        setFieldErrors(errors);
        setError("Please correct the highlighted fields and try again.");
      } else {
        setError(response.data?.detail || "The application could not be saved.");
      }
    }
  };

  const remove = async id => {
    if (!confirm("Delete this application? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/applications/${id}`);
      if (selected?.id === id) { setSelected(null); setPage("Applications"); }
      await Promise.all([loadDashboard(), loadApplications()]);
      notify("Application deleted.");
    } catch { notify("The application could not be deleted.", "error"); }
  };

  const nav = ["Dashboard", "Applications", "Reports"];
  return <div className="shell">
    <aside>
      <div className="brand"><span>◆</span> Trackly</div>
      <p className="caption">JOB SEARCH WORKSPACE</p>
      {nav.map(item => <button className={page === item ? "active" : ""} onClick={() => setPage(item)} key={item}>{item === "Dashboard" ? "▦" : item === "Applications" ? "☷" : "▤"} {item}</button>)}
      <button className={page === "Add Application" ? "active" : ""} onClick={openNew}>＋ Add Application</button>
      <div className="aside-bottom">Your workspace<br /><strong>Local development</strong></div>
    </aside>
    <main>
      <header><div><div className="eyebrow">OVERVIEW</div><h1>{page}</h1></div><div className="header-actions"><input aria-label="Search applications" placeholder="Search company or role…" value={filters.search} onChange={event => changeFilter("search", event.target.value)} /><button className="primary" onClick={openNew}>＋ Add application</button></div></header>
      {error && <div className="error">{error}</div>}
      {page === "Dashboard" && <Dashboard stats={stats} applications={applications} onDetails={openDetails} />}
      {page === "Applications" && <Applications applications={applications} meta={listMeta} filters={filters} changeFilter={changeFilter} loading={loading} edit={openEdit} details={openDetails} remove={remove} />}
      {page === "Add Application" && <Form form={form} setForm={setForm} save={save} editing={editing} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} cancel={() => setPage(editing ? "Details" : "Applications")} />}
      {page === "Details" && selected && <Details application={selected} onBack={() => setPage("Applications")} onEdit={() => openEdit(selected)} notify={notify} />}
      {page === "Reports" && <Reports notify={notify} onNavigate={setPage} />}
      {toast && <div className={`toast ${toast.type}`}>{toast.type === "success" ? "✓" : "!"} {toast.message}</div>}
    </main>
  </div>;
}

function Dashboard({ stats, applications, onDetails }) {
  if (!stats) return <div className="loading">Loading your workspace…</div>;
  const cards = [["Total applications", stats.total, "↗"], ["Submitted this month", stats.this_month, "▣"], ["Interviews scheduled", stats.interviews, "◷"], ["Offers received", stats.offers, "★"]];
  return <><section className="cards">{cards.map(([label, value, icon]) => <div className="card" key={label}><div className="card-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>From your saved applications</small></div>)}</section><section className="grid"><div className="panel chart"><div className="panel-heading"><div><h2>Application pipeline</h2><p>Current status of your applications</p></div></div><ResponsiveContainer width="100%" height={260}><BarChart data={Object.entries(stats.distribution).map(([name, value]) => ({ name, value }))}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#6c63ff" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="panel"><div className="panel-heading"><div><h2>Recent applications</h2><p>Click an item to view details</p></div></div>{applications.slice(0, 5).map(application => <button className="recent recent-button" key={application.id} onClick={() => onDetails(application)}><div className="avatar">{application.company[0]?.toUpperCase()}</div><div><strong>{application.job_title}</strong><p>{application.company} · {application.location}</p></div><Badge status={application.status} /></button>)}{!applications.length && <div className="empty">No applications yet. Add your first one.</div>}</div></section></>;
}

function Badge({ status }) { return <span className={`badge ${status.toLowerCase()}`}>{status}</span>; }

function Applications({ applications, meta, filters, changeFilter, loading, edit, details, remove }) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.page_size));
  return <div className="panel table-panel"><div className="panel-heading"><div><h2>All applications</h2><p>Search, filter, and organize every opportunity.</p></div><span className="count">{meta.total} results</span></div><div className="filters"><input aria-label="Filter by location" placeholder="Location" value={filters.location} onChange={event => changeFilter("location", event.target.value)} /><select aria-label="Filter by status" value={filters.status} onChange={event => changeFilter("status", event.target.value)}><option value="">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select><select aria-label="Filter by employment type" value={filters.employment_type} onChange={event => changeFilter("employment_type", event.target.value)}><option value="">All employment types</option>{employmentTypes.map(type => <option key={type}>{type}</option>)}</select><select aria-label="Sort applications" value={`${filters.sort}:${filters.order}`} onChange={event => { const [sort, order] = event.target.value.split(":"); setFilters(current => ({ ...current, sort, order, page: 1 })); }}><option value="application_date:desc">Newest first</option><option value="application_date:asc">Oldest first</option><option value="company:asc">Company A–Z</option><option value="job_title:asc">Role A–Z</option><option value="interview_date:asc">Upcoming interview</option></select></div>{loading ? <div className="loading">Loading applications…</div> : !applications.length ? <div className="empty">No matching applications found. Try changing your filters.</div> : <div className="table-wrap"><table><thead><tr><th>Company / role</th><th>Location</th><th>Applied</th><th>Status</th><th /></tr></thead><tbody>{applications.map(application => <tr key={application.id}><td><button className="table-link" onClick={() => details(application)}><strong>{application.company}</strong><small>{application.job_title}</small></button></td><td>{application.location}</td><td>{application.application_date}</td><td><Badge status={application.status} /></td><td><button className="icon-btn" onClick={() => edit(application)}>Edit</button><button className="icon-btn danger" onClick={() => remove(application.id)}>Delete</button></td></tr>)}</tbody></table></div>}<div className="pagination"><button className="secondary small-button" disabled={filters.page <= 1} onClick={() => changeFilter("page", filters.page - 1)}>← Previous</button><span>Page {filters.page} of {pages}</span><button className="secondary small-button" disabled={filters.page >= pages} onClick={() => changeFilter("page", filters.page + 1)}>Next →</button></div></div>;
}

function Details({ application, onBack, onEdit, notify }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const loadDocuments = () => axios.get(`${API}/applications/${application.id}/documents`).then(response => setDocuments(response.data)).catch(() => setMessage("Documents could not be loaded."));
  useEffect(() => { loadDocuments(); }, [application.id]);
  const upload = async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) { setMessage("Only PDF files are supported."); event.target.value = ""; return; }
    const body = new FormData(); body.append("file", file); setUploading(true); setMessage("");
    try { await axios.post(`${API}/applications/${application.id}/documents`, body); await loadDocuments(); notify("Document uploaded."); } catch (requestError) { setMessage(requestError.response?.data?.detail || "Document upload failed."); } finally { setUploading(false); event.target.value = ""; }
  };
  return <div className="panel details-panel"><div className="detail-toolbar"><button className="link" onClick={onBack}>← Back to applications</button><button className="secondary" onClick={onEdit}>Edit application</button></div><div className="detail-heading"><div><h2>{application.job_title}</h2><p>{application.company} · {application.location}</p></div><Badge status={application.status} /></div><div className="details-grid"><Detail label="Employment type" value={application.employment_type} /><Detail label="Application date" value={application.application_date} /><Detail label="Interview date" value={application.interview_date || "Not scheduled"} /><Detail label="Follow-up date" value={application.follow_up_date || "Not scheduled"} /><Detail label="Salary range" value={application.salary_range || "Not provided"} /><Detail label="Job URL" value={application.job_url ? <a href={application.job_url} target="_blank" rel="noreferrer" className="link">Open posting ↗</a> : "Not provided"} /></div><div className="notes"><h3>Notes</h3><p>{application.notes || "No notes added."}</p></div><div className="documents"><div className="panel-heading"><div><h3>Documents</h3><p>Private PDF files for this application</p></div><label className="primary upload-label">{uploading ? "Uploading…" : "＋ Upload PDF"}<input type="file" accept="application/pdf,.pdf" onChange={upload} disabled={uploading} /></label></div>{message && <div className="notice">{message}</div>}{documents.length ? documents.map(document => <div className="document-row" key={document.id}><span>▤ {document.original_name}</span><small>{Math.max(1, Math.round(document.size / 1024))} KB</small><a className="link" href={`${API}/documents/${document.id}`} target="_blank" rel="noreferrer">Download</a></div>) : <div className="empty">No documents uploaded yet.</div>}</div></div>;
}

function Detail({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function Reports({ notify, onNavigate }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const create = async () => { setError(""); try { const response = await axios.post(`${API}/reports`); setJob(response.data); notify("Report queued."); } catch (requestError) { setError(requestError.response?.data?.detail || "The report could not be queued."); } };
  useEffect(() => {
    if (!job?.job_id || ["completed", "failed"].includes(job.state)) return undefined;
    const timer = setInterval(async () => { try { const response = await axios.get(`${API}/reports/${job.job_id}`); setJob(response.data); } catch { setError("Could not check report status."); } }, 1000);
    return () => clearInterval(timer);
  }, [job?.job_id, job?.state]);
  const result = useMemo(() => { if (!job?.result) return null; try { return typeof job.result === "string" ? JSON.parse(job.result) : job.result; } catch { return { summary: job.result }; } }, [job?.result]);
  const active = job && ["pending", "processing"].includes(job.state);
  return <div className="panel reports-panel"><div className="panel-heading"><div><h2>Search reports</h2><p>Generate a summary in the background. You can continue using the rest of the app.</p></div><button className="primary" onClick={create} disabled={active}>＋ Generate report</button></div>{error && <div className="error">{error}</div>}{active && <div className="notice">This report is running in the background. Use the sidebar to view applications or return to the dashboard.</div>}{!job ? <div className="empty">No report requested yet.</div> : <div className="report-result"><div className="status-line"><span>Job status</span><strong className={job.state}>{job.state}</strong></div>{job.state === "pending" && <p>The job is waiting for the worker.</p>}{job.state === "processing" && <p>The worker is generating your report…</p>}{job.state === "completed" && <div><h3>Report ready</h3><p>{result?.summary}</p>{result?.application_count !== undefined && <div className="report-stat"><strong>{result.application_count}</strong><span>applications included</span></div>}</div>}{job.state === "failed" && <p className="field-error">{job.error || "Report generation failed."}</p>}</div>}{active && <button className="secondary continue-button" onClick={() => onNavigate("Applications")}>Continue to applications →</button>}</div>;
}

function Form({ form, setForm, save, editing, fieldErrors, setFieldErrors, cancel }) {
  const update = event => { const { name, value } = event.target; setForm({ ...form, [name]: value }); if (fieldErrors[name]) setFieldErrors({ ...fieldErrors, [name]: undefined }); };
  const field = (name, label, control) => <label className={fieldErrors[name] ? "invalid" : ""}>{label}{control}{fieldErrors[name] && <small className="field-error">{fieldErrors[name]}</small>}</label>;
  return <div className="panel form-panel"><div className="panel-heading"><div><h2>{editing ? "Edit application" : "Add application"}</h2><p>Keep the details that help you follow up confidently.</p></div></div><form onSubmit={save}><div className="form-grid">
    {field("company", "Company name", <input required name="company" value={form.company} placeholder="Tkxel" onChange={update}/>)}{field("job_title", "Job title", <input required name="job_title" value={form.job_title} placeholder="Associate DevOps Engineer" onChange={update}/>)}{field("location", "Location", <input required name="location" value={form.location} placeholder="Islamabad" onChange={update}/>)}{field("employment_type", "Employment type", <select required name="employment_type" value={form.employment_type} onChange={update}>{employmentTypes.map(type => <option key={type}>{type}</option>)}</select>)}{field("application_date", "Application date", <input required type="date" name="application_date" value={form.application_date} onChange={update}/>)}{field("job_url", "Job posting URL", <input type="url" name="job_url" value={form.job_url} placeholder="https://example.com/job" onChange={update}/>)}{field("status", "Status", <select name="status" value={form.status} onChange={update}>{statuses.map(status => <option key={status}>{status}</option>)}</select>)}{field("salary_range", "Salary range", <input name="salary_range" value={form.salary_range} placeholder="$80k–$100k" onChange={update}/>)}{field("interview_date", "Interview date", <input type="date" name="interview_date" value={form.interview_date} onChange={update}/>)}{field("follow_up_date", "Follow-up date", <input type="date" name="follow_up_date" value={form.follow_up_date} onChange={update}/>)}{field("notes", "Notes", <textarea className="wide" name="notes" rows="5" value={form.notes} placeholder="Recruiter details, reminders, or next steps…" onChange={update}/>)}</div><div className="form-actions"><button type="button" className="secondary" onClick={cancel}>Cancel</button><button className="primary">{editing ? "Save changes" : "Create application"}</button></div></form></div>;
}

createRoot(document.getElementById("root")).render(<App />);
