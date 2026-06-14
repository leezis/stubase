import { supabase } from '../../lib/supabase'

const SCHOOL_LIFE_RECORD_TABLE = 'school_life_records'

export function getSchoolLifeRecordErrorMessage(error) {
  const message = String(error?.message ?? '')

  if (
    message.includes('school_life_records') ||
    message.includes('relation') ||
    message.includes('does not exist')
  ) {
    return '학교생활기록부 저장 테이블이 아직 없습니다. Supabase SQL Editor에서 supabase-school-life-records.sql을 실행해 주세요.'
  }

  if (
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('RLS')
  ) {
    return '학교생활기록부 저장 권한을 확인해 주세요. supabase-school-life-records.sql의 RLS 정책이 필요합니다.'
  }

  return message || '학교생활기록부 데이터를 저장하지 못했습니다.'
}

export async function fetchSchoolLifeRecordRows(studentId, schoolYear) {
  if (!supabase || !studentId) {
    return { data: [], error: null }
  }

  return supabase
    .from(SCHOOL_LIFE_RECORD_TABLE)
    .select('section_id, content')
    .eq('student_id', studentId)
    .eq('school_year', schoolYear)
}

export async function saveSchoolLifeRecordValue({
  content,
  schoolYear,
  sectionId,
  studentId,
}) {
  if (!supabase || !studentId || !sectionId) {
    return { error: null }
  }

  if (!String(content ?? '').trim()) {
    return supabase
      .from(SCHOOL_LIFE_RECORD_TABLE)
      .delete()
      .eq('student_id', studentId)
      .eq('school_year', schoolYear)
      .eq('section_id', sectionId)
  }

  return supabase.from(SCHOOL_LIFE_RECORD_TABLE).upsert(
    {
      student_id: studentId,
      school_year: schoolYear,
      section_id: sectionId,
      content,
    },
    {
      onConflict: 'student_id,school_year,section_id',
    },
  )
}
