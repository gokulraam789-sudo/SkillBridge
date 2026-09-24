-- SkillBridge schema for Supabase / PostgreSQL.
--
-- You do not have to run this. The API calls create_all() on startup and will
-- build these tables for you. Run it in the Supabase SQL editor if you would
-- rather create the schema first, or want to read it before pointing the API at
-- a production project.
--
-- Access control lives in the API (JWT + role checks in app/deps.py). If you also
-- expose these tables through Supabase's auto-generated REST API, enable RLS -
-- see the notes at the bottom.

create table if not exists institutes (
    id          varchar(32) primary key,
    name        varchar(200) not null,
    city        varchar(120) default '',
    created_at  timestamp default now()
);

create table if not exists companies (
    id          varchar(32) primary key,
    name        varchar(200) not null,
    sector      varchar(120) default '',
    created_at  timestamp default now()
);

create table if not exists users (
    id            varchar(32) primary key,
    email         varchar(200) unique not null,
    password_hash varchar(200) not null,
    name          varchar(200) not null,
    role          varchar(20) not null check (role in ('student','institute','industry','admin')),
    institute_id  varchar(32) references institutes(id),
    company_id    varchar(32) references companies(id),
    created_at    timestamp default now()
);
create index if not exists idx_users_email on users(email);

create table if not exists roles (
    id      varchar(32) primary key,
    slug    varchar(80) unique not null,
    title   varchar(140) not null,
    summary text default ''
);

create table if not exists skills (
    id          varchar(32) primary key,
    slug        varchar(80) unique not null,
    name        varchar(120) not null,
    category    varchar(40) default 'technical',
    description text default ''
);

create table if not exists students (
    id             varchar(32) primary key,
    user_id        varchar(32) not null references users(id),
    institute_id   varchar(32) references institutes(id),
    department     varchar(120) default '',
    batch          varchar(40) default '',
    headline       varchar(240) default '',
    target_role_id varchar(32) references roles(id),
    cgpa           double precision,
    open_to_work   boolean default true,
    created_at     timestamp default now()
);

create table if not exists role_skills (
    id             varchar(32) primary key,
    role_id        varchar(32) not null references roles(id),
    skill_id       varchar(32) not null references skills(id),
    importance     integer default 3,
    expected_level integer default 3,
    rationale      text default '',
    unique (role_id, skill_id)
);

-- The shared skill graph: one edge per student-skill pair, read by all three dashboards.
create table if not exists student_skills (
    id            varchar(32) primary key,
    student_id    varchar(32) not null references students(id) on delete cascade,
    skill_id      varchar(32) not null references skills(id),
    level         integer default 2 check (level between 1 and 5),
    confidence    double precision default 0.5,
    source        varchar(40) default 'resume',
    evidence_text text default '',
    verified      boolean default false,
    updated_at    timestamp default now(),
    unique (student_id, skill_id)
);
create index if not exists idx_student_skills_skill on student_skills(skill_id);

create table if not exists evidence (
    id                  varchar(32) primary key,
    student_id          varchar(32) not null references students(id) on delete cascade,
    kind                varchar(40) default 'project',
    title               varchar(240) not null,
    description         text default '',
    issuer              varchar(200) default '',
    url                 varchar(400) default '',
    verification_status varchar(20) default 'unverified'
        check (verification_status in ('unverified','pending','verified')),
    verification_source varchar(80) default '',
    verified_at         timestamp,
    created_at          timestamp default now()
);

create table if not exists documents (
    id              varchar(32) primary key,
    student_id      varchar(32) not null references students(id) on delete cascade,
    filename        varchar(300) default '',
    kind            varchar(40) default 'resume',
    raw_text        text default '',
    status          varchar(20) default 'uploaded',
    extraction_note text default '',
    created_at      timestamp default now()
);

create table if not exists opportunities (
    id             varchar(32) primary key,
    company_id     varchar(32) not null references companies(id),
    title          varchar(200) not null,
    kind           varchar(30) default 'internship'
        check (kind in ('internship','job','project','challenge')),
    description    text default '',
    location       varchar(140) default 'Remote',
    stipend        varchar(80) default '',
    role_id        varchar(32) references roles(id),
    open_positions integer default 1,
    is_open        boolean default true,
    created_at     timestamp default now()
);

create table if not exists opportunity_skills (
    id             varchar(32) primary key,
    opportunity_id varchar(32) not null references opportunities(id) on delete cascade,
    skill_id       varchar(32) not null references skills(id),
    importance     integer default 3,
    expected_level integer default 3,
    unique (opportunity_id, skill_id)
);

create table if not exists applications (
    id             varchar(32) primary key,
    student_id     varchar(32) not null references students(id) on delete cascade,
    opportunity_id varchar(32) not null references opportunities(id) on delete cascade,
    status         varchar(30) default 'applied',
    match_score    double precision default 0,
    note           text default '',
    created_at     timestamp default now(),
    unique (student_id, opportunity_id)
);

create table if not exists roadmap_items (
    id              varchar(32) primary key,
    student_id      varchar(32) not null references students(id) on delete cascade,
    skill_id        varchar(32) not null references skills(id),
    step            integer default 1,
    action          text default '',
    project_idea    text default '',
    resource        varchar(300) default '',
    estimated_weeks integer default 2,
    status          varchar(20) default 'todo',
    created_at      timestamp default now()
);

create table if not exists training_signals (
    id           varchar(32) primary key,
    institute_id varchar(32) not null references institutes(id),
    skill_id     varchar(32) not null references skills(id),
    batch        varchar(40) default '',
    department   varchar(120) default '',
    title        varchar(240) default '',
    rationale    text default '',
    status       varchar(20) default 'planned',
    created_at   timestamp default now()
);

create table if not exists activity_log (
    id         varchar(32) primary key,
    actor_id   varchar(32),
    actor_role varchar(20) default '',
    action     varchar(120) default '',
    detail     text default '',
    created_at timestamp default now()
);

-- Row level security
-- The API connects with the service role and enforces per-role access itself, so
-- RLS is not required for this deployment. If you also query these tables directly
-- from a browser using the anon key, turn RLS on for every table below and write
-- policies before doing so - student_skills, evidence and documents carry personal
-- data and must never be readable by the anon key.
--
-- alter table students       enable row level security;
-- alter table student_skills enable row level security;
-- alter table evidence       enable row level security;
-- alter table documents      enable row level security;
