import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Card, ErrorNote, Loader, Progress, SectionTitle, Stat } from '../../components/UI.jsx'
import { useApi } from '../../lib/useApi.js'

export default function Overview() {
  const { data, error, loading, reload } = useApi('/industry/overview')

  if (loading) return <Loader label="Reading the talent pool" />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  return (
    <>
      <PageHeader
        title={data.company || 'Talent overview'}
        description="Candidates are ranked on their structured skill graph, with the reasoning attached. No unexplained score."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open opportunities" value={data.open_opportunities} />
        <Stat label="Applications received" value={data.total_applications} />
        <Stat label="Students open to work" value={data.talent_pool} sub="Across all institutes on the platform" />
        <Stat label="Shortlisted" value={data.pipeline.shortlisted || 0} sub="Move candidates from the opportunity page" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 mt-6">
        <div className="lg:col-span-2 space-y-5">
          <SectionTitle
            title="Strongest matches right now"
            hint="Computed from the live skill graph, so this changes as students develop."
            action={
              <Link to="/industry/discover" className="text-sm text-industry underline underline-offset-4">
                Search the graph
              </Link>
            }
          />
          {data.top_matches.length === 0 && (
            <Card>
              <p className="text-sm text-muted">
                Post an internship, project or challenge and matching candidates appear here.
              </p>
            </Card>
          )}
          {data.top_matches.map((group) => (
            <Card key={group.opportunity_id}>
              <SectionTitle title={group.opportunity} />
              <ul className="divide-y divide-line">
                {group.candidates.map((c) => (
                  <li key={c.student_id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-sm text-muted"> · {c.institute}</span>
                      </div>
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <Progress value={c.score} colour="bg-industry" />
                        <span className="text-sm tabular-nums">{c.score}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted mt-1 max-w-[80ch]">{c.reasons[0]}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.verified_count > 0 && <Badge tone="verified">{c.verified_count} verified skills</Badge>}
                      {c.matched.slice(0, 4).map((s) => (
                        <Badge key={s.slug} tone="neutral">{s.name}</Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card>
          <SectionTitle
            title="What the platform is asking for"
            hint="Aggregate demand across every employer. Institutes see this too, and train against it."
          />
          <ul className="space-y-3">
            {data.demand.map((item) => (
              <li key={item.slug}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{item.name}</span>
                  <span className="text-xs text-muted">{item.employers} employers</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-industry"
                    style={{ width: `${Math.min(100, (item.weighted / (data.demand[0]?.weighted || 1)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
