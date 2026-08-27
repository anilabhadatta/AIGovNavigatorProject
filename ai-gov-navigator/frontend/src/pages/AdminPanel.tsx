import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Edit3, AlertCircle, RefreshCw, Loader2, Database, GitPullRequest } from 'lucide-react'
import axios from 'axios'

interface DraftUpdate {
  id: string
  service_id: string
  service_name: string
  portal: string
  changes: {
    field: string
    old_value: string
    new_value: string
    needs_review: boolean
  }[]
  source_snapshot: string
  timestamp: string
}

interface ServiceEntry {
  service_id: string
  app_id: string
  service_name: string
  portal: string
  content: any
  version: number
  updated_at: string
}

export default function AdminPanel() {
  const [drafts, setDrafts] = useState<DraftUpdate[]>([])
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending')
  const [parentApiUrl, setParentApiUrl] = useState('http://localhost:8001/api/master')

  const fetchData = async () => {
    try {
      const [draftsRes, servicesRes] = await Promise.all([
        axios.get('http://localhost:8000/api/v1/admin/drafts'),
        axios.get('http://localhost:8000/api/v1/admin/services')
      ])
      setDrafts(draftsRes.data)
      setServices(servicesRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const res = await axios.post('http://localhost:8000/api/v1/admin/scan-updates', {
        master_api_url: parentApiUrl
      })
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
      await axios.post(`http://localhost:8000/api/v1/admin/drafts/${id}/approve`)
      await fetchData()
      alert('Update approved and knowledge base updated!')
    } catch (err) {
      console.error(err)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/admin/drafts/${id}/reject`)
      setDrafts(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32}/></div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Portal Admin Review</h2>
          <p className="text-gray-500 mt-2">Manage the local Knowledge Base and approve pending portal updates.</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={parentApiUrl}
            onChange={(e) => setParentApiUrl(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Gov Parent API URL"
          />
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isScanning ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {isScanning ? 'Scanning...' : 'Scan for Updates'}
          </button>
        </div>
      </div>

      <div className="flex space-x-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-4 flex items-center gap-2 font-medium transition-colors ${activeTab === 'pending' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <GitPullRequest size={18} />
          Pending Updates
          {drafts.length > 0 && (
            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">{drafts.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 px-4 flex items-center gap-2 font-medium transition-colors ${activeTab === 'active' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Database size={18} />
          Active Knowledge Base
        </button>
      </div>

      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'pending' ? (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {drafts.length === 0 ? (
                <div className="text-center p-12 glass rounded-2xl border border-gray-200 shadow-sm">
                  <div className="inline-block p-4 bg-green-50 rounded-full text-green-500 mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700">All caught up!</h3>
                  <p className="text-gray-500 mt-2">No pending updates to review. Click "Scan for Updates" to trigger the crawler.</p>
                </div>
              ) : (
                drafts.map(draft => (
                  <motion.div 
                    key={draft.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden mb-6"
                  >
                    <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">PENDING</span>
                          <h3 className="text-lg font-bold">{draft.service_name}</h3>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Portal: {draft.portal} • Source: {draft.source_snapshot}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Detected: {new Date(draft.timestamp).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Detected Changes</h4>
                      <div className="space-y-4">
                        {draft.changes.map((change, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="col-span-3 font-medium text-sm text-gray-600 flex items-center gap-2">
                              {change.field}
                              {change.needs_review && (
                                <span className="text-amber-500" title="Low confidence extraction">
                                  <AlertCircle size={14} />
                                </span>
                              )}
                            </div>
                            <div className="col-span-4 p-2 bg-red-50 text-red-700 border border-red-100 rounded text-sm relative line-through opacity-80 overflow-auto max-h-32">
                              {change.old_value}
                            </div>
                            <div className="col-span-1 text-center text-gray-400">→</div>
                            <div className="col-span-4 p-2 bg-green-50 text-green-700 border border-green-100 rounded text-sm relative overflow-auto max-h-32">
                              {change.new_value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
                      <button 
                        onClick={() => handleReject(draft.id)}
                        className="px-4 py-2 flex items-center gap-2 text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
                      >
                        <X size={16} /> Reject
                      </button>
                      <button 
                        className="px-4 py-2 flex items-center gap-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
                      >
                        <Edit3 size={16} /> Edit
                      </button>
                      <button 
                        onClick={() => handleApprove(draft.id)}
                        className="px-4 py-2 flex items-center gap-2 text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors font-medium text-sm shadow-sm"
                      >
                        <Check size={16} /> Approve & Publish
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {services.map(service => (
                <div key={service.service_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{service.service_name}</h3>
                      <p className="text-sm text-gray-500">App ID: {service.app_id} • Portal: {service.portal}</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">v{service.version}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 font-mono text-xs text-gray-700 overflow-auto max-h-48">
                    <pre>{JSON.stringify(service.content, null, 2)}</pre>
                  </div>
                  <div className="text-right mt-2 text-xs text-gray-400">
                    Last Updated: {new Date(service.updated_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <div className="text-center p-8 text-gray-500">No active knowledge base entries found. Database is empty.</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
