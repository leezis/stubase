-- Supabase SQL Editor에서 한 번만 실행해 주세요.
-- counseling_records 테이블에 상담 장소 / 상담 교사 컬럼을 추가합니다.

alter table if exists public.counseling_records
add column if not exists location text;

alter table if exists public.counseling_records
add column if not exists teacher_name text;

comment on column public.counseling_records.location is
'상담 장소 (예: 교무실, 교실, 복도, 상담실, 복지실, 급식실)';

comment on column public.counseling_records.teacher_name is
'상담 교사 이름';
