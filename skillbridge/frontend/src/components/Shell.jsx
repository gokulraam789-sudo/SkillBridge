import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { accent } from './UI.jsx'

const NAV = {
  student: [
    ['', 'Overview'],
    ['upload', 'Add documents'],
    ['graph', 'My skill graph'],
    ['gaps', 'Skill gaps'],
    ['roadmap', 'Learning roadmap'],
    ['opportunities', 'Opportunities'],
    ['passport', 'Skill passport'],
    ['assistant', 'Ask SkillBridge'],
  ],
  institute: [
    ['', 'Cohort overview'],
    ['students', 'Students'],
    ['training', 'Training plans'],
  ],
  industry: [
    ['', 'Overview'],
    ['discover', 'Find talent'],
    ['opportunities', 'Opportunities'],
  ],
  admin: [
    ['', 'Platform overview'],
    ['manage', 'Manage platform'],
  ],
}

const ROLE_LABEL = {
  student: 'Student',
  institute: 'Institute',
  industry: 'Industry',
  admin: 'Admin',
}

export default function Shell({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const a = accent(user.role)
  const base = `/${user.role}`
  const items = NAV[user.role] || []

  const nav = (
    <nav className="space-y-0.5">
      {items.map(([path, label]) => (
        <NavLink
          key={path}
          to={path ? `${base}/${path}` : base}
          end={!path}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `block rounded-lg px-3 py-2 text-sm ${
              isActive ? `${a.soft} ${a.text} font-medium` : 'text-muted hover:text-ink hover:bg-paper'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <Brand role={user.role} />
        <button className="btn-ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        className={`${open ? 'block' : 'hidden'} lg:block lg:w-64 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-white lg:h-screen lg:sticky lg:top-0`}
      >
        <div className="hidden lg:block px-5 pt-5">
          <Brand role={user.role} />
        </div>
        <div className="px-3 py-4 lg:px-3 lg:py-5">
          <div className={`mb-4 rounded-lg ${a.soft} px-3 py-2.5`}>
            <p className={`text-xs font-medium ${a.text}`}>{ROLE_LABEL[user.role]} workspace</p>
            <p className="text-sm font-medium mt-0.5 truncate">{user.name}</p>
            {user.organisation && <p className="text-xs text-muted truncate">{user.organisation}</p>}
          </div>
          {nav}
          <button
            className="btn-quiet w-full justify-start mt-4"
            onClick={() => {
              signOut()
              navigate('/signin')
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>
    </div>
  )
}

function Brand({ role }) {
  const a = accent(role)
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${a.bg}`}>
        <span className="block h-2.5 w-2.5 rounded-full bg-white/90" />
      </span>
      <span className="font-display font-semibold tracking-tight">SkillBridge</span>
    </div>
  )
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted mt-1.5 max-w-[72ch]">{description}</p>}
      </div>
      {action}
    </div>
  )
}
