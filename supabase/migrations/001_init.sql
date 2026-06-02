-- Enable UUID
create extension if not exists "uuid-ossp";

-- Profiles (linked to auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- Candidates
create table candidates (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references profiles(id),
  first_name text not null,
  last_name text not null,
  age int,
  role text not null,
  city text,
  availability text,
  language text default 'nl',
  review_tone text default 'formal',
  contact_person text default 'marlie',
  photo_url text,
  cv_json jsonb,
  cv_html text,
  intake_sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Intake forms
create table intake_forms (
  id uuid default uuid_generate_v4() primary key,
  candidate_id uuid references candidates(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  email text not null,
  expires_at timestamptz default (now() + interval '7 days'),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Intake responses
create table intake_responses (
  id uuid default uuid_generate_v4() primary key,
  intake_form_id uuid references intake_forms(id) on delete cascade,
  responses jsonb not null,
  photo_url text,
  submitted_at timestamptz default now()
);

-- Storage bucket for photos
insert into storage.buckets (id, name, public) values ('photos', 'photos', true);

-- RLS
alter table profiles enable row level security;
alter table candidates enable row level security;
alter table intake_forms enable row level security;
alter table intake_responses enable row level security;

create policy "Users see own profile" on profiles for select using (auth.uid() = id);
create policy "Admin sees all profiles" on profiles for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "All logged in users see all candidates" on candidates for select using (auth.role() = 'authenticated');
create policy "Users can insert candidates" on candidates for insert with check (auth.role() = 'authenticated');
create policy "Users can update own candidates" on candidates for update using (created_by = auth.uid());

create policy "Users manage own intake forms" on intake_forms for all using (
  exists (select 1 from candidates where id = candidate_id and created_by = auth.uid())
);
create policy "Public can read intake form by token" on intake_forms for select using (true);
create policy "Public can insert intake responses" on intake_responses for insert with check (true);
