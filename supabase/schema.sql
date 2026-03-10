create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create table if not exists voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('aliyun', 'doubao')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer,
  status text not null check (status in ('active', 'finalized', 'failed')),
  raw_summary text
);

create table if not exists transcript_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references voice_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  seq integer not null,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references voice_sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  entry_date date not null,
  title text not null,
  events jsonb not null default '[]'::jsonb,
  thoughts jsonb not null default '[]'::jsonb,
  mood text,
  wins jsonb not null default '[]'::jsonb,
  problems jsonb not null default '[]'::jsonb,
  ideas jsonb not null default '[]'::jsonb,
  markdown text not null
);

create table if not exists planned_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references voice_sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  task_date date not null,
  title text not null,
  notes text,
  location text,
  priority text not null check (priority in ('high', 'medium', 'low')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  start_time timestamptz,
  end_time timestamptz,
  source_type text not null check (source_type in ('explicit', 'inferred')),
  calendar_event_id text,
  calendar_source text check (calendar_source in ('ios_eventkit', 'ics_single', 'ics_feed')),
  status text not null check (status in ('draft', 'confirmed', 'exported'))
);

create table if not exists calendar_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references voice_sessions(id) on delete cascade,
  export_type text not null check (export_type in ('ics_single', 'ics_feed', 'shortcuts', 'eventkit')),
  external_ref text,
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_sessions_user_started_at on voice_sessions(user_id, started_at desc);
create index if not exists idx_transcript_segments_session_seq on transcript_segments(session_id, seq);
create index if not exists idx_journal_entries_user_date on journal_entries(user_id, entry_date desc);
create index if not exists idx_planned_tasks_user_date on planned_tasks(user_id, task_date desc);

alter table voice_sessions enable row level security;
alter table transcript_segments enable row level security;
alter table journal_entries enable row level security;
alter table planned_tasks enable row level security;
alter table calendar_exports enable row level security;

create policy "Users can access own sessions" on voice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can access own journal entries" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can access own tasks" on planned_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can access own exports" on calendar_exports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can access transcript for own sessions" on transcript_segments
  for all using (
    exists (
      select 1
      from voice_sessions
      where voice_sessions.id = transcript_segments.session_id
        and voice_sessions.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from voice_sessions
      where voice_sessions.id = transcript_segments.session_id
        and voice_sessions.user_id = auth.uid()
    )
  );
