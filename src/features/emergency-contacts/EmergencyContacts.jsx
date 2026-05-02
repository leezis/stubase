import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import schoolLogoUrl from '../../assets/dongsuyeong-school-logo.svg'
import {
  getSupabaseEnvHelpMessage,
  hasSupabaseEnv,
  supabase,
} from '../../lib/supabase'

const CONTACT_FETCH_PAGE_SIZE = 1000
const CONTACT_PAGE_SIZE = 10
const EMERGENCY_CONTACT_TITLE = '2026학년도 동수영중학교 비상연락망'
const CONTACT_SELECT_COLUMNS =
  'id, name, grade, class_num, student_num, avatar_url, student_phone, parent_phone'
const BASIC_SELECT_COLUMNS = 'id, name, grade, class_num, student_num, avatar_url'
const GRADE_OPTIONS = [1, 2, 3]
const CLASS_OPTIONS = Array.from({ length: 7 }, (_, index) => index + 1)

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatPhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '')

  if (!digits) {
    return ''
  }

  if (/^\d{11}$/.test(digits)) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }

  if (/^\d{10}$/.test(digits)) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  }

  return String(value ?? '').trim()
}

function createSchoolNumber(student) {
  return `${student.grade}${student.class_num}${String(student.student_num).padStart(2, '0')}`
}

function normalizeStudent(row) {
  const grade = Number(row?.grade ?? 0)
  const classNum = Number(row?.class_num ?? 0)
  const studentNum = Number(row?.student_num ?? 0)

  return {
    id: row?.id,
    name: String(row?.name ?? '').trim(),
    grade,
    class_num: classNum,
    student_num: studentNum,
    avatar_url: String(row?.avatar_url ?? '').trim(),
    student_phone: formatPhoneNumber(row?.student_phone ?? ''),
    parent_phone: formatPhoneNumber(row?.parent_phone ?? ''),
  }
}

function sortStudents(students) {
  return students.slice().sort((left, right) => {
    const gradeDiff = Number(left.grade) - Number(right.grade)

    if (gradeDiff !== 0) {
      return gradeDiff
    }

    const classDiff = Number(left.class_num) - Number(right.class_num)

    if (classDiff !== 0) {
      return classDiff
    }

    return Number(left.student_num) - Number(right.student_num)
  })
}

function chunkRows(rows, size) {
  const chunks = []

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }

  return chunks
}

function hasMissingContactColumnError(error) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return text.includes('student_phone') || text.includes('parent_phone')
}

function getEmergencyContactErrorMessage(error) {
  const rawMessage = error?.message ?? ''

  if (hasMissingContactColumnError(error)) {
    return 'students 테이블에 연락처 컬럼이 아직 없습니다. supabase-add-emergency-contact-columns.sql을 실행해 주세요.'
  }

  return rawMessage || '비상연락망 데이터를 불러오지 못했습니다.'
}

async function fetchAllStudents(selectColumns) {
  const records = []
  let rangeStart = 0

  while (true) {
    const { data, error } = await supabase
      .from('students')
      .select(selectColumns)
      .order('grade', { ascending: true })
      .order('class_num', { ascending: true })
      .order('student_num', { ascending: true })
      .range(rangeStart, rangeStart + CONTACT_FETCH_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error }
    }

    const nextRows = data ?? []
    records.push(...nextRows)

    if (nextRows.length < CONTACT_FETCH_PAGE_SIZE) {
      return { data: records, error: null }
    }

    rangeStart += CONTACT_FETCH_PAGE_SIZE
  }
}

async function fetchEmergencyStudents() {
  const contactResult = await fetchAllStudents(CONTACT_SELECT_COLUMNS)

  if (!contactResult.error) {
    return {
      rows: contactResult.data ?? [],
      hasContactColumns: true,
      error: null,
    }
  }

  if (!hasMissingContactColumnError(contactResult.error)) {
    return {
      rows: [],
      hasContactColumns: true,
      error: contactResult.error,
    }
  }

  const basicResult = await fetchAllStudents(BASIC_SELECT_COLUMNS)

  return {
    rows: basicResult.data ?? [],
    hasContactColumns: false,
    error: basicResult.error,
    fallbackError: contactResult.error,
  }
}

function getPhoneDisplay(value, emptyText) {
  const formatted = formatPhoneNumber(value)

  return {
    text: formatted || emptyText,
    missing: !formatted,
  }
}

function createContactCardHtml(student) {
  const schoolNumber = createSchoolNumber(student)
  const studentPhone = getPhoneDisplay(student.student_phone, '학생전화 없음')
  const parentPhone = getPhoneDisplay(student.parent_phone, '학부모전화 없음')
  const gradeClass = `print-emergency-card--grade-${Number(student.grade) || 0}`
  const photoHtml = student.avatar_url
    ? `<img src="${escapeHtml(student.avatar_url)}" alt="${escapeHtml(student.name)} 사진" />`
    : '<span>사진없음</span>'

  return `<article class="print-emergency-card ${gradeClass}">
    <div class="print-emergency-photo">${photoHtml}</div>
    <div class="print-emergency-body">
      <div class="print-emergency-meta">${escapeHtml(`${student.grade}학년 ${student.class_num}반 ${student.student_num}번`)}</div>
      <div class="print-emergency-name">${escapeHtml(student.name || '-')}</div>
      <div class="print-emergency-phone-list">
        <div class="print-emergency-phone${studentPhone.missing ? ' is-missing' : ''}">
          <span>학생</span>
          <strong>${escapeHtml(studentPhone.text)}</strong>
        </div>
        <div class="print-emergency-phone${parentPhone.missing ? ' is-missing' : ''}">
          <span>학부모</span>
          <strong>${escapeHtml(parentPhone.text)}</strong>
        </div>
      </div>
      <div class="print-emergency-number">${escapeHtml(schoolNumber)}</div>
    </div>
  </article>`
}

function createContactPagesHtml(rows, grade, classNum) {
  const pages = chunkRows(rows, CONTACT_PAGE_SIZE)

  return pages
    .map((pageRows, pageIndex) => {
      const cardsHtml = pageRows.map(createContactCardHtml).join('')

      return `<section class="print-emergency-page">
        <header class="print-emergency-head">
          <div class="print-emergency-title-wrap">
            <img src="${escapeHtml(schoolLogoUrl)}" alt="" />
            <div>
              <p>개인정보보호 유의</p>
              <h1>${escapeHtml(EMERGENCY_CONTACT_TITLE)}</h1>
              <span>${escapeHtml(`${grade}학년 ${classNum}반 · 학생 ${rows.length}명`)}</span>
            </div>
          </div>
          <strong>${escapeHtml(`${grade}-${classNum}`)}</strong>
        </header>
        <div class="print-emergency-grid">${cardsHtml}</div>
        <footer>${pageIndex + 1} / ${pages.length}</footer>
      </section>`
    })
    .join('')
}

function createAllContactPagesHtml(groups) {
  return groups
    .map((group) =>
      createContactPagesHtml(group.rows, group.grade, group.classNum),
    )
    .join('')
}

function openPrintPopup(title, pagesHtml) {
  const popup = window.open(
    '',
    'emergency_contact_print',
    'width=1280,height=980,resizable=yes,scrollbars=yes',
  )

  if (!popup) {
    return false
  }

  popup.document.open()
  popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        color: #0f2f60;
        background: #eef2f7;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body { padding: 18px; }
      .print-emergency-stack {
        display: grid;
        gap: 18px;
        justify-items: center;
      }
      .print-emergency-page {
        width: 200mm;
        min-height: 281mm;
        height: 281mm;
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 2.2mm;
        padding: 5mm;
        overflow: hidden;
        background: linear-gradient(180deg, #ffffff 0%, #f6faff 100%);
        border: 1px solid #c7d4e7;
      }
      .print-emergency-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 8mm;
        padding-bottom: 2.5mm;
        border-bottom: 2px solid #dbe7f8;
      }
      .print-emergency-title-wrap {
        display: flex;
        align-items: center;
        gap: 3mm;
      }
      .print-emergency-title-wrap img {
        width: 11mm;
        height: 11mm;
        object-fit: contain;
      }
      .print-emergency-title-wrap p,
      .print-emergency-title-wrap span {
        margin: 0;
        color: #50627f;
        font-size: 10.5px;
        font-weight: 800;
      }
      .print-emergency-title-wrap p {
        color: #c81e1e;
        font-weight: 900;
      }
      .print-emergency-title-wrap h1 {
        margin: 1mm 0 0.8mm;
        color: #15396f;
        font-size: 24px;
        font-weight: 900;
        line-height: 1.15;
      }
      .print-emergency-head > strong {
        display: grid;
        place-items: center;
        min-width: 28mm;
        min-height: 10mm;
        padding: 0 4mm;
        border-radius: 999px;
        border: 1px solid #b7c9ea;
        background: linear-gradient(180deg, #f8fbff 0%, #dbeafe 100%);
        color: #17408b;
        font-size: 16px;
        font-weight: 900;
      }
      .print-emergency-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: 47mm;
        gap: 2mm;
      }
      .print-emergency-card {
        position: relative;
        display: grid;
        grid-template-columns: 29mm minmax(0, 1fr);
        gap: 2.8mm;
        align-items: center;
        min-width: 0;
        padding: 3mm 2.5mm 2mm;
        overflow: hidden;
        border: 1px solid #c4d5ee;
        border-radius: 5mm;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        box-shadow: 0 3mm 6mm rgba(21, 54, 109, 0.08);
        break-inside: avoid;
      }
      .print-emergency-card::before {
        content: "";
        position: absolute;
        inset: 0 0 auto;
        height: 1.4mm;
        background: linear-gradient(90deg, #1d4ed8 0%, #0ea5e9 52%, #14b8a6 100%);
      }
      .print-emergency-card--grade-1::before {
        background: linear-gradient(90deg, #dc2626 0%, #f97316 52%, #fb7185 100%);
      }
      .print-emergency-card--grade-2::before {
        background: linear-gradient(90deg, #0284c7 0%, #38bdf8 52%, #60a5fa 100%);
      }
      .print-emergency-card--grade-3::before {
        background: linear-gradient(90deg, #15803d 0%, #22c55e 52%, #84cc16 100%);
      }
      .print-emergency-photo {
        position: relative;
        z-index: 1;
        width: 29mm;
        height: 40mm;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid #b9cae5;
        border-radius: 4mm;
        background: linear-gradient(145deg, #eef5ff 0%, #dbeafe 100%);
        color: #4c6a98;
        font-size: 11px;
        font-weight: 900;
        text-align: center;
      }
      .print-emergency-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .print-emergency-body {
        position: relative;
        z-index: 1;
        min-width: 0;
        height: 40mm;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto auto;
        gap: 1mm;
      }
      .print-emergency-meta {
        display: inline-flex;
        align-items: center;
        gap: 1.7mm;
        width: fit-content;
        min-height: 8mm;
        padding: 0 3.2mm 0 2.7mm;
        border: 1px solid #c5d6f2;
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(224, 236, 255, 0.94) 100%);
        color: #18407b;
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }
      .print-emergency-meta::before {
        content: "";
        width: 1.5mm;
        height: 1.5mm;
        flex: 0 0 auto;
        border-radius: 999px;
        background: #2563eb;
      }
      .print-emergency-card--grade-1 .print-emergency-meta {
        border-color: #f2c9cc;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 233, 235, 0.94) 100%);
        color: #8c1d34;
      }
      .print-emergency-card--grade-1 .print-emergency-meta::before {
        background: #dc2626;
      }
      .print-emergency-card--grade-3 .print-emergency-meta {
        border-color: #c7dfd1;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(226, 245, 235, 0.94) 100%);
        color: #166043;
      }
      .print-emergency-card--grade-3 .print-emergency-meta::before {
        background: #16a34a;
      }
      .print-emergency-name {
        align-self: center;
        color: #0c2d5d;
        font-size: 22px;
        font-weight: 900;
        line-height: 1.1;
      }
      .print-emergency-phone-list {
        display: grid;
        gap: 1mm;
      }
      .print-emergency-phone {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        align-items: center;
        gap: 2mm;
        min-width: 0;
        min-height: 9.2mm;
        padding: 1.1mm 1.6mm;
        border-radius: 3mm;
        background: linear-gradient(180deg, #fbfdff 0%, #edf5ff 100%);
        border: 1px solid #c9daf7;
      }
      .print-emergency-phone:nth-child(2) {
        border-color: #cbe4de;
        background: linear-gradient(180deg, #fcfffe 0%, #edf9f5 100%);
      }
      .print-emergency-phone span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 13mm;
        min-height: 6.2mm;
        padding: 0 2.2mm;
        border-radius: 999px;
        border: 1px solid #bfd1f2;
        background: linear-gradient(180deg, #f8fbff 0%, #dbeafe 100%);
        color: #18407b;
        font-size: 10px;
        font-weight: 900;
      }
      .print-emergency-phone:nth-child(2) span {
        border-color: #b9d9d2;
        background: linear-gradient(180deg, #f6fffc 0%, #d8f5ec 100%);
        color: #155e52;
      }
      .print-emergency-phone strong {
        min-width: 0;
        color: #17345f;
        font-size: 16.5px;
        line-height: 1.16;
        white-space: nowrap;
        font-weight: 900;
        font-variant-numeric: tabular-nums;
      }
      .print-emergency-phone.is-missing strong {
        color: #a11d35;
        font-size: 12px;
        white-space: normal;
      }
      .print-emergency-number {
        justify-self: end;
        color: #94a3b8;
        font-size: 10px;
        font-weight: 800;
      }
      .print-emergency-page footer {
        display: flex;
        justify-content: flex-end;
        color: #8391a5;
        font-size: 10px;
        font-weight: 800;
      }
      @media print {
        @page { size: A4; margin: 5mm; }
        body {
          padding: 0;
          background: #ffffff;
        }
        .print-emergency-stack {
          display: block;
          gap: 0;
        }
        .print-emergency-page {
          width: 200mm;
          min-height: 281mm;
          height: 281mm;
          margin: 0 auto;
          border: 0;
          page-break-after: always;
          break-after: page;
        }
        .print-emergency-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }
      }
    </style>
  </head>
  <body>
    <main class="print-emergency-stack">${pagesHtml}</main>
    <script>
      window.addEventListener('load', function () {
        var images = Array.prototype.slice.call(document.images || []);
        var imageReady = Promise.allSettled(images.map(function (image) {
          if (image.complete) return Promise.resolve();
          return new Promise(function (resolve) {
            image.onload = resolve;
            image.onerror = resolve;
          });
        }));
        Promise.race([
          imageReady,
          new Promise(function (resolve) { setTimeout(resolve, 1200); })
        ]).finally(function () {
          setTimeout(function () { window.print(); }, 180);
        });
      });
    </script>
  </body>
</html>`)
  popup.document.close()
  popup.focus()
  return true
}

function buildExcelHtml(grade, classNum, rows) {
  const bodyRows = rows
    .map((student) => {
      const studentPhone = formatPhoneNumber(student.student_phone)
      const parentPhone = formatPhoneNumber(student.parent_phone)

      return `<tr>
        <td style="mso-number-format:'\\@';">${escapeHtml(createSchoolNumber(student))}</td>
        <td>${escapeHtml(student.name)}</td>
        <td>${escapeHtml(student.grade)}</td>
        <td>${escapeHtml(student.class_num)}</td>
        <td>${escapeHtml(student.student_num)}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(studentPhone)}</td>
        <td style="mso-number-format:'\\@';">${escapeHtml(parentPhone)}</td>
      </tr>`
    })
    .join('')

  return `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=UTF-8" />
  <style>
    @page { size: A4 landscape; margin: 6mm; }
    body {
      font-family: "Malgun Gothic", "Pretendard", sans-serif;
      color: #172033;
    }
    h1 {
      margin: 0 0 4px;
      text-align: center;
      font-size: 24pt;
    }
    p {
      margin: 0 0 8px;
      text-align: center;
      color: #506070;
      font-size: 13pt;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th,
    td {
      border: 1px solid #b7c8df;
      padding: 8px 10px;
      text-align: center;
      vertical-align: middle;
      font-size: 13pt;
    }
    th {
      background: #dbeafe;
      color: #1e3a8a;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(EMERGENCY_CONTACT_TITLE)}</h1>
  <p>${escapeHtml(`${grade}학년 ${classNum}반 · 학생 수 ${rows.length}명`)}</p>
  <table>
    <thead>
      <tr>
        <th>학번</th>
        <th>이름</th>
        <th>학년</th>
        <th>반</th>
        <th>번호</th>
        <th>학생 전화번호</th>
        <th>학부모 전화번호</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`
}

function downloadExcelFile(fileName, html) {
  const blob = new Blob([html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1200)
}

function EmergencyStudentCard({ isSelected, onSelect, student }) {
  const studentPhone = getPhoneDisplay(student.student_phone, '학생전화 없음')
  const parentPhone = getPhoneDisplay(student.parent_phone, '학부모전화 없음')

  return (
    <button
      className={`emergency-contact-card emergency-contact-card--grade-${
        Number(student.grade) || 0
      } ${isSelected ? 'is-selected' : ''}`}
      type="button"
      onClick={() => onSelect(student)}
    >
      <span className="emergency-contact-card__photo" aria-hidden="true">
        {student.avatar_url ? <img src={student.avatar_url} alt="" /> : '사진없음'}
      </span>

      <span className="emergency-contact-card__body">
        <span className="emergency-contact-card__meta">
          {student.grade}학년 {student.class_num}반 {student.student_num}번
        </span>
        <strong>{student.name || '-'}</strong>
        <span className="emergency-contact-card__phones">
          <span
            className={`emergency-contact-card__phone-row ${
              studentPhone.missing ? 'is-missing' : ''
            }`}
          >
            <span className="emergency-contact-card__phone-label">학생</span>
            <b>{studentPhone.text}</b>
          </span>
          <span
            className={`emergency-contact-card__phone-row ${
              parentPhone.missing ? 'is-missing' : ''
            }`}
          >
            <span className="emergency-contact-card__phone-label">학부모</span>
            <b>{parentPhone.text}</b>
          </span>
        </span>
      </span>
    </button>
  )
}

function EmergencyContacts() {
  const [students, setStudents] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('1')
  const [selectedClass, setSelectedClass] = useState('1')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupCandidates, setLookupCandidates] = useState([])
  const [phoneDrafts, setPhoneDrafts] = useState({
    student_phone: '',
    parent_phone: '',
  })
  const [hasContactColumns, setHasContactColumns] = useState(true)
  const [isLoading, setIsLoading] = useState(hasSupabaseEnv)
  const [savingField, setSavingField] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedClassStudents = useMemo(
    () =>
      sortStudents(
        students.filter(
          (student) =>
            String(student.grade) === selectedGrade &&
            String(student.class_num) === selectedClass,
        ),
      ),
    [selectedClass, selectedGrade, students],
  )
  const selectedStudent = useMemo(
    () =>
      students.find((student) => String(student.id) === selectedStudentId) ??
      null,
    [selectedStudentId, students],
  )
  const pages = useMemo(
    () => chunkRows(selectedClassStudents, CONTACT_PAGE_SIZE),
    [selectedClassStudents],
  )
  const classGroups = useMemo(() => {
    const grouped = new Map()

    students.forEach((student) => {
      const key = `${student.grade}-${student.class_num}`
      const current = grouped.get(key) ?? {
        grade: student.grade,
        classNum: student.class_num,
        rows: [],
      }
      current.rows.push(student)
      grouped.set(key, current)
    })

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        rows: sortStudents(group.rows),
      }))
      .sort((left, right) => {
        const gradeDiff = Number(left.grade) - Number(right.grade)

        if (gradeDiff !== 0) {
          return gradeDiff
        }

        return Number(left.classNum) - Number(right.classNum)
      })
  }, [students])

  async function loadEmergencyContacts({ silent = false } = {}) {
    if (!supabase) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    if (!silent) {
      setStatusMessage('비상연락망 학생 정보를 불러오는 중입니다.')
    }

    const result = await fetchEmergencyStudents()

    if (result.error) {
      setStudents([])
      setErrorMessage(getEmergencyContactErrorMessage(result.error))
      setStatusMessage('비상연락망을 불러오지 못했습니다.')
      setIsLoading(false)
      return
    }

    const nextStudents = sortStudents((result.rows ?? []).map(normalizeStudent))
    setStudents(nextStudents)
    setHasContactColumns(result.hasContactColumns)
    setStatusMessage(
      result.hasContactColumns
        ? `비상연락망 학생 ${nextStudents.length}명을 불러왔습니다.`
        : '연락처 컬럼이 없어 보기 전용으로 불러왔습니다.',
    )
    setErrorMessage(
      result.hasContactColumns
        ? ''
        : getEmergencyContactErrorMessage(result.fallbackError),
    )
    setIsLoading(false)
  }

  const runInitialLoad = useEffectEvent(() => {
    void loadEmergencyContacts({ silent: false })
  })

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      runInitialLoad()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  function clearSelectedEmergencyStudent() {
    setSelectedStudentId('')
    setPhoneDrafts({
      student_phone: '',
      parent_phone: '',
    })
  }

  function handleSelectStudent(student) {
    setSelectedGrade(String(student.grade))
    setSelectedClass(String(student.class_num))
    setSelectedStudentId(String(student.id))
    setLookupCandidates([])
    setPhoneDrafts({
      student_phone: formatPhoneNumber(student.student_phone),
      parent_phone: formatPhoneNumber(student.parent_phone),
    })
    setStatusMessage(
      `${student.grade}학년 ${student.class_num}반 ${student.student_num}번 ${student.name} 학생을 선택했습니다.`,
    )
  }

  function handleFindStudent() {
    const query = lookupQuery.trim()
    setLookupCandidates([])

    if (!query) {
      setStatusMessage('학번 또는 이름을 입력해 주세요.')
      return
    }

    if (/^\d+$/.test(query) && query.length !== 4) {
      setStatusMessage('학번은 4자리로 입력해 주세요.')
      return
    }

    const isSchoolNumberQuery = /^\d{4}$/.test(query)
    const source = isSchoolNumberQuery
      ? students
      : selectedClassStudents.length
        ? selectedClassStudents
        : students
    const candidates = isSchoolNumberQuery
      ? source.filter((student) => createSchoolNumber(student) === query)
      : source.filter((student) => student.name.includes(query))

    if (candidates.length === 0) {
      clearSelectedEmergencyStudent()
      setStatusMessage('일치하는 학생을 찾지 못했습니다.')
      return
    }

    if (candidates.length === 1) {
      handleSelectStudent(candidates[0])
      return
    }

    clearSelectedEmergencyStudent()
    setLookupCandidates(candidates)
    setStatusMessage(`동명이인 ${candidates.length}명이 검색되었습니다.`)
  }

  function handlePhoneDraftChange(fieldName, value) {
    setPhoneDrafts((previous) => ({
      ...previous,
      [fieldName]: value,
    }))
  }

  function handlePhoneDraftBlur(fieldName) {
    setPhoneDrafts((previous) => ({
      ...previous,
      [fieldName]: formatPhoneNumber(previous[fieldName]),
    }))
  }

  async function handleSavePhone(fieldName) {
    if (!selectedStudent || !supabase) {
      setStatusMessage('먼저 학생을 선택해 주세요.')
      return
    }

    if (!hasContactColumns) {
      setStatusMessage(
        '연락처 저장을 하려면 Supabase students 테이블에 연락처 컬럼을 먼저 추가해야 합니다.',
      )
      return
    }

    const nextValue = formatPhoneNumber(phoneDrafts[fieldName])
    const payload = {
      [fieldName]: nextValue,
    }

    setSavingField(fieldName)
    setErrorMessage('')
    setStatusMessage('연락처를 저장하는 중입니다.')

    const { data, error } = await supabase
      .from('students')
      .update(payload)
      .eq('id', selectedStudent.id)
      .select('id, student_phone, parent_phone')
      .single()

    if (error) {
      if (hasMissingContactColumnError(error)) {
        setHasContactColumns(false)
      }

      setErrorMessage(getEmergencyContactErrorMessage(error))
      setStatusMessage('연락처 저장에 실패했습니다.')
      setSavingField('')
      return
    }

    setStudents((previous) =>
      previous.map((student) =>
        student.id === selectedStudent.id
          ? {
              ...student,
              student_phone: formatPhoneNumber(data?.student_phone ?? student.student_phone),
              parent_phone: formatPhoneNumber(data?.parent_phone ?? student.parent_phone),
            }
          : student,
      ),
    )
    setPhoneDrafts((previous) => ({
      ...previous,
      [fieldName]: nextValue,
    }))
    setStatusMessage('연락처를 저장했습니다.')
    setSavingField('')
  }

  function handlePrintSelectedClass() {
    if (!selectedClassStudents.length) {
      setStatusMessage('출력할 학생이 없습니다.')
      return
    }

    const pagesHtml = createContactPagesHtml(
      selectedClassStudents,
      selectedGrade,
      selectedClass,
    )
    const opened = openPrintPopup(
      `${EMERGENCY_CONTACT_TITLE}_${selectedGrade}학년${selectedClass}반`,
      pagesHtml,
    )

    if (!opened) {
      setStatusMessage('팝업 차단을 해제한 뒤 다시 출력해 주세요.')
    }
  }

  function handlePrintAllClasses() {
    if (!classGroups.length) {
      setStatusMessage('출력할 학생이 없습니다.')
      return
    }

    const opened = openPrintPopup(
      `${EMERGENCY_CONTACT_TITLE}_전체`,
      createAllContactPagesHtml(classGroups),
    )

    if (!opened) {
      setStatusMessage('팝업 차단을 해제한 뒤 다시 출력해 주세요.')
    }
  }

  function handleExportExcel() {
    if (!selectedClassStudents.length) {
      setStatusMessage('저장할 학생이 없습니다.')
      return
    }

    const html = buildExcelHtml(
      selectedGrade,
      selectedClass,
      selectedClassStudents,
    )
    downloadExcelFile(
      `${EMERGENCY_CONTACT_TITLE}_${selectedGrade}학년${selectedClass}반.xls`,
      html,
    )
    setStatusMessage('엑셀 파일을 저장했습니다.')
  }

  if (!hasSupabaseEnv) {
    return (
      <section className="empty-card">
        <div className="empty-icon">!</div>
        <h2>비상연락망을 열려면 Supabase 연결이 필요합니다.</h2>
        <p>{getSupabaseEnvHelpMessage()}</p>
      </section>
    )
  }

  return (
    <section className="emergency-contacts-shell">
      <section className="emergency-contacts-toolbar">
        <div>
          <p className="section-label">학교업무</p>
          <h1>비상연락망</h1>
          <p className="emergency-contacts-toolbar__copy">
            학급별 학생 연락처를 확인하고 출력합니다.
          </p>
        </div>

        <div className="emergency-contacts-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadEmergencyContacts({ silent: false })}
            disabled={isLoading}
          >
            {isLoading ? '새로고침 중...' : '학생명단 새로고침'}
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={handleExportExcel}
            disabled={!selectedClassStudents.length}
          >
            엑셀 저장
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={handlePrintAllClasses}
            disabled={!classGroups.length}
          >
            전체 출력
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={handlePrintSelectedClass}
            disabled={!selectedClassStudents.length}
          >
            PDF 출력
          </button>
        </div>
      </section>

      <section className="emergency-contacts-layout">
        <section className="emergency-contacts-preview">
          <div className="emergency-contact-pages">
            {pages.length ? (
              pages.map((pageRows, pageIndex) => (
                <section
                  className="emergency-contact-page"
                  key={`${selectedGrade}-${selectedClass}-${pageIndex}`}
                >
                  <div className="emergency-contacts-paper-head">
                    <div className="emergency-contacts-paper-title-wrap">
                      <img
                        className="emergency-contacts-paper-logo"
                        src={schoolLogoUrl}
                        alt=""
                      />
                      <div>
                        <span>개인정보보호 유의</span>
                        <h2>{EMERGENCY_CONTACT_TITLE}</h2>
                        <p>
                          {selectedGrade}학년 {selectedClass}반 · 학생{' '}
                          {selectedClassStudents.length}명
                        </p>
                      </div>
                    </div>

                    <strong>
                      {selectedGrade}-{selectedClass}
                    </strong>
                  </div>

                  <div className="emergency-contact-card-grid">
                    {pageRows.map((student) => (
                      <EmergencyStudentCard
                        key={student.id}
                        student={student}
                        isSelected={selectedStudentId === String(student.id)}
                        onSelect={handleSelectStudent}
                      />
                    ))}
                  </div>
                  <footer>
                    {pageIndex + 1} / {pages.length}
                  </footer>
                </section>
              ))
            ) : (
              <section className="emergency-contact-empty">
                <strong>
                  {isLoading
                    ? '비상연락망을 불러오는 중입니다.'
                    : '선택한 학급에 표시할 학생이 없습니다.'}
                </strong>
                <p>
                  {isLoading
                    ? '학생 정보와 연락처를 확인하고 있습니다.'
                    : '학년과 반을 다시 선택하거나 학생명단을 새로고침해 주세요.'}
                </p>
              </section>
            )}
          </div>
        </section>

        <aside className="emergency-contacts-panel">
          <section className="emergency-contacts-card">
            <h2>출력 학급</h2>
            <div className="emergency-contacts-class-grid">
              <label className="field">
                <span className="field-label">학년</span>
                <select
                  className="field-input field-select"
                  value={selectedGrade}
                  onChange={(event) => {
                    setSelectedGrade(event.target.value)
                    clearSelectedEmergencyStudent()
                    setLookupCandidates([])
                  }}
                >
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}학년
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">반</span>
                <select
                  className="field-input field-select"
                  value={selectedClass}
                  onChange={(event) => {
                    setSelectedClass(event.target.value)
                    clearSelectedEmergencyStudent()
                    setLookupCandidates([])
                  }}
                >
                  {CLASS_OPTIONS.map((classNum) => (
                    <option key={classNum} value={classNum}>
                      {classNum}반
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="emergency-contacts-stat-grid">
              <article>
                <span>학생 수</span>
                <strong>{selectedClassStudents.length}</strong>
              </article>
              <article>
                <span>출력 페이지</span>
                <strong>{pages.length}</strong>
              </article>
            </div>
          </section>

          <section className="emergency-contacts-card">
            <h2>연락처 수정</h2>
            <div className="emergency-contacts-search">
              <input
                className="field-input"
                type="text"
                value={lookupQuery}
                onChange={(event) => setLookupQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleFindStudent()
                  }
                }}
                placeholder="4자리 학번 또는 이름"
              />
              <button
                className="primary-button"
                type="button"
                onClick={handleFindStudent}
              >
                확인
              </button>
            </div>

            {lookupCandidates.length ? (
              <div className="emergency-contacts-candidates">
                {lookupCandidates.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => handleSelectStudent(student)}
                  >
                    <strong>
                      {createSchoolNumber(student)} {student.name}
                    </strong>
                    <span>
                      {student.grade}학년 {student.class_num}반{' '}
                      {student.student_num}번
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="emergency-contacts-selected">
              <span>선택 학생</span>
              <strong>
                {selectedStudent
                  ? `${createSchoolNumber(selectedStudent)} ${selectedStudent.name}`
                  : '-'}
              </strong>
            </div>

            <div className="emergency-contacts-phone-fields">
              <label className="field">
                <span className="field-label">학생 전화번호</span>
                <div className="emergency-contacts-phone-row">
                  <input
                    className="field-input"
                    type="text"
                    value={phoneDrafts.student_phone}
                    onChange={(event) =>
                      handlePhoneDraftChange('student_phone', event.target.value)
                    }
                    onBlur={() => handlePhoneDraftBlur('student_phone')}
                    placeholder="010-1234-5678"
                    disabled={!selectedStudent || !hasContactColumns}
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void handleSavePhone('student_phone')}
                    disabled={
                      !selectedStudent ||
                      !hasContactColumns ||
                      savingField === 'student_phone'
                    }
                  >
                    {savingField === 'student_phone' ? '저장중...' : '저장'}
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="field-label">학부모 전화번호</span>
                <div className="emergency-contacts-phone-row">
                  <input
                    className="field-input"
                    type="text"
                    value={phoneDrafts.parent_phone}
                    onChange={(event) =>
                      handlePhoneDraftChange('parent_phone', event.target.value)
                    }
                    onBlur={() => handlePhoneDraftBlur('parent_phone')}
                    placeholder="010-1234-5678"
                    disabled={!selectedStudent || !hasContactColumns}
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void handleSavePhone('parent_phone')}
                    disabled={
                      !selectedStudent ||
                      !hasContactColumns ||
                      savingField === 'parent_phone'
                    }
                  >
                    {savingField === 'parent_phone' ? '저장중...' : '저장'}
                  </button>
                </div>
              </label>
            </div>

            <p
              className={`emergency-contacts-status ${
                errorMessage ? 'is-error' : ''
              }`}
              aria-live="polite"
            >
              {errorMessage || statusMessage || '학생을 선택하면 연락처를 수정할 수 있습니다.'}
            </p>
          </section>
        </aside>
      </section>
    </section>
  )
}

export default EmergencyContacts
