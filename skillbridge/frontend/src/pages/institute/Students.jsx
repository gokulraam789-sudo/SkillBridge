import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Card, ErrorNote, LevelDots, Loader, Progress, SectionTitle } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

export default function Students() {
  const [filters, setFilters] = useState({ batch: '', department: '', role_slug: '' })
  const [roles, setRoles] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
    const qs = params.toString()
    return `/institute/students${qs ? `?${qs}` : ''}`
  }, [filters])

  const { data, error, loading, reload } = useApi(query)

  useEffect(() => {
    api.get('/reference/roles').then(setRoles).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return setDetail(null)
    setDetail(null)
    api.get(`/institute/students/${selected}`).then(setDetail).catch(() => setDetail(null))
  }, [selected])

  if (loading && !data) return <Loader />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const rows = (data || []).filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <PageHeader
        title="Students"
        description="Readiness per student against their own target role, or against one role you choose for the whole list."
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className="input" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={filters.batch} onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}>
            <option value="">All years</option>
            {[...new Set((data || []).map((r) => r.batch).filter(Boolean))].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select className="input" value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
            <option value="">All departments</option>
            {[...new Set((data || []).map((r) => r.department).filter(Boolean))].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select className="input" value={filters.role_slug} onChange={(e) => setFilters((f) => ({ ...f, role_slug: e.target.value }))}>
            <option value="">Each student's own target</option>
            {roles.map((r) => <option key={r.slug} value={r.slug}>Measure against {r.title}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-muted">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Student</th>
                  <th className="text-left font-medium px-4 py-2.5">Target</th>
                  <th className="text-left font-medium px-4 py-2.5 w-[160px]">Readiness</th>
                  <th className="text-left font-medium px-4 py-2.5">Skills</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`border-t border-line cursor-pointer hover:bg-paper ${selected === r.id ? 'bg-institute-soft' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-muted">{r.department} · {r.batch}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{r.target_role || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.readiness === null ? (
                        <span className="text-muted text-xs">No target set</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Progress value={r.readiness} colour="bg-institute" />
                          <span className="text-xs tabular-nums w-9">{r.readiness}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {r.skills}
                      {r.verified_skills > 0 && <span className="text-institute"> · {r.verified_skills} verified</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="p-5 text-sm text-muted">No students match these filters.</p>}
        </Card>

        <div className="lg:col-span-2">
          {!selected && (
            <Card>
              <p className="text-sm text-muted">Select a student to see their gaps against their target role.</p>
            </Card>
          )}
          {selected && !detail && <Loader label="Loading profile" />}
          {detail && (
            <Card>
              <SectionTitle
                title={detail.name}
                hint={`${detail.department} · ${detail.batch}${detail.target_role ? ` · targeting ${detail.target_role}` : ''}`}
              />
              {detail.readiness !== null && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <Progress value={detail.readiness} colour="bg-institute" />
                    <span className="text-sm font-medium tabular-nums">{detail.readiness}%</span>
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-1.5 mb-4">
                <Badge tone="neutral">{detail.evidence_counts.projects} projects</Badge>
                <Badge tone="neutral">{detail.evidence_counts.certifications} certifications</Badge>
                <Badge tone="verified">{detail.evidence_counts.verified} verified</Badge>
              </div>

              <p className="label mb-2">Missing for their target role</p>
              {detail.missing.length === 0 ? (
                <p className="text-sm text-muted mb-4">Nothing missing.</p>
              ) : (
                <ul className="space-y-1.5 mb-4">
                  {detail.missing.slice(0, 6).map((m) => (
                    <li key={m.slug} className="text-sm flex items-center justify-between gap-2">
                      <span>{m.name}</span>
                      <span className="text-xs text-muted">importance {m.importance}/5</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="label mb-2">Skills on record</p>
              <ul className="space-y-1.5">
                {detail.skills.map((s) => (
                  <li key={s.name} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    <LevelDots level={s.level} colour="bg-institute" />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
