import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  downloadClassPersonalGradeRecordZip,
  downloadCombinedClassPersonalGradeRecordHwpx,
  downloadPersonalGradeRecordHwpx,
} from './hwpxExporter.js'
import {
  PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
  hasVolunteerAward,
  mergePersonalGradeRecordData,
} from './personalGradeRecordsData.js'
import { personalGradeRecordsMenu } from './personalGradeRecordsConfig.js'
import {
  fetchExistingPersonalGradeRecordMap,
  getPersonalGradeRecordErrorMessage,
} from './personalGradeRecordsRepository.js'
import './PersonalGradeRecords.css'

function PersonalGradeRecords({
  dataRefreshKey = 0,
  onHeaderActionsChange,
  onToast,
  selectedClass = '',
  selectedGrade = '',
  selectedStudent,
}) {
  const [recordData, setRecordData] = useState(() => mergePersonalGradeRecordData())
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadRecord() {
      setRecordData(mergePersonalGradeRecordData())
      setNoticeMessage('')
      setErrorMessage('')

      if (!selectedStudent) {
        return
      }

      if (!supabase) {
        setErrorMessage('Supabase 연결 정보가 없어 데이터를 불러올 수 없습니다.')
        return
      }

      setIsLoading(true)

      const { data, error } = await supabase
        .from('personal_grade_records')
        .select('data')
        .eq('student_id', selectedStudent.id)
        .eq('school_year', PERSONAL_GRADE_RECORD_SCHOOL_YEAR)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (error) {
        setErrorMessage(getPersonalGradeRecordErrorMessage(error))
        setIsLoading(false)
        return
      }

      setRecordData(mergePersonalGradeRecordData(data?.data))
      setIsLoading(false)
    }

    void loadRecord()

    return () => {
      isMounted = false
    }
  }, [dataRefreshKey, selectedStudent])

  function updateStudentInfoField(field, value) {
    setRecordData((previous) => ({
      ...previous,
      studentInfo: {
        ...previous.studentInfo,
        [field]: value,
      },
    }))
  }

  function updateAttendanceField(field, value) {
    setRecordData((previous) => ({
      ...previous,
      attendance: {
        ...previous.attendance,
        [field]: value.replace(/[^\d]/g, ''),
      },
    }))
  }

  function updateSelfGovernmentField(field, checked) {
    setRecordData((previous) => ({
      ...previous,
      selfGovernment: {
        ...previous.selfGovernment,
        [field]: checked,
      },
    }))
  }

  function updateClubField(group, field, value) {
    setRecordData((previous) => ({
      ...previous,
      club: {
        ...previous.club,
        [group]: {
          ...previous.club[group],
          [field]: value,
        },
      },
    }))
  }

  function updateVolunteerField(field, value) {
    setRecordData((previous) => ({
      ...previous,
      volunteer: {
        ...previous.volunteer,
        [field]: field === 'hours' ? value.replace(/[^\d]/g, '') : value,
      },
    }))
  }

  async function saveRecord(nextRecordData = recordData, targetStudent = selectedStudent) {
    if (!targetStudent || !supabase) {
      return false
    }

    const { error } = await supabase.from('personal_grade_records').upsert(
      {
        student_id: targetStudent.id,
        school_year: PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
        data: mergePersonalGradeRecordData(nextRecordData),
      },
      {
        onConflict: 'student_id,school_year',
      },
    )

    if (error) {
      throw error
    }

    return true
  }

  async function handleSaveClick() {
    if (!selectedStudent) {
      return
    }

    setIsSaving(true)
    setNoticeMessage('')
    setErrorMessage('')

    try {
      await saveRecord()
      onToast?.(`${selectedStudent.name} 학생의 개인내신성적관리부 데이터를 저장했습니다.`)
    } catch (error) {
      onToast?.(getPersonalGradeRecordErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePersonalHwpxDownload = useCallback(async () => {
    if (!selectedStudent) {
      return
    }

    setIsExporting(true)
    setNoticeMessage('')
    setErrorMessage('')

    try {
      await downloadPersonalGradeRecordHwpx(selectedStudent, recordData)
      setNoticeMessage('선택 학생의 HWPX 파일을 생성했습니다.')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsExporting(false)
    }
  }, [recordData, selectedStudent])

  const loadClassExportRows = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase 연결 정보가 없어 파일을 생성할 수 없습니다.')
    }

    const exportGrade = selectedGrade || selectedStudent?.grade || '1'
    const exportClass = selectedClass || ''
    let studentQuery = supabase
      .from('students')
      .select('id, name, grade, class_num, student_num')
      .eq('grade', Number(exportGrade))
      .order('class_num', { ascending: true })
      .order('student_num', { ascending: true })

    if (exportClass) {
      studentQuery = studentQuery.eq('class_num', Number(exportClass))
    }

    const { data: students, error: studentsError } = await studentQuery

    if (studentsError) {
      throw studentsError
    }

    if (!students?.length) {
      return {
        exportClass,
        exportGrade,
        studentsWithRecords: [],
      }
    }

    const existingRecordMap = await fetchExistingPersonalGradeRecordMap(
      students.map((student) => student.id),
    )

    return {
      exportClass,
      exportGrade,
      studentsWithRecords: students.map((student) => ({
        student,
        recordData: mergePersonalGradeRecordData(existingRecordMap.get(student.id)),
      })),
    }
  }, [selectedClass, selectedGrade, selectedStudent])

  const handleCombinedClassHwpxDownload = useCallback(async () => {
    setIsExporting(true)
    setNoticeMessage('')
    setErrorMessage('')

    try {
      const { exportClass, exportGrade, studentsWithRecords } = await loadClassExportRows()

      if (!studentsWithRecords.length) {
        setErrorMessage('출력할 학생이 없습니다.')
        return
      }

      const fileName = `${PERSONAL_GRADE_RECORD_SCHOOL_YEAR}_${exportGrade}-${
        exportClass || '전체'
      }_개인내신성적관리부_학급모두.hwpx`

      await downloadCombinedClassPersonalGradeRecordHwpx(studentsWithRecords, fileName)

      setNoticeMessage(
        `${studentsWithRecords.length}명의 HWPX 페이지를 한 파일로 생성했습니다.`,
      )
    } catch (error) {
      setErrorMessage(getPersonalGradeRecordErrorMessage(error))
    } finally {
      setIsExporting(false)
    }
  }, [loadClassExportRows])

  const handleClassZipDownload = useCallback(async () => {
    setIsExporting(true)
    setNoticeMessage('')
    setErrorMessage('')

    try {
      const { exportClass, exportGrade, studentsWithRecords } = await loadClassExportRows()

      if (!studentsWithRecords.length) {
        setErrorMessage('출력할 학생이 없습니다.')
        return
      }

      const zipName = `${PERSONAL_GRADE_RECORD_SCHOOL_YEAR}_${exportGrade}-${
        exportClass || '전체'
      }_개인내신성적관리부.zip`

      await downloadClassPersonalGradeRecordZip(studentsWithRecords, zipName)

      setNoticeMessage(`${studentsWithRecords.length}명의 HWPX 파일을 ZIP으로 생성했습니다.`)
    } catch (error) {
      setErrorMessage(getPersonalGradeRecordErrorMessage(error))
    } finally {
      setIsExporting(false)
    }
  }, [loadClassExportRows])

  const isBusy = isLoading || isSaving || isExporting
  const headerActions = useMemo(
    () => (
      <>
        <button
          className="ghost-button personal-grade-records-export-button personal-grade-records-export-button--student"
          type="button"
          onClick={handlePersonalHwpxDownload}
          disabled={!selectedStudent || isBusy}
        >
          개인저장
        </button>
        <button
          className="ghost-button personal-grade-records-export-button personal-grade-records-export-button--combined"
          type="button"
          onClick={handleCombinedClassHwpxDownload}
          disabled={isBusy}
        >
          전체저장
        </button>
        <button
          className="ghost-button personal-grade-records-export-button personal-grade-records-export-button--class"
          type="button"
          onClick={handleClassZipDownload}
          disabled={isBusy}
        >
          전체저장(개별)
        </button>
      </>
    ),
    [
      handleClassZipDownload,
      handleCombinedClassHwpxDownload,
      handlePersonalHwpxDownload,
      isBusy,
      selectedStudent,
    ],
  )

  useEffect(() => {
    onHeaderActionsChange?.(headerActions)

    return () => {
      onHeaderActionsChange?.(null)
    }
  }, [headerActions, onHeaderActionsChange])

  return (
    <section className="detail-section personal-grade-records-shell">
      <div className="section-row personal-grade-records-toolbar">
        <div>
          <h1>{personalGradeRecordsMenu.title}</h1>
        </div>
        <div className="personal-grade-records-actions">
          <fieldset className="personal-grade-records-gender-field">
            <legend>성별</legend>
            <div className="personal-grade-records-gender-toggle">
              {['남', '여'].map((gender) => (
                <button
                  className={`personal-grade-records-gender-button ${
                    recordData.studentInfo.gender === gender ? 'is-active' : ''
                  }`}
                  key={gender}
                  type="button"
                  onClick={() => updateStudentInfoField('gender', gender)}
                  disabled={!selectedStudent || isBusy}
                  aria-pressed={recordData.studentInfo.gender === gender}
                >
                  {gender}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            className="primary-button"
            type="button"
            onClick={handleSaveClick}
            disabled={!selectedStudent || isBusy}
          >
            {isSaving ? '변경사항 저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>

      {noticeMessage ? (
        <p className="personal-grade-records-message">{noticeMessage}</p>
      ) : null}
      {errorMessage ? (
        <p className="personal-grade-records-message personal-grade-records-message--error">
          {errorMessage}
        </p>
      ) : null}

      <div className="personal-grade-records-card-grid">
        <section className="personal-grade-records-card">
          <div className="personal-grade-records-card__header">
            <span className="personal-grade-records-card__number">1</span>
            <h2>출결상황</h2>
          </div>
          <div className="personal-grade-records-mini-grid personal-grade-records-mini-grid--attendance">
            <label className="personal-grade-records-mini-card">
              <strong>미인정 결석</strong>
              <input
                value={recordData.attendance.unexcusedAbsence}
                onChange={(event) => updateAttendanceField('unexcusedAbsence', event.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </label>
            <label className="personal-grade-records-mini-card">
              <strong>미인정 지각</strong>
              <input
                value={recordData.attendance.unexcusedTardy}
                onChange={(event) => updateAttendanceField('unexcusedTardy', event.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </label>
            <label className="personal-grade-records-mini-card">
              <strong>미인정 조퇴</strong>
              <input
                value={recordData.attendance.unexcusedEarlyLeave}
                onChange={(event) => updateAttendanceField('unexcusedEarlyLeave', event.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </label>
            <label className="personal-grade-records-mini-card">
              <strong>미인정 결과</strong>
              <input
                value={recordData.attendance.unexcusedResult}
                onChange={(event) => updateAttendanceField('unexcusedResult', event.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </label>
          </div>
        </section>

        <section className="personal-grade-records-card">
          <div className="personal-grade-records-card__header">
            <span className="personal-grade-records-card__number">2</span>
            <h2>자율자치활동</h2>
          </div>
          <div className="personal-grade-records-mini-grid">
            <label className="personal-grade-records-mini-card personal-grade-records-mini-card--check">
              <input
                type="checkbox"
                checked={recordData.selfGovernment.classPresident}
                onChange={(event) => updateSelfGovernmentField('classPresident', event.target.checked)}
              />
              <strong>학급임원(반장)</strong>
            </label>
            <label className="personal-grade-records-mini-card personal-grade-records-mini-card--check">
              <input
                type="checkbox"
                checked={recordData.selfGovernment.vicePresident}
                onChange={(event) => updateSelfGovernmentField('vicePresident', event.target.checked)}
              />
              <strong>학급임원(부반장)</strong>
            </label>
            <label className="personal-grade-records-mini-card personal-grade-records-mini-card--check">
              <input
                type="checkbox"
                checked={recordData.selfGovernment.guidanceDisciplinaryAction}
                onChange={(event) =>
                  updateSelfGovernmentField('guidanceDisciplinaryAction', event.target.checked)
                }
              />
              <strong>선도처분</strong>
            </label>
            <label className="personal-grade-records-mini-card personal-grade-records-mini-card--check">
              <input
                type="checkbox"
                checked={recordData.selfGovernment.schoolViolenceDisciplinaryAction}
                onChange={(event) =>
                  updateSelfGovernmentField(
                    'schoolViolenceDisciplinaryAction',
                    event.target.checked,
                  )
                }
              />
              <strong>학폭처분</strong>
            </label>
          </div>
        </section>

        <section className="personal-grade-records-card">
          <div className="personal-grade-records-card__header">
            <span className="personal-grade-records-card__number">3</span>
            <h2>동아리활동</h2>
          </div>
          <div className="personal-grade-records-mini-grid">
            <label className="personal-grade-records-mini-card">
              <strong>동아리활동</strong>
              <input
                value={recordData.club.clubActivity.name}
                onChange={(event) => updateClubField('clubActivity', 'name', event.target.value)}
                placeholder="부서명"
              />
            </label>
            <label className="personal-grade-records-mini-card">
              <strong>자율동아리</strong>
              <input
                value={recordData.club.autonomousClub.name}
                onChange={(event) => updateClubField('autonomousClub', 'name', event.target.value)}
                placeholder="부서명"
              />
            </label>
          </div>
        </section>

        <section className="personal-grade-records-card">
          <div className="personal-grade-records-card__header">
            <span className="personal-grade-records-card__number">4</span>
            <h2>봉사활동</h2>
          </div>
          <div className="personal-grade-records-mini-grid">
            <label className="personal-grade-records-mini-card">
              <strong>봉사시간</strong>
              <input
                value={recordData.volunteer.hours}
                onChange={(event) => updateVolunteerField('hours', event.target.value)}
                inputMode="numeric"
                placeholder="시간"
              />
            </label>
            <label className="personal-grade-records-mini-card personal-grade-records-mini-card--check">
              <input
                type="checkbox"
                checked={hasVolunteerAward(recordData.volunteer)}
                onChange={(event) => updateVolunteerField('award', event.target.checked)}
              />
              <strong>봉사상</strong>
            </label>
          </div>
        </section>
      </div>
    </section>
  )
}

export default PersonalGradeRecords
