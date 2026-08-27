import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import CitizenPortal from './pages/CitizenPortal'
import AdminPanel from './pages/AdminPanel'
import { LayoutDashboard, MessageCircle, Sparkles } from 'lucide-react'

// CodeX: route shell and app-level branding for the citizen and admin experiences.
function App() {
  return (
    <Router basename="/navigator">
      <div className="min-h-screen bg-slate-950 text-foreground transition-colors duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.14),_transparent_30%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/75 px-5 py-4 backdrop-blur-2xl sm:px-8">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <Link to="/" className="group inline-flex items-center gap-3 rounded-full bg-white/6 px-4 py-2 backdrop-blur-xl transition-colors hover:bg-white/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.3)]">
                  <MessageCircle size={20} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/45">
                    <Sparkles size={10} /> Government Navigator
                  </div>
                  <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">AI Gov Navigator</h1>
                </div>
              </Link>

              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-cyan-100/80">
                Powered by CodeX
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-white/6 p-1 backdrop-blur-xl ring-1 ring-white/10">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <MessageCircle size={16} /> Citizen Chat
                </Link>
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LayoutDashboard size={16} /> Admin Panel
                </Link>
              </div>
            </div>
          </header>

          <main className="relative flex flex-1 overflow-hidden px-3 pb-3 sm:px-6 sm:pb-6">
            <div className="w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/3 shadow-[0_0_60px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
              <Routes>
                <Route path="/" element={<CitizenPortal />} />
                <Route path="/admin" element={<AdminPanel />} />
              </Routes>
            </div>
          </main>

          <footer className="relative z-10 border-t border-white/10 bg-slate-950/80 px-5 py-4 text-[11px] text-white/60">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="inline-flex items-center gap-2">
                <span>Powered by</span>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 font-semibold text-cyan-100">CodeX</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-center">
                <span>Created by</span>
                <a href="https://www.linkedin.com/in/aniruddha-routh/" target="_blank" rel="noreferrer" className="text-cyan-200 transition hover:text-cyan-100">Aniruddha Routh</a>
                <a href="https://www.linkedin.com/in/anilabha-datta/" target="_blank" rel="noreferrer" className="text-cyan-200 transition hover:text-cyan-100">Anilabha Datta</a>
                <span className="font-semibold text-white/80">CodeX</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </Router>
  )
}

export default App
