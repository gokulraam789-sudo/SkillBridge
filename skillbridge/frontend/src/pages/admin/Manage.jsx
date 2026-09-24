import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import {
  Badge, Button, Card, ErrorNote, Loader, SectionTitle, Tabs, VerificationBadge,
} from '../../components/UI.jsx'
import { api } from '../../lib/api.js'

const TABS = [
  { id: 'people', label: 'Accounts' },
  { id: 'skills', label: 'Skill taxonomy' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'opportunities', label: 'Opportunities' },
]

export default function Manage() {
  const [tab, setTab] = useState('people')
  return (
    <>
      <PageHeader
        title="Manage platform"
        description="Accounts, the skill taxonomy every dashboard reads from, credential review, and posted opportunities."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} role="admin" />
      {tab === 'people' && <People />}
      {tab === 'skills' && <Taxonomy />}
      {tab === 'credentials' && <Credentials />}
      {tab === 'opportunities' && <Opportunities />}
    </>
  )
}

function useResource(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  function load() {
    setLoading(true)
    api.get(path).then((d) => { setData(d); setError(null) }).catch(setError).finally(() => setLoading(false))
  }
  useEffect(load, [path])
  return { data, error, loading, reload: load, setError }
}

const ROLE_TONE = { student: 'info', institute: 'verified', industry: 'warn', admin: 'neutral' }

function People() {
  const [role, setRole] = useState('')
  const { data, error, loading, reload, setError } = useResource(`/admin/users${role ? `?role=${role}` : ''}`)
  const [org, setOrg] = useState({ kind: 'institutes', name: '', extra: '' })

  async function remove(u) {
    setError(null)
    try {
      await api.del(`/admin/users/${u.id}`)
      reload()
    } catch (err) { setError(err) }
  }

  async function addOrg(e) {
    e.preventDefault()
    setError(null)
    try {
      const body = org.kind === 'institutes' ? { name: org.name, city: org.extra } : { name: org.name, sector: org.extra }
      await api.post(`/admin/${org.kind}`, body)
      setOrg({ ...org, name: '', extra: '' })
    } catch (err) { setError(err) }
  }

  return (
    <div className="space-y-5">
      <ErrorNote error={error} />

      <Card>
        <SectionTitle title="Add an organisation" hint="Institutes and companies must exist before their staff can sign up against them." />
        <form className="grid gap-3 sm:grid-cols-[160px_1fr_1fr_auto]" onSubmit={addOrg}>
          <select className="input" value={org.kind} onChange={(e) => setOrg({ ...org, kind: e.target.value })}>
            <option value="institutes">Institute</option>
            <option value="companies">Company</option>
          </select>
          <input
            className="input"
            placeholder="Name"
            value={org.name}
            onChange={(e) => setOrg({ ...org, name: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder={org.kind === 'institutes' ? 'City' : 'Sector'}
            value={org.extra}
            onChange={(e) => setOrg({ ...org, extra: e.target.value })}
          />
          <Button role="admin" type="submit">Add</Button>
        </form>
      </Card>

      <Card>
        <SectionTitle
          title="Accounts"
          hint="Each account only ever sees the slice of the shared graph its role allows."
          action={
            <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="institute">Institutes</option>
              <option value="industry">Industry</option>
              <option value="admin">Admins</option>
            </select>
          }
        />
        {loading && <Loader />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data || []).map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4 font-medium">{u.name}</td>
                  <td className="py-2.5 pr-4 text-muted">{u.email}</td>
                  <td className="py-2.5 pr-4"><Badge tone={ROLE_TONE[u.role] || 'neutral'}>{u.role}</Badge></td>
                  <td className="py-2.5 pr-4 text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</td>
                  <td className="py-2.5 text-right">
                    <button className="btn-quiet text-rose-700" onClick={() => remove(u)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Taxonomy() {
  const { data, error, loading, reload, setError } = useResource('/admin/skills')
  const [draft, setDraft] = useState({ slug: '', name: '', category: 'technical', description: '' })

  async function add(e) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/admin/skills', draft)
      setDraft({ slug: '', name: '', category: 'technical', description: '' })
      reload()
    } catch (err) { setError(err) }
  }

  async function remove(slug) {
    setError(null)
    try {
      await api.del(`/admin/skills/${slug}`)
      reload()
    } catch (err) { setError(err) }
  }

  const grouped = (data || []).reduce((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <ErrorNote error={error} />
      <Card>
        <SectionTitle
          title="Add a skill"
          hint="Adding a node here makes it available to extraction, matching, analytics and roadmaps at once."
        />
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={add}>
          <input className="input" placeholder="Name, e.g. Apache Kafka" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <input className="input" placeholder="Slug, e.g. kafka" value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required />
          <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            <option value="technical">Technical</option>
            <option value="tool">Tool or platform</option>
            <option value="domain">Domain</option>
            <option value="soft">Ways of working</option>
          </select>
          <input className="input" placeholder="What it means here" value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <Button role="admin" type="submit">Add skill</Button>
        </form>
      </Card>

      {loading && <Loader />}
      {Object.entries(grouped).map(([category, skills]) => (
        <Card key={category}>
          <SectionTitle title={category} hint={`${skills.length} skills in this branch of the taxonomy.`} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted">{s.students} student graphs</p>
                </div>
                <button className="btn-quiet text-rose-700 shrink-0" onClick={() => remove(s.slug)}>Retire</button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function Credentials() {
  const [status, setStatus] = useState('')
  const { data, error, loading, reload, setError } = useResource(`/admin/credentials${status ? `?status=${status}` : ''}`)

  async function review(id, next) {
    setError(null)
    try {
      await api.put(`/admin/credentials/${id}`, { status: next })
      reload()
    } catch (err) { setError(err) }
  }

  return (
    <div className="space-y-5">
      <ErrorNote error={error} />
      <Card>
        <SectionTitle
          title="Credential review"
          hint="Verified, pending and student-provided are three different things, and the passport shows which is which."
          action={
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="unverified">Student-provided</option>
            </select>
          }
        />
        {loading && <Loader />}
        <ul className="divide-y divide-line">
          {(data || []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted">
                  {c.student} · {c.kind}
                  {c.issuer ? ` · ${c.issuer}` : ''}
                  {c.verification_source ? ` · via ${c.verification_source}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <VerificationBadge status={c.verification_status} />
                {c.verification_status !== 'verified' ? (
                  <Button role="admin" tone="soft" onClick={() => review(c.id, 'verified')}>Mark verified</Button>
                ) : (
                  <Button role="admin" tone="ghost" onClick={() => review(c.id, 'unverified')}>Withdraw</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!loading && (data || []).length === 0 && <p className="text-sm text-muted">Nothing to review here.</p>}
      </Card>
    </div>
  )
}

function Opportunities() {
  const { data, error, loading, reload } = useResource('/admin/opportunities')
  return (
    <Card>
      <ErrorNote error={error} onRetry={reload} />
      <SectionTitle title="Posted opportunities" hint="Everything industry has opened, with how many students applied." />
      {loading && <Loader />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Company</th>
              <th className="py-2 pr-4 font-medium">Kind</th>
              <th className="py-2 pr-4 font-medium">Applicants</th>
              <th className="py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data || []).map((o) => (
              <tr key={o.id}>
                <td className="py-2.5 pr-4 font-medium">{o.title}</td>
                <td className="py-2.5 pr-4 text-muted">{o.company}</td>
                <td className="py-2.5 pr-4 text-muted">{o.kind}</td>
                <td className="py-2.5 pr-4">{o.applicants}</td>
                <td className="py-2.5">
                  <Badge tone={o.is_open ? 'verified' : 'neutral'}>{o.is_open ? 'Open' : 'Closed'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
