create table if not exists public.personal_grade_records (
  id uuid primary key default gen_random_uuid(),
  student_id bigint not null references public.students(id) on delete cascade,
  school_year text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year)
);

alter table public.personal_grade_records enable row level security;

grant select, insert, update, delete on public.personal_grade_records to authenticated;

drop policy if exists "Authenticated users can read personal grade records"
on public.personal_grade_records;

drop policy if exists "Authenticated users can insert personal grade records"
on public.personal_grade_records;

drop policy if exists "Authenticated users can update personal grade records"
on public.personal_grade_records;

drop policy if exists "Authenticated users can delete personal grade records"
on public.personal_grade_records;

create policy "Authenticated users can read personal grade records"
on public.personal_grade_records
for select
to authenticated
using (true);

create policy "Authenticated users can insert personal grade records"
on public.personal_grade_records
for insert
to authenticated
with check (true);

create policy "Authenticated users can update personal grade records"
on public.personal_grade_records
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete personal grade records"
on public.personal_grade_records
for delete
to authenticated
using (true);

create or replace function public.set_personal_grade_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_personal_grade_records_updated_at
on public.personal_grade_records;

create trigger set_personal_grade_records_updated_at
before update on public.personal_grade_records
for each row
execute function public.set_personal_grade_records_updated_at();
