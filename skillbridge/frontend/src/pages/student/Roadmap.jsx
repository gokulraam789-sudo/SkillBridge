import { useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Button, Card, Empty, ErrorNote, Loader } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

export default function Roadmap() {
  const { data, error, loading, reload } = useApi('/student/roadmap')
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState(null)

  async function act(fn) {
    setBusy(true)
    setIssue(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setIssue(err)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const items = data || []
  const done = items.filter((i) => i.status === 'done').length

  return (
    <>
      <PageHeader
        title="Learning roadmap"
        description="Your gaps, ordered so prerequisites come first. Marking a step done raises that skill in your graph, which is what your institute and employers then see."
        action={
          <Button disabled={busy} onClick={() => act(() => api.post('/student/roadmap/generate'))}>
            {items.length ? 'Regenerate from current gaps' : 'Generate my roadmap'}
          </Button>
        }
      />

      <ErrorNote error={issue} />

      {items.length === 0 ? (
        <Empty
          title="No roadmap yet"
          hint="Pick a target role, then generate a roadmap. It orders your gaps by how much each one costs you and puts prerequisites first."
        />
      ) : (
        <>
          <Card className="mb-5">
            <p className="text-sm text-muted">
              {done} of {items.length} steps complete
              {done === items.length && ' — regenerate to pick up your next set of gaps.'}
            </p>
          </Card>

          <ol className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <Card className={item.status === 'done' ? 'opacity-60' : ''}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-4">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-student-soft text-sm font-medium text-student">
                        {item.step}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display font-semibold">{item.skill}</h3>
                          <Badge tone="neutral">about {item.estimated_weeks} weeks</Badge>
                          {item.status === 'done' && <Badge tone="verified">Done</Badge>}
                        </div>
                        <p className="text-sm text-muted mt-1 max-w-[80ch]">{item.action}</p>
                        <p className="text-sm mt-2 max-w-[80ch]">
                          <span className="text-muted">Build as evidence: </span>
                          {item.project_idea}
                        </p>
                        {item.resource && (
                          <p className="text-sm text-muted mt-1">Where to learn it: {item.resource}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.status !== 'done' && (
                        <Button
                          tone="soft"
                          disabled={busy}
                          onClick={() => act(() => api.put(`/student/roadmap/${item.id}`, { status: 'done' }))}
                        >
                          Mark done
                        </Button>
                      )}
                      {item.status === 'done' && (
                        <Button
                          tone="ghost"
                          disabled={busy}
                          onClick={() => act(() => api.put(`/student/roadmap/${item.id}`, { status: 'todo' }))}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
