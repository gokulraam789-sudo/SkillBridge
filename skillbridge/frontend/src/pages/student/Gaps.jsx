import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/Shell.jsx'
import GapList from '../../components/GapList.jsx'
import { Button, Card, ErrorNote, Loader, Progress, SectionTitle, Tabs } from '../../components/UI.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'

export default function Gaps() {
  const { user, refresh } = useAuth()
  const [roles, setRoles] = useState([])
  const [gap, setGap] = useState(null)
  const [tab, setTab] = useState('missing')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/reference/roles').then(setRoles).catch(setError)
  }, [])

  const load = () => {
    setError(null)
    api
      .get('/student/gap')
      .then(setGap)
      .catch((err) => {
        setGap(null)
        if (user.target_role) setError(err)
      })
  }

  useEffect(load, [user.target_role?.slug])

  async function choose(slug) {
    setBusy(true)
    try {
      await api.put('/student/target-role', { role_slug: slug })
      await refresh()
      load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Skill gaps"
        description="Your graph against the requirements of a role, with the reason each requirement exists."
      />

      <Card className="mb-5">
        <SectionTitle title="Target role" hint="Change this any time. Everything downstream re-computes." />
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role.slug}
              disabled={busy}
              onClick={() => choose(role.slug)}
              className={`rounded-lg border px-3 py-2 text-sm text-left ${
                user.target_role?.slug === role.slug
                  ? 'border-student bg-student-soft text-student font-medium'
                  : 'border-line hover:bg-paper'
              }`}
            >
              {role.title}
              <span className="block text-xs text-muted">{role.skill_count} requirements</span>
            </button>
          ))}
        </div>
      </Card>

      <ErrorNote error={error} onRetry={load} />

      {!gap && !error && user.target_role && <Loader label="Comparing your graph" />}

      {gap && (
        <>
          <Card className="mb-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold">{gap.role.title}</h2>
                <p className="text-sm text-muted mt-1 max-w-[70ch]">{gap.role.summary}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-semibold">{gap.readiness}%</p>
                <p className="text-xs text-muted">readiness</p>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={gap.readiness} />
            </div>
            <div className="mt-4">
              <Link to="/student/roadmap">
                <Button>Turn these gaps into a roadmap</Button>
              </Link>
            </div>
          </Card>

          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'missing', label: `Missing (${gap.missing.length})` },
              { id: 'improve', label: `Needs lifting (${gap.improve.length})` },
              { id: 'have', label: `Covered (${gap.have.length})` },
            ]}
          />

          <Card>
            {tab === 'missing' && <GapList items={gap.missing} variant="missing" />}
            {tab === 'improve' && <GapList items={gap.improve} variant="improve" />}
            {tab === 'have' && <GapList items={gap.have} variant="have" />}
          </Card>
        </>
      )}
    </>
  )
}
