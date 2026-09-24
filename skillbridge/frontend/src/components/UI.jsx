const ACCENT = {
  student: { text: 'text-student', bg: 'bg-student', soft: 'bg-student-soft', border: 'border-student/30' },
  institute: { text: 'text-institute', bg: 'bg-institute', soft: 'bg-institute-soft', border: 'border-institute/30' },
  industry: { text: 'text-industry', bg: 'bg-industry', soft: 'bg-industry-soft', border: 'border-industry/30' },
  admin: { text: 'text-admin', bg: 'bg-admin', soft: 'bg-admin-soft', border: 'border-admin/30' },
}

export function accent(role) {
  return ACCENT[role] || ACCENT.student
}

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`card p-5 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function SectionTitle({ title, hint, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {hint && <p className="text-sm text-muted mt-1 max-w-[68ch]">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({ children, tone = 'solid', role = 'student', className = '', ...rest }) {
  const a = accent(role)
  const styles =
    tone === 'solid'
      ? `${a.bg} text-white hover:opacity-90`
      : tone === 'soft'
        ? `${a.soft} ${a.text} hover:brightness-95`
        : 'border border-line bg-white text-ink hover:bg-paper'
  return (
    <button className={`btn ${styles} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Stat({ label, value, sub, tone = 'default' }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-display font-semibold ${tone === 'muted' ? 'text-muted' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-paper text-muted border-line',
    verified: 'bg-institute-soft text-institute border-institute/25',
    warn: 'bg-industry-soft text-industry border-industry/25',
    info: 'bg-student-soft text-student border-student/25',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function VerificationBadge({ status }) {
  if (status === 'verified') return <Badge tone="verified">✓ Verified credential</Badge>
  if (status === 'pending') return <Badge tone="warn">Verification in progress</Badge>
  return <Badge tone="neutral">Student-provided</Badge>
}

const LEVELS = ['', 'Aware', 'Learning', 'Working', 'Strong', 'Expert']

export function LevelDots({ level = 0, expected, colour = 'bg-student' }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${LEVELS[level] || 'Not evidenced'}${expected ? ` · expected ${LEVELS[expected]}` : ''}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${
            i <= level ? colour : expected && i <= expected ? 'bg-line' : 'bg-line/50'
          }`}
        />
      ))}
    </span>
  )
}

export function Progress({ value, colour = 'bg-student' }) {
  return (
    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function Empty({ title, hint, action }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-display font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted mt-2 max-w-[52ch] mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Loader({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted py-10 justify-center">
      <span className="h-2 w-2 rounded-full bg-muted animate-pulse" />
      {label}
    </div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="card p-4 border-rose-200 bg-rose-50">
      <p className="text-sm text-rose-800">{String(error.message || error)}</p>
      {onRetry && (
        <button className="btn-quiet mt-2 text-rose-800" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Tabs({ tabs, active, onChange, role = 'student' }) {
  const a = accent(role)
  return (
    <div className="flex gap-1 border-b border-line mb-5 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
            active === t.id ? `${a.text} border-current` : 'text-muted border-transparent hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export { LEVELS }
