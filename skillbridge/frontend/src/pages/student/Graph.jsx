import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import SkillGraph from '../../components/SkillGraph.jsx'
import { Badge, Button, Card, ErrorNote, LevelDots, Loader, SectionTitle } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'

export default function Graph() {
  const graph = useApi('/student/graph')
  const skills = useApi('/student/skills')
  const [taxonomy, setTaxonomy] = useState([])
  const [draft, setDraft] = useState({ slug: '', level: 3 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/reference/skills').then(setTaxonomy).catch(() => {})
  }, [])

  async function mutate(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      graph.reload()
      skills.reload()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (graph.loading || skills.loading) return <Loader label="Drawing your graph" />
  if (graph.error) return <ErrorNote error={graph.error} onRetry={graph.reload} />

  const held = new Set((skills.data || []).map((s) => s.slug))
  const addable = taxonomy.filter((t) => !held.has(t.slug))

  return (
    <>
      <PageHeader
        title="My skill graph"
        description="This is the single record the whole platform reads. Your institute sees it aggregated with their other students; employers see it when they search."
      />

      <SkillGraph data={graph.data} />

      <ErrorNote error={error} />

      <div className="grid gap-5 lg:grid-cols-3 mt-6">
        <Card className="lg:col-span-2">
          <SectionTitle title="Skills in your graph" hint="Correct anything the extraction got wrong." />
          {(skills.data || []).length === 0 ? (
            <p className="text-sm text-muted">Nothing here yet. Upload a document or add a skill.</p>
          ) : (
            <ul className="divide-y divide-line">
              {skills.data.map((skill) => (
                <li key={skill.slug} className="py-3 first:pt-0 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{skill.name}</span>
                      {skill.verified && <Badge tone="verified">Verified</Badge>}
                      <Badge tone="neutral">{skill.source}</Badge>
                    </div>
                    {skill.evidence && <p className="text-xs text-muted mt-1 max-w-[70ch]">{skill.evidence}</p>}
                  </div>
                  <LevelDots level={skill.level} />
                  <select
                    className="input w-auto"
                    value={skill.level}
                    disabled={busy}
                    onChange={(e) =>
                      mutate(() =>
                        api.post('/student/skills', { slug: skill.slug, level: Number(e.target.value), source: 'self' }),
                      )
                    }
                    aria-label={`Level for ${skill.name}`}
                  >
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>
                        {['Aware', 'Learning', 'Working', 'Strong', 'Expert'][l - 1]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-quiet"
                    disabled={busy}
                    onClick={() => mutate(() => api.del(`/student/skills/${skill.slug}`))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle title="Add a skill yourself" hint="Self-added skills show as unverified until you attach evidence." />
          <label className="label" htmlFor="add-skill">Skill</label>
          <select
            id="add-skill"
            className="input mt-1.5"
            value={draft.slug}
            onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
          >
            <option value="">Select a skill</option>
            {addable.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>

          <label className="label mt-4 block" htmlFor="add-level">Where are you with it?</label>
          <select
            id="add-level"
            className="input mt-1.5"
            value={draft.level}
            onChange={(e) => setDraft((d) => ({ ...d, level: Number(e.target.value) }))}
          >
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                {['Aware', 'Learning', 'Working', 'Strong', 'Expert'][l - 1]}
              </option>
            ))}
          </select>

          <Button
            className="mt-4 w-full"
            disabled={!draft.slug || busy}
            onClick={() =>
              mutate(async () => {
                await api.post('/student/skills', { ...draft, source: 'self' })
                setDraft({ slug: '', level: 3 })
              })
            }
          >
            Add to graph
          </Button>
        </Card>
      </div>
    </>
  )
}
