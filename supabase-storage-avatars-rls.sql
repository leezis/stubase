-- Supabase SQL Editor에서 그대로 실행해 주세요.
-- 먼저 Dashboard > Storage 에서 아래 두 가지를 확인해 주세요.
-- 1. avatars 버킷이 이미 존재하는지
-- 2. avatars 버킷이 Public 상태인지
--
-- 이 파일은 storage.objects의 업로드/수정/삭제 정책만 추가합니다.
-- 현재 프론트 업로드 경로: auth.uid()/students/{studentId}/{random}.webp
--
-- 참고:
-- storage.objects는 Supabase가 관리하는 테이블이라
-- alter table ... enable row level security; 같은 구문은 실행하지 않습니다.

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;
drop policy if exists "Authenticated users can delete avatars" on storage.objects;
drop policy if exists "Authenticated users can read avatars" on storage.objects;

create policy "Authenticated users can upload avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can update avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can delete avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated users can read avatars"
on storage.objects
for select
to authenticated
using (bucket_id = 'avatars');

-- 참고:
-- - 버킷을 Public으로 두면 업로드 후 getPublicUrl()로 이미지를 바로 표시할 수 있습니다.
-- - Public 여부는 "보이기" 권한이고, 지금 에러의 핵심 원인은 insert/update/delete용 Storage RLS 정책이 없다는 점입니다.
