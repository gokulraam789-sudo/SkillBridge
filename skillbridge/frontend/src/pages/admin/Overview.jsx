import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EcosystemLoop from '../../components/EcosystemLoop.jsx'
import { PageHeader } from '../../components/Shell.jsx'
import { Card, ErrorNote, Loader, SectionTitle, Stat } from '../../components/UI.jsx'
import { useApi } from '../../lib/useApi.js'

const ACTOR_TONE = {
  student: 'bg-student',
  institute: 'bg-institute',
  industry: 'bg-industry',
  admin: 'bg-admin',
}

export default function Overview() {
  const { data, error, loading, reload } = useApi('/admin/overview')

  if (loading && !data) return <Loader label="Reading the platform" />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const { counts, demand, activity } = data
  const demandChart = (demand || []).map((d) => ({ name: d.name, openings: d.openings }))
  const verifiedShare = counts.credentials
    ? Math.round((counts.verified_credentials / counts.credentials) * 100)
    : 0

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="One engine and one shared skill graph behind every dashboard. These are its live totals."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={counts.students} sub={`${counts.skill_edges} skill claims in the graph`} />
        <Stat label="Institutes" value={counts.institutes} sub={`${counts.users} accounts in total`} />
        <Stat label="Companies" value={counts.companies} sub={`${counts.opportunities} opportunities posted`} />
        <Stat
          label="Credentials"
          value={counts.credentials}
          sub={`${counts.verified_credentials} verified · ${verifiedShare}% of the total`}
        />
      </div>

      <div className="mt-8">
        <SectionTitle
          title="How the three sides connect"
          hint="Every number above comes from the same skill representation. Nothing is duplicated per dashboard."
        />
        <EcosystemLoop />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Skills industry is asking for" hint="Counted across every open opportunity." />
          {demandChart.length === 0 ? (
            <p className="text-sm text-muted">No open opportunities yet, so there is no demand signal to show.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demandChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#E2E7EF" />
                  <XAxis type="number" allowDecimals={false} stroke="#64748B" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={130} stroke="#64748B" fontSize={12} />
                  <Tooltip cursor={{ fill: '#F5F7FA' }} />
                  <Bar dataKey="openings" fill="#6D28D9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Recent activity" hint="Who did what, across all four workspaces." />
          {(!activity || activity.length === 0) && <p className="text-sm text-muted">Nothing logged yet.</p>}
          <ul className="divide-y divide-line max-h-72 overflow-y-auto -mx-1 px-1">
            {(activity || []).map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTOR_TONE[a.actor_role] || 'bg-line'}`} />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{a.action.replace(/_/g, ' ')}</span>
                    {a.detail && <span className="text-muted"> — {a.detail}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {a.actor_role || 'system'} · {a.at ? new Date(a.at).toLocaleString() : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
