import { useRef, useState } from 'react'
import {
  getFriendlyAvatarStudentUpdateErrorMessage,
  getFriendlyAvatarUploadErrorMessage,
} from '../../lib/avatarUploadHelpers'
import { supabase } from '../../lib/supabase'

const BATCH_SIZE = 5
const STUDENT_MATCH_FETCH_PAGE_SIZE = 1000

function buildStudentMatchKey(grade, classNum, studentNum) {
  return `${grade}-${classNum}-${studentNum}`
}

function parseStudentCodeFromFileName(fileName) {
  const baseName = String(fileName ?? '').replace(/\.[^.]+$/, '').trim()
  const match = baseName.match(/^(\d)(\d)(\d{2})$/)

  if (!match) {
    return null
  }

  return {
    schoolNumber: match[0],
    grade: Number(match[1]),
    classNum: Number(match[2]),
    studentNum: Number(match[3]),
  }
}

function createAvatarStoragePath(studentId, fileName, authUserId) {
  const fileExtension =
    fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp'
  const uniqueToken =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`

  return `${authUserId}/students/${studentId}/${uniqueToken}.${fileExtension}`
}

function createBatchEntry(file, index, studentMap) {
  const fileName = file.name.trim()
  const isWebpFile = /\.webp$/i.test(fileName) || file.type === 'image/webp'

  if (!isWebpFile) {
    return {
      id: `${fileName}-${file.lastModified}-${index}`,
      file,
      fileName,
      status: 'unmatched',
      reason: 'webp 파일만 업로드할 수 있습니다.',
      student: null,
    }
  }

  const parsed = parseStudentCodeFromFileName(fileName)

  if (!parsed) {
    return {
      id: `${fileName}-${file.lastModified}-${index}`,
      file,
      fileName,
      status: 'unmatched',
      reason: '파일명을 1101.webp 형식으로 맞춰 주세요.',
      student: null,
    }
  }

  const matchedStudent =
    studentMap.get(
      buildStudentMatchKey(parsed.grade, parsed.classNum, parsed.studentNum),
    ) ?? null

  if (!matchedStudent) {
    return {
      id: `${fileName}-${file.lastModified}-${index}`,
      file,
      fileName,
      status: 'unmatched',
      reason: `${parsed.schoolNumber}에 해당하는 학생이 DB에 없습니다.`,
      parsed,
      student: null,
    }
  }

  return {
    id: `${fileName}-${file.lastModified}-${index}`,
    file,
    fileName,
    parsed,
    student: matchedStudent,
    status: 'ready',
    reason: '',
  }
}

async function fetchAllStudentsForMatching() {
  const students = []
  let rangeStart = 0

  while (true) {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, grade, class_num, student_num')
      .order('grade', { ascending: true })
      .order('class_num', { ascending: true })
      .order('student_num', { ascending: true })
      .range(rangeStart, rangeStart + STUDENT_MATCH_FETCH_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error }
    }

    const nextChunk = data ?? []
    students.push(...nextChunk)

    if (nextChunk.length < STUDENT_MATCH_FETCH_PAGE_SIZE) {
      return { data: students, error: null }
    }

    rangeStart += STUDENT_MATCH_FETCH_PAGE_SIZE
  }
}

function BatchAvatarUpload({ authUserId, onAvatarUpdated, onStatusMessage }) {
  const fileInputRef = useRef(null)

  const [entries, setEntries] = useState([])
  const [phase, setPhase] = useState('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [localErrorMessage, setLocalErrorMessage] = useState('')

  const totalCount = entries.length
  const matchedEntries = entries.filter((entry) => entry.student)
  const uploadableEntries = entries.filter(
    (entry) =>
      entry.student && (entry.status === 'ready' || entry.status === 'failed'),
  )
  const unmatchedEntries = entries.filter((entry) => entry.status === 'unmatched')
  const completedEntries = entries.filter((entry) => entry.status === 'completed')
  const failedEntries = entries.filter((entry) => entry.status === 'failed')
  const processedCount =
    completedEntries.length + failedEntries.length + unmatchedEntries.length
  const progressPercent = totalCount
    ? Math.round((processedCount / totalCount) * 100)
    : 0

  function updateEntry(entryId, patch) {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    )
  }

  function resetBatchState() {
    setEntries([])
    setPhase('idle')
    setIsDragging(false)
    setIsPreparing(false)
    setIsProcessing(false)
    setLocalErrorMessage('')
  }

  async function analyzeFiles(fileList) {
    const nextFiles = Array.from(fileList ?? [])

    if (!nextFiles.length || !supabase || !authUserId) {
      return
    }

    setIsPreparing(true)
    setPhase('analyzing')
    setLocalErrorMessage('')
    onStatusMessage?.(`${nextFiles.length}개 사진 파일을 분석하는 중입니다.`)

    const { data, error } = await fetchAllStudentsForMatching()

    if (error) {
      setEntries([])
      setPhase('idle')
      setLocalErrorMessage(error.message)
      setIsPreparing(false)
      return
    }

    const studentMap = new Map(
      (data ?? []).map((student) => [
        buildStudentMatchKey(student.grade, student.class_num, student.student_num),
        student,
      ]),
    )

    const nextEntries = nextFiles.map((file, index) =>
      createBatchEntry(file, index, studentMap),
    )

    setEntries(nextEntries)
    setPhase('review')
    setIsPreparing(false)

    if (nextEntries.length) {
      onStatusMessage?.(
        `파일 분석을 마쳤습니다. ${nextEntries.length}개 중 ${nextEntries.filter((entry) => entry.student).length}개가 학생과 매칭되었습니다.`,
      )
    }
  }

  async function processSingleEntry(entry) {
    if (!supabase || !entry.student || entry.status === 'completed') {
      return 'failed'
    }

    updateEntry(entry.id, {
      status: 'uploading',
      reason: '',
    })

    const storagePath = createAvatarStoragePath(
      entry.student.id,
      entry.file.name,
      authUserId,
    )

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, entry.file, {
        cacheControl: '3600',
        upsert: true,
        contentType: entry.file.type || 'image/webp',
      })

    if (uploadError) {
      updateEntry(entry.id, {
        status: 'failed',
        reason: getFriendlyAvatarUploadErrorMessage(uploadError),
      })
      return 'failed'
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(storagePath)

    updateEntry(entry.id, {
      status: 'updating',
    })

    const { error: updateError } = await supabase
      .from('students')
      .update({ avatar_url: publicUrl })
      .eq('id', entry.student.id)

    if (updateError) {
      updateEntry(entry.id, {
        status: 'failed',
        reason: getFriendlyAvatarStudentUpdateErrorMessage(updateError),
      })
      return 'failed'
    }

    onAvatarUpdated?.(entry.student.id, publicUrl)

    updateEntry(entry.id, {
      status: 'completed',
      reason: '',
    })

    return 'completed'
  }

  async function handleStartUpload() {
    if (!uploadableEntries.length || !supabase || !authUserId) {
      return
    }

    setIsProcessing(true)
    setPhase('uploading')
    setLocalErrorMessage('')
    onStatusMessage?.(
      `일괄 업로드를 시작했습니다. 총 ${uploadableEntries.length}개 매칭 파일을 처리합니다.`,
    )

    let successCount = 0
    let failureCount = 0

    for (let startIndex = 0; startIndex < uploadableEntries.length; startIndex += BATCH_SIZE) {
      const chunk = uploadableEntries.slice(startIndex, startIndex + BATCH_SIZE)
      const results = await Promise.all(chunk.map((entry) => processSingleEntry(entry)))

      results.forEach((result) => {
        if (result === 'completed') {
          successCount += 1
        } else {
          failureCount += 1
        }
      })
    }

    setIsProcessing(false)
    setPhase('complete')
    onStatusMessage?.(
      `사진 일괄 업로드를 마쳤습니다. 성공 ${successCount}개, 확인 필요 ${unmatchedEntries.length + failureCount}개입니다.`,
    )
  }

  function handleInputChange(event) {
    void analyzeFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)

    if (isPreparing || isProcessing) {
      return
    }

    void analyzeFiles(event.dataTransfer.files)
  }

  function openFilePicker() {
    if (isPreparing || isProcessing) {
      return
    }

    fileInputRef.current?.click()
  }

  const phaseTitleMap = {
    idle: 'webp 파일을 올리면 자동으로 학생을 찾아 연결합니다.',
    analyzing: '파일명에서 학년, 반, 번호를 분석하고 있습니다.',
    review: '학생 매칭 결과를 확인한 뒤 업로드를 시작할 수 있습니다.',
    uploading: `전체 ${totalCount}개 중 ${processedCount}개 완료`,
    complete: '일괄 업로드 처리가 완료되었습니다.',
  }

  return (
    <section className="batch-upload-card">
      <div className="card-header batch-upload-card__header">
        <div>
          <p className="section-label">Batch Upload</p>
          <h2>사진 일괄 매칭 업로드</h2>
          <p className="form-description">
            파일 분석 → 학생 매칭 확인 → Storage 업로드 → DB 주소 업데이트 순서로
            진행됩니다.
          </p>
        </div>

        <div className="batch-upload-card__actions">
          <button
            className="ghost-button"
            type="button"
            onClick={resetBatchState}
            disabled={isPreparing || isProcessing || !entries.length}
          >
            초기화
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handleStartUpload}
            disabled={isPreparing || isProcessing || !uploadableEntries.length}
          >
            {isProcessing ? '업로드 진행 중..' : '일괄 업로드 시작'}
          </button>
        </div>
      </div>

      <div className="batch-phase-card">
        <div className="batch-phase-card__steps" aria-hidden="true">
          <span className={phase === 'analyzing' ? 'is-active' : ''}>파일 분석</span>
          <span className={phase === 'review' ? 'is-active' : ''}>학생 매칭 확인</span>
          <span className={phase === 'uploading' ? 'is-active' : ''}>Storage 업로드</span>
          <span className={phase === 'complete' ? 'is-active' : ''}>DB 주소 업데이트</span>
        </div>
        <strong>{phaseTitleMap[phase]}</strong>
      </div>

      <div
        className={`batch-dropzone ${isDragging ? 'is-dragging' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!isPreparing && !isProcessing) {
            setIsDragging(true)
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          if (event.currentTarget === event.target) {
            setIsDragging(false)
          }
        }}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".webp,image/webp"
          multiple
          onChange={handleInputChange}
        />

        <div className="batch-dropzone__icon" aria-hidden="true">
          ⤴
        </div>
        <h3>webp 파일을 한꺼번에 올려 주세요</h3>
        <p>1101.webp 형식 파일을 여러 개 선택하거나 이 영역으로 끌어오면 됩니다.</p>
        <button
          className="secondary-button"
          type="button"
          onClick={openFilePicker}
          disabled={isPreparing || isProcessing}
        >
          {isPreparing ? '분석 중..' : '파일 선택하기'}
        </button>
      </div>

      {localErrorMessage ? <p className="toolbar-error">{localErrorMessage}</p> : null}

      {entries.length ? (
        <>
          <div className="batch-progress-card">
            <div className="batch-progress-card__summary">
              <div className="batch-progress-card__copy">
                <strong>{progressPercent}%</strong>
                <p>
                  전체 {totalCount}개 중 {processedCount}개 완료
                </p>
              </div>

              <div className="batch-stat-list">
                <span>매칭 성공 {matchedEntries.length}개</span>
                <span>완료 {completedEntries.length}개</span>
                <span>확인 필요 {unmatchedEntries.length + failedEntries.length}개</span>
              </div>
            </div>

            <div className="batch-progress-bar" aria-hidden="true">
              <div
                className="batch-progress-bar__fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="batch-review-grid">
            <section className="batch-review-panel">
              <div className="section-row">
                <div>
                  <p className="section-label">Ready</p>
                  <h3 className="detail-title">매칭된 파일</h3>
                </div>
                <span className="card-count">{matchedEntries.length}개</span>
              </div>

              <ul className="batch-review-list">
                {matchedEntries.slice(0, 8).map((entry) => (
                  <li className="batch-review-item" key={entry.id}>
                    <strong>{entry.fileName}</strong>
                    <p>
                      {entry.student.name} · {entry.student.grade}학년 {entry.student.class_num}반{' '}
                      {entry.student.student_num}번
                    </p>
                    <span className={`batch-status-chip is-${entry.status}`}>
                      {entry.status === 'completed'
                        ? '완료'
                        : entry.status === 'failed'
                          ? '실패'
                          : entry.status === 'uploading'
                            ? '업로드 중'
                            : entry.status === 'updating'
                              ? 'DB 저장 중'
                              : '대기'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="batch-review-panel">
              <div className="section-row">
                <div>
                  <p className="section-label">Needs Review</p>
                  <h3 className="detail-title">확인 필요</h3>
                </div>
                <span className="card-count">
                  {unmatchedEntries.length + failedEntries.length}개
                </span>
              </div>

              {unmatchedEntries.length || failedEntries.length ? (
                <ul className="batch-review-list">
                  {[...unmatchedEntries, ...failedEntries].map((entry) => (
                    <li className="batch-review-item is-warning" key={entry.id}>
                      <strong>{entry.fileName}</strong>
                      <p>{entry.reason || '확인 필요'}</p>
                      <span className="batch-status-chip is-warning">확인 필요</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="record-empty">
                  <p>현재까지 확인이 필요한 파일은 없습니다.</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default BatchAvatarUpload
