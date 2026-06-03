-- Add status to candidates
alter table candidates add column if not exists status text not null default 'in_behandeling'
  check (status in ('review', 'in_behandeling', 'archief'));

-- Track who made changes (last 3 editors)
alter table candidates add column if not exists editors jsonb not null default '[]'::jsonb;
-- editors format: [{user_id, full_name, edited_at}] — last 3 entries

-- Link back to invite
alter table candidates add column if not exists invite_id uuid references candidate_invites(id);

-- Add invite's candidate_id back-reference
alter table candidate_invites add column if not exists candidate_id uuid references candidates(id);
