import { Badge, LevelDots } from './UI.jsx'

/** Every gap carries the reason it matters, so nothing here is an unexplained score. */
export default function GapList({ items, variant = 'missing', colour = 'bg-student' }) {
  if (!items?.length) {
    return <p className="text-sm text-muted">Nothing in this group.</p>
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.slug} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <LevelDots level={item.level} expected={item.expected_level} colour={colour} />
            {item.verified && <Badge tone="verified">Verified</Badge>}
            {variant !== 'have' && item.importance >= 5 && <Badge tone="warn">Critical for the role</Badge>}
            {item.transfer_from && (
              <Badge tone="info">Partly covered by your {item.transfer_from.replace(/-/g, ' ')}</Badge>
            )}
          </div>
          <p className="text-sm text-muted mt-1 max-w-[80ch]">{item.reason || item.why}</p>
          {variant !== 'have' && item.why && item.reason && (
            <p className="text-xs text-muted/80 mt-1 max-w-[80ch]">Why it matters: {item.why}</p>
          )}
          {variant === 'have' && item.evidence && (
            <p className="text-xs text-muted/80 mt-1 max-w-[80ch] italic">{item.evidence}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
