import { useEffect, useEffectEvent, useState } from 'react'
import { supabase } from './lib/supabase'

const CUSTOM_OPTION_VALUE = '__custom__'

const LOCATION_OPTIONS = [
  '교무실',
  '교실',
  '복도',
  '상담실',
  '복지실',
  '급식실',
  '직접입력',
]

const CATEGORY_OPTIONS = [
  '교우관계',
  '학업',
  '진로',
  '정서',
  '생활습관',
  '가정',
  '출결',
  '건강',
  '기타',
  '직접입력',
]

function getTodayDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatCounselingDate(dateString) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(new Date(`${dateString}T00:00:00`))
  } catch {
    return dateString
  }
}

function formatTeacherLabel(teacherName) {
  const trimmedTeacherName = String(teacherName ?? '').trim()

  if (!trimmedTeacherName) {
    return ''
  }

  return trimmedTeacherName.endsWith('선생님')
    ? trimmedTeacherName
    : `${trimmedTeacherName} 선생님`
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'absolute'
  textArea.style.left = '-9999px'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

function useToast() {
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage('')
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toastMessage])

  return {
    toastMessage,
    showToast: setToastMessage,
  }
}

function ToastMessage({ message }) {
  if (!message) {
    return null
  }

  return (
    <div style={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  )
}

function CounselingComposer({
  studentId,
  studentName,
  onSaveSuccess,
  onSaved,
  title = '새 상담 기록하기',
  eyebrow = '',
}) {
  const [date, setDate] = useState(getTodayDateString())
  const [selectedLocationOption, setSelectedLocationOption] = useState('')
  const [location, setLocation] = useState('')
  const [selectedCategoryOption, setSelectedCategoryOption] = useState('')
  const [category, setCategory] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { toastMessage, showToast } = useToast()

  function handleLocationOptionChange(event) {
    const nextValue = event.target.value
    setSelectedLocationOption(nextValue)

    if (nextValue === CUSTOM_OPTION_VALUE) {
      setLocation('')
      return
    }

    setLocation(nextValue)
  }

  function handleCategoryOptionChange(event) {
    const nextValue = event.target.value
    setSelectedCategoryOption(nextValue)

    if (nextValue === CUSTOM_OPTION_VALUE) {
      setCategory('')
      return
    }

    setCategory(nextValue)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!studentId || !supabase) {
      setErrorMessage('학생을 먼저 선택한 뒤 상담 기록을 작성해 주세요.')
      return
    }

    const trimmedLocation = location.trim()
    const trimmedCategory = category.trim()
    const trimmedTeacherName = teacherName.trim()
    const trimmedContent = content.trim()

    if (!date) {
      setErrorMessage('상담 날짜를 선택해 주세요.')
      return
    }

    if (!trimmedLocation) {
      setErrorMessage('상담 장소를 입력해 주세요.')
      return
    }

    if (!trimmedCategory) {
      setErrorMessage('상담 분야를 입력해 주세요.')
      return
    }

    if (!trimmedTeacherName) {
      setErrorMessage('상담 교사를 입력해 주세요.')
      return
    }

    if (!trimmedContent) {
      setErrorMessage('상담 내용을 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    const { error } = await supabase.from('counseling_records').insert([
      {
        student_id: studentId,
        counseling_date: date,
        location: trimmedLocation,
        category: trimmedCategory,
        teacher_name: trimmedTeacherName,
        content: trimmedContent,
      },
    ])

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      setIsSubmitting(false)
      return
    }

    setDate(getTodayDateString())
    setSelectedLocationOption('')
    setLocation('')
    setSelectedCategoryOption('')
    setCategory('')
    setTeacherName('')
    setContent('')

    onSaved?.()
    await onSaveSuccess?.(studentName)

    showToast('상담 기록이 저장되었습니다.')
    setIsSubmitting(false)
  }

  return (
    <div style={styles.wrapper}>
      <ToastMessage message={toastMessage} />

      <section style={styles.card}>
        <div style={styles.panelHeader}>
          <div>
            {eyebrow ? <p style={styles.historyEyebrow}>{eyebrow}</p> : null}
            <h3 style={styles.title}>{title}</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inlineFieldRow}>
            <div style={{ ...styles.inputGroup, ...styles.inputGroupDate }}>
              <label style={styles.label}>상담 날짜</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                style={styles.input}
                required
              />
            </div>

            <div style={{ ...styles.inputGroup, ...styles.inputGroupLocation }}>
              <label style={styles.label}>상담 장소</label>
              <select
                value={selectedLocationOption}
                onChange={handleLocationOptionChange}
                style={styles.input}
                required
              >
                <option value="" disabled>
                  상담 장소 선택
                </option>
                {LOCATION_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option === '직접입력' ? CUSTOM_OPTION_VALUE : option}
                  >
                    {option}
                  </option>
                ))}
              </select>
              {selectedLocationOption === CUSTOM_OPTION_VALUE ? (
                <input
                  type="text"
                  placeholder="예: 교문 앞"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  style={styles.input}
                  required
                />
              ) : null}
            </div>

            <div style={{ ...styles.inputGroup, ...styles.inputGroupCategory }}>
              <label style={styles.label}>상담 분야</label>
              <select
                value={selectedCategoryOption}
                onChange={handleCategoryOptionChange}
                style={styles.input}
                required
              >
                <option value="" disabled>
                  상담 분야 선택
                </option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option
                    key={option}
                    value={option === '직접입력' ? CUSTOM_OPTION_VALUE : option}
                  >
                    {option}
                  </option>
                ))}
              </select>
              {selectedCategoryOption === CUSTOM_OPTION_VALUE ? (
                <input
                  type="text"
                  placeholder="예: 진로"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  style={styles.input}
                  required
                />
              ) : null}
            </div>

            <div style={{ ...styles.inputGroup, ...styles.inputGroupTeacher }}>
              <label style={styles.label}>상담 교사</label>
              <input
                type="text"
                placeholder="예: 홍길동"
                value={teacherName}
                onChange={(event) => setTeacherName(event.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>상담 내용</label>
            <textarea
              rows="4"
              placeholder="상담 내용을 자세히 입력해 주세요."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              style={styles.textarea}
              required
            />
          </div>

          {errorMessage ? <p className="detail-error">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            style={isSubmitting ? styles.primaryButtonDisabled : styles.primaryButton}
          >
            {isSubmitting ? '저장 중...' : '상담 기록 저장'}
          </button>
        </form>
      </section>
    </div>
  )
}

function CounselingHistoryPanel({
  studentId,
  refreshKey = 0,
  summarySlot = null,
  showCountBadge = true,
  variant = 'default',
  title = '학생 상담 기록',
  eyebrow = '',
  emptyMessage = '아직 등록된 상담 기록이 없습니다.',
}) {
  const [records, setRecords] = useState([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { toastMessage, showToast } = useToast()
  const isHomePreviewVariant = variant === 'home-preview'

  async function loadRecords(targetStudentId) {
    if (!targetStudentId || !supabase) {
      setRecords([])
      return
    }

    setIsLoadingRecords(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('counseling_records')
      .select('id, student_id, counseling_date, location, category, teacher_name, content')
      .eq('student_id', targetStudentId)
      .order('counseling_date', { ascending: false })
      .order('id', { ascending: false })

    if (error) {
      setRecords([])
      setErrorMessage(error.message)
    } else {
      setRecords(data ?? [])
    }

    setIsLoadingRecords(false)
  }

  const runLoadRecords = useEffectEvent((targetStudentId) => {
    void loadRecords(targetStudentId)
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      runLoadRecords(studentId)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [studentId, refreshKey])

  async function handleCopyForNeis(record) {
    const teacherLabel = formatTeacherLabel(record.teacher_name)
    const metaParts = [teacherLabel, record.location, record.category].filter(Boolean)
    const copyTarget = `[${record.counseling_date}]${
      metaParts.length ? ` (${metaParts.join(' / ')})` : ''
    } ${record.content}`

    try {
      await copyTextToClipboard(copyTarget)
      showToast('나이스 입력용으로 복사되었습니다.')
    } catch {
      showToast('복사에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  return (
    <div style={styles.wrapper}>
      <ToastMessage message={toastMessage} />

      <section style={styles.historySectionCard}>
        <div style={styles.historyHeader}>
          <div>
            {eyebrow ? <p style={styles.historyEyebrow}>{eyebrow}</p> : null}
            <h3 style={styles.historyTitle}>{title}</h3>
          </div>

          {showCountBadge ? (
            <div style={styles.historyActions}>
              <span style={styles.countBadge}>{records.length}건</span>
            </div>
          ) : null}
        </div>

        {summarySlot}

        {errorMessage ? <p className="detail-error">{errorMessage}</p> : null}

        {isLoadingRecords ? (
          <div className="record-skeleton-list" aria-hidden="true">
            <div className="record-skeleton" />
            <div className="record-skeleton" />
          </div>
        ) : null}

        {!isLoadingRecords && !records.length ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyMessage}>{emptyMessage}</p>
          </div>
        ) : null}

        {records.length ? (
          <ul className="record-list">
            {records.map((record) => (
              <li className="record-item" key={record.id}>
                {isHomePreviewVariant ? (
                  <div style={styles.recordMetaStackHome}>
                    <div style={styles.recordDateRowHome}>
                      <strong style={styles.recordDateHome}>
                        {formatCounselingDate(record.counseling_date)}
                      </strong>
                      {record.teacher_name ? (
                        <span style={styles.recordTeacherMetaHome}>
                          <span aria-hidden="true" style={styles.recordTeacherDivider} />
                          <span style={styles.recordTeacher}>
                            상담교사: {formatTeacherLabel(record.teacher_name)}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    <div style={styles.recordActionRowHome}>
                      {record.location ? (
                        <span className="record-badge">{record.location}</span>
                      ) : null}
                      <span className="record-badge">
                        {record.category || '상담 분야'}
                      </span>

                      <button
                        type="button"
                        style={styles.copyButton}
                        onClick={() => handleCopyForNeis(record)}
                      >
                        나이스 복사
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={styles.recordTopRow}>
                    <div style={styles.recordMetaBlock}>
                      <div style={styles.recordDateRow}>
                        <strong style={styles.recordDate}>
                          {formatCounselingDate(record.counseling_date)}
                        </strong>
                        {record.teacher_name ? (
                          <span style={styles.recordTeacherMeta}>
                            <span aria-hidden="true" style={styles.recordTeacherDivider} />
                            <span style={styles.recordTeacher}>
                              상담교사: {formatTeacherLabel(record.teacher_name)}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div style={styles.recordActionRow}>
                      {record.location ? (
                        <span className="record-badge">{record.location}</span>
                      ) : null}
                      <span className="record-badge">
                        {record.category || '상담 분야'}
                      </span>

                      <button
                        type="button"
                        style={styles.copyButton}
                        onClick={() => handleCopyForNeis(record)}
                      >
                        나이스 복사
                      </button>
                    </div>
                  </div>
                )}

                <p className="record-content">{record.content}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}

function CounselingForm(props) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="counseling-board" style={styles.combinedLayout}>
      <CounselingComposer
        {...props}
        onSaved={() => {
          setRefreshKey((previous) => previous + 1)
        }}
      />
      <CounselingHistoryPanel {...props} refreshKey={refreshKey} />
    </div>
  )
}

const styles = {
  combinedLayout: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'start',
  },
  wrapper: {
    display: 'grid',
    gap: '20px',
    position: 'relative',
  },
  card: {
    width: '100%',
    maxWidth: '100%',
    margin: '0',
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '24px',
    border: '1px solid rgba(229, 233, 240, 0.98)',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.04)',
  },
  historySectionCard: {
    display: 'grid',
    gap: '14px',
    width: '100%',
    maxWidth: '100%',
    margin: '0',
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '24px',
    border: '1px solid rgba(229, 233, 240, 0.98)',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.04)',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  title: {
    margin: '0',
    fontSize: '22px',
    fontWeight: '800',
    color: '#191f28',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inlineFieldRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
    alignItems: 'start',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputGroupDate: {
    minWidth: 0,
    width: '100%',
  },
  inputGroupLocation: {
    minWidth: 0,
    width: '100%',
  },
  inputGroupCategory: {
    minWidth: 0,
    width: '100%',
  },
  inputGroupTeacher: {
    minWidth: 0,
    width: '100%',
  },
  label: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#4e5968',
  },
  input: {
    minHeight: '52px',
    padding: '0 16px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#ffffff',
    color: '#191f28',
    fontSize: '16px',
    outline: 'none',
  },
  textarea: {
    minHeight: '98px',
    padding: '14px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#ffffff',
    color: '#191f28',
    fontSize: '16px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  primaryButton: {
    minHeight: '52px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#3182f6',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(49, 130, 246, 0.18)',
  },
  primaryButtonDisabled: {
    minHeight: '52px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#b0d1ff',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'not-allowed',
  },
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  historyActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  historyEyebrow: {
    margin: '0 0 6px',
    color: '#3182f6',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '-0.01em',
  },
  historyTitle: {
    margin: '0',
    fontSize: '22px',
    fontWeight: '800',
    color: '#191f28',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '36px',
    padding: '0 14px',
    borderRadius: '999px',
    background: '#f8fafc',
    color: '#191f28',
    fontSize: '14px',
    fontWeight: '700',
  },
  copyButton: {
    minHeight: '34px',
    padding: '0 12px',
    borderRadius: '999px',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    backgroundColor: '#f8fafc',
    color: '#4e5968',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  recordTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  recordMetaBlock: {
    display: 'grid',
    gap: '8px',
    flex: '1 1 auto',
    minWidth: '0',
  },
  recordDateRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  recordDate: {
    color: '#191f28',
    fontSize: '16px',
    fontWeight: '800',
  },
  recordMetaStackHome: {
    display: 'grid',
    gap: '10px',
  },
  recordDateRowHome: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
  },
  recordDateHome: {
    color: '#191f28',
    fontSize: '16px',
    fontWeight: '800',
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  recordTeacherMeta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
  },
  recordTeacherMetaHome: {
    display: 'inline-flex',
    alignItems: 'center',
    justifySelf: 'end',
    gap: '10px',
    whiteSpace: 'nowrap',
  },
  recordTeacherDivider: {
    width: '1px',
    alignSelf: 'stretch',
    borderLeft: '2px dotted rgba(49, 130, 246, 0.45)',
  },
  recordTeacher: {
    color: '#3182f6',
    fontSize: '13px',
    fontWeight: '800',
    whiteSpace: 'nowrap',
  },
  recordActionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '8px',
    flexShrink: 0,
  },
  recordActionRowHome: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: '8px',
  },
  emptyState: {
    display: 'grid',
    justifyItems: 'center',
    padding: '28px 0 12px',
    textAlign: 'center',
  },
  emptyMessage: {
    margin: '0',
    color: '#8b95a1',
    fontSize: '15px',
    fontWeight: '500',
  },
  toast: {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '30',
    padding: '14px 16px',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    color: '#191f28',
    fontSize: '14px',
    fontWeight: '700',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
    backdropFilter: 'blur(14px)',
  },
}

export { CounselingComposer, CounselingHistoryPanel }
export default CounselingForm
