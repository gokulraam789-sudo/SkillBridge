import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Button, Card, ErrorNote, Loader, SectionTitle, Stat } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

export default function Overview() {
  const [filters, setFilters] = useState({ batch: '', department: '', role_slug: '' })
  const [roles, setRoles] = useState([])
  const [planned, setPlanned] = useState({})
  const [issue, setIssue] = useState(null)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
    const qs = params.toString()
    return `/institute/overview${qs ? `?${qs}` : ''}`
  }, [filters])

  const { data, error, loading, reload } = useApi(query)

  useEffect(() => {
    api.get('/reference/roles').then(setRoles).catch(() => {})
  }, [])

  async function plan(rec) {
    setIssue(null)
    try {
      await api.post('/institute/training', {
        skill_slug: rec.skill_slug,
        title: rec.title,
        rationale: rec.rationale,
        batch: filters.batch,
        department: filters.department,
      })
      setPlanned((p) => ({ ...p, [rec.skill_slug]: true }))
    } catch (err) {
      setIssue(err)
    }
  }

  if (loading && !data) return <Loader label="Aggregating your cohort" />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const { cohort, analytics, recommendations, supply_vs_demand: supply } = data
  const gapChart = analytics.gaps.slice(0, 8).map((g) => ({
    name: g.name,
    percent: g.percent,
    missing: g.missing_percent,
  }))

  return (
    <>
      <PageHeader
        title="Cohort skill intelligence"
        description="Aggregated from the same skill graphs your students maintain. Individual resumes and contact details stay with the student."
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="batch">Graduating year</label>
            <select id="batch" className="input mt-1.5" value={filters.batch}
                    onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}>
              <option value="">All years</option>
              {data.filters.batches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dept">Department</label>
            <select id="dept" className="input mt-1.5" value={filters.department}
                    onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
              <option value="">All departments</option>
              {data.filters.departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="role">Measure against</label>
            <select id="role" className="input mt-1.5" value={filters.role_slug}
                    onChange={(e) => setFilters((f) => ({ ...f, role_slug: e.target.value }))}>
              <option value="">What students are targeting</option>
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.title}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students in view" value={analytics.total_students} sub={cohort.batch ? `Class of ${cohort.batch}` : 'All years'} />
        <Stat label="Average readiness" value={`${analytics.average_readiness}%`} sub={cohort.role ? `against ${cohort.role}` : 'set a role to measure'} />
        <Stat label="At 70% or above" value={data.placement_ready} sub="Close to placement ready" />
        <Stat label="Priority gaps" value={analytics.gaps.filter((g) => g.percent >= 40).length} sub="Affecting 40% or more" />
      </div>

      <ErrorNote error={issue} />

      <div className="grid gap-5 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2">
          <SectionTitle
            title={`Where this cohort falls short${cohort.role ? ` of ${cohort.role}` : ''}`}
            hint="Dark bars are students with no evidence at all; the lighter part is students who have it but below the level the role expects."
          />
          {gapChart.length === 0 ? (
            <p className="text-sm text-muted">No role selected, so there is nothing to measure against yet.</p>
          ) : (
            <div className="h-[320px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapChart} layout="vertical" margin={{ left: 28, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#E2E7EF" />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#101826' }} />
                  <Tooltip
                    formatter={(value, key) => [`${value}%`, key === 'missing' ? 'No evidence' : 'Total affected']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E7EF', fontSize: 13 }}
                  />
                  <Bar dataKey="percent" fill="#C7D2E8" radius={[0, 4, 4, 0]} name="Total affected" />
                  <Bar dataKey="missing" fill="#0E7C66" radius={[0, 4, 4, 0]} name="No evidence" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {analytics.gaps[0] && (
            <p className="text-sm text-muted mt-3 max-w-[80ch]">
              {analytics.gaps[0].percent}% of this cohort is short on {analytics.gaps[0].name}.{' '}
              {analytics.gaps[0].why}
            </p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Readiness spread" hint="How the cohort distributes against the target role." />
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.readiness_bands}>
                <CartesianGrid vertical={false} stroke="#E2E7EF" />
                <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E7EF', fontSize: 13 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {analytics.readiness_bands.map((_, i) => (
                    <Cell key={i} fill={['#F1B37A', '#E8C468', '#7FBFA8', '#0E7C66'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionTitle title="Strongest across the cohort" hint="" />
          <ul className="space-y-2">
            {analytics.strengths.slice(0, 6).map((s) => (
              <li key={s.slug} className="flex items-center justify-between text-sm">
                <span className="truncate">{s.name}</span>
                <span className="text-muted text-xs">{s.percent}% of students</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 mt-6">
        <Card>
          <SectionTitle
            title="Training worth running"
            hint="Derived from the gaps above, not from a generic catalogue. Planning one records it against this cohort."
          />
          {recommendations.length === 0 ? (
            <p className="text-sm text-muted">No gap is widespread enough to justify a dedicated track right now.</p>
          ) : (
            <ul className="space-y-4">
              {recommendations.map((rec) => (
                <li key={rec.skill_slug} className="border border-line rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{rec.title}</span>
                    {rec.urgency === 'high' && <Badge tone="warn">Urgent</Badge>}
                    <Badge tone="neutral">{rec.affected_percent}% affected</Badge>
                  </div>
                  <p className="text-sm text-muted mt-1.5 max-w-[70ch]">{rec.rationale}</p>
                  <div className="mt-3">
                    {planned[rec.skill_slug] ? (
                      <Badge tone="verified">Added to training plans</Badge>
                    ) : (
                      <Button role="institute" tone="soft" onClick={() => plan(rec)}>
                        Plan this training
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="What industry is asking for against what you supply"
            hint="Demand comes from open opportunities on the platform; supply is the share of this cohort at working level or above."
          />
          <ul className="divide-y divide-line">
            {supply.map((row) => {
              const shortfall = row.cohort_supply_percent < 40
              return (
                <li key={row.slug} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">{row.skill}</span>
                    <span className={`text-xs ${shortfall ? 'text-industry' : 'text-institute'}`}>
                      {row.cohort_supply_percent}% of your students
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full rounded-full ${shortfall ? 'bg-industry' : 'bg-institute'}`}
                      style={{ width: `${row.cohort_supply_percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {row.openings} {row.openings === 1 ? 'opening' : 'openings'} currently ask for it
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </>
  )
}
