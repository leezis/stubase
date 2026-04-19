-- Supabase SQL Editor에서 실행하세요.
-- 목표:
-- 1. students / counseling_records 테이블에 RLS 활성화
-- 2. 로그인한 authenticated 사용자만 조회/추가/수정/삭제 허용
-- 3. 로그아웃 상태의 anon 사용자는 모든 데이터 접근 차단

alter table if exists public.students enable row level security;
alter table if exists public.counseling_records enable row level security;

drop policy if exists "Authenticated users can read students" on public.students;
drop policy if exists "Authenticated users can insert students" on public.students;
drop policy if exists "Authenticated users can update students" on public.students;
drop policy if exists "Authenticated users can delete students" on public.students;

create policy "Authenticated users can read students"
on public.students
for select
to authenticated
using (true);

create policy "Authenticated users can insert students"
on public.students
for insert
to authenticated
with check (true);

create policy "Authenticated users can update students"
on public.students
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete students"
on public.students
for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read counseling records" on public.counseling_records;
drop policy if exists "Authenticated users can insert counseling records" on public.counseling_records;
drop policy if exists "Authenticated users can update counseling records" on public.counseling_records;
drop policy if exists "Authenticated users can delete counseling records" on public.counseling_records;

create policy "Authenticated users can read counseling records"
on public.counseling_records
for select
to authenticated
using (true);

create policy "Authenticated users can insert counseling records"
on public.counseling_records
for insert
to authenticated
with check (true);

create policy "Authenticated users can update counseling records"
on public.counseling_records
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete counseling records"
on public.counseling_records
for delete
to authenticated
using (true);

-- 참고:
-- 지금 정책은 "로그인한 교사면 전체 학생 데이터를 관리 가능"한 구조입니다.
-- 나중에 교사별 담당 학생만 보이게 하려면 owner_id 같은 컬럼을 추가하고
-- using / with check 조건을 auth.uid() 기준으로 좁히면 됩니다.
