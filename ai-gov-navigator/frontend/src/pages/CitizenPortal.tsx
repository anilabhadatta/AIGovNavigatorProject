import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Info, ExternalLink } from 'lucide-react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: any[]
  isTyping?: boolean
}

export default function CitizenPortal() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Namaste! I am your AI Government Service Navigator. How can I help you today? (Try asking: "How do I apply for a driving license?")'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Add typing indicator
    const typingId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: typingId, role: 'assistant', content: '', isTyping: true }])

    try {
      // Phase 2: AI chat pipeline
      const res = await axios.post('http://localhost:8000/aigov/api/v1/chat', {
        query: input
      })

      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== typingId))

      const data = res.data
      const botMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }
      setMessages(prev => [...prev, botMessage])

    } catch (error: any) {
      console.error(error)
      setMessages(prev => prev.filter(m => m.id !== typingId))
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: error.response?.data?.detail || "Sorry, I am having trouble connecting to the portal. Please try again later."
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto glass rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      <div className="bg-primary/5 p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">Citizen Assistant</h2>
          <p className="text-xs text-gray-500">Grounded strictly in verified KB</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-gray-100 rounded-tl-sm text-gray-800'}`}>
                {msg.isTyping ? (
                  <div className="flex space-x-2 items-center h-5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    {msg.sources && msg.sources.map((src, i) => (
                      <div key={i} className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex flex-col gap-1">
                        <div className="flex items-center gap-1 font-semibold text-primary/80">
                          <Info size={12} /> Source Citation
                        </div>
                        <p>Ref: {src.ref}</p>
                        <p>Last Verified: {src.lastVerified}</p>
                        <a href={src.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                          Official Portal <ExternalLink size={10} />
                        </a>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question here in English, Hindi, or Bengali..."
            className="flex-1 p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all bg-slate-50"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-primary-dark text-white p-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center w-12 h-12"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  )
}
