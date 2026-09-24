import { accent } from './UI.jsx'

const STAGES = [
  { role: 'industry', title: 'Industry demand', body: 'Employers post what they actually need, skill by skill.' },
  { role: 'institute', title: 'Academia', body: 'Institutes see where their cohort falls short and train against it.' },
  { role: 'student', title: 'Student development', body: 'Students close gaps and their graph updates as they do.' },
  { role: 'industry', title: 'Opportunities', body: 'Stronger graphs surface to employers, and the loop repeats.' },
]

/** The product idea in one strip: one engine, one graph, three dashboards. */
export default function EcosystemLoop({ compact = false }) {
  return (
    <div className={compact ? '' : 'card p-5'}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage, i) => {
          const a = accent(stage.role)
          return (
            <div key={i} className="relative rounded-lg border border-line bg-white p-4">
              <span className={`inline-block h-1.5 w-8 rounded-full ${a.bg}`} />
              <p className="mt-3 font-display text-sm font-semibold">{stage.title}</p>
              <p className="mt-1 text-sm text-muted leading-relaxed">{stage.body}</p>
              {i < STAGES.length - 1 && (
                <span className="hidden lg:block absolute top-1/2 -right-[13px] text-line text-lg" aria-hidden="true">
                  →
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
