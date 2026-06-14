create table if not exists public.school_life_records (
  id uuid primary key default gen_random_uuid(),
  student_id bigint not null references public.students(id) on delete cascade,
  school_year text not null,
  section_id text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year, section_id)
);

alter table public.school_life_records enable row level security;

grant select, insert, update, delete on public.school_life_records to authenticated;

drop policy if exists "Authenticated users can read school life records"
on public.school_life_records;

drop policy if exists "Authenticated users can insert school life records"
on public.school_life_records;

drop policy if exists "Authenticated users can update school life records"
on public.school_life_records;

drop policy if exists "Authenticated users can delete school life records"
on public.school_life_records;

create policy "Authenticated users can read school life records"
on public.school_life_records
for select
to authenticated
using (true);

create policy "Authenticated users can insert school life records"
on public.school_life_records
for insert
to authenticated
with check (true);

create policy "Authenticated users can update school life records"
on public.school_life_records
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete school life records"
on public.school_life_records
for delete
to authenticated
using (true);

create or replace function public.set_school_life_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_school_life_records_updated_at
on public.school_life_records;

create trigger set_school_life_records_updated_at
before update on public.school_life_records
for each row
execute function public.set_school_life_records_updated_at();

create table if not exists public.school_life_subject_references (
  id uuid primary key default gen_random_uuid(),
  school_year text not null,
  subject_id text not null,
  reference_type text not null check (reference_type in ('standard', 'level', 'evaluation', 'assignment')),
  file_name text not null default '',
  file_size bigint not null default 0,
  content_type text not null default 'application/pdf',
  storage_path text not null default '',
  extracted_text text not null default '',
  extracted_char_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_year, subject_id, reference_type)
);

alter table public.school_life_subject_references
drop constraint if exists school_life_subject_references_reference_type_check;

alter table public.school_life_subject_references
add constraint school_life_subject_references_reference_type_check
check (reference_type in ('standard', 'level', 'evaluation', 'assignment'));

alter table public.school_life_subject_references enable row level security;

grant select, insert, update, delete on public.school_life_subject_references to authenticated;

drop policy if exists "Authenticated users can read school life subject references"
on public.school_life_subject_references;

drop policy if exists "Authenticated users can insert school life subject references"
on public.school_life_subject_references;

drop policy if exists "Authenticated users can update school life subject references"
on public.school_life_subject_references;

drop policy if exists "Authenticated users can delete school life subject references"
on public.school_life_subject_references;

create policy "Authenticated users can read school life subject references"
on public.school_life_subject_references
for select
to authenticated
using (true);

create policy "Authenticated users can insert school life subject references"
on public.school_life_subject_references
for insert
to authenticated
with check (true);

create policy "Authenticated users can update school life subject references"
on public.school_life_subject_references
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete school life subject references"
on public.school_life_subject_references
for delete
to authenticated
using (true);

create or replace function public.set_school_life_subject_references_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_school_life_subject_references_updated_at
on public.school_life_subject_references;

create trigger set_school_life_subject_references_updated_at
before update on public.school_life_subject_references
for each row
execute function public.set_school_life_subject_references_updated_at();

insert into storage.buckets (id, name, public)
values ('school-life-subject-references', 'school-life-subject-references', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read school life subject reference files"
on storage.objects;

drop policy if exists "Authenticated users can upload school life subject reference files"
on storage.objects;

drop policy if exists "Authenticated users can update school life subject reference files"
on storage.objects;

drop policy if exists "Authenticated users can delete school life subject reference files"
on storage.objects;

create policy "Authenticated users can read school life subject reference files"
on storage.objects
for select
to authenticated
using (bucket_id = 'school-life-subject-references');

create policy "Authenticated users can upload school life subject reference files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'school-life-subject-references');

create policy "Authenticated users can update school life subject reference files"
on storage.objects
for update
to authenticated
using (bucket_id = 'school-life-subject-references')
with check (bucket_id = 'school-life-subject-references');

create policy "Authenticated users can delete school life subject reference files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'school-life-subject-references');
