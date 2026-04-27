-- 비상연락망 기능에서 사용하는 연락처 컬럼을 students 테이블에 추가합니다.

alter table if exists public.students
add column if not exists student_phone text;

alter table if exists public.students
add column if not exists parent_phone text;

comment on column public.students.student_phone is
'비상연락망에 표시할 학생 휴대전화번호입니다.';

comment on column public.students.parent_phone is
'비상연락망에 표시할 학부모 또는 보호자 휴대전화번호입니다.';
