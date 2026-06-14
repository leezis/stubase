import { supabase } from '../../lib/supabase'

const SCHOOL_LIFE_RECORD_TABLE = 'school_life_records'
const RECORD_QUERY_CHUNK_SIZE = 500
const PERSONAL_GRADE_RECORD_TABLE = 'personal_grade_records'

function chunkArray(values, size) {
  const chunks = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

function normalizeDepartmentName(value) {
  return String(value ?? '').trim()
}

function getClubDepartmentNames(data) {
  const club = data?.club ?? {}

  return [
    club.clubActivity?.name,
    club.clubActivity?.className,
    club.autonomousClub?.name,
  ]
    .map(normalizeDepartmentName)
    .filter(Boolean)
}

function sortStudentsBySchoolNumber(students) {
  return [...(students ?? [])].sort((left, right) => {
    const leftValue =
      Number(left?.grade ?? 0) * 1000000 +
      Number(left?.class_num ?? 0) * 10000 +
      Number(left?.student_num ?? 0)
    const rightValue =
      Number(right?.grade ?? 0) * 1000000 +
      Number(right?.class_num ?? 0) * 10000 +
      Number(right?.student_num ?? 0)

    return leftValue - rightValue
  })
}

async function fetchPersonalGradeRecordRows(schoolYear) {
  if (!supabase || !schoolYear) {
    return { data: [], error: null }
  }

  const records = []
  let rangeStart = 0

  while (true) {
    const { data, error } = await supabase
      .from(PERSONAL_GRADE_RECORD_TABLE)
      .select('student_id, data')
      .eq('school_year', schoolYear)
      .range(rangeStart, rangeStart + RECORD_QUERY_CHUNK_SIZE - 1)

    if (error) {
      return { data: [], error }
    }

    const rows = data ?? []
    records.push(...rows)

    if (rows.length < RECORD_QUERY_CHUNK_SIZE) {
      break
    }

    rangeStart += RECORD_QUERY_CHUNK_SIZE
  }

  return { data: records, error: null }
}

export async function fetchClubDepartmentOptions({ schoolYear }) {
  const { data, error } = await fetchPersonalGradeRecordRows(schoolYear)

  if (error) {
    return { data: [], error }
  }

  const departmentNames = new Set()

  ;(data ?? []).forEach((record) => {
    getClubDepartmentNames(record.data).forEach((departmentName) => {
      departmentNames.add(departmentName)
    })
  })

  return {
    data: Array.from(departmentNames).sort((left, right) =>
      left.localeCompare(right, 'ko-KR'),
    ),
    error: null,
  }
}

export async function fetchClubDepartmentStudentRows({
  departmentName,
  schoolYear,
}) {
  const normalizedDepartmentName = normalizeDepartmentName(departmentName)

  if (!normalizedDepartmentName) {
    return { data: [], error: null }
  }

  const { data, error } = await fetchPersonalGradeRecordRows(schoolYear)

  if (error) {
    return { data: [], error }
  }

  const studentIds = Array.from(
    new Set(
      (data ?? [])
        .filter((record) =>
          getClubDepartmentNames(record.data).includes(normalizedDepartmentName),
        )
        .map((record) => record.student_id)
        .filter(Boolean),
    ),
  )

  if (!studentIds.length) {
    return { data: [], error: null }
  }

  const students = []

  for (const studentIdChunk of chunkArray(studentIds, RECORD_QUERY_CHUNK_SIZE)) {
    const { data: studentRows, error: studentsError } = await supabase
      .from('students')
      .select('id, name, grade, class_num, student_num, avatar_url')
      .in('id', studentIdChunk)

    if (studentsError) {
      return { data: [], error: studentsError }
    }

    students.push(...(studentRows ?? []))
  }

  return {
    data: sortStudentsBySchoolNumber(students),
    error: null,
  }
}

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

export async function fetchClassStudentRows({ classNum, grade }) {
  if (!supabase || !grade || !classNum) {
    return { data: [], error: null }
  }

  return supabase
    .from('students')
    .select('id, name, grade, class_num, student_num, avatar_url')
    .eq('grade', Number(grade))
    .eq('class_num', Number(classNum))
    .order('student_num', { ascending: true })
}

export async function fetchSchoolLifeRecordComparisonRows({
  classNum,
  excludeStudentIds = [],
  grade,
  schoolYear,
  scope = 'class',
  sectionId,
}) {
  if (!supabase || !schoolYear || !sectionId) {
    return { data: [], error: null }
  }

  let studentQuery = supabase
    .from('students')
    .select('id, name, grade, class_num, student_num, avatar_url')
    .order('grade', { ascending: true })
    .order('class_num', { ascending: true })
    .order('student_num', { ascending: true })

  if (scope === 'class') {
    if (!grade || !classNum) {
      return { data: [], error: null }
    }

    studentQuery = studentQuery
      .eq('grade', Number(grade))
      .eq('class_num', Number(classNum))
  } else if (scope === 'grade') {
    if (!grade) {
      return { data: [], error: null }
    }

    studentQuery = studentQuery.eq('grade', Number(grade))
  }

  const { data: students, error: studentsError } = await studentQuery

  if (studentsError) {
    return { data: [], error: studentsError }
  }

  const excludedIds = new Set(excludeStudentIds.filter(Boolean))
  const targetStudents = (students ?? []).filter(
    (student) => student.id && !excludedIds.has(student.id),
  )
  const studentIds = targetStudents.map((student) => student.id)

  if (!studentIds.length) {
    return { data: [], error: null }
  }

  const records = []

  for (const studentIdChunk of chunkArray(studentIds, RECORD_QUERY_CHUNK_SIZE)) {
    const { data: recordChunk, error: recordsError } = await supabase
      .from(SCHOOL_LIFE_RECORD_TABLE)
      .select('student_id, content')
      .eq('school_year', schoolYear)
      .eq('section_id', sectionId)
      .in('student_id', studentIdChunk)

    if (recordsError) {
      return { data: [], error: recordsError }
    }

    records.push(...(recordChunk ?? []))
  }

  const studentsById = new Map(
    targetStudents.map((student) => [student.id, student]),
  )

  return {
    data: records
      .map((record) => ({
        content: record.content ?? '',
        student: studentsById.get(record.student_id) ?? null,
        student_id: record.student_id,
      }))
      .filter((row) => row.student && row.content.trim()),
    error: null,
  }
}

export async function fetchComparableSchoolLifeRecordRows({
  classNum,
  grade,
  schoolYear,
  sectionId,
  studentId,
}) {
  if (!supabase || !grade || !classNum || !sectionId) {
    return { data: [], error: null }
  }

  const {
    data: students,
    error: studentsError,
  } = await supabase
    .from('students')
    .select('id')
    .eq('grade', Number(grade))
    .eq('class_num', Number(classNum))

  if (studentsError) {
    return { data: [], error: studentsError }
  }

  const studentIds = (students ?? [])
    .map((student) => student.id)
    .filter((id) => id && id !== studentId)

  if (!studentIds.length) {
    return { data: [], error: null }
  }

  return supabase
    .from(SCHOOL_LIFE_RECORD_TABLE)
    .select('student_id, content')
    .eq('school_year', schoolYear)
    .eq('section_id', sectionId)
    .in('student_id', studentIds)
}

export async function fetchClassSchoolLifeRecordRows({
  schoolYear,
  studentIds = [],
}) {
  if (!supabase || !schoolYear) {
    return { data: [], error: null }
  }

  const targetStudentIds = studentIds.filter(Boolean)

  if (!targetStudentIds.length) {
    return { data: [], error: null }
  }

  return supabase
    .from(SCHOOL_LIFE_RECORD_TABLE)
    .select('student_id, section_id, content')
    .eq('school_year', schoolYear)
    .in('student_id', targetStudentIds)
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
