import { useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import MatchCard from '../../components/MatchCard.jsx'
import { Card, Empty, ErrorNote, Loader, SectionTitle, Tabs } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'internship', label: 'Internships' },
  { id: 'job', label: 'Graduate roles' },
  { id: 'project', label: 'Industry projects' },
  { id: 'challenge', label: 'Challenges' },
]

export default function Opportunities() {
  const { data, error, loading, reload } = useApi('/student/opportunities')
  const applications = useApi('/student/applications')
  const [filter, setFilter] = useState('all')
  const [issue, setIssue] = useState(null)

  async function apply(match) {
    setIssue(null)
    try {
      await api.post('/student/applications', { opportunity_id: match.opportunity_id })
      reload()
      applications.reload()
    } catch (err) {
      setIssue(err)
    }
  }

  if (loading) return <Loader label="Matching your graph against open roles" />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const matches = (data || []).filter((m) => filter === 'all' || m.kind === filter)

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Ranked by how your structured skills line up with what each employer asked for — not by keyword overlap with your resume."
      />

      <ErrorNote error={issue} />

      {(applications.data || []).length > 0 && (
        <Card className="mb-5">
          <SectionTitle title="Your applications" />
          <ul className="divide-y divide-line">
            {applications.data.map((a) => (
              <li key={a.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{a.title}</span>
                  <span className="text-muted"> · {a.company}</span>
                </span>
                <span className="text-muted capitalize">{a.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} />

      {matches.length === 0 ? (
        <Empty title="Nothing open in this category" hint="Try another filter, or check back once employers post more." />
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard
              key={match.opportunity_id}
              match={match}
              onApply={apply}
              applied={match.application_status}
            />
          ))}
        </div>
      )}
    </>
  )
}
