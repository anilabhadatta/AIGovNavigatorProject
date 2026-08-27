import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowRight, Bot, Check, Clock3, Database, ExternalLink, FileText, GitPullRequest, Landmark, Loader2, RefreshCw, SearchCheck, ShieldCheck, UserRoundCheck, X } from 'lucide-react'
import axios from 'axios'

interface DraftUpdate {
  id: string
  service_id: string
  service_name: string
  portal: string
  changes: { field: string; old_value: string; new_value: string; needs_review: boolean }[]
  source_snapshot: string
  timestamp: string
}

interface ServiceEntry {
  service_id: string
  app_id: string
  service_name: string
  portal: string
  content: { official_link?: string; [key: string]: unknown }
  version: number
  updated_at: string
}

const formatDate = (value?: string) => {
  if (!value) return 'Not yet available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function AdminPanel() {
  const [drafts, setDrafts] = useState<DraftUpdate[]>([])
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('active')
  const [parentApiUrl, setParentApiUrl] = useState('/dummygov/api/master')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // CodeX: central admin review data model and connection state for the governance workflow.
  const getHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('navAdminToken')}` } })
  const latestUpdate = useMemo(() => services.reduce<string | undefined>((latest, service) => !latest || new Date(service.updated_at).getTime() > new Date(latest).getTime() ? service.updated_at : latest, undefined), [services])
  const connectedPortals = useMemo(() => new Set(services.map(service => service.app_id).filter(Boolean)).size, [services])

  const fetchData = async () => {
    try {
      const [draftsRes, servicesRes] = await Promise.all([
        axios.get('/aigov/api/v1/admin/drafts', getHeaders()),
        axios.get('/aigov/api/v1/admin/services', getHeaders()),
      ])
      setDrafts(draftsRes.data)
      setServices(servicesRes.data)
    } catch (err: any) {
      console.error(err)
      if (err.response?.status === 401) handleLogout()
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (localStorage.getItem('navAdminToken')) {
      setIsAuthenticated(true)
      fetchData()
    } else setIsLoading(false)
  }, [])

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const res = await axios.post('/aigov/api/v1/admin/scan-updates', { master_api_url: parentApiUrl }, getHeaders())
      await fetchData()
      alert(res.data.message)
      setActiveTab('pending')
    } catch (err) {
      console.error(err)
      alert('Error during scan. Make sure Dummy Gov Webapp is running on port 8001.')
    } finally {
      setIsScanning(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await axios.post(`/aigov/api/v1/admin/drafts/${id}/approve`, {}, getHeaders())
      await fetchData()
      alert('Update approved and knowledge base updated!')
    } catch (err) { console.error(err) }
  }

  const handleReject = async (id: string) => {
    try {
      await axios.post(`/aigov/api/v1/admin/drafts/${id}/reject`, {}, getHeaders())
      setDrafts(prev => prev.filter(draft => draft.id !== id))
    } catch (err) { console.error(err) }
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const res = await axios.post('/aigov/api/v1/admin/login', { username, password })
      localStorage.setItem('navAdminToken', res.data.token)
      setIsAuthenticated(true)
      setIsLoading(true)
      fetchData()
    } catch { alert('Invalid credentials') }
  }

  const handleLogout = () => {
    localStorage.removeItem('navAdminToken')
    setIsAuthenticated(false)
    setDrafts([])
    setServices([])
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>

  if (!isAuthenticated) return (
    <div className="mx-auto flex h-full w-full max-w-md items-center justify-center p-6">
      <div className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-8 shadow-2xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300"><Database size={24} /></div>
        <h2 className="mb-2 text-center text-2xl font-bold text-white">Navigator Admin</h2>
        <p className="mb-6 text-center text-sm text-slate-400">Secure knowledge-base operations</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" value={username} onChange={event => setUsername(event.target.value)} placeholder="Username" className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-500">Login</button>
        </form>
      </div>
    </div>
  )

  const pipeline = [
    { icon: Landmark, title: 'Official portal', text: 'Department admins expose public service-flow updates.' },
    { icon: SearchCheck, title: 'Crawler checks', text: 'Navigator discovers and compares registered portal records.' },
    { icon: Bot, title: 'AI drafts change', text: 'Differences become a reviewable update proposal.' },
    { icon: UserRoundCheck, title: 'Human approves', text: 'An admin is the publication gate for every update.' },
    { icon: ShieldCheck, title: 'Citizen guidance', text: 'Approved facts power sourced, grounded answers.' },
  ]
  const metrics: [string, string | number, string][] = [
    ['Connected portals', connectedPortals, 'Registered sources in the verified catalog'],
    ['Verified services', services.length, 'Approved records available to the citizen assistant'],
    ['Awaiting review', drafts.length, 'AI-drafted updates needing an admin decision'],
    ['Latest source update', formatDate(latestUpdate), 'Most recent active record timestamp'],
  ]

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto px-5 py-6 sm:px-8">
      <header className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3"><div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-300"><Database size={24} /></div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Live governance console</p></div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">From official portal changes to trustworthy citizen guidance.</h2>
            <p className="mt-3 text-slate-400">This demo tracks public service-flow information—steps, documents, fees, and portal UI changes. It never ingests citizen records or personal data.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input value={parentApiUrl} onChange={event => setParentApiUrl(event.target.value)} aria-label="Government parent API URL" className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Gov Parent API URL" />
            <button onClick={handleScan} disabled={isScanning} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-white transition hover:bg-indigo-400 disabled:opacity-50">{isScanning ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}{isScanning ? 'Scanning...' : 'Scan Official Portal Updates'}</button>
            <button onClick={handleLogout} className="text-sm text-slate-400 underline transition hover:text-white">Logout</button>
          </div>
        </div>
      </header>

      <section aria-label="Knowledge update pipeline" className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-indigo-950"><ShieldCheck size={18} className="text-indigo-600" /><h3 className="font-bold">Governed update pipeline</h3><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">Human review required</span></div>
        <div className="grid gap-3 lg:grid-cols-5">{pipeline.map((stage, index) => {
          const Icon = stage.icon
          return <div key={stage.title} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-indigo-100 lg:block"><div className="mb-0 flex shrink-0 items-center gap-2 lg:mb-3"><div className="rounded-lg bg-slate-950 p-2 text-indigo-300"><Icon size={16} /></div>{index < pipeline.length - 1 && <ArrowRight size={15} className="hidden text-indigo-300 lg:block" />}</div><div><h4 className="text-sm font-bold text-slate-900">{index + 1}. {stage.title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-600">{stage.text}</p></div></div>
        })}</div>
      </section>

      <section aria-label="Live demo summary" className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, description]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p></div>)}</section>

      <div role="tablist" aria-label="Knowledge governance records" className="mb-5 flex gap-2 border-b border-slate-200">
        <button role="tab" aria-selected={activeTab === 'active'} onClick={() => setActiveTab('active')} className={`flex items-center gap-2 px-4 pb-3 font-medium transition ${activeTab === 'active' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}><Database size={18} />Verified Knowledge Base</button>
        <button role="tab" aria-selected={activeTab === 'pending'} onClick={() => setActiveTab('pending')} className={`flex items-center gap-2 px-4 pb-3 font-medium transition ${activeTab === 'pending' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}><GitPullRequest size={18} />Review Queue {drafts.length > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">{drafts.length}</span>}</button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pending' ? <motion.section key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-950"><strong>Review gate:</strong> these proposed differences were detected from registered portal sources and structured by AI. They do not reach the citizen assistant until an administrator approves them.</div>
          {drafts.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"><div className="mb-4 inline-block rounded-full bg-indigo-50 p-4 text-indigo-600"><Check size={32} /></div><h3 className="text-xl font-semibold text-slate-800">All caught up</h3><p className="mt-2 text-slate-500">No source changes are waiting for review. Scan the registered portals to check for updates.</p></div> : drafts.map(draft => <article key={draft.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 p-4"><div><div className="flex items-center gap-2"><span className="rounded bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">AI DRAFT</span><h3 className="text-lg font-bold text-slate-900">{draft.service_name}</h3></div><p className="mt-1 text-xs text-slate-600">Source: {draft.portal} · {draft.source_snapshot}</p></div><p className="text-xs text-slate-500">Detected {formatDate(draft.timestamp)}</p></div><div className="p-5"><h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-700">Proposed source changes</h4><div className="space-y-3">{draft.changes.map((change, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[minmax(8rem,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center"><div className="flex items-center gap-2 text-sm font-medium text-slate-700">{change.field}{change.needs_review && <AlertCircle size={15} className="text-amber-500" aria-label="Needs additional review" />}</div><div className="max-h-28 overflow-auto rounded bg-red-50 p-2 text-sm text-red-700 line-through">{change.old_value}</div><ArrowRight size={16} className="hidden text-slate-400 md:block" /><div className="max-h-28 overflow-auto rounded bg-violet-50 p-2 text-sm text-violet-700">{change.new_value}</div></div>)}</div></div><div className="flex flex-wrap justify-end gap-3 border-t bg-slate-50 p-4"><button onClick={() => handleReject(draft.id)} className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"><X size={16} />Reject</button><button onClick={() => handleApprove(draft.id)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"><Check size={16} />Approve & sync to citizen guidance</button></div></article>)}
        </motion.section> : <motion.section key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950"><strong>Verified source of truth:</strong> each approved record is synchronized to semantic retrieval, so the citizen assistant can answer from reviewed service-flow facts and show the official source.</div>
          {services.map(service => <article key={service.service_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">APPROVED · CITIZEN-ANSWER READY</span><span className="rounded bg-violet-100 px-2 py-1 text-xs font-bold text-violet-800">v{service.version}</span></div><h3 className="text-lg font-bold text-slate-900">{service.service_name}</h3><p className="mt-1 text-sm text-slate-500">Agency: {service.portal} · Service ID: {service.service_id}</p></div><div className="text-right text-xs text-slate-500"><div className="flex items-center justify-end gap-1"><Clock3 size={13} />Last verified</div><p className="mt-1 font-medium text-slate-700">{formatDate(service.updated_at)}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><FileText size={15} />Service-flow data</div>{service.content.official_link && <a href={service.content.official_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">Official source <ExternalLink size={14} /></a>}</div><pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify(service.content, null, 2)}</pre></article>)}
          {services.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No verified service records are available yet.</div>}
        </motion.section>}
      </AnimatePresence>
    </div>
  )
}
