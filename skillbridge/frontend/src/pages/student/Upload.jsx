import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Button, Card, ErrorNote, LevelDots, SectionTitle } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'

const KINDS = [
  ['resume', 'Resume'],
  ['transcript', 'Transcript'],
  ['project', 'Project write-up'],
  ['certificate', 'Certificate'],
]

export default function Upload() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [kind, setKind] = useState('resume')
  const [pasted, setPasted] = useState('')
  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  async function run(fn) {
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const result = await fn()
      setProposal(result)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) run(() => api.upload('/student/documents', file, kind))
  }

  const toggle = (list, index) =>
    setProposal((p) => ({
      ...p,
      [list]: p[list].map((item, i) => (i === index ? { ...item, accepted: !item.accepted } : item)),
    }))

  const setLevel = (index, level) =>
    setProposal((p) => ({
      ...p,
      skills: p.skills.map((s, i) => (i === index ? { ...s, level } : s)),
    }))

  async function commit() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post('/student/extraction/commit', {
        document_id: proposal.document_id,
        skills: proposal.skills,
        evidence: proposal.evidence,
        cgpa: proposal.cgpa,
      })
      setSaved(result)
      setProposal(null)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Add documents"
        description="Upload a resume, transcript or project write-up. SkillBridge reads it, proposes skills and evidence, and you correct anything it got wrong before it enters your graph."
      />

      {saved && (
        <div className="card p-4 mb-5 border-institute/30 bg-institute-soft">
          <p className="text-sm text-institute">
            Added {saved.skills_added} skills, raised {saved.skills_raised}, and recorded{' '}
            {saved.evidence_added} pieces of evidence.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate('/student/graph')}>See your graph</Button>
            <Button tone="ghost" onClick={() => navigate('/student/gaps')}>
              Run gap analysis
            </Button>
          </div>
        </div>
      )}

      <ErrorNote error={error} />

      {!proposal && (
        <div className="grid gap-5 lg:grid-cols-2 mt-1">
          <Card>
            <SectionTitle title="Upload a file" hint="PDF, DOCX or TXT, up to 8 MB." />
            <div className="flex flex-wrap gap-2 mb-4">
              {KINDS.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setKind(value)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    kind === value ? 'border-student text-student bg-student-soft' : 'border-line text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input ref={fileRef} type="file" onChange={onFile} accept=".pdf,.docx,.txt,.md" className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-xl border-2 border-dashed border-line py-10 text-center hover:border-student/50 hover:bg-student-soft/40"
            >
              <span className="block font-medium">{busy ? 'Reading your document' : 'Choose a file'}</span>
              <span className="block text-sm text-muted mt-1">
                Nothing is added to your graph until you review it
              </span>
            </button>
          </Card>

          <Card>
            <SectionTitle title="Or paste the text" hint="Useful if your resume lives in another tool." />
            <textarea
              className="input h-44 resize-none"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'Skills: Python, SQL, Power BI\nProjects: Sales dashboard for a local retailer...'}
            />
            <Button
              className="mt-3"
              disabled={busy || pasted.trim().length < 40}
              onClick={() => run(() => api.post('/student/documents/text', { text: pasted, kind }))}
            >
              Read this text
            </Button>
          </Card>
        </div>
      )}

      {proposal && (
        <div className="space-y-5">
          <Card>
            <SectionTitle
              title="Review what was found"
              hint={proposal.note}
              action={
                <div className="flex gap-2">
                  <Button tone="ghost" onClick={() => setProposal(null)}>
                    Discard
                  </Button>
                  <Button onClick={commit} disabled={busy}>
                    {busy ? 'Saving' : 'Add to my skill graph'}
                  </Button>
                </div>
              }
            />
            {proposal.cgpa && <Badge tone="info">CGPA read as {proposal.cgpa}</Badge>}
          </Card>

          <Card>
            <SectionTitle
              title={`Skills (${proposal.skills.filter((s) => s.accepted).length} selected)`}
              hint="Untick anything that is not really yours, and adjust the level if it reads too high or low."
            />
            <ul className="divide-y divide-line">
              {proposal.skills.map((skill, i) => (
                <li key={skill.slug} className="py-3 first:pt-0 flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    checked={skill.accepted}
                    onChange={() => toggle('skills', i)}
                    className="mt-1 h-4 w-4 accent-[#1F4FD8]"
                    aria-label={`Include ${skill.name}`}
                  />
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{skill.name}</span>
                      <LevelDots level={skill.level} />
                      <span className="text-xs text-muted">confidence {Math.round(skill.confidence * 100)}%</span>
                    </div>
                    {skill.evidence_text && (
                      <p className="text-sm text-muted mt-1 max-w-[80ch]">Found in: {skill.evidence_text}</p>
                    )}
                  </div>
                  <select
                    className="input w-auto"
                    value={skill.level}
                    onChange={(e) => setLevel(i, Number(e.target.value))}
                    aria-label={`Level for ${skill.name}`}
                  >
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>
                        {['Aware', 'Learning', 'Working', 'Strong', 'Expert'][l - 1]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </Card>

          {proposal.evidence.length > 0 && (
            <Card>
              <SectionTitle
                title="Projects, certificates and achievements"
                hint="These go on your passport as student-provided until a credential check verifies them."
              />
              <ul className="divide-y divide-line">
                {proposal.evidence.map((item, i) => (
                  <li key={i} className="py-3 first:pt-0 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.accepted}
                      onChange={() => toggle('evidence', i)}
                      className="mt-1 h-4 w-4 accent-[#1F4FD8]"
                      aria-label={`Include ${item.title}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        <Badge tone="neutral">{item.kind}</Badge>
                      </div>
                      <p className="text-sm text-muted mt-0.5 max-w-[80ch]">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
