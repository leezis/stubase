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
