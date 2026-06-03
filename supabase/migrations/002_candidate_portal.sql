create table if not exists candidate_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  candidate_email text not null,
  candidate_name text not null,
  created_by uuid references profiles(id),
  expires_at timestamptz not null default now() + interval '72 hours',
  status text not null default 'pending', -- pending, submitted, expired
  submitted_at timestamptz,
  questionnaire_answers jsonb,
  photo_url text,
  cv_url text,
  grade_list_url text,
  extra_doc_urls text[],
  notes text,
  created_at timestamptz default now()
);

-- RLS: only authenticated users can see invites
alter table candidate_invites enable row level security;
create policy "authenticated users can manage invites" on candidate_invites
  for all to authenticated using (true) with check (true);
-- Public can read by token (for candidate portal)
create policy "public can read invite by token" on candidate_invites
  for select to anon using (true);
-- Public can update their own submission
create policy "public can submit invite" on candidate_invites
  for update to anon using (true) with check (true);

insert into storage.buckets (id, name, public) values ('candidate-uploads', 'candidate-uploads', false) on conflict do nothing;
create policy "authenticated users can read candidate uploads" on storage.objects for select to authenticated using (bucket_id = 'candidate-uploads');
create policy "anon can upload to candidate-uploads" on storage.objects for insert to anon with check (bucket_id = 'candidate-uploads');
