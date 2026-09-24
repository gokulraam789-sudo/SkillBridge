import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import {
  Badge, Button, Card, Empty, ErrorNote, Loader, Progress, SectionTitle,
} from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

const KINDS = [
  ['internship', 'Internship'],
  ['job', 'Graduate role'],
  ['project', 'Industry project'],
  ['challenge', 'Challenge'],
]

const STATUSES = ['applied', 'shortlisted', 'interviewing', 'offered', 'closed']

export default function Opportunities() {
  const { data, error, loading, reload } = useApi('/industry/opportunities')
  const applications = useApi('/industry/applications')
  const [roles, setRoles] = useState([])
  const [taxonomy, setTaxonomy] = useState([])
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [candidates, setCandidates] = useState(null)
  const [issue, setIssue] = useState(null)
  const [draft, setDraft] = useState({
    title: '', kind: 'internship', description: '', location: 'Remote', stipend: '',
    role_slug: '', open_positions: 1, skills: [],
  })

  useEffect(() => {
    api.get('/reference/roles').then(setRoles).catch(() => {})
    api.get('/reference/skills').then(setTaxonomy).catch(() => {})
  }, [])

  useEffect(() => {
    if (!openId) return setCandidates(null)
    setCandidates(null)
    api.get(`/industry/opportunities/${openId}/candidates`).then(setCandidates).catch(setIssue)
  }, [openId])

  async function create(e) {
    e.preventDefault()
    setIssue(null)
    try {
      await api.post('/industry/opportunities', {
        ...draft,
        skills: draft.skills.map((slug) => ({ slug, importance: 4, expected_level: 3 })),
      })
      setCreating(false)
      setDraft({ title: '', kind: 'internship', description: '', location: 'Remote', stipend: '',
                 role_slug: '', open_positions: 1, skills: [] })
      reload()
    } catch (err) {
      setIssue(err)
    }
  }

  async function move(application, status) {
    setIssue(null)
    try {
      await api.put(`/industry/applications/${application.id}`, { status })
      applications.reload()
    } catch (err) {
      setIssue(err)
    }
  }

  if (loading && !data) return <Loader />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const opportunities = data || []

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Post what you need skill by skill. SkillBridge recommends students whose graphs line up, before they ever apply."
        action={
          <Button role="industry" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Cancel' : 'Post an opportunity'}
          </Button>
        }
      />

      <ErrorNote error={issue} />

      {creating && (
        <Card className="mb-5">
          <SectionTitle
            title="New opportunity"
            hint="Leave the skills blank and the requirements of the role you pick are used as the starting point."
          />
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">Title</label>
              <input id="title" className="input mt-1.5" required value={draft.title}
                     onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                     placeholder="Backend Engineering Intern" />
            </div>
            <div>
              <label className="label" htmlFor="kind">Type</label>
              <select id="kind" className="input mt-1.5" value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="role">Closest role</label>
              <select id="role" className="input mt-1.5" value={draft.role_slug}
                      onChange={(e) => setDraft({ ...draft, role_slug: e.target.value })}>
                <option value="">Select a role</option>
                {roles.map((r) => <option key={r.slug} value={r.slug}>{r.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="location">Location</label>
              <input id="location" className="input mt-1.5" value={draft.location}
                     onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="stipend">Stipend or salary</label>
              <input id="stipend" className="input mt-1.5" value={draft.stipend}
                     onChange={(e) => setDraft({ ...draft, stipend: e.target.value })}
                     placeholder="Rs 30,000/month" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">What the work involves</label>
              <textarea id="description" className="input mt-1.5 h-24 resize-none" value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Skills you need (optional)</label>
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                {taxonomy.map((t) => {
                  const on = draft.skills.includes(t.slug)
                  return (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          skills: on ? d.skills.filter((s) => s !== t.slug) : [...d.skills, t.slug],
                        }))
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        on ? 'border-industry bg-industry-soft text-industry' : 'border-line text-muted'
                      }`}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button role="industry">Post opportunity</Button>
            </div>
          </form>
        </Card>
      )}

      {opportunities.length === 0 && !creating && (
        <Empty title="Nothing posted yet" hint="Post an internship, project or challenge and matching students appear straight away." />
      )}

      <div className="space-y-4">
        {opportunities.map((opp) => (
          <Card key={opp.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-semibold">{opp.title}</h3>
                  <Badge tone="neutral">{KINDS.find(([k]) => k === opp.kind)?.[1] || opp.kind}</Badge>
                  {!opp.is_open && <Badge tone="danger">Closed</Badge>}
                </div>
                <p className="text-sm text-muted mt-0.5">
                  {[opp.location, opp.stipend, `${opp.open_positions} ${opp.open_positions === 1 ? 'position' : 'positions'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {opp.description && <p className="text-sm mt-2 max-w-[80ch]">{opp.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {opp.skills.map((s) => <Badge key={s.slug} tone="neutral">{s.name}</Badge>)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-sm text-muted">{opp.applicants} applied</span>
                <Button role="industry" tone={openId === opp.id ? 'ghost' : 'soft'}
                        onClick={() => setOpenId(openId === opp.id ? null : opp.id)}>
                  {openId === opp.id ? 'Hide matches' : 'See recommended students'}
                </Button>
                {opp.is_open && (
                  <button className="btn-quiet" onClick={() => api.del(`/industry/opportunities/${opp.id}`).then(reload)}>
                    Close this posting
                  </button>
                )}
              </div>
            </div>

            {openId === opp.id && (
              <div className="mt-5 border-t border-line pt-5">
                {!candidates && <Loader label="Ranking the talent pool" />}
                {candidates && candidates.candidates.length === 0 && (
                  <p className="text-sm text-muted">No student graph covers these requirements yet.</p>
                )}
                {candidates && (
                  <ul className="divide-y divide-line">
                    {candidates.candidates.slice(0, 10).map((c) => (
                      <li key={c.student_id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{c.name}</span>
                              {c.verified_count > 0 && <Badge tone="verified">{c.verified_count} verified</Badge>}
                              {c.application_status && <Badge tone="info">{c.application_status}</Badge>}
                            </div>
                            <p className="text-sm text-muted">{c.institute} · {c.department}</p>
                          </div>
                          <div className="flex items-center gap-3 min-w-[170px]">
                            <Progress value={c.score} colour="bg-industry" />
                            <span className="text-sm tabular-nums">{c.score}%</span>
                          </div>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {c.reasons.map((reason, i) => (
                            <li key={i} className="text-sm text-muted flex gap-2">
                              <span className="text-line">—</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {(applications.data || []).length > 0 && (
        <Card className="mt-6">
          <SectionTitle title="Applications" hint="Students who applied with their skill passport." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="text-left font-medium py-2">Student</th>
                  <th className="text-left font-medium py-2">Opportunity</th>
                  <th className="text-left font-medium py-2">Match</th>
                  <th className="text-left font-medium py-2">Stage</th>
                </tr>
              </thead>
              <tbody>
                {applications.data.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="py-2.5">
                      <span className="font-medium">{a.student}</span>
                      <span className="block text-xs text-muted">{a.institute}</span>
                    </td>
                    <td className="py-2.5 text-muted">{a.opportunity}</td>
                    <td className="py-2.5 tabular-nums">{Math.round(a.score)}%</td>
                    <td className="py-2.5">
                      <select className="input w-auto py-1" value={a.status} onChange={(e) => move(a, e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
