import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
  hasVolunteerAward,
} from './personalGradeRecordsData.js'
import { getPersonalGradeRecordErrorMessage } from './personalGradeRecordsRepository.js'
import './PersonalGradeRecords.css'

const uploadStatusItems = [
  {
    id: 'attendance',
    label: '출결파일',
    isUploaded: (data) => {
      const attendance = data?.attendance ?? {}

      return [
        attendance.unexcusedAbsence,
        attendance.unexcusedTardy,
        attendance.unexcusedEarlyLeave,
        attendance.unexcusedResult,
      ].some((value) => value !== undefined && value !== null && String(value) !== '')
    },
  },
  {
    id: 'club',
    label: '동아리파일',
    isUploaded: (data) => {
      const club = data?.club ?? {}

      return [
        club.clubActivity?.name,
        club.clubActivity?.className,
        club.autonomousClub?.name,
      ].some((value) => value !== undefined && value !== null && String(value) !== '')
    },
  },
  {
    id: 'volunteer',
    label: '봉사파일',
    isUploaded: (data) => {
      const volunteer = data?.volunteer ?? {}

      return String(volunteer.hours ?? '') !== '' || hasVolunteerAward(volunteer)
    },
  },
]

function createEmptyUploadSummary(totalCount = 0) {
  return Object.fromEntries(
    uploadStatusItems.map((item) => [
      item.id,
      {
        ...item,
        completedCount: 0,
        totalCount,
      },
    ]),
  )
}

function getPercent(completedCount, totalCount) {
  if (!totalCount) {
    return 0
  }

  return Math.round((completedCount / totalCount) * 100)
}

function PersonalGradeRecordsUploadStatus({
  dataRefreshKey = 0,
  selectedClass = '',
  selectedGrade = '1',
}) {
  const [summary, setSummary] = useState(() => createEmptyUploadSummary())
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadUploadStatus() {
      if (!supabase) {
        setErrorMessage('Supabase 연결 정보가 없어 업로드 현황을 불러올 수 없습니다.')
        return
      }

      setIsLoading(true)
      setErrorMessage('')

      try {
        let studentQuery = supabase
          .from('students')
          .select('id')
          .eq('grade', Number(selectedGrade || '1'))

        if (selectedClass) {
          studentQuery = studentQuery.eq('class_num', Number(selectedClass))
        }

        const { data: students, error: studentsError } = await studentQuery

        if (studentsError) {
          throw studentsError
        }

        const studentIds = (students ?? []).map((student) => student.id)
        const nextSummary = createEmptyUploadSummary(studentIds.length)

        if (studentIds.length) {
          const { data: records, error: recordsError } = await supabase
            .from('personal_grade_records')
            .select('student_id, data')
            .eq('school_year', PERSONAL_GRADE_RECORD_SCHOOL_YEAR)
            .in('student_id', studentIds)

          if (recordsError) {
            throw recordsError
          }

          ;(records ?? []).forEach((record) => {
            uploadStatusItems.forEach((item) => {
              if (item.isUploaded(record.data)) {
                nextSummary[item.id].completedCount += 1
              }
            })
          })
        }

        if (isMounted) {
          setSummary(nextSummary)
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getPersonalGradeRecordErrorMessage(error))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadUploadStatus()

    return () => {
      isMounted = false
    }
  }, [dataRefreshKey, selectedClass, selectedGrade])

  const statusValues = Object.values(summary)
  const targetLabel = selectedClass
    ? `${selectedGrade}학년 ${selectedClass}반`
    : `${selectedGrade || '1'}학년 전체`

  return (
    <div className="personal-grade-records-upload-status">
      <div className="personal-grade-records-upload-status__header">
        <strong>업로드 현황</strong>
        <span>{isLoading ? '확인 중' : targetLabel}</span>
      </div>

      {errorMessage ? (
        <p className="personal-grade-records-upload-status__error">{errorMessage}</p>
      ) : (
        <div className="personal-grade-records-upload-status__grid">
          {statusValues.map((item) => {
            const percent = getPercent(item.completedCount, item.totalCount)

            return (
              <div
                key={item.id}
                className={`personal-grade-records-upload-status__item personal-grade-records-upload-status__item--${item.id}`}
              >
                <span>{item.label}</span>
                <strong>
                  {item.completedCount}
                  <small>/{item.totalCount}명</small>
                </strong>
                <div
                  className="personal-grade-records-upload-status__bar"
                  aria-hidden="true"
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PersonalGradeRecordsUploadStatus
