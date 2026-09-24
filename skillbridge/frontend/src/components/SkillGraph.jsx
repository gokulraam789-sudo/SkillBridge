import { useMemo, useState } from 'react'

const CATEGORY_COLOUR = {
  technical: '#1F4FD8',
  tool: '#0E7C66',
  domain: '#B4530A',
  soft: '#6D28D9',
}

const LEVEL_LABEL = ['Not evidenced', 'Aware', 'Learning', 'Working', 'Strong', 'Expert']

/**
 * Radial view of one student's graph.
 * Distance from the core encodes evidenced level: the stronger the skill, the closer
 * it sits to the student. Dashed nodes are required by the target role but not yet
 * evidenced, so the gap is legible as a shape rather than as a list.
 */
export default function SkillGraph({ data, height = 520 }) {
  const [selected, setSelected] = useState(null)

  const layout = useMemo(() => {
    if (!data?.nodes?.length) return null
    const skills = data.nodes.filter((n) => n.type === 'skill')
    if (!skills.length) return null

    const byCategory = {}
    skills.forEach((s) => {
      const cat = s.category || 'technical'
      byCategory[cat] = byCategory[cat] || []
      byCategory[cat].push(s)
    })
    const categories = Object.keys(byCategory).sort()

    const cx = 400
    const cy = 280
    const placed = []
    const gap = 0.22 // radians of padding between category wedges
    const totalSkills = skills.length
    let cursor = -Math.PI / 2

    categories.forEach((cat) => {
      const items = byCategory[cat].slice().sort((a, b) => (b.level || 0) - (a.level || 0))
      const span = (2 * Math.PI * items.length) / totalSkills - gap
      const start = cursor + gap / 2
      items.forEach((node, i) => {
        const angle = items.length === 1 ? start + span / 2 : start + (span * i) / (items.length - 1)
        const level = node.level || 0
        const radius = 108 + (5 - level) * 34 + (i % 2) * 9
        placed.push({
          ...node,
          cat,
          angle,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          r: node.missing ? 6 : 7 + level * 1.6,
        })
      })
      cursor += (2 * Math.PI * items.length) / totalSkills
    })

    const index = Object.fromEntries(placed.map((p) => [`skill:${p.slug ?? ''}`, p]))
    placed.forEach((p) => {
      index[`skill:${p.label}`] = index[`skill:${p.label}`] || p
    })
    const byId = Object.fromEntries(placed.map((p) => [p.id, p]))

    const links = (data.edges || [])
      .filter((e) => e.kind === 'related' && byId[e.source] && byId[e.target])
      .map((e) => ({ a: byId[e.source], b: byId[e.target], weight: e.weight || 0.3 }))

    const student = data.nodes.find((n) => n.type === 'student')
    const role = data.nodes.find((n) => n.type === 'role')
    return { placed, links, cx, cy, student, role, categories }
  }, [data])

  if (!layout) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        Your graph is empty. Upload a resume or add a skill and it will appear here.
      </div>
    )
  }

  const { placed, links, cx, cy, student, role, categories } = layout

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-b border-line text-xs text-muted">
        {categories.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOUR[c] || '#64748B' }} />
            {c === 'soft' ? 'Ways of working' : c === 'tool' ? 'Tools & platforms' : c[0].toUpperCase() + c.slice(1)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted" />
          Required by target role, not evidenced
        </span>
        <span className="ml-auto hidden sm:block">Closer to the centre means stronger evidence</span>
      </div>

      <svg viewBox="0 0 800 560" style={{ height }} className="w-full" role="img" aria-label="Skill graph">
        {[1, 2, 3, 4].map((ring) => (
          <circle key={ring} cx={cx} cy={cy} r={108 + ring * 34} fill="none" stroke="#E2E7EF" strokeWidth="1" />
        ))}

        {links.map((l, i) => (
          <line
            key={i}
            x1={l.a.x}
            y1={l.a.y}
            x2={l.b.x}
            y2={l.b.y}
            stroke="#94A3B8"
            strokeOpacity={0.35 * l.weight + 0.1}
            strokeWidth="1"
          />
        ))}

        {placed.map((n) => (
          <line
            key={`spoke-${n.id}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={CATEGORY_COLOUR[n.cat] || '#64748B'}
            strokeOpacity={n.missing ? 0.14 : 0.3}
            strokeWidth={n.missing ? 1 : 1.4}
            strokeDasharray={n.missing ? '3 4' : undefined}
          />
        ))}

        <circle cx={cx} cy={cy} r="54" fill="#101826" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">
          {(student?.label || 'You').split(' ')[0]}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94A3B8" fontSize="10">
          {placed.filter((p) => !p.missing).length} skills
        </text>

        {placed.map((n) => {
          const colour = CATEGORY_COLOUR[n.cat] || '#64748B'
          const isSelected = selected?.id === n.id
          const labelAnchor = n.x < cx ? 'end' : 'start'
          const labelOffset = n.x < cx ? -(n.r + 6) : n.r + 6
          return (
            <g
              key={n.id}
              onMouseEnter={() => setSelected(n)}
              onFocus={() => setSelected(n)}
              onClick={() => setSelected(n)}
              tabIndex={0}
              className="cursor-pointer"
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.missing ? 'white' : colour}
                fillOpacity={n.missing ? 1 : 0.9}
                stroke={colour}
                strokeWidth={isSelected ? 3 : n.missing ? 1.5 : 1}
                strokeDasharray={n.missing ? '3 3' : undefined}
              />
              {n.verified && !n.missing && (
                <circle cx={n.x + n.r * 0.75} cy={n.y - n.r * 0.75} r="3.5" fill="#0E7C66" stroke="white" strokeWidth="1.5" />
              )}
              <text
                x={n.x + labelOffset}
                y={n.y + 4}
                textAnchor={labelAnchor}
                fontSize="11"
                fill={n.missing ? '#64748B' : '#101826'}
                fontWeight={isSelected ? 600 : 400}
              >
                {n.label}
              </text>
            </g>
          )
        })}

        {role && (
          <text x="400" y="545" textAnchor="middle" fontSize="11" fill="#64748B">
            Dashed nodes are what {role.label} still asks of you
          </text>
        )}
      </svg>

      {selected && (
        <div className="border-t border-line px-5 py-4 bg-paper">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-semibold">{selected.label}</p>
            {selected.missing ? (
              <span className="text-xs text-industry">Required by your target role, no evidence yet</span>
            ) : (
              <span className="text-xs text-muted">
                {LEVEL_LABEL[selected.level] || 'Evidenced'}
                {selected.verified ? ' · verified' : ` · from your ${selected.source || 'profile'}`}
              </span>
            )}
          </div>
          {selected.evidence && <p className="text-sm text-muted mt-1.5 max-w-[80ch]">{selected.evidence}</p>}
        </div>
      )}
    </div>
  )
}
