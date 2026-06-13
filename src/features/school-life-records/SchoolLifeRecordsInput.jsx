import { useEffect, useMemo, useState } from 'react'
import './SchoolLifeRecordsInput.css'

const SELF_GOVERNMENT_SECTION_ID = 'self-government'

const recordSections = [
  {
    id: SELF_GOVERNMENT_SECTION_ID,
    label: '자율자치 활동',
    placeholder: '자율자치 활동 내용을 입력하세요.',
  },
  {
    id: 'club',
    label: '동아리 활동',
    placeholder: '동아리 활동 내용을 입력하세요.',
  },
  {
    id: 'behavior',
    label: '행동특성 및 종합의견',
    placeholder: '행동특성 및 종합의견을 입력하세요.',
  },
]

const fallbackAvatarThemes = [
  { background: '#e8f3ff', color: '#2563eb' },
  { background: '#eef7eb', color: '#15803d' },
  { background: '#fff1e6', color: '#c2410c' },
  { background: '#f5edff', color: '#6d28d9' },
  { background: '#e9f7f7', color: '#0f766e' },
]

function getStudentInitial(student) {
  return String(student?.name ?? '?').trim().slice(0, 1) || '?'
}

function getFallbackAvatarTheme(student) {
  const seed = String(student?.name ?? '').split('').reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  )

  return fallbackAvatarThemes[seed % fallbackAvatarThemes.length]
}

function sortStudentsBySchoolNumber(studentA, studentB) {
  return (
    Number(studentA.grade ?? 0) - Number(studentB.grade ?? 0) ||
    Number(studentA.class_num ?? 0) - Number(studentB.class_num ?? 0) ||
    Number(studentA.student_num ?? 0) - Number(studentB.student_num ?? 0)
  )
}

function SchoolLifeRecordsInput({
  onHeaderActionsChange,
  onToast,
  selectedClass = '',
  selectedGrade = '',
  selectedStudent,
  students = [],
}) {
  const [activeSectionId, setActiveSectionId] = useState(recordSections[0].id)
  const [recordValues, setRecordValues] = useState({})
  const [generatingStudentIds, setGeneratingStudentIds] = useState({})
  const activeSection =
    recordSections.find((section) => section.id === activeSectionId) ??
    recordSections[0]
  const isSelfGovernmentSection =
    activeSectionId === SELF_GOVERNMENT_SECTION_ID
  const visibleStudents = useMemo(() => {
    const filteredStudents = students
      .filter((student) => {
        const gradeMatches =
          !selectedGrade || String(student.grade) === String(selectedGrade)
        const classMatches =
          !selectedClass || String(student.class_num) === String(selectedClass)

        return gradeMatches && classMatches
      })
      .sort(sortStudentsBySchoolNumber)

    if (filteredStudents.length || !selectedStudent) {
      return filteredStudents
    }

    return [selectedStudent]
  }, [selectedClass, selectedGrade, selectedStudent, students])

  const headerActions = useMemo(
    () => (
      <div
        className="school-life-records-mode-actions"
        role="group"
        aria-label="학교생활기록부 입력 영역"
      >
        {recordSections.map((section) => (
          <button
            className={`school-life-records-mode-button ${
              activeSectionId === section.id ? 'is-active' : ''
            }`}
            key={section.id}
            type="button"
            aria-pressed={activeSectionId === section.id}
            onClick={() => setActiveSectionId(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
    ),
    [activeSectionId],
  )

  useEffect(() => {
    onHeaderActionsChange?.(headerActions)
  }, [headerActions, onHeaderActionsChange])

  useEffect(() => {
    return () => {
      onHeaderActionsChange?.(null)
    }
  }, [onHeaderActionsChange])

  function updateRecordValue(studentId, value) {
    setRecordValues((previous) => ({
      ...previous,
      [`${activeSectionId}:${studentId}`]: value,
    }))
  }

  function setStudentGenerationState(studentId, isGenerating) {
    setGeneratingStudentIds((previous) => ({
      ...previous,
      [studentId]: isGenerating,
    }))
  }

  function createSelfGovernmentPrompt(student, currentText) {
    const memo = currentText.trim()
    const studentContext = `${student.grade}학년 ${student.class_num}반 ${student.student_num}번`

    return [
      '중학교 학교생활기록부의 자율자치 활동 내용을 작성해 주세요.',
      '교사가 기록하는 문체로 자연스럽게 쓰고, 학생 이름은 넣지 마세요.',
      '과장된 표현은 피하고 관찰 가능한 행동 중심으로 2문장, 180자 이내로 작성하세요.',
      `학생 구분: ${studentContext}`,
      memo
        ? `참고 메모: ${memo}`
        : '참고 메모: 학급 자치 활동에 성실히 참여하고 맡은 역할을 책임감 있게 수행함.',
    ].join('\n')
  }

  async function handleGenerateSelfGovernmentRecord(student) {
    const recordKey = `${SELF_GOVERNMENT_SECTION_ID}:${student.id}`
    const currentText = recordValues[recordKey] ?? ''

    setStudentGenerationState(student.id, true)

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: createSelfGovernmentPrompt(student, currentText),
        }),
      })
      const contentType = response.headers.get('content-type') ?? ''
      const data = contentType.includes('application/json')
        ? await response.json()
        : {
            error:
              'Gemini API 함수에 연결하지 못했습니다. Cloudflare Pages 환경에서 GEMINI_API_KEY를 설정해 주세요.',
          }

      if (!response.ok) {
        throw new Error(data?.error ?? 'Gemini 응답을 불러오지 못했습니다.')
      }

      updateRecordValue(student.id, data.text ?? '')
      onToast?.(`${student.name} 학생의 자율자치 활동 문장을 생성했습니다.`)
    } catch (error) {
      onToast?.(
        error instanceof Error
          ? error.message
          : 'Gemini 응답을 불러오지 못했습니다.',
        'error',
      )
    } finally {
      setStudentGenerationState(student.id, false)
    }
  }

  return (
    <section className="detail-section school-life-records-shell">
      <div className="section-row school-life-records-heading">
        <div>
          <p className="section-label">학교업무</p>
          <h1>학교생활기록부 입력</h1>
        </div>
        <span className="school-life-records-current-section">
          {activeSection.label}
        </span>
      </div>

      <div className="school-life-records-list" aria-label={`${activeSection.label} 입력 목록`}>
        {visibleStudents.map((student) => {
          const recordKey = `${activeSectionId}:${student.id}`
          const avatarTheme = getFallbackAvatarTheme(student)
          const isSelectedStudent = selectedStudent?.id === student.id

          return (
            <article
              className={`school-life-records-row ${
                isSelectedStudent ? 'is-selected' : ''
              }`}
              key={student.id}
            >
              <div className="school-life-records-student">
                <div className="school-life-records-avatar" aria-hidden="true">
                  {student.avatar_url ? (
                    <img src={student.avatar_url} alt="" loading="lazy" />
                  ) : (
                    <span
                      style={{
                        backgroundColor: avatarTheme.background,
                        color: avatarTheme.color,
                      }}
                    >
                      {getStudentInitial(student)}
                    </span>
                  )}
                </div>
                <div className="school-life-records-student-copy">
                  <strong>{student.name}</strong>
                  <span>
                    {student.grade}학년 {student.class_num}반 {student.student_num}번
                  </span>
                </div>
              </div>

              <div className="school-life-records-input-stack">
                <label className="school-life-records-field">
                  <span className="visually-hidden">
                    {student.name} {activeSection.label}
                  </span>
                  <textarea
                    value={recordValues[recordKey] ?? ''}
                    onChange={(event) =>
                      updateRecordValue(student.id, event.target.value)
                    }
                    placeholder={activeSection.placeholder}
                  />
                </label>

                {isSelfGovernmentSection ? (
                  <div className="school-life-records-ai-actions">
                    <button
                      className="school-life-records-ai-button"
                      type="button"
                      onClick={() => handleGenerateSelfGovernmentRecord(student)}
                      disabled={Boolean(generatingStudentIds[student.id])}
                    >
                      {generatingStudentIds[student.id]
                        ? '생성 중...'
                        : 'Gemini 생성'}
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}

        {!visibleStudents.length ? (
          <div className="detail-placeholder school-life-records-empty">
            <div className="empty-icon">0</div>
            <h2>선택한 학급에 표시할 학생이 없습니다</h2>
            <p>상단에서 다른 학급을 선택해 주세요.</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default SchoolLifeRecordsInput
