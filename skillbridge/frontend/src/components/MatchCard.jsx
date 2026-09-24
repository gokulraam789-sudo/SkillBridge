import { Badge, Button, Progress } from './UI.jsx'

const KIND_LABEL = {
  internship: 'Internship',
  job: 'Graduate role',
  project: 'Industry project',
  challenge: 'Challenge',
}

export default function MatchCard({ match, onApply, applied }) {
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold">{match.title}</h3>
            <Badge tone="neutral">{KIND_LABEL[match.kind] || match.kind}</Badge>
          </div>
          <p className="text-sm text-muted mt-0.5">
            {match.company}
            {match.location ? ` · ${match.location}` : ''}
            {match.stipend ? ` · ${match.stipend}` : ''}
          </p>
        </div>
        <div className="text-right min-w-[92px]">
          <p className="font-display text-xl font-semibold">{match.score}%</p>
          <p className="text-xs text-muted">skill match</p>
        </div>
      </div>

      <div className="mt-3">
        <Progress value={match.score} />
      </div>

      <ul className="mt-3 space-y-1">
        {match.reasons?.map((reason, i) => (
          <li key={i} className="text-sm text-muted flex gap-2">
            <span className="text-line">—</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>

      {(match.matched?.length > 0 || match.missing?.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {match.matched?.slice(0, 6).map((s) => (
            <Badge key={s.slug} tone="info">
              {s.name}
            </Badge>
          ))}
          {match.missing?.slice(0, 3).map((s) => (
            <Badge key={s.slug} tone="warn">
              {s.name} missing
            </Badge>
          ))}
        </div>
      )}

      {onApply && (
        <div className="mt-4">
          {applied ? (
            <Badge tone="verified">Application {applied}</Badge>
          ) : (
            <Button onClick={() => onApply(match)}>Apply with my skill passport</Button>
          )}
        </div>
      )}
    </article>
  )
}
