import { supabase } from '../../lib/supabase'
import { parseAttendanceWorkbooks } from './attendanceExcelImporter.js'
import { parseClubActivityWorkbooks } from './clubExcelImporter.js'
import { parseVolunteerWorkbooks } from './volunteerExcelImporter.js'
import {
  PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
  mergePersonalGradeRecordData,
} from './personalGradeRecordsData.js'

export function getPersonalGradeRecordErrorMessage(error) {
  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'personal_grade_records 테이블이 아직 없습니다. supabase-personal-grade-records.sql을 Supabase SQL Editor에서 먼저 실행해 주세요.'
  }

  return error?.message ?? '개인내신성적관리부 데이터를 처리하지 못했습니다.'
}

function getMatchedStudentKey(record) {
  return `${record.grade}-${record.classNum}-${record.studentNum}`
}

function getStudentKey(student) {
  return `${student.grade}-${student.class_num}-${student.student_num}`
}

function applyAttendanceImportToRecord(recordData, importedRecord) {
  const nextData = mergePersonalGradeRecordData(recordData)

  return {
    ...nextData,
    attendance: {
      ...nextData.attendance,
      ...importedRecord.attendance,
    },
  }
}

function applyClubImportToRecord(recordData, importedRecord) {
  const nextData = mergePersonalGradeRecordData(recordData)

  return {
    ...nextData,
    club: {
      clubActivity: importedRecord.clubActivity,
      autonomousClub: importedRecord.autonomousClub,
    },
  }
}

function applyVolunteerImportToRecord(recordData, importedRecord) {
  const nextData = mergePersonalGradeRecordData(recordData)

  return {
    ...nextData,
    volunteer: {
      ...nextData.volunteer,
      ...importedRecord.volunteer,
    },
  }
}

const excelImportConfigByKind = {
  출결: {
    applyImportedRecord: applyAttendanceImportToRecord,
    parseWorkbooks: parseAttendanceWorkbooks,
  },
  동아리: {
    applyImportedRecord: applyClubImportToRecord,
    parseWorkbooks: parseClubActivityWorkbooks,
  },
  봉사: {
    applyImportedRecord: applyVolunteerImportToRecord,
    parseWorkbooks: parseVolunteerWorkbooks,
  },
}

async function fetchStudentsForImportedRecords(importedRecords) {
  const classGroups = new Map()

  importedRecords.forEach((record) => {
    if (!record.grade || !record.classNum) {
      return
    }

    classGroups.set(`${record.grade}-${record.classNum}`, {
      grade: record.grade,
      classNum: record.classNum,
    })
  })

  const studentsByKey = new Map()

  for (const classGroup of classGroups.values()) {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, grade, class_num, student_num')
      .eq('grade', classGroup.grade)
      .eq('class_num', classGroup.classNum)

    if (error) {
      throw error
    }

    ;(data ?? []).forEach((student) => {
      studentsByKey.set(getStudentKey(student), student)
    })
  }

  return studentsByKey
}

export async function fetchExistingPersonalGradeRecordMap(studentIds) {
  if (!studentIds.length) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('personal_grade_records')
    .select('student_id, data')
    .eq('school_year', PERSONAL_GRADE_RECORD_SCHOOL_YEAR)
    .in('student_id', studentIds)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((row) => [row.student_id, row.data]))
}

export async function importPersonalGradeRecordExcel({ files, kind }) {
  if (!files?.length) {
    return null
  }

  if (!supabase) {
    throw new Error('Supabase 연결 정보가 없어 파일 데이터를 저장할 수 없습니다.')
  }

  const importConfig = excelImportConfigByKind[kind]

  if (!importConfig) {
    throw new Error(`${kind} 파일 가져오기를 처리하지 못했습니다.`)
  }

  const importedRecords = await importConfig.parseWorkbooks(files)
  const studentsByKey = await fetchStudentsForImportedRecords(importedRecords)
  const matchedImports = []
  const unmatchedImports = []

  importedRecords.forEach((importedRecord) => {
    const matchedStudent = studentsByKey.get(getMatchedStudentKey(importedRecord))

    if (!matchedStudent || matchedStudent.name !== importedRecord.studentName) {
      unmatchedImports.push(importedRecord)
      return
    }

    matchedImports.push({
      importedRecord,
      student: matchedStudent,
    })
  })

  const existingRecordMap = await fetchExistingPersonalGradeRecordMap(
    matchedImports.map(({ student }) => student.id),
  )

  const payload = matchedImports.map(({ importedRecord, student }) => ({
    student_id: student.id,
    school_year: PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
    data: importConfig.applyImportedRecord(
      existingRecordMap.get(student.id),
      importedRecord,
    ),
  }))

  if (payload.length) {
    const { error } = await supabase.from('personal_grade_records').upsert(payload, {
      onConflict: 'student_id,school_year',
    })

    if (error) {
      throw error
    }
  }

  return {
    kind,
    matchedCount: matchedImports.length,
    unmatchedCount: unmatchedImports.length,
    unmatchedPreview: unmatchedImports
      .slice(0, 3)
      .map((record) => `${record.grade}-${record.classNum} ${record.studentNum}번 ${record.studentName}`),
  }
}
