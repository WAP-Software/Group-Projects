-- Task Subtasks
create table if not exists public.task_subtasks (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  completed boolean default false,
  assigned_to uuid references public.profiles(id) on delete set null,
  position float default 0,
  created_at timestamptz default now()
);
alter table public.task_subtasks enable row level security;
create policy "subtask_all" on public.task_subtasks for all
  using (task_id in (
    select id from public.tasks where workspace_id in (select public.get_my_workspace_ids())
  ));

-- Task Comments
create table if not exists public.task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);
alter table public.task_comments enable row level security;
create policy "task_comment_all" on public.task_comments for all
  using (task_id in (
    select id from public.tasks where workspace_id in (select public.get_my_workspace_ids())
  ));

-- Task Files (links tasks to the existing files table)
create table if not exists public.task_files (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  file_id uuid references public.files(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(task_id, file_id)
);
alter table public.task_files enable row level security;
create policy "task_file_all" on public.task_files for all
  using (task_id in (
    select id from public.tasks where workspace_id in (select public.get_my_workspace_ids())
  ));

-- Realtime
alter publication supabase_realtime add table public.task_subtasks;
alter publication supabase_realtime add table public.task_comments;
