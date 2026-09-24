import { useRef, useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Button, Card } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'

const SUGGESTIONS = [
  'What skills am I missing?',
  'What should I learn next?',
  'Why am I not matching a particular role?',
  'Which opportunities fit my current skills?',
  'How do I improve my readiness?',
]

export default function Assistant() {
  const [messages, setMessages] = useState([
    {
      from: 'assistant',
      text: 'Ask me anything about your skill graph, your gaps or the roles you are aiming at. I only answer from what is actually in your profile.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  async function send(question) {
    const text = (question ?? input).trim()
    if (!text || busy) return
    setMessages((m) => [...m, { from: 'student', text }])
    setInput('')
    setBusy(true)
    try {
      const result = await api.post('/student/assistant', { question: text })
      setMessages((m) => [...m, { from: 'assistant', text: result.answer, engine: result.engine }])
    } catch (err) {
      setMessages((m) => [...m, { from: 'assistant', text: err.message, error: true }])
    } finally {
      setBusy(false)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <>
      <PageHeader
        title="Ask SkillBridge"
        description="Grounded in your own graph, gaps and matches. It will not invent a skill or an employer that is not in your profile."
      />

      <Card className="p-0 overflow-hidden">
        <div className="max-h-[52vh] overflow-y-auto px-5 py-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.from === 'student' ? 'flex justify-end' : ''}>
              <div
                className={`max-w-[80ch] rounded-xl px-4 py-2.5 text-sm whitespace-pre-line ${
                  m.from === 'student'
                    ? 'bg-student text-white'
                    : m.error
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-paper border border-line'
                }`}
              >
                {m.text}
                {m.engine === 'built-in' && (
                  <span className="block mt-2">
                    <Badge tone="neutral">Answered from your profile data</Badge>
                  </span>
                )}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-muted">Reading your graph…</p>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} disabled={busy}
                      className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-paper hover:text-ink">
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your skills, gaps or matches"
              aria-label="Your question"
            />
            <Button disabled={busy || !input.trim()}>Send</Button>
          </form>
        </div>
      </Card>
    </>
  )
}
