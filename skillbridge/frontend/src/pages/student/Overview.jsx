import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/Shell.jsx'
import MatchCard from '../../components/MatchCard.jsx'
import { Badge, Button, Card, ErrorNote, Loader, Progress, SectionTitle, Stat } from '../../components/UI.jsx'
import { useApi } from '../../lib/useApi.js'

export default function Overview() {
  const { data, error, loading, reload } = useApi('/student/overview')

  if (loading) return <Loader label="Building your view" />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const d = data
  const roadmapDone = d.roadmap_progress.total
    ? Math.round((100 * d.roadmap_progress.done) / d.roadmap_progress.total)
    : 0

  return (
    <>
      <PageHeader
        title={`Hello, ${(d.name || '').split(' ')[0]}`}
        description={
          d.target_role
            ? `Everything below compares your skill graph against ${d.target_role.title}.`
            : 'Pick a target role and the rest of the platform has something to compare your graph against.'
        }
        action={
          !d.target_role && (
            <Link to="/student/gaps">
              <Button>Choose a target role</Button>
            </Link>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2">
          <p className="text-sm text-muted">
            Readiness for {d.target_role ? d.target_role.title : 'your target role'}
          </p>
          <div className="flex items-end gap-3 mt-1">
            <p className="font-display text-4xl font-semibold">{d.readiness}%</p>
            <p className="text-sm text-muted mb-1.5">
              {d.gap_counts.have} of {d.gap_counts.have + d.gap_counts.improve + d.gap_counts.missing} requirements covered
            </p>
          </div>
          <div className="mt-3">
            <Progress value={d.readiness} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="info">{d.gap_counts.have} covered</Badge>
            <Badge tone="warn">{d.gap_counts.improve} need lifting</Badge>
            <Badge tone="neutral">{d.gap_counts.missing} not evidenced</Badge>
          </div>
        </Card>

        <Stat label="Skills in your graph" value={d.skill_count} sub={`${d.verified_skills} verified`} />
        <Stat
          label="Roadmap progress"
          value={d.roadmap_progress.total ? `${roadmapDone}%` : '—'}
          sub={
            d.roadmap_progress.total
              ? `${d.roadmap_progress.done} of ${d.roadmap_progress.total} steps done`
              : 'No roadmap generated yet'
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 mt-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <SectionTitle
              title="What is holding you back"
              hint="Ranked by how much each gap costs you against the role, not alphabetically."
              action={
                <Link to="/student/gaps" className="text-sm text-student underline underline-offset-4">
                  Full analysis
                </Link>
              }
            />
            {d.top_gaps.length === 0 ? (
              <p className="text-sm text-muted">
                {d.target_role
                  ? 'Nothing is missing against this role right now.'
                  : 'Choose a target role to see this.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {d.top_gaps.map((gap) => (
                  <li key={gap.slug} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{gap.name}</span>
                      {gap.importance >= 5 && <Badge tone="warn">Critical</Badge>}
                    </div>
                    <p className="text-sm text-muted mt-0.5">{gap.reason || gap.why}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div>
            <SectionTitle
              title="Opportunities matched to your graph"
              hint="Matched on structured skills, with the reasoning shown."
              action={
                <Link to="/student/opportunities" className="text-sm text-student underline underline-offset-4">
                  See all
                </Link>
              }
            />
            <div className="space-y-4">
              {d.top_matches.map((match) => (
                <MatchCard key={match.opportunity_id} match={match} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle title="Your evidence" hint="Verified items carry more weight with employers." />
            <div className="space-y-2 text-sm">
              <Row label="Projects and certificates" value={d.evidence.total} />
              <Row label="Verified" value={d.evidence.verified} />
              <Row label="Documents uploaded" value={d.documents} />
            </div>
            <Link to="/student/passport" className="btn-ghost mt-4 w-full">
              Open skill passport
            </Link>
          </Card>

          <Card>
            <SectionTitle
              title="What employers are asking for"
              hint="Live demand across open opportunities on the platform."
            />
            <ul className="space-y-2.5">
              {d.industry_demand.map((item) => (
                <li key={item.slug} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-muted text-xs whitespace-nowrap">
                    {item.openings} {item.openings === 1 ? 'opening' : 'openings'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
