-- ============================================================
-- FinanceCollab — Supabase SQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  university text,
  program text default 'Master in Finance',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select using (true);

create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- WORKSPACES
-- ============================================================
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  slug text unique not null,
  course_name text,
  semester text,
  color text default '#2563eb',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')) default 'editor',
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Security-definer helper: returns workspace IDs the current user belongs to.
-- SECURITY DEFINER bypasses RLS inside the function, preventing infinite recursion
-- when policies on workspace_members reference workspace_members.
create or replace function public.get_my_workspace_ids()
returns setof uuid language sql security definer set search_path = public stable as $$
  select workspace_id from public.workspace_members where user_id = auth.uid();
$$;
grant execute on function public.get_my_workspace_ids() to authenticated, anon;

create policy "workspace_member_select" on public.workspaces for select
  using (
    id in (select public.get_my_workspace_ids())
    or created_by = auth.uid()
  );

create policy "workspace_insert" on public.workspaces for insert
  with check (auth.uid() is not null);

create policy "workspace_update" on public.workspaces for update
  using (id in (select public.get_my_workspace_ids()));

create policy "workspace_delete" on public.workspaces for delete
  using (id in (
    select workspace_id from workspace_members
    where user_id = auth.uid() and role = 'owner'
  ));

create policy "wm_select" on public.workspace_members for select
  using (workspace_id in (select public.get_my_workspace_ids()));

create policy "wm_insert" on public.workspace_members for insert
  with check (auth.uid() is not null);

create policy "wm_delete" on public.workspace_members for delete
  using (user_id = auth.uid() or workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'
  ));

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null default 'Untitled Document',
  content jsonb,
  yjs_state bytea,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'draft' check (status in ('draft', 'in_review', 'approved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.document_comments (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references public.documents(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  position jsonb,
  resolved boolean default false,
  created_at timestamptz default now()
);

alter table public.documents enable row level security;
alter table public.document_comments enable row level security;

create policy "doc_select" on public.documents for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "doc_insert" on public.documents for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "doc_update" on public.documents for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "doc_delete" on public.documents for delete
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role in ('owner','editor')
  ));

create policy "comment_select" on public.document_comments for select
  using (document_id in (
    select id from documents where workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  ));

create policy "comment_insert" on public.document_comments for insert
  with check (user_id = auth.uid());

create policy "comment_update" on public.document_comments for update
  using (user_id = auth.uid());

create policy "comment_delete" on public.document_comments for delete
  using (user_id = auth.uid());

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in ('backlog','in_progress','review','done')),
  priority text default 'medium'
    check (priority in ('low','medium','high','urgent')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_date date,
  position float default 0,
  milestone boolean default false,
  depends_on uuid references public.tasks(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.task_labels (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade,
  label text not null,
  color text default '#6b7280'
);

alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;

create policy "task_select" on public.tasks for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "task_insert" on public.tasks for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "task_update" on public.tasks for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "task_delete" on public.tasks for delete
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "label_all" on public.task_labels for all
  using (task_id in (
    select id from tasks where workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  ));

-- ============================================================
-- FILES
-- ============================================================
create table public.files (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  r2_key text not null,
  folder_path text default '/',
  version integer default 1,
  parent_version_id uuid references public.files(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  description text,
  tags text[],
  created_at timestamptz default now()
);

alter table public.files enable row level security;

create policy "file_select" on public.files for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "file_insert" on public.files for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "file_delete" on public.files for delete
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role in ('owner','editor')
  ));

-- ============================================================
-- CHAT
-- ============================================================
create table public.channels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid references public.channels(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  thread_id uuid references public.messages(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  edited boolean default false,
  created_at timestamptz default now()
);

create index messages_channel_created on public.messages(channel_id, created_at desc);

alter table public.channels enable row level security;
alter table public.messages enable row level security;

create policy "channel_select" on public.channels for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "channel_insert" on public.channels for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "message_select" on public.messages for select
  using (channel_id in (
    select id from channels where workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  ));

create policy "message_insert" on public.messages for insert
  with check (user_id = auth.uid());

create policy "message_update" on public.messages for update
  using (user_id = auth.uid());

create policy "message_delete" on public.messages for delete
  using (user_id = auth.uid());

-- ============================================================
-- SOURCES
-- ============================================================
create table public.sources (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null,
  url text,
  file_id uuid references public.files(id) on delete set null,
  source_type text default 'url'
    check (source_type in ('url','pdf','book','paper','news','other')),
  notes text,
  tags text[],
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.sources enable row level security;

create policy "source_all" on public.sources for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- ============================================================
-- FORMULAS
-- ============================================================
create table public.formulas (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null,
  latex text not null,
  description text,
  category text default 'Allgemein',
  tags text[],
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.formulas enable row level security;

create policy "formula_all" on public.formulas for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- ============================================================
-- PEER REVIEW
-- ============================================================
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  title text not null,
  status text default 'pending'
    check (status in ('pending','in_review','changes_requested','approved')),
  submitted_by uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.review_assignments (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid references public.reviews(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending'
    check (status in ('pending','in_progress','done')),
  feedback text,
  rating integer check (rating between 1 and 5),
  submitted_at timestamptz,
  unique(review_id, reviewer_id)
);

alter table public.reviews enable row level security;
alter table public.review_assignments enable row level security;

create policy "review_select" on public.reviews for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "review_insert" on public.reviews for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "review_update" on public.reviews for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "ra_select" on public.review_assignments for select
  using (review_id in (
    select id from reviews where workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  ));

create policy "ra_all" on public.review_assignments for all
  using (
    reviewer_id = auth.uid() or
    review_id in (select id from reviews where submitted_by = auth.uid())
  );

-- ============================================================
-- POLLS
-- ============================================================
create table public.polls (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  question text not null,
  options jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  multiple_choice boolean default false,
  anonymous boolean default false,
  created_at timestamptz default now()
);

create table public.poll_votes (
  id uuid primary key default uuid_generate_v4(),
  poll_id uuid references public.polls(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  option_ids jsonb not null,
  created_at timestamptz default now(),
  unique(poll_id, user_id)
);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

create policy "poll_select" on public.polls for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "poll_insert" on public.polls for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "vote_select" on public.poll_votes for select
  using (poll_id in (
    select id from polls where workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  ));

create policy "vote_insert" on public.poll_votes for insert
  with check (user_id = auth.uid());

-- ============================================================
-- CONTRIBUTION TRACKING (View)
-- ============================================================
create or replace view public.contributions as
  select
    wm.workspace_id,
    wm.user_id,
    p.full_name,
    p.avatar_url,
    count(distinct t.id) filter (where t.status = 'done') as tasks_completed,
    count(distinct t.id) filter (where t.created_by = wm.user_id) as tasks_created,
    count(distinct d.id) as documents_created,
    count(distinct f.id) as files_uploaded,
    count(distinct m.id) as messages_sent
  from workspace_members wm
  join profiles p on p.id = wm.user_id
  left join tasks t on t.workspace_id = wm.workspace_id
    and (t.assigned_to = wm.user_id or t.created_by = wm.user_id)
  left join documents d on d.workspace_id = wm.workspace_id
    and d.created_by = wm.user_id
  left join files f on f.workspace_id = wm.workspace_id
    and f.uploaded_by = wm.user_id
  left join channels ch on ch.workspace_id = wm.workspace_id
  left join messages m on m.channel_id = ch.id
    and m.user_id = wm.user_id
  group by wm.workspace_id, wm.user_id, p.full_name, p.avatar_url;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.poll_votes;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.document_comments;
