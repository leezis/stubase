const STORAGE_POLICY_GUIDE =
  'avatars 버킷의 Storage RLS 정책이 없어 업로드가 막혔습니다. Supabase SQL Editor에서 avatars 업로드 정책을 추가해 주세요.'

const STUDENT_AVATAR_UPDATE_GUIDE =
  'students 테이블의 avatar_url 저장 권한이 없어 사진 주소를 기록하지 못했습니다. Supabase SQL Editor에서 update 정책을 확인해 주세요.'

export function getFriendlyAvatarUploadErrorMessage(error) {
  const rawMessage = error?.message ?? ''

  if (rawMessage.includes('row-level security policy')) {
    return STORAGE_POLICY_GUIDE
  }

  if (rawMessage.includes('mime type')) {
    return '허용되지 않은 이미지 형식입니다. webp 또는 일반 이미지 파일인지 확인해 주세요.'
  }

  if (rawMessage.includes('duplicate')) {
    return '같은 경로에 이미 파일이 있어 업로드하지 못했습니다.'
  }

  return rawMessage || '사진 업로드 중 오류가 발생했습니다.'
}

export function getFriendlyAvatarStudentUpdateErrorMessage(error) {
  const rawMessage = error?.message ?? ''

  if (rawMessage.includes('row-level security policy')) {
    return STUDENT_AVATAR_UPDATE_GUIDE
  }

  return rawMessage || '사진 주소 저장 중 오류가 발생했습니다.'
}

export function getAvatarStoragePolicyGuideMessage() {
  return STORAGE_POLICY_GUIDE
}
