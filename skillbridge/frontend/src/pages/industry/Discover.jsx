import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/Shell.jsx'
import {
  Badge, Button, Card, Empty, ErrorNote, LevelDots, Loader, Progress, SectionTitle, VerificationBadge,
} from '../../components/UI.jsx'
import { api } from '../../lib/api.js'

export default function Discover() {
  const [taxonomy, setTaxonomy] = useState([])
  const [roles, setRoles] = useState([])
  const [query, setQuery] = useState({ skills: [], min_level: 3, verified_only: false, role_slug: '' })
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.get('/reference/skills').then(setTaxonomy).catch(setError)
    api.get('/reference/roles').then(setRoles).catch(() => {})
  }, [])

  useEffect(() => {
    if (!openId) return setProfile(null)
    setProfile(null)
    api
      .get(`/industry/candidates/${openId}${query.role_slug ? `?role_slug=${query.role_slug}` : ''}`)
      .then(setProfile)
      .catch(setError)
  }, [openId])

  function toggleSkill(slug) {
    setQuery((q) => ({
      ...q,
      skills: q.skills.includes(slug) ? q.skills.filter((s) => s !== slug) : [...q.skills, slug],
    }))
  }

  async function search() {
    setBusy(true)
    setError(null)
    setOpenId(null)
    try {
      setResults(await api.post('/industry/search', query))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const visible = taxonomy.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 40)

  return (
    <>
      <PageHeader
        title="Find talent"
        description="Search the shared skill graph directly. Related skills count towards a match, so a student who worked in PyTorch still surfaces for a machine learning requirement."
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <Card className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <SectionTitle title="Requirements" />
          <input className="input mb-3" placeholder="Filter skills" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-[280px] overflow-y-auto pr-1 space-y-1">
            {visible.map((t) => (
              <label key={t.slug} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#B4530A]"
                  checked={query.skills.includes(t.slug)}
                  onChange={() => toggleSkill(t.slug)}
                />
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>

          <label className="label mt-4 block" htmlFor="level">Minimum level</label>
          <select id="level" className="input mt-1.5" value={query.min_level}
                  onChange={(e) => setQuery((q) => ({ ...q, min_level: Number(e.target.value) }))}>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>{['Aware', 'Learning', 'Working', 'Strong', 'Expert'][l - 1]} or above</option>
            ))}
          </select>

          <label className="label mt-4 block" htmlFor="role">Targeting</label>
          <select id="role" className="input mt-1.5" value={query.role_slug}
                  onChange={(e) => setQuery((q) => ({ ...q, role_slug: e.target.value }))}>
            <option value="">Any role</option>
            {roles.map((r) => <option key={r.slug} value={r.slug}>{r.title}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm mt-4 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-[#B4530A]" checked={query.verified_only}
                   onChange={(e) => setQuery((q) => ({ ...q, verified_only: e.target.checked }))} />
            Verified evidence only
          </label>

          <Button role="industry" className="w-full mt-4" onClick={search} disabled={busy}>
            {busy ? 'Searching' : 'Search the skill graph'}
          </Button>
          {query.skills.length > 0 && (
            <p className="text-xs text-muted mt-2">{query.skills.length} skills selected</p>
          )}
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <ErrorNote error={error} />
          {!results && !busy && (
            <Empty title="Pick the skills you need" hint="Select requirements on the left and search. Every result explains why it matched." />
          )}
          {busy && <Loader label="Reading student graphs" />}
          {results && results.length === 0 && (
            <Empty title="No students match those requirements" hint="Try lowering the minimum level, or turning off verified-only." />
          )}

          {results?.map((c) => (
            <Card key={c.student_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-semibold">{c.name}</h3>
                    {c.verified_count > 0 && <Badge tone="verified">{c.verified_count} verified</Badge>}
                  </div>
                  <p className="text-sm text-muted mt-0.5">
                    {[c.institute, c.department, c.batch && `Class of ${c.batch}`].filter(Boolean).join(' · ')}
                  </p>
                  {c.target_role && <p className="text-sm text-muted">Targeting {c.target_role}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-semibold">{c.score}%</p>
                  <p className="text-xs text-muted">on your requirements</p>
                </div>
              </div>

              <div className="mt-3"><Progress value={c.score} colour="bg-industry" /></div>

              <ul className="mt-3 space-y-1">
                {c.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-muted flex gap-2">
                    <span className="text-line">—</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.matched.map((s) => <Badge key={s.slug} tone="info">{s.name}</Badge>)}
                {c.missing.map((s) => <Badge key={s.slug} tone="warn">{s.name} missing</Badge>)}
              </div>

              <div className="mt-4">
                <Button role="industry" tone={openId === c.student_id ? 'ghost' : 'soft'}
                        onClick={() => setOpenId(openId === c.student_id ? null : c.student_id)}>
                  {openId === c.student_id ? 'Hide passport' : 'Open skill passport'}
                </Button>
              </div>

              {openId === c.student_id && (
                <div className="mt-4 border-t border-line pt-4">
                  {!profile && <Loader label="Opening passport" />}
                  {profile && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <p className="label mb-2">Skills on record</p>
                        <ul className="space-y-1.5">
                          {profile.skills.map((s) => (
                            <li key={s.slug} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{s.name}</span>
                              <span className="flex items-center gap-2">
                                <LevelDots level={s.level} colour="bg-industry" />
                                {s.verified && <Badge tone="verified">✓</Badge>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="label mb-2">Projects and credentials</p>
                        <ul className="space-y-3">
                          {profile.evidence.map((e, i) => (
                            <li key={i}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{e.title}</span>
                                <VerificationBadge status={e.verification_status} />
                              </div>
                              {e.description && <p className="text-xs text-muted mt-0.5 max-w-[60ch]">{e.description}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
