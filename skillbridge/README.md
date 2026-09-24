# SkillBridge

One AI engine → one shared skill graph → three connected dashboards.

Students build a structured skill graph from their own documents. Institutes read the
same graph aggregated across a batch. Industry searches across it and posts what it needs.
Nothing is duplicated per dashboard — the same skill representation powers extraction,
gap analysis, matching, analytics and the verified Skill Passport.

- **Frontend** — React 18 + Vite + Tailwind CSS
- **Backend** — Python, FastAPI, SQLAlchemy
- **Database** — PostgreSQL (Supabase), with a zero-setup SQLite fallback for the first run

---

## Run it in a GitHub Codespace

Unzip this folder into a repository, push it, and open a Codespace. Then, in two terminals:

**Terminal 1 — API**

```bash
cd backend
./run.sh
```

That creates a virtualenv, installs dependencies, copies `.env.example` to `.env`, seeds the
demo ecosystem and starts the API on port 8000.

**Terminal 2 — web app**

```bash
cd frontend
npm install
npm run dev
```

Open the forwarded URL for port 5173. Nothing else to configure: the dev server proxies API
calls to the backend on `localhost:8000` internally, so the browser only ever talks to the one
origin it's already on. (Port 8000 doesn't need to be made Public for this reason — the browser
never calls it directly. Only make it Public if you want to hit it yourself, e.g. for `/docs`.)

## Run it locally

Same two commands. The API is at `http://localhost:8000`, docs at `http://localhost:8000/docs`,
the web app at `http://localhost:5173`.

---

## Demo sign-ins

| Role | Email | Password |
|---|---|---|
| Student | `student@skillbridge.dev` | `student123` |
| Institute (TPO) | `tpo@anna.edu` | `institute123` |
| Industry | `hiring@lumina.dev` | `industry123` |
| Admin | `admin@skillbridge.dev` | `admin123` |

The seed also creates ~40 students across two institutes so the batch analytics and talent
search have real distributions to work with. Every seeded student uses `student123`.

## The demo journey

The demo student starts with a deliberately thin graph, so one pass shows the whole loop:

1. Sign in as the student → **Add documents** → upload a resume (or paste text; there is a
   sample at `samples/ravi-resume.txt`).
2. Skills are extracted with the evidence line that justified each one. **You review and edit
   the proposal before anything is written** to your graph.
3. **My skill graph** shows the committed nodes; **Skill gaps** compares them against the
   target role, with a reason per missing skill.
4. **Learning roadmap** sequences the gaps into phases with a project per skill.
5. **Opportunities** ranks internships and projects by skill overlap, and explains each match.
6. Sign in as the institute → the same student's skills now move the batch numbers, and a
   training recommendation appears against the gap that justified it.
7. Sign in as industry → search by skill, open the student's verified profile, see matched and
   missing skills rather than an unexplained score.

---

## Point it at Supabase

1. Create a Supabase project. In **Project settings → Database → Connection string → URI**,
   copy the connection pooler URI (port `6543`).
2. Put it in `backend/.env`, converting the scheme to SQLAlchemy's driver form:

```
DATABASE_URL=postgresql+psycopg2://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

3. Restart `./run.sh`. Tables are created on startup and the seed runs against Postgres.

If you prefer to create the schema yourself, `backend/sql/schema.sql` has the equivalent DDL
to paste into the Supabase SQL editor.

To start over: `cd backend && source .venv/bin/activate && python -m app.seed --reset`.

---

## Optional: LLM enrichment

Everything runs without an API key. The extraction and assistant engines are deterministic and
offline by default, which keeps the demo reproducible.

Set `ANTHROPIC_API_KEY` in `backend/.env` and the same two steps get an LLM pass layered on top:
resume text is read for skills the rule-based pass missed, and the student assistant answers in
freer language. Matching, gap analysis and analytics stay deterministic either way.

`GET /health` reports whether enrichment is active.

---

## Layout

```
backend/
  app/
    main.py            FastAPI app, CORS, startup
    models.py          The shared graph: students, skills, roles, evidence, opportunities
    seed.py            Taxonomy + demo ecosystem
    data/taxonomy.py   Skills, aliases, target roles and why each skill matters
    routers/           auth · student · institute · industry · admin
    services/
      extraction.py    Documents → a reviewable skill proposal
      semantic.py      Alias and related-skill similarity (no exact-keyword matching)
      matching.py      Profile ↔ role, profile ↔ opportunity, with reasons
      graph.py         The shared graph, read three ways
      roadmap.py       Gaps → a sequenced plan
      assistant.py     Student Q&A grounded in the student's own graph
  sql/schema.sql       Postgres DDL for Supabase
frontend/
  src/
    components/        Shell, skill graph canvas, gap list, match card
    pages/             student/ · institute/ · industry/ · admin/
    lib/               API client, auth context
samples/               A resume to drop into the upload flow
```

## Access control

JWT bearer tokens, checked per role on every route. Students reach only their own graph and
passport. Institutes reach students at their institute, and see aggregates rather than resumes
or contact details. Industry sees skill profiles and verification status, not academic records
it has no reason to hold. Admin manages the taxonomy, accounts and credential review.

## What is deliberately not claimed

Resume parsing, embeddings, skill matching and credential checks are established techniques.
The work here is the integration: one skill representation that three dashboards read and write
continuously, so a student closing a gap moves the institute's batch numbers and surfaces the
student to industry without anyone re-entering anything.

Credential verification ships with a DigiLocker/API Setu-shaped sandbox flow, not a live
integration. Credentials stay in one of three states — verified, pending, student-provided —
and the UI never blurs them.

## Extending it

Modular by design: add a credential provider under `services/`, swap the similarity function in
`semantic.py` for a hosted embedding model, or add a router without touching the others. The
skill taxonomy in `data/taxonomy.py` is data, not code paths — new skills and roles flow to every
dashboard at once.
