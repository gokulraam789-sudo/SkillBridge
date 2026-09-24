import { useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import { Badge, Button, Card, Empty, ErrorNote, Loader } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

const NEXT = { planned: 'running', running: 'complete', complete: 'planned' }
const LABEL = { planned: 'Start this track', running: 'Mark complete', complete: 'Reopen' }

export default function Training() {
  const { data, error, loading, reload } = useApi('/institute/training')
  const [issue, setIssue] = useState(null)

  async function advance(item) {
    setIssue(null)
    try {
      await api.put(`/institute/training/${item.id}`, { status: NEXT[item.status] })
      reload()
    } catch (err) {
      setIssue(err)
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const items = data || []

  return (
    <>
      <PageHeader
        title="Training plans"
        description="Tracks you committed to from the cohort analysis. Each one records the gap that justified it."
      />

      <ErrorNote error={issue} />

      {items.length === 0 ? (
        <Empty
          title="No training planned yet"
          hint="Open the cohort overview and plan one of the recommended tracks. It will appear here with the gap that justified it."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-semibold">{item.title}</h3>
                    <Badge tone={item.status === 'complete' ? 'verified' : item.status === 'running' ? 'info' : 'neutral'}>
                      {item.status}
                    </Badge>
                    {item.batch && <Badge tone="neutral">Class of {item.batch}</Badge>}
                  </div>
                  <p className="text-sm text-muted mt-1.5 max-w-[80ch]">{item.rationale}</p>
                  <p className="text-xs text-muted mt-1">Targets: {item.skill}</p>
                </div>
                <Button role="institute" tone={item.status === 'complete' ? 'ghost' : 'soft'} onClick={() => advance(item)}>
                  {LABEL[item.status]}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
