-- Link Westijn candidates to Jordan candidates
alter table candidates add column if not exists jordan_id text;
