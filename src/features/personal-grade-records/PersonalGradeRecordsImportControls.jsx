import { useRef, useState } from 'react'
import {
  getPersonalGradeRecordErrorMessage,
  importPersonalGradeRecordExcel,
} from './personalGradeRecordsRepository.js'
import './PersonalGradeRecords.css'

const excelImportControls = [
  {
    kind: '출결',
    label: '출결 파일 업로드',
    loadingLabel: '출결 업로드 중...',
    tone: 'attendance',
  },
  {
    kind: '동아리',
    label: '동아리 파일 업로드',
    loadingLabel: '동아리 업로드 중...',
    tone: 'club',
  },
  {
    kind: '봉사',
    label: '봉사 파일 업로드',
    loadingLabel: '봉사 업로드 중...',
    tone: 'volunteer',
  },
]

function PersonalGradeRecordsImportControls({ onImportComplete }) {
  const attendanceFileInputRef = useRef(null)
  const clubFileInputRef = useRef(null)
  const volunteerFileInputRef = useRef(null)
  const [importingKind, setImportingKind] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRefs = {
    출결: attendanceFileInputRef,
    동아리: clubFileInputRef,
    봉사: volunteerFileInputRef,
  }

  async function handleExcelFileChange(event, kind) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (!files.length) {
      return
    }

    setImportingKind(kind)
    setNoticeMessage('')
    setErrorMessage('')

    try {
      const result = await importPersonalGradeRecordExcel({ files, kind })

      if (!result) {
        return
      }

      setNoticeMessage(
        `${result.kind}: ${result.matchedCount}명 저장, ${result.unmatchedCount}명 미매칭${
          result.unmatchedPreview.length
            ? ` (${result.unmatchedPreview.join(', ')})`
            : ''
        }`,
      )
      onImportComplete?.(result)
    } catch (error) {
      setErrorMessage(getPersonalGradeRecordErrorMessage(error))
    } finally {
      setImportingKind('')
    }
  }

  const isImporting = Boolean(importingKind)

  return (
    <div className="personal-grade-records-import-controls">
      <div className="personal-grade-records-import-controls__buttons">
        {excelImportControls.map((control) => (
          <button
            key={control.kind}
            className={`personal-grade-records-import-controls__button personal-grade-records-import-controls__button--${control.tone}`}
            type="button"
            onClick={() => fileInputRefs[control.kind].current?.click()}
            disabled={isImporting}
          >
            {importingKind === control.kind ? control.loadingLabel : control.label}
          </button>
        ))}
      </div>

      {excelImportControls.map((control) => (
        <input
          key={control.kind}
          ref={fileInputRefs[control.kind]}
          className="visually-hidden"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          onChange={(event) => handleExcelFileChange(event, control.kind)}
        />
      ))}

      {noticeMessage || errorMessage ? (
        <p
          className={`personal-grade-records-import-controls__message ${
            errorMessage ? 'personal-grade-records-import-controls__message--error' : ''
          }`}
          title={errorMessage || noticeMessage}
        >
          {errorMessage || noticeMessage}
        </p>
      ) : null}
    </div>
  )
}

export default PersonalGradeRecordsImportControls
