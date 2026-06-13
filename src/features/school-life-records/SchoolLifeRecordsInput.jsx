import { useEffect, useMemo, useState } from 'react'
import './SchoolLifeRecordsInput.css'

const SELF_GOVERNMENT_SECTION_ID = 'self-government'
const ACTIVITY_STORAGE_KEY = 'dsy-school-life-self-government-activities-v1'
const DEFAULT_ACTIVITY_YEAR = '2026'
const SELF_GOVERNMENT_MIN_LENGTH = 400
const SELF_GOVERNMENT_MAX_LENGTH = 450

const emptySchoolLifeQualities = {
  competencies: [],
  characters: [],
}

const recordSections = [
  {
    id: SELF_GOVERNMENT_SECTION_ID,
    label: '자율자치 활동',
    placeholder: '자율자치 활동 내용을 입력하세요.',
    promptGuide:
      '중학교 학교생활기록부의 자율자치 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
    fallbackMemo:
      '학급 자치 활동에 성실히 참여하고 맡은 역할을 책임감 있게 수행함.',
  },
  {
    id: 'club',
    label: '동아리 활동',
    placeholder: '동아리 활동 내용을 입력하세요.',
    promptGuide:
      '중학교 학교생활기록부의 동아리 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
    fallbackMemo:
      '동아리 활동에 꾸준히 참여하며 활동 과정에서 맡은 역할을 성실히 수행함.',
  },
  {
    id: 'behavior',
    label: '행동특성 및 종합의견',
    placeholder: '행동특성 및 종합의견을 입력하세요.',
    promptGuide:
      '중학교 학교생활기록부의 행동특성 및 종합의견을 교사가 기록하는 문체로 작성해 주세요.',
    fallbackMemo:
      '학교생활에 성실히 참여하고 친구들과 원만하게 지내며 맡은 일을 책임감 있게 수행함.',
  },
]

function createInitialActivityTextsByClass() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const savedValue = window.localStorage.getItem(ACTIVITY_STORAGE_KEY)
    return savedValue ? JSON.parse(savedValue) ?? {} : {}
  } catch {
    return {}
  }
}

function getClassActivityKey(selectedGrade, selectedClass, selectedStudent) {
  const grade = selectedGrade || selectedStudent?.grade || 'all'
  const classNum = selectedClass || selectedStudent?.class_num || 'all'

  return `${grade}-${classNum}`
}

function parseActivityRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalizedLine = line.replace(/\s+/g, '')
      return !(
        normalizedLine.includes('실시일') &&
        (normalizedLine.includes('활동내용') ||
          normalizedLine.includes('세부영역'))
      )
    })
    .map((line) => {
      const cleanedLine = line.replace(/^[\s*ㆍ•-]+/, '').trim()
      const fullDateMatch = cleanedLine.match(
        /^(\d{4}[./-]\d{1,2}[./-]\d{1,2}\.?)\s*(?:[-–—|/:：\t]+)?\s*(.+)$/u,
      )

      if (fullDateMatch) {
        return {
          date: fullDateMatch[1],
          content: fullDateMatch[2].trim(),
        }
      }

      const koreanDateMatch = cleanedLine.match(
        /^(\d{1,2}\s*월\s*\d{1,2}\s*일)\s*(?:[-–—|/:：\t]+)?\s*(.+)$/u,
      )

      if (koreanDateMatch) {
        return {
          date: koreanDateMatch[1].replace(/\s+/g, ' '),
          content: koreanDateMatch[2].trim(),
        }
      }

      const numericDateMatch = cleanedLine.match(
        /^(\d{1,2}[./-]\d{1,2})\s*(?:[-–—|/:：\t]+)?\s*(.+)$/u,
      )

      if (numericDateMatch) {
        return {
          date: numericDateMatch[1],
          content: numericDateMatch[2].trim(),
        }
      }

      const delimiterParts = cleanedLine
        .split(/\s*(?:\||\t| - | – | — |:|：)\s*/u)
        .map((part) => part.trim())
        .filter(Boolean)

      if (delimiterParts.length >= 2) {
        return {
          date: delimiterParts[0],
          content: delimiterParts.slice(1).join(' - '),
        }
      }

      return {
        date: '',
        content: cleanedLine,
      }
    })
    .filter((row) => row.content)
}

function formatActivityRowsForPrompt(activityRows) {
  return activityRows
    .map((row) => {
      const recordDate = formatDateForRecord(row.date)
      return recordDate ? `${row.content}(${recordDate})` : row.content
    })
    .join('\n')
}

function formatDateForRecord(date) {
  const trimmedDate = String(date ?? '').trim()

  if (!trimmedDate) {
    return ''
  }

  const fullDateMatch = trimmedDate.match(
    /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})\.?$/u,
  )

  if (fullDateMatch) {
    return `${fullDateMatch[1]}.${fullDateMatch[2].padStart(2, '0')}.${fullDateMatch[3].padStart(2, '0')}.`
  }

  const koreanDateMatch = trimmedDate.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/u)

  if (koreanDateMatch) {
    return `${DEFAULT_ACTIVITY_YEAR}.${koreanDateMatch[1].padStart(2, '0')}.${koreanDateMatch[2].padStart(2, '0')}.`
  }

  const shortDateMatch = trimmedDate.match(/^(\d{1,2})[./-](\d{1,2})\.?$/u)

  if (shortDateMatch) {
    return `${DEFAULT_ACTIVITY_YEAR}.${shortDateMatch[1].padStart(2, '0')}.${shortDateMatch[2].padStart(2, '0')}.`
  }

  return trimmedDate
}

function getRandomActivityRows(activityRows, minCount = 3, maxCount = 4) {
  if (!activityRows.length) {
    return []
  }

  const shuffledRows = [...activityRows]

  for (let index = shuffledRows.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledRows[index], shuffledRows[randomIndex]] = [
      shuffledRows[randomIndex],
      shuffledRows[index],
    ]
  }

  const targetCount =
    Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount

  return shuffledRows.slice(0, Math.min(targetCount, shuffledRows.length))
}

function cleanGeneratedRecordText(text) {
  return String(text ?? '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/u, '')
        .replace(/^[-*ㆍ•]\s*/u, '')
        .replace(/^\d+[.)]\s*/u, '')
        .replace(/^\*\*(.+)\*\*$/u, '$1')
        .trim(),
    )
    .filter(Boolean)
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/[`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRecordTextLength(text) {
  return Array.from(String(text ?? '')).length
}

function isWithinSelfGovernmentLength(text) {
  const textLength = getRecordTextLength(text)
  return (
    textLength >= SELF_GOVERNMENT_MIN_LENGTH &&
    textLength <= SELF_GOVERNMENT_MAX_LENGTH
  )
}

function isLikelyKoreanRecordText(text, shouldBeLong = false) {
  const koreanCount = text.match(/[가-힣]/g)?.length ?? 0
  const latinCount = text.match(/[A-Za-z]/g)?.length ?? 0
  const hasCompleteEnding = /[.!?。]$/u.test(text.trim())
  const hasInstructionLeak =
    /\b(showing|conclude|conclusion|write|student|record|activity|empathy|kindness|conflict|resolution|politeness|March|semester)\b/i.test(
      text,
    )

  return (
    (!shouldBeLong || isWithinSelfGovernmentLength(text)) &&
    koreanCount >= 20 &&
    latinCount <= Math.max(12, Math.floor(koreanCount * 0.08)) &&
    hasCompleteEnding &&
    !hasInstructionLeak
  )
}

function SchoolLifeRecordsInput({
  onHeaderActionsChange,
  onToast,
  schoolLifeQualities = emptySchoolLifeQualities,
  selectedClass = '',
  selectedGrade = '',
  selectedStudent,
}) {
  const [recordValues, setRecordValues] = useState({})
  const [generatingSectionIds, setGeneratingSectionIds] = useState({})
  const [activityTextsByClass, setActivityTextsByClass] = useState(
    createInitialActivityTextsByClass,
  )
  const [isActivityEditorOpen, setIsActivityEditorOpen] = useState(true)
  const classActivityKey = getClassActivityKey(
    selectedGrade,
    selectedClass,
    selectedStudent,
  )
  const activityText = activityTextsByClass[classActivityKey] ?? ''
  const activityRows = useMemo(() => parseActivityRows(activityText), [activityText])
  const classLabel =
    selectedGrade || selectedClass
      ? `${selectedGrade || selectedStudent?.grade || ''}학년 ${
          selectedClass || selectedStudent?.class_num || ''
        }반`
      : '현재 학급'

  useEffect(() => {
    onHeaderActionsChange?.(null)

    return () => {
      onHeaderActionsChange?.(null)
    }
  }, [onHeaderActionsChange])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify(activityTextsByClass),
    )
  }, [activityTextsByClass])

  function getRecordKey(sectionId) {
    return `${sectionId}:${selectedStudent?.id ?? 'empty'}`
  }

  function updateRecordValue(sectionId, value) {
    setRecordValues((previous) => ({
      ...previous,
      [getRecordKey(sectionId)]: value,
    }))
  }

  function updateActivityText(value) {
    setActivityTextsByClass((previous) => ({
      ...previous,
      [classActivityKey]: value,
    }))
  }

  function setSectionGenerationState(sectionId, isGenerating) {
    setGeneratingSectionIds((previous) => ({
      ...previous,
      [sectionId]: isGenerating,
    }))
  }

  function createRecordPrompt(section, currentText) {
    const memo = currentText.trim()
    const studentContext = `${selectedStudent.grade}학년 ${selectedStudent.class_num}반 ${selectedStudent.student_num}번`
    const selectedCompetencies = schoolLifeQualities.competencies ?? []
    const selectedCharacters = schoolLifeQualities.characters ?? []
    const qualityContext = [
      selectedCompetencies.length
        ? `학생역량: ${selectedCompetencies.join(', ')}`
        : '',
      selectedCharacters.length ? `품성: ${selectedCharacters.join(', ')}` : '',
    ].filter(Boolean)
    const isSelfGovernmentSection = section.id === SELF_GOVERNMENT_SECTION_ID
    const selectedActivityRows = isSelfGovernmentSection
      ? getRandomActivityRows(activityRows)
      : []
    const activityContext = formatActivityRowsForPrompt(selectedActivityRows)

    return [
      section.promptGuide,
      '아래 조건을 반드시 지켜서 완성된 한국어 생활기록부 문장만 출력하세요.',
      '영어 번역, 제목, 설명, 번호, 목록, 불릿, 마크다운 기호(*, **, #, -), 따옴표를 절대 쓰지 마세요.',
      '학생 이름은 넣지 말고, 과장된 표현은 피해 주세요.',
      isSelfGovernmentSection
        ? '한 문단으로 작성하고 최종 출력은 공백 포함 반드시 400자 이상 450자 이하로 맞추세요. 399자 이하는 실패이고 451자 이상도 실패입니다.'
        : '관찰 가능한 행동 중심으로 자연스럽게 2문장, 180자 이내로 작성하세요.',
      isSelfGovernmentSection
        ? '아래에서 랜덤 선택된 자율자치 활동 3~4개만 활용하고, 출력은 반드시 활동내용(실시일) 형식을 문장 안에 넣어 이어 쓰세요. 예: 학교폭력 예방교육(2026.03.11.)을 통해 타인의 입장을 이해하고 갈등을 평화롭게 해결하는 방법을 배움.'
        : '관찰 가능한 행동과 태도 중심으로 작성하세요.',
      isSelfGovernmentSection
        ? '학생역량과 품성 단어를 그대로 나열하지 말고, 각 활동에서 보인 태도와 배운 점 속에 자연스럽고 랜덤하게 섞어 표현하세요.'
        : '',
      isSelfGovernmentSection
        ? '입력된 활동자료 밖의 활동은 새로 만들지 말고, 모든 문장은 마침표로 끝나게 작성하세요.'
        : '',
      `학생 구분: ${studentContext}`,
      qualityContext.length
        ? `반영할 학생 특성: ${qualityContext.join(' / ')}`
        : '반영할 학생 특성: 선택된 항목이 없으면 참고 메모 중심으로 작성',
      isSelfGovernmentSection && activityContext
        ? `[이번 생성에 사용할 랜덤 선택 자율자치 활동자료]\n${activityContext}`
        : '',
      memo ? `참고 메모: ${memo}` : `참고 메모: ${section.fallbackMemo}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  async function handleGenerateRecord(section) {
    if (!selectedStudent) {
      return
    }

    const recordKey = getRecordKey(section.id)
    const currentText = recordValues[recordKey] ?? ''

    setSectionGenerationState(section.id, true)

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: createRecordPrompt(section, currentText),
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

      const generatedText = cleanGeneratedRecordText(data.text)

      if (
        !isLikelyKoreanRecordText(
          generatedText,
          section.id === SELF_GOVERNMENT_SECTION_ID,
        )
      ) {
        const lengthMessage =
          section.id === SELF_GOVERNMENT_SECTION_ID
            ? ` 현재 ${getRecordTextLength(generatedText)}자입니다.`
            : ''

        throw new Error(
          `한국어 생활기록부 문장으로 생성되지 않았거나 400~450자 범위를 벗어났습니다.${lengthMessage} 다시 Gemini 생성을 눌러 주세요.`,
        )
      }

      updateRecordValue(section.id, generatedText)
      onToast?.(`${selectedStudent.name} 학생의 ${section.label} 문장을 생성했습니다.`)
    } catch (error) {
      onToast?.(
        error instanceof Error
          ? error.message
          : 'Gemini 응답을 불러오지 못했습니다.',
        'error',
      )
    } finally {
      setSectionGenerationState(section.id, false)
    }
  }

  if (!selectedStudent) {
    return null
  }

  return (
    <section className="detail-section school-life-records-shell">
      <section className="school-life-records-activity-card">
        <div className="school-life-records-activity-card__header">
          <div>
            <p className="section-label">자율자치 활동자료</p>
            <h2>{classLabel}</h2>
          </div>

          <div className="school-life-records-activity-card__actions">
            <span className="school-life-records-activity-count">
              {activityRows.length}개
            </span>
            <button
              className="school-life-records-toggle-button"
              type="button"
              onClick={() => setIsActivityEditorOpen((previous) => !previous)}
            >
              {isActivityEditorOpen ? '접기' : '펼치기'}
            </button>
          </div>
        </div>

        {isActivityEditorOpen ? (
          <label className="school-life-records-activity-field">
            <span className="field-label">실시일 / 활동내용</span>
            <textarea
              value={activityText}
              onChange={(event) => updateActivityText(event.target.value)}
              placeholder={`3월 10일 - 새학기 대청소(봉사)\n3월 11일 - 학교폭력 예방교육\n3월 12일 - 아동학대 예방교육`}
            />
          </label>
        ) : null}

        {activityRows.length ? (
          <div
            className="school-life-records-activity-preview"
            aria-label="자율자치 활동자료 미리보기"
          >
            {activityRows.slice(0, 6).map((activity, index) => (
              <div
                className="school-life-records-activity-preview__row"
                key={`${activity.date}-${activity.content}-${index}`}
              >
                <span>{activity.date || '-'}</span>
                <strong>{activity.content}</strong>
              </div>
            ))}
            {activityRows.length > 6 ? (
              <p className="school-life-records-activity-preview__more">
                외 {activityRows.length - 6}개
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="school-life-records-fields" aria-label="학교생활기록부 입력">
        {recordSections.map((section) => {
          const recordKey = getRecordKey(section.id)

          return (
            <section className="school-life-records-field-card" key={section.id}>
              <div className="school-life-records-field-card__header">
                <h2>{section.label}</h2>
              </div>

              <label className="school-life-records-field">
                <span className="visually-hidden">
                  {selectedStudent.name} {section.label}
                </span>
                <textarea
                  maxLength={
                    section.id === SELF_GOVERNMENT_SECTION_ID
                      ? SELF_GOVERNMENT_MAX_LENGTH
                      : undefined
                  }
                  value={recordValues[recordKey] ?? ''}
                  onChange={(event) =>
                    updateRecordValue(section.id, event.target.value)
                  }
                  placeholder={section.placeholder}
                />
              </label>

              <div className="school-life-records-ai-actions">
                <button
                  className="school-life-records-ai-button"
                  type="button"
                  onClick={() => handleGenerateRecord(section)}
                  disabled={Boolean(generatingSectionIds[section.id])}
                >
                  {generatingSectionIds[section.id] ? '생성 중...' : 'Gemini 생성'}
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

export default SchoolLifeRecordsInput
