import { useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import {
  Badge, Button, Card, ErrorNote, LevelDots, Loader, SectionTitle, VerificationBadge,
} from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

const KIND_LABEL = { project: 'Project', certification: 'Certification', achievement: 'Achievement', experience: 'Experience', course: 'Course' }

export default function Passport() {
  const { data, error, loading, reload } = useApi('/student/passport')
  const [busy, setBusy] = useState('')
  const [issue, setIssue] = useState(null)
  const [draft, setDraft] = useState({ kind: 'project', title: '', description: '', issuer: '', url: '' })

  async function verify(id) {
    setBusy(id)
    setIssue(null)
    try {
      await api.post('/student/evidence/verify', { evidence_id: id, source: 'digilocker-sandbox' })
      reload()
    } catch (err) {
      setIssue(err)
    } finally {
      setBusy('')
    }
  }

  async function add(e) {
    e.preventDefault()
    setBusy('new')
    setIssue(null)
    try {
      await api.post('/student/evidence', draft)
      setDraft({ kind: 'project', title: '', description: '', issuer: '', url: '' })
      reload()
    } catch (err) {
      setIssue(err)
    } finally {
      setBusy('')
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const { student, skills, evidence, summary } = data
  const verifiedSkills = skills.filter((s) => s.verified)

  return (
    <>
      <PageHeader
        title="Skill passport"
        description="What an employer sees when they open your profile. Verified items are checked against a credential provider; everything else is clearly marked as your own claim."
      />

      <ErrorNote error={issue} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">{student.name}</h2>
            <p className="text-sm text-muted mt-1">
              {[student.department, student.institute, student.batch && `Class of ${student.batch}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {student.headline && <p className="text-sm mt-2 max-w-[70ch]">{student.headline}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {student.target_role && <Badge tone="info">Targeting {student.target_role}</Badge>}
            {student.cgpa && <Badge tone="neutral">CGPA {student.cgpa}</Badge>}
            <Badge tone="verified">{summary.verified} verified credentials</Badge>
            <Badge tone="neutral">{summary.unverified} self-declared</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title={`Skills (${skills.length})`}
            hint={`${verifiedSkills.length} are backed by a verified credential.`}
          />
          <ul className="divide-y divide-line">
            {skills.map((s) => (
              <li key={s.slug} className="py-2.5 first:pt-0 flex items-center gap-3">
                <span className="flex-1 truncate">{s.name}</span>
                <LevelDots level={s.level} />
                {s.verified ? <Badge tone="verified">Verified</Badge> : <Badge tone="neutral">Claimed</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionTitle title={`Evidence (${evidence.length})`} hint="Certifications can be checked against a credential provider." />
            <ul className="divide-y divide-line">
              {evidence.map((e) => (
                <li key={e.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.title}</span>
                    <Badge tone="neutral">{KIND_LABEL[e.kind] || e.kind}</Badge>
                    <VerificationBadge status={e.verification_status} />
                  </div>
                  {e.issuer && <p className="text-xs text-muted mt-1">Issued by {e.issuer}</p>}
                  {e.description && <p className="text-sm text-muted mt-1 max-w-[70ch]">{e.description}</p>}
                  {e.verification_status === 'unverified' && ['certification', 'achievement', 'course'].includes(e.kind) && (
                    <button className="btn-quiet mt-1.5 px-0" disabled={busy === e.id} onClick={() => verify(e.id)}>
                      {busy === e.id ? 'Checking' : 'Check against DigiLocker'}
                    </button>
                  )}
                  {e.verification_source && (
                    <p className="text-xs text-institute mt-1">Checked via {e.verification_source}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Add evidence" hint="A project, certificate or award you have not uploaded a document for." />
            <form onSubmit={add} className="space-y-3">
              <select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input className="input" placeholder="Title" required value={draft.title}
                     onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <input className="input" placeholder="Issuer or organisation (optional)" value={draft.issuer}
                     onChange={(e) => setDraft({ ...draft, issuer: e.target.value })} />
              <textarea className="input h-20 resize-none" placeholder="What did you build or achieve?"
                        value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <Button disabled={busy === 'new' || !draft.title}>Add to passport</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  )
}
