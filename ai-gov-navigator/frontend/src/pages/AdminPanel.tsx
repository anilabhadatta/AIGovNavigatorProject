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

        <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">
          <div className="flex items-center justify-between gap-3"><span>Username</span><span className="font-semibold text-cyan-200">admin</span></div>
          <div className="mt-1 flex items-center justify-between gap-3"><span>Password</span><span className="font-semibold text-cyan-200">admin</span></div>
        </div>

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
    <div className="h-full min-h-0 w-full overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(15,23,42,0.38)] backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2.5 text-cyan-200"><Database size={22} /></div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/80">Live governance console</p>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">From official portal changes to trustworthy citizen guidance.</h2>
              <p className="mt-3 max-w-xl text-sm text-slate-300">This demo tracks public service-flow information—steps, documents, fees, and portal UI changes without ingesting sensitive citizen data.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input value={parentApiUrl} onChange={event => setParentApiUrl(event.target.value)} aria-label="Government parent API URL" className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 sm:w-64" placeholder="Gov Parent API URL" />
              <button onClick={handleScan} disabled={isScanning} className="flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">{isScanning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{isScanning ? 'Scanning...' : 'Scan updates'}</button>
              <button onClick={handleLogout} className="text-sm text-slate-300 transition hover:text-white">Logout</button>
            </div>
          </div>
        </header>

        <section aria-label="Knowledge update pipeline" className="rounded-[1.5rem] border border-white/10 bg-white/4 p-4 shadow-[0_0_30px_rgba(15,23,42,0.22)] backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-cyan-100">
            <ShieldCheck size={18} className="text-cyan-300" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100/90">Governed update pipeline</h3>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-100/80">Human review required</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            {pipeline.map((stage, index) => {
              const Icon = stage.icon
              return (
                <div key={stage.title} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-slate-900/50 p-3 text-left ring-1 ring-white/[0.03]">
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-2 text-cyan-200"><Icon size={15} /></div>
                    {index < pipeline.length - 1 && <ArrowRight size={15} className="hidden text-slate-500 lg:block" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{index + 1}. {stage.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{stage.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section aria-label="Live demo summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, description]) => (
            <div key={label} className="rounded-[1.4rem] border border-white/10 bg-slate-900/55 p-4 shadow-[0_0_25px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{description}</p>
            </div>
          ))}
        </section>

        <div role="tablist" aria-label="Knowledge governance records" className="flex gap-2 border-b border-white/10 pb-2">
          <button role="tab" aria-selected={activeTab === 'active'} onClick={() => setActiveTab('active')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'active' ? 'bg-cyan-400/12 text-cyan-100 ring-1 ring-cyan-400/20' : 'text-slate-400 hover:text-white'}`}><Database size={16} />Verified Knowledge Base</button>
          <button role="tab" aria-selected={activeTab === 'pending'} onClick={() => setActiveTab('pending')} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === 'pending' ? 'bg-cyan-400/12 text-cyan-100 ring-1 ring-cyan-400/20' : 'text-slate-400 hover:text-white'}`}><GitPullRequest size={16} />Review Queue {drafts.length > 0 && <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">{drafts.length}</span>}</button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'pending' ? (
            <motion.section key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-400/8 p-4 text-sm text-cyan-50">
                <strong>Review gate:</strong> these proposed differences were detected from registered portal sources and structured by AI. They do not reach the citizen assistant until an administrator approves them.
              </div>

              {drafts.length === 0 ? (
                <div className="rounded-[1.6rem] border border-white/10 bg-slate-900/55 p-12 text-center shadow-[0_0_28px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                  <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"><Check size={28} /></div>
                  <h3 className="text-xl font-semibold text-white">All caught up</h3>
                  <p className="mt-2 text-slate-300">No source changes are waiting for review. Scan the registered portals to check for updates.</p>
                </div>
              ) : (
                drafts.map(draft => (
                  <article key={draft.id} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/55 shadow-[0_0_28px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-white/[0.02] p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">AI draft</span>
                          <h3 className="text-lg font-semibold text-white">{draft.service_name}</h3>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">Source: {draft.portal} · {draft.source_snapshot}</p>
                      </div>
                      <p className="text-xs text-slate-400">Detected {formatDate(draft.timestamp)}</p>
                    </div>

                    <div className="p-5">
                      <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Proposed source changes</h4>
                      <div className="space-y-3">
                        {draft.changes.map((change, index) => (
                          <div key={index} className="grid gap-3 rounded-2xl border border-white/8 bg-slate-950/60 p-3 md:grid-cols-[minmax(8rem,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">{change.field}{change.needs_review && <AlertCircle size={15} className="text-amber-300" aria-label="Needs additional review" />}</div>
                            <div className="max-h-28 overflow-auto rounded-xl bg-rose-500/10 p-2 text-sm text-rose-200 line-through">{change.old_value}</div>
                            <ArrowRight size={16} className="hidden text-slate-500 md:block" />
                            <div className="max-h-28 overflow-auto rounded-xl bg-cyan-400/10 p-2 text-sm text-cyan-100">{change.new_value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
                      <button onClick={() => handleReject(draft.id)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"><X size={14} /> Reject</button>
                      <button onClick={() => handleApprove(draft.id)} className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"><Check size={14} /> Approve update</button>
                    </div>
                  </article>
                ))
              )}
            </motion.section>
          ) : (
            <motion.section key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-[1.4rem] border border-emerald-400/20 bg-emerald-400/8 p-4 text-sm text-emerald-50">
                <strong>Verified source of truth:</strong> each approved record is synchronized to semantic retrieval, so the citizen assistant can answer from reviewed service-flow facts and show the official source.
              </div>

              {services.map(service => (
                <article key={service.service_id} className="rounded-[1.5rem] border border-white/10 bg-slate-900/55 p-5 shadow-[0_0_28px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">Approved</span>
                        <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100">v{service.version}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white">{service.service_name}</h3>
                      <p className="mt-1 text-sm text-slate-400">Agency: {service.portal} · Service ID: {service.service_id}</p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div className="flex items-center justify-end gap-1"><Clock3 size={13} /> Last verified</div>
                      <p className="mt-1 font-medium text-slate-200">{formatDate(service.updated_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400"><FileText size={15} />Service-flow data</div>
                    {service.content.official_link && (
                      <a href={service.content.official_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium text-cyan-200 transition hover:text-cyan-100">Official source <ExternalLink size={14} /></a>
                    )}
                  </div>

                  <pre className="mt-3 max-h-52 overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-200">{JSON.stringify(service.content, null, 2)}</pre>
                </article>
              ))}

              {services.length === 0 && (
                <div className="rounded-[1.6rem] border border-white/10 bg-slate-900/55 p-8 text-center text-slate-300 backdrop-blur-xl">No verified service records are available yet.</div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
