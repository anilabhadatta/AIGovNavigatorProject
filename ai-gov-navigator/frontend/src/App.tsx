import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import CitizenPortal from './pages/CitizenPortal'
import AdminPanel from './pages/AdminPanel'
import { LayoutDashboard, MessageCircle } from 'lucide-react'

function App() {
  return (
    <Router basename="/navigator">
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <nav className="glass sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-lg">
              <MessageCircle size={24} />
            </div>
            <h1 className="text-xl font-bold font-sans tracking-tight">AI Gov Navigator</h1>
          </div>
          <div className="flex gap-4">
            <Link to="/" className="flex items-center gap-2 hover:text-primary transition-colors font-medium">
              <MessageCircle size={18} /> Citizen Chat
            </Link>
            <Link to="/admin" className="flex items-center gap-2 hover:text-secondary-dark transition-colors font-medium">
              <LayoutDashboard size={18} /> Admin Panel
            </Link>
          </div>
        </nav>

        <main className="container mx-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<CitizenPortal />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
