import { useEffect, useEffectEvent, useState } from 'react'
import { supabase } from './lib/supabase'

const CATEGORY_OPTIONS = [
  '학업',
  '진로',
  '교우관계',
  '생활태도',
  '가정환경',
  '직접 입력',
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
    }).format(new Date(`${dateString}T00:00:00`))
  } catch {
    return dateString
  }
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
  eyebrow = 'Counseling Form',
}) {
  const [date, setDate] = useState(getTodayDateString())
  const [category, setCategory] = useState('학업')
  const [customCategory, setCustomCategory] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { toastMessage, showToast } = useToast()

  async function handleSubmit(event) {
    event.preventDefault()

    if (!studentId || !supabase) {
      setErrorMessage('학생을 먼저 선택한 뒤 상담 기록을 저장해 주세요.')
      return
    }

    const finalCategory =
      category === '직접 입력' ? customCategory.trim() : category
    const trimmedContent = content.trim()

    if (!date) {
      setErrorMessage('상담 날짜를 선택해 주세요.')
      return
    }

    if (!finalCategory) {
      setErrorMessage('상담 분야를 입력해 주세요.')
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
        category: finalCategory,
        content: trimmedContent,
      },
    ])

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      setIsSubmitting(false)
      return
    }

    setDate(getTodayDateString())
    setCategory('학업')
    setCustomCategory('')
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
            <p style={styles.historyEyebrow}>{eyebrow}</p>
            <h3 style={styles.title}>{title}</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>상담 날짜</label>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>상담 분야</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={styles.input}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {category === '직접 입력' ? (
            <div style={styles.inputGroup}>
              <label style={styles.label}>직접 입력한 상담 분야</label>
              <input
                type="text"
                placeholder="예: 진학 준비, 학부모 상담"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                style={styles.input}
                required
              />
            </div>
          ) : null}

          <div style={styles.inputGroup}>
            <label style={styles.label}>상담 내용</label>
            <textarea
              rows="7"
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
  title = '학생 상담 목록',
  eyebrow = 'Counseling History',
  emptyMessage = '아직 등록된 상담 기록이 없습니다.',
}) {
  const [records, setRecords] = useState([])
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { toastMessage, showToast } = useToast()

  async function loadRecords(targetStudentId) {
    if (!targetStudentId || !supabase) {
      setRecords([])
      return
    }

    setIsLoadingRecords(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('counseling_records')
      .select('id, student_id, counseling_date, category, content')
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
    const copyTarget = `[${record.counseling_date}] (${record.category || '상담'}) ${record.content}`

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

          {showCountBadge ? <div style={styles.historyActions}>
            <span style={styles.countBadge}>{records.length}건</span>
          </div> : null}
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
                <div style={styles.recordTopRow}>
                  <div className="record-meta" style={styles.recordMetaInline}>
                    <strong>{formatCounselingDate(record.counseling_date)}</strong>
                    <span className="record-badge">
                      {record.category || '상담 분야'}
                    </span>
                  </div>

                  <button
                    type="button"
                    style={styles.copyButton}
                    onClick={() => handleCopyForNeis(record)}
                  >
                    나이스 복사
                  </button>
                </div>

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
      <CounselingHistoryPanel {...props} refreshKey={refreshKey} />
      <CounselingComposer
        {...props}
        onSaved={() => {
          setRefreshKey((previous) => previous + 1)
        }}
      />
    </div>
  )
}

const styles = {
  combinedLayout: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)',
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
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
    minHeight: '196px',
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
  softButton: {
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '999px',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    backgroundColor: '#f8fafc',
    color: '#4e5968',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  softButtonDisabled: {
    minHeight: '38px',
    padding: '0 14px',
    borderRadius: '999px',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    backgroundColor: '#f8fafc',
    color: '#a0a8b2',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'not-allowed',
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
  recordMetaInline: {
    flex: '1 1 auto',
    minWidth: '0',
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
