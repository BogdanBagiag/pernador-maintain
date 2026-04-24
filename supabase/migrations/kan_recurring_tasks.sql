-- Template-uri pentru taskuri recurente
create table if not exists kan_task_templates (
  id            uuid        primary key default gen_random_uuid(),
  board_id      uuid        not null references kan_boards(id) on delete cascade,
  column_id     uuid        references kan_columns(id) on delete set null,
  name          text        not null,
  description   text,
  checklist     jsonb       not null default '[]',
  priority      text        not null default 'medium',
  assigned_to   uuid        references profiles(id) on delete set null,
  recurrence_type text      not null check (recurrence_type in ('daily', 'weekly', 'monthly')),
  recurrence_day  integer,  -- ziua lunii (1-28) pentru monthly; null pentru daily/weekly
  recurrence_days jsonb     not null default '[]', -- zile saptamana pentru weekly: [0,1,2..6] (0=Du)
  recurrence_time time,     -- ora minima de creare, ex: '09:00'; null = oricand
  created_by    uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_spawned_date date    -- ultima data cand s-a creat un task din acest template
);

alter table kan_task_templates enable row level security;
create policy "kan_task_templates_all" on kan_task_templates
  for all using (true) with check (true);

-- Leaga task-urile create din template de sursa lor
alter table kan_tasks
  add column if not exists template_id uuid references kan_task_templates(id) on delete set null;
