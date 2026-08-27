import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Info, ExternalLink, CarFront, MapPinHouse, FileText, IdCard, Sparkles, ArrowUpRight, Search, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  speechSynthesis?: SpeechSynthesis
}

interface ChatSource {
  link: string
  lastVerified: string
  ref: string
  serviceId?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  isTyping?: boolean
}

interface KnowledgeSource {
  id: string
  label: string
  icon: any
}

const suggestionGroups = [
  {
    label: 'English',
    suggestions: [
      'How do I apply for a new driving license?',
      'How can I update my Aadhaar address information?',
    ],
  },
  {
    label: 'বাংলা',
    suggestions: [
      'নতুন ড্রাইভিং লাইসেন্স আবেদনের তথ্য প্রদান',
      'আধার তথ্য আপডেট করার জন্য কীভাবে আবেদন করবেন',
    ],
  },
  {
    label: 'हिंदी',
    suggestions: [
      'नए ड्राइविंग लाइसेंस के लिए आवेदन कैसे करें',
      'आधार जानकारी अपडेट करने के लिए आवेदन कैसे करें',
    ],
  },
]

const loadingMessages = [
  'Scanning the service graph...',
  'Tracing the verified node...',
  'Charging the neon conduit...',
  'Aligning the answer pulse...',
]

const knowledgeSources: KnowledgeSource[] = [
  {
    id: 'dl_new_01',
    label: 'New Driving License Application',
    icon: CarFront,
  },
  {
    id: 'aadhaar_update_01',
    label: 'Aadhaar Address Update',
    icon: MapPinHouse,
  },
  {
    id: 'passport_new_01',
    label: 'Fresh Passport Application',
    icon: FileText,
  },
  {
    id: 'voter_new_01',
    label: 'New Voter ID Registration (Form 6)',
    icon: IdCard,
  },
]

export default function CitizenPortal() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Search the verified government knowledge base. Try a Bengali, Hindi, or English query to get grounded results instantly.'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingCopy, setLoadingCopy] = useState(loadingMessages[0])
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null)
  const [connectorPath, setConnectorPath] = useState('')
  const [connectorVisible, setConnectorVisible] = useState(false)
  const [connectorDrawn, setConnectorDrawn] = useState(false)
  const [connectorLength, setConnectorLength] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState('Voice input ready')

  const searchBarRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const connectorPathRef = useRef<SVGPathElement | null>(null)
  const loadingIntervalRef = useRef<number | null>(null)
  const finalizeTimerRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const assistantResponses = messages.slice(1).filter(message => message.role === 'assistant' && !message.isTyping)
  const latestAssistantMessage = assistantResponses[assistantResponses.length - 1] ?? null

  useEffect(() => {
    if (!isLoading) {
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
      return
    }

    let index = 0
    setLoadingCopy(loadingMessages[index])
    loadingIntervalRef.current = window.setInterval(() => {
      index = (index + 1) % loadingMessages.length
      setLoadingCopy(loadingMessages[index])
    }, 1200)

    return () => {
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
    }
  }, [isLoading])

  useEffect(() => {
    if (!connectorVisible || !connectorPathRef.current) return

    const length = connectorPathRef.current.getTotalLength()
    setConnectorLength(length)
    setConnectorDrawn(false)

    const frame = window.requestAnimationFrame(() => {
      setConnectorDrawn(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [connectorPath, connectorVisible])

  useEffect(() => {
    const SpeechRecognitionApi = (window as Window & WindowWithSpeech).SpeechRecognition || (window as Window & WindowWithSpeech).webkitSpeechRecognition

    if (!SpeechRecognitionApi) {
      setVoiceSupported(false)
      setVoiceStatus('Voice input is not supported in this browser')
      return
    }

    const recognition = new SpeechRecognitionApi()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN'

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      if (transcript) {
        setInput(transcript)
        setVoiceStatus('Voice captured. Review and send when ready.')
      }
    }

    recognition.onerror = (event: any) => {
      const errorMessage = event?.error || 'Voice capture failed'
      setVoiceStatus(errorMessage === 'not-allowed' ? 'Microphone permission was denied.' : `Voice capture failed: ${errorMessage}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current)
      }
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current)
      }
    }
  }, [])

  const toggleVoiceInput = () => {
    if (!voiceSupported || !recognitionRef.current) {
      setVoiceStatus('Voice input is not supported in this browser')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      setVoiceStatus('Listening stopped')
      return
    }

    try {
      recognitionRef.current.start()
      setIsListening(true)
      setVoiceStatus('Listening... speak your query now')
    } catch (error) {
      setVoiceStatus('Microphone is already active. Please try again.')
      setIsListening(false)
    }
  }

  const speakLatestAnswer = () => {
    if (!latestAssistantMessage?.content) return

    if (!('speechSynthesis' in window)) {
      setVoiceStatus('Text-to-speech is not supported in this browser')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setVoiceStatus('Audio playback stopped')
      return
    }

    const utterance = new SpeechSynthesisUtterance(latestAssistantMessage.content)
    utterance.lang = 'en-IN'
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setVoiceStatus('Speaking the latest answer')
  }

  // CodeX: keep the verified source path visible until the next user query triggers a fresh connection.
  const buildConnectorPath = (sourceId: string) => {
    const stageElement = stageRef.current
    const searchElement = searchBarRef.current
    const sourceElement = sourceRefs.current[sourceId]

    if (!stageElement || !searchElement || !sourceElement) return ''

    const stageRect = stageElement.getBoundingClientRect()
    const searchRect = searchElement.getBoundingClientRect()
    const sourceRect = sourceElement.getBoundingClientRect()

    const startX = searchRect.left + searchRect.width / 2 - stageRect.left
    const startY = searchRect.top + searchRect.height / 2 - stageRect.top
    const endX = sourceRect.left + sourceRect.width / 2 - stageRect.left
    const endY = sourceRect.top + sourceRect.height / 2 - stageRect.top

    const deltaX = endX - startX
    const midY = (startY + endY) / 2
    const curveLift = Math.min(220, Math.max(120, Math.abs(deltaX) * 0.18))

    const control1X = startX + deltaX * 0.28
    const control2X = startX + deltaX * 0.72
    const control1Y = midY - curveLift
    const control2Y = midY + curveLift

    return `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`
  }

  const startConnector = (sourceId: string) => {
    const path = buildConnectorPath(sourceId)
    if (!path) return false

    setActiveSourceId(sourceId)
    setConnectorPath(path)
    setConnectorVisible(true)
    setConnectorDrawn(false)
    return true
  }

  const finishConnector = () => {
    if (finalizeTimerRef.current) {
      window.clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = null
    }
    setConnectorVisible(false)
    setConnectorDrawn(false)
    setConnectorPath('')
    setConnectorLength(0)
    setActiveSourceId(null)
  }

  const sendQuery = async (query: string) => {
    if (!query.trim() || isLoading) return

    if (finalizeTimerRef.current) {
      window.clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = null
    }

    if (connectorVisible || activeSourceId) {
      finishConnector()
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setLoadingCopy(loadingMessages[0])

    // Add typing indicator
    const typingId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: typingId, role: 'assistant', content: '', isTyping: true }])

    try {
      // Phase 2: AI chat pipeline
      const res = await axios.post('/aigov/api/v1/chat', {
        query
      })

      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== typingId))

      const data = res.data
      const targetSourceId = data?.sources?.[0]?.serviceId || data?.sources?.[0]?.ref || null
      const targetSource = targetSourceId ? knowledgeSources.find(source => source.id === targetSourceId) : null

      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }

      setLoadingCopy(targetSource ? `Linking to ${targetSource.label}...` : 'Finalizing verified answer...')

      if (targetSourceId) {
        startConnector(targetSourceId)
      }

      const botMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }

      finalizeTimerRef.current = window.setTimeout(() => {
        setMessages(prev => [...prev, botMessage])
        setIsLoading(false)
        setLoadingCopy(loadingMessages[0])
      }, targetSourceId ? 1100 : 0)

    } catch (error: any) {
      console.error(error)
      setMessages(prev => prev.filter(m => m.id !== typingId))
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current)
        loadingIntervalRef.current = null
      }
      if (finalizeTimerRef.current) {
        window.clearTimeout(finalizeTimerRef.current)
        finalizeTimerRef.current = null
      }
      setIsLoading(false)
      finishConnector()
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: error.response?.data?.detail || "Sorry, I am having trouble connecting to the portal. Please try again later."
      }])
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendQuery(input)
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-none bg-slate-950 text-white">
      {/* CodeX: layered neon backdrop to emphasize the verified public-service graph. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.18),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

      <div className="relative z-10 flex h-full min-h-0 flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/55">
          <span className="inline-flex items-center gap-2">
            <Sparkles size={12} /> Citizen Search Interface
          </span>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1 text-[10px] tracking-[0.25em] text-white/70">
            Verified sources only
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center py-10 sm:py-12">
          <div ref={stageRef} className="relative w-full max-w-5xl xl:max-w-6xl">
            {connectorVisible && connectorPath && (
              <svg className="pointer-events-none absolute inset-0 hidden sm:block h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.65" />
                    <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#a3e635" stopOpacity="0.85" />
                  </linearGradient>
                  <filter id="connectorGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d={connectorPath}
                  fill="none"
                  stroke="url(#connectorGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.12"
                  filter="url(#connectorGlow)"
                />
                <path
                  ref={connectorPathRef}
                  d={connectorPath}
                  fill="none"
                  stroke="url(#connectorGradient)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.45"
                  filter="url(#connectorGlow)"
                  style={{
                    strokeDasharray: connectorLength,
                    strokeDashoffset: connectorDrawn ? 0 : connectorLength,
                    transition: 'stroke-dashoffset 1100ms ease-out, opacity 250ms ease-out',
                  }}
                />
              </svg>
            )}

            <div className="pointer-events-none absolute inset-0">
              <AnimatePresence>
                {knowledgeSources.map((source, index) => {
                  const Icon = source.icon
                  const positions = [
                    '-left-8 top-[-1.5rem] sm:-left-12 sm:top-[-1.75rem]',
                    '-right-8 top-[-0.75rem] sm:-right-12 sm:top-[-1.25rem]',
                    '-left-8 bottom-[-1.5rem] sm:-left-12 sm:bottom-[-1.75rem]',
                    '-right-8 bottom-[-0.75rem] sm:-right-12 sm:bottom-[-1.25rem]',
                  ]

                  return (
                    <motion.div
                      key={source.label}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
                      transition={{ duration: 5 + index, repeat: Infinity, ease: 'easeInOut' }}
                      className={`absolute ${positions[index]} hidden sm:block`}
                      ref={el => {
                        sourceRefs.current[source.id] = el
                      }}
                    >
                      <div className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 backdrop-blur-xl shadow-[0_0_30px_rgba(15,23,42,0.35)] transition-all duration-300 ${activeSourceId === source.id ? 'border-emerald-300/60 bg-emerald-400/16 ring-1 ring-emerald-200/40 shadow-[0_0_40px_rgba(34,197,94,0.32)]' : 'border-white/10 bg-gradient-to-r from-violet-500/18 via-fuchsia-500/12 to-amber-400/10'}`}>
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full ring-1 ${activeSourceId === source.id ? 'bg-emerald-300/25 text-emerald-100 ring-emerald-200/35' : 'bg-violet-400/20 text-violet-100 ring-violet-300/20'}`}>
                          <Icon size={12} />
                        </div>
                        <span className={`max-w-[180px] text-[10px] font-medium leading-tight ${activeSourceId === source.id ? 'text-emerald-50' : 'text-white/80'}`}>
                          {source.label}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mx-auto flex max-w-2xl flex-col items-center text-center"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-xl ring-1 ring-white/10">
                <Search size={12} /> Ask in English, Hindi, or Bengali
              </div>

              <h1 className="max-w-2xl text-xl font-semibold tracking-tight text-white sm:text-3xl">
                Search the government knowledge graph.
              </h1>
              <p className="mt-3 max-w-lg text-[11px] leading-relaxed text-white/58 sm:text-xs">
                Type a service question and get a grounded response from verified sources, with no traditional chat framing.
              </p>

              <form onSubmit={handleSend} className="mt-7 w-full">
                <div ref={searchBarRef} className="flex w-full items-center gap-2 rounded-full bg-white/8 px-3 py-2.5 backdrop-blur-2xl shadow-[0_0_45px_rgba(15,23,42,0.45)] ring-1 ring-white/10">
                  <button
                    type="button"
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                    onClick={toggleVoiceInput}
                    disabled={!voiceSupported || isLoading}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-all ${isListening ? 'bg-rose-400 text-slate-950 shadow-[0_0_18px_rgba(251,113,133,0.6)]' : 'bg-white/10 text-white/80 hover:bg-white/14'} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Search: new driving license, Aadhaar update, passport, voter ID..."
                    className="flex-1 bg-transparent px-3 text-xs sm:text-sm text-white placeholder:text-white/45 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </form>

              <div className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/50">
                {voiceStatus}
              </div>

              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-4 py-2 text-[11px] text-white/72 backdrop-blur-xl"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)] animate-pulse" />
                    {loadingCopy}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {suggestionGroups.flatMap(group => group.suggestions).map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendQuery(suggestion)}
                    className="rounded-full bg-white/7 px-3.5 py-1.5 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/14 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-5xl pb-2">
          <AnimatePresence>
            {!isLoading && latestAssistantMessage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="rounded-[1.5rem] bg-white/6 px-5 py-4 backdrop-blur-2xl shadow-[0_0_40px_rgba(15,23,42,0.28)]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    <ArrowUpRight size={12} /> Live result
                  </div>

                  {latestAssistantMessage.content && (
                    <button
                      type="button"
                      onClick={speakLatestAnswer}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/12"
                    >
                      {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      {isSpeaking ? 'Stop' : 'Listen'}
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/88">
                  {latestAssistantMessage.content}
                </div>
                {latestAssistantMessage.sources && latestAssistantMessage.sources.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {latestAssistantMessage.sources.map((src, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-xs text-white/70">
                        <Info size={12} />
                        <span>{src.ref}</span>
                        <a href={src.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100">
                          Portal <ExternalLink size={10} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
