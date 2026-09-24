import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { HOME, useAuth } from '../lib/auth.jsx'
import { accent } from '../components/UI.jsx'

const DEMO = [
  ['student', 'Student', 'student@skillbridge.dev', 'student123', 'Ravi, three skills short of a data role'],
  ['institute', 'Institute', 'tpo@anna.edu', 'institute123', 'Placement cell, 22 students'],
  ['industry', 'Industry', 'hiring@lumina.dev', 'industry123', 'Lumina Systems, hiring two roles'],
  ['admin', 'Admin', 'admin@skillbridge.dev', 'admin123', 'Taxonomy, users and credentials'],
]

export default function SignIn() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) navigate(HOME[user.role], { replace: true })
  }, [user, navigate])

  async function submit(e, creds) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const signed = await signIn(creds?.email ?? email, creds?.password ?? password)
      navigate(HOME[signed.role], { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-ink text-white px-6 py-12 sm:px-10 lg:px-14 lg:py-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white">
              <span className="block h-2.5 w-2.5 rounded-full bg-ink" />
            </span>
            <span className="font-display font-semibold">SkillBridge</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-[1.15] mt-12 max-w-[18ch]">
            One skill graph, read by everyone who shapes a career.
          </h1>
          <p className="text-white/70 mt-4 max-w-[52ch] leading-relaxed">
            A student's skills, a department's gaps and an employer's requirements are the same data seen
            from three sides. SkillBridge stores it once and lets each side act on it.
          </p>

          <div className="mt-10 space-y-3">
            {[
              ['industry', 'Industry posts what it needs, skill by skill'],
              ['institute', 'Institutes see where the cohort falls short and train against it'],
              ['student', 'Students close gaps, and their graph updates as they do'],
              ['industry', 'Stronger graphs surface back to employers'],
            ].map(([role, text], i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${accent(role).bg}`} />
                <p className="text-sm text-white/80">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40 mt-12">
          Skill extraction, matching and gap analysis are established techniques. What is new here is that all
          three run on one shared representation.
        </p>
      </section>

      <section className="px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
        <div className="mx-auto max-w-[420px]">
          <h2 className="font-display text-xl font-semibold">Sign in</h2>
          <p className="text-sm text-muted mt-1">Use a demo account below, or your own.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input mt-1.5" type="email" value={email} required
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" className="input mt-1.5" type="password" value={password} required
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
            <button className="btn bg-ink text-white w-full hover:opacity-90" disabled={busy}>
              {busy ? 'Signing in' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-muted mt-4">
            New here? <Link to="/signup" className="text-ink underline underline-offset-4">Create an account</Link>
          </p>

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm font-medium">Demo accounts</p>
            <div className="mt-3 space-y-2">
              {DEMO.map(([role, label, demoEmail, demoPassword, hint]) => (
                <button
                  key={role}
                  onClick={(e) => submit(e, { email: demoEmail, password: demoPassword })}
                  disabled={busy}
                  className="w-full text-left rounded-lg border border-line px-3 py-2.5 hover:bg-paper"
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${accent(role).bg}`} />
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted ml-auto">{demoEmail}</span>
                  </span>
                  <span className="block text-xs text-muted mt-1">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'student',
    institute_id: '', company_id: '', department: '', batch: '',
  })
  const [refs, setRefs] = useState({ institutes: [], companies: [] })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/reference/institutes'), api.get('/reference/companies')])
      .then(([institutes, companies]) => setRefs({ institutes, companies }))
      .catch(() => {})
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await signUp(form)
      navigate(HOME[user.role], { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen px-6 py-12 flex items-start justify-center">
      <div className="w-full max-w-[460px]">
        <h1 className="font-display text-2xl font-semibold">Create your account</h1>
        <p className="text-muted mt-1.5 text-sm">
          Pick the side of the ecosystem you are on. It decides which dashboard you land in.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {['student', 'institute', 'industry'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role }))}
                className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                  form.role === role ? `${accent(role).soft} ${accent(role).text} border-current font-medium` : 'border-line text-muted'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input mt-1.5" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="label" htmlFor="su-email">Email</label>
            <input id="su-email" className="input mt-1.5" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label" htmlFor="su-password">Password</label>
            <input id="su-password" className="input mt-1.5" type="password" minLength={6} value={form.password}
                   onChange={set('password')} required />
            <p className="text-xs text-muted mt-1">At least six characters.</p>
          </div>

          {form.role !== 'industry' && (
            <div>
              <label className="label" htmlFor="institute">Institute</label>
              <select id="institute" className="input mt-1.5" value={form.institute_id} onChange={set('institute_id')}>
                <option value="">Select your institute</option>
                {refs.institutes.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.role === 'industry' && (
            <div>
              <label className="label" htmlFor="company">Company</label>
              <select id="company" className="input mt-1.5" value={form.company_id} onChange={set('company_id')}>
                <option value="">Select your company</option>
                {refs.companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.role === 'student' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="dept">Department</label>
                <input id="dept" className="input mt-1.5" value={form.department} onChange={set('department')}
                       placeholder="Computer Science" />
              </div>
              <div>
                <label className="label" htmlFor="batch">Graduating year</label>
                <input id="batch" className="input mt-1.5" value={form.batch} onChange={set('batch')} placeholder="2027" />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <button className="btn bg-ink text-white w-full hover:opacity-90" disabled={busy}>
            {busy ? 'Creating account' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-muted mt-4">
          Already have an account? <Link to="/signin" className="text-ink underline underline-offset-4">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
