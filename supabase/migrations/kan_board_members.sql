-- Membri asociati unui board de echipa
create table if not exists kan_board_members (
  id         uuid        primary key default gen_random_uuid(),
  board_id   uuid        not null references kan_boards(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(board_id, user_id)
);

alter table kan_board_members enable row level security;
create policy "kan_board_members_all" on kan_board_members
  for all using (true) with check (true);
