import { useEffect, useEffectEvent, useRef, useState } from 'react'
import BatchAvatarUpload from './BatchAvatarUpload.jsx'
import CounselingForm, { CounselingHistoryPanel } from './CounselingForm.jsx'
import Dashboard from './Dashboard.jsx'
import Login from './Login.jsx'
import './App.css'
import {
  getFriendlyAvatarStudentUpdateErrorMessage,
  getFriendlyAvatarUploadErrorMessage,
} from './lib/avatarUploadHelpers'
import {
  getSupabaseEnvHelpMessage,
  hasSupabaseEnv,
  supabase,
} from './lib/supabase'

const PAGE_SIZE = 20
const COUNSELING_COUNT_PAGE_SIZE = 1000
const APP_BUILD_LABEL = 'build 2026-04-21 b1'
const PRODUCTION_SITE_URL = 'https://stubase.pages.dev/'

const CLASS_FILTER_OPTIONS = Array.from({ length: 3 }, (_, gradeIndex) =>
  Array.from({ length: 7 }, (_, classIndex) => ({
    label: `${gradeIndex + 1}-${classIndex + 1}`,
    grade: String(gradeIndex + 1),
    classNum: String(classIndex + 1),
  })),
).flat()

const initialStatusMessage = hasSupabaseEnv
  ? '학생 데이터를 불러오는 중입니다.'
  : getSupabaseEnvHelpMessage()

const initialStudentFormValues = {
  name: '',
  grade: '',
  classNum: '',
  studentNum: '',
}

const AVATAR_THEMES = [
  { background: '#e8f3ff', color: '#3182f6' },
  { background: '#eef7eb', color: '#2f9e44' },
  { background: '#fff1e6', color: '#f08c00' },
  { background: '#f5edff', color: '#845ef7' },
  { background: '#e9f7f7', color: '#0f9c9c' },
  { background: '#fff0f6', color: '#d6336c' },
]

function formatSchoolNumber(student) {
  return `${student.grade}${student.class_num}${String(student.student_num).padStart(2, '0')}`
}

function groupStudentsBySchoolPrefix(students) {
  return students.reduce((groups, student) => {
    const schoolNumber = formatSchoolNumber(student)
    const groupKey = schoolNumber.slice(0, 2)
    const lastGroup = groups.at(-1)

    if (!lastGroup || lastGroup.key !== groupKey) {
      groups.push({
        key: groupKey,
        students: [student],
      })
      return groups
    }

    lastGroup.students.push(student)
    return groups
  }, [])
}

function getStudentInitial(student) {
  return String(student?.name ?? '?').trim().slice(0, 1) || '?'
}

function getStudentAvatarUrl(student) {
  return String(student?.avatar_url ?? '').trim()
}

function getStudentAvatarTheme(student) {
  const seed = String(student?.name ?? '')
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0)

  return AVATAR_THEMES[seed % AVATAR_THEMES.length]
}

function createAvatarStoragePath(studentId, fileName, authId) {
  const fileExtension =
    fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const uniqueToken =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`

  return `${authId}/students/${studentId}/${uniqueToken}.${fileExtension}`
}

function withAvatarCacheBust(url) {
  if (!url) {
    return ''
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Date.now()}`
}

function verifyImageSource(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })
}

function normalizeSearchKeyword(value) {
  return String(value ?? '')
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
}

function getAuthRedirectUrl() {
  if (typeof window === 'undefined') {
    return PRODUCTION_SITE_URL
  }

  const { hostname, origin } = window.location

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return `${origin}/`
  }

  if (hostname === 'stubase.pages.dev') {
    return `${origin}/`
  }

  if (hostname.endsWith('.stubase.pages.dev')) {
    return PRODUCTION_SITE_URL
  }

  return `${origin}/`
}

function parseSchoolNumberKeyword(value) {
  const normalizedValue = String(value ?? '').replace(/\s+/g, '')

  if (!/^\d{4}$/.test(normalizedValue)) {
    return null
  }

  const grade = Number(normalizedValue.slice(0, 1))
  const classNum = Number(normalizedValue.slice(1, 2))
  const studentNum = Number(normalizedValue.slice(2, 4))

  if (!grade || !classNum || !studentNum) {
    return null
  }

  return {
    grade,
    classNum,
    studentNum,
  }
}

function validateStudentForm(values) {
  const errors = {}
  const trimmedName = values.name.trim()

  if (!trimmedName) {
    errors.name = '이름을 입력해 주세요.'
  } else if (trimmedName.length > 20) {
    errors.name = '이름은 20자 이하로 입력해 주세요.'
  }

  const numberFields = [
    ['grade', '학년'],
    ['classNum', '반'],
    ['studentNum', '번호'],
  ]

  const parsedNumbers = {}

  numberFields.forEach(([key, label]) => {
    const rawValue = values[key].trim()

    if (!rawValue) {
      errors[key] = `${label}을 입력해 주세요.`
      return
    }

    if (!/^\d+$/.test(rawValue)) {
      errors[key] = `${label}은 숫자로만 입력해 주세요.`
      return
    }

    const parsedValue = Number(rawValue)

    if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 99) {
      errors[key] = `${label}은 1부터 99 사이 숫자로 입력해 주세요.`
      return
    }

    parsedNumbers[key] = parsedValue
  })

  return {
    errors,
    payload:
      Object.keys(errors).length > 0
        ? null
        : {
            name: trimmedName,
            grade: parsedNumbers.grade,
            class_num: parsedNumbers.classNum,
            student_num: parsedNumbers.studentNum,
          },
  }
}

function createDuplicateErrorMessage(payload) {
  return `${payload.grade}학년 ${payload.class_num}반 ${payload.student_num}번 학생이 이미 등록되어 있습니다.`
}

function getFriendlySupabaseErrorMessage(action, error) {
  const rawMessage = error?.message ?? ''

  if (
    rawMessage.includes('relation') &&
    rawMessage.includes('counseling_records')
  ) {
    return '상담 기록 테이블이 아직 없습니다. Supabase SQL Editor에서 먼저 생성해 주세요.'
  }

  if (rawMessage.includes('row-level security policy')) {
    if (action === 'delete') {
      return '삭제 권한 정책이 아직 없습니다. Supabase SQL Editor에서 delete policy를 추가해 주세요.'
    }

    if (action === 'update') {
      return '수정 권한 정책이 아직 없습니다. Supabase SQL Editor에서 update policy를 추가해 주세요.'
    }

    if (action === 'insert') {
      return '추가 권한 정책이 아직 없습니다. Supabase SQL Editor에서 insert policy를 추가해 주세요.'
    }

    if (action === 'select') {
      return '조회 권한 정책이 아직 없습니다. Supabase SQL Editor에서 authenticated 사용자용 select policy를 추가해 주세요.'
    }
  }

  return rawMessage || '처리 중 오류가 발생했습니다.'
}

function getFriendlyAuthErrorMessage(error) {
  const rawMessage = error?.message ?? ''

  if (rawMessage.includes('provider is not enabled')) {
    return 'Supabase Authentication에서 Google provider를 먼저 활성화해 주세요.'
  }

  if (rawMessage.includes('Unsupported provider')) {
    return 'Google 로그인 설정이 아직 완료되지 않았습니다.'
  }

  if (rawMessage.includes('redirect')) {
    return 'Supabase의 Redirect URL 설정을 확인해 주세요.'
  }

  return rawMessage || '로그인 처리 중 오류가 발생했습니다.'
}

function getUserDisplayName(user) {
  const metadata = user?.user_metadata ?? {}
  return (
    metadata.full_name?.trim() ||
    metadata.name?.trim() ||
    user?.email?.split('@')[0] ||
    '사용자'
  )
}

function getUserAvatarUrl(user) {
  const metadata = user?.user_metadata ?? {}
  return metadata.avatar_url?.trim() || metadata.picture?.trim() || ''
}

function getUserInitial(user) {
  return getUserDisplayName(user).slice(0, 1)
}

function App() {
  const [authUser, setAuthUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseEnv)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState('')

  const [activeView, setActiveView] = useState('home')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [statusMessage, setStatusMessage] = useState(initialStatusMessage)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMoreStudents, setIsLoadingMoreStudents] = useState(false)
  const [hasMoreStudents, setHasMoreStudents] = useState(false)
  const [totalStudentCount, setTotalStudentCount] = useState(0)
  const [isCreatingTest, setIsCreatingTest] = useState(false)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarPreviewUrls, setAvatarPreviewUrls] = useState({})
  const [avatarLoadFailures, setAvatarLoadFailures] = useState({})
  const [deletingStudentId, setDeletingStudentId] = useState(null)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [formValues, setFormValues] = useState(initialStudentFormValues)
  const [formErrors, setFormErrors] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [counselingRefreshKey, setCounselingRefreshKey] = useState(0)
  const [counselingCountMap, setCounselingCountMap] = useState({})
  const [expandedCounselingRecordId, setExpandedCounselingRecordId] =
    useState(null)

  const authUserId = authUser?.id ?? ''
  const selectedStudentId = selectedStudent?.id ?? null
  const isStudentWorkspaceView =
    activeView === 'home' ||
    activeView === 'counseling' ||
    activeView === 'student-create' ||
    activeView === 'photo-matching'
  const nextRangeStartRef = useRef(0)
  const latestRequestIdRef = useRef(0)
  const counselingCountRequestIdRef = useRef(0)
  const loadMoreSentinelRef = useRef(null)
  const studentGridScrollRef = useRef(null)
  const detailColumnRef = useRef(null)
  const managementMenuCloseTimeoutRef = useRef(null)
  const pageRef = useRef(null)
  const appHeaderRef = useRef(null)
  const studentDiscoveryRef = useRef(null)
  const avatarFileInputRef = useRef(null)
  const avatarObjectUrlsRef = useRef({})
  const [isCounselingShortcutPending, setIsCounselingShortcutPending] =
    useState(false)
  const [isManagementMenuOpen, setIsManagementMenuOpen] = useState(false)

  function resetStudentForm() {
    setFormValues(initialStudentFormValues)
    setFormErrors({})
    setEditingStudentId(null)
  }

  function clearSelectedStudent() {
    setSelectedStudent(null)
  }

  function handleOpenHomeView() {
    setActiveView('home')
    setIsCounselingShortcutPending(false)
    setIsManagementMenuOpen(false)
  }

  function handleOpenCounselingView() {
    const nextStudent = selectedStudent ?? students[0] ?? null

    setActiveView('counseling')
    setIsManagementMenuOpen(false)
    setExpandedCounselingRecordId(null)

    if (nextStudent) {
      setSelectedStudent(nextStudent)
      setCounselingRefreshKey(0)
      setStatusMessage(`${nextStudent.name} 학생의 상담 화면을 열었습니다.`)
    }

    setIsCounselingShortcutPending(true)
  }

  function handleOpenDashboardView() {
    setActiveView('dashboard')
    setIsCounselingShortcutPending(false)
    setIsManagementMenuOpen(false)
  }

  function handleOpenStudentFormView() {
    setActiveView('student-create')
    setIsCounselingShortcutPending(false)
    setIsManagementMenuOpen(false)
  }

  function handleOpenBatchUploadView() {
    setActiveView('photo-matching')
    setIsCounselingShortcutPending(false)
    setIsManagementMenuOpen(false)
  }

  function clearManagementMenuCloseTimeout() {
    if (managementMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(managementMenuCloseTimeoutRef.current)
      managementMenuCloseTimeoutRef.current = null
    }
  }

  function openManagementMenu() {
    clearManagementMenuCloseTimeout()
    setIsManagementMenuOpen(true)
  }

  function closeManagementMenu() {
    clearManagementMenuCloseTimeout()
    setIsManagementMenuOpen(false)
  }

  function scheduleCloseManagementMenu() {
    clearManagementMenuCloseTimeout()
    managementMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsManagementMenuOpen(false)
      managementMenuCloseTimeoutRef.current = null
    }, 260)
  }

  function handleManagementMenuBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return
    }

    scheduleCloseManagementMenu()
  }

  const resetProtectedState = useEffectEvent(() => {
    Object.values(avatarObjectUrlsRef.current).forEach((url) => {
      URL.revokeObjectURL(url)
    })
    avatarObjectUrlsRef.current = {}

    latestRequestIdRef.current += 1
    nextRangeStartRef.current = 0

    setActiveView('home')
    setStudents([])
    setSelectedStudent(null)
    setStatusMessage(initialStatusMessage)
    setErrorMessage('')
    setIsLoading(false)
    setIsRefreshing(false)
    setIsLoadingMoreStudents(false)
    setHasMoreStudents(false)
    setTotalStudentCount(0)
    setIsCreatingTest(false)
    setIsSubmittingForm(false)
    setIsUploadingAvatar(false)
    setAvatarPreviewUrls({})
    setAvatarLoadFailures({})
    setDeletingStudentId(null)
    setEditingStudentId(null)
    setFormValues(initialStudentFormValues)
    setFormErrors({})
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setSelectedGrade('')
    setSelectedClass('')
    setCounselingRefreshKey(0)
    setCounselingCountMap({})
  })

  function buildStudentQuery(searchKeyword, gradeValue, classValue) {
    let query = supabase
      .from('students')
      .select('id, name, grade, class_num, student_num, avatar_url', {
        count: 'exact',
      })
      .order('grade', { ascending: true })
      .order('class_num', { ascending: true })
      .order('student_num', { ascending: true })

    if (gradeValue) {
      query = query.eq('grade', Number(gradeValue))
    }

    if (gradeValue && classValue) {
      query = query.eq('class_num', Number(classValue))
    }

    if (searchKeyword) {
      const orFilters = [`name.ilike.%${searchKeyword}%`]
      const parsedSchoolNumber = parseSchoolNumberKeyword(searchKeyword)

      if (parsedSchoolNumber) {
        orFilters.push(
          `and(grade.eq.${parsedSchoolNumber.grade},class_num.eq.${parsedSchoolNumber.classNum},student_num.eq.${parsedSchoolNumber.studentNum})`,
        )
      } else if (/^\d+$/.test(searchKeyword)) {
        const numericKeyword = Number(searchKeyword)

        if (numericKeyword >= 1 && numericKeyword <= 99) {
          orFilters.push(`student_num.eq.${numericKeyword}`)
        }
      }

      query = query.or(orFilters.join(','))
    }

    return query
  }

  async function findDuplicateStudent(payload, excludeStudentId = null) {
    if (!supabase || !authUserId) {
      return null
    }

    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('grade', payload.grade)
      .eq('class_num', payload.class_num)
      .eq('student_num', payload.student_num)
      .limit(5)

    if (error) {
      throw error
    }

    return (data ?? []).find((student) => student.id !== excludeStudentId) ?? null
  }

  async function loadStudents(options = {}) {
    const { reset = false, showRefreshState = false } = options

    if (!supabase || !authUserId) {
      return
    }

    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    const keyword = normalizeSearchKeyword(debouncedSearchTerm)
    const gradeValue = selectedGrade
    const classValue = selectedClass
    const hasQueryFilters = Boolean(keyword || gradeValue || classValue)
    const from = reset ? 0 : nextRangeStartRef.current
    const to = from + PAGE_SIZE - 1

    if (reset) {
      if (showRefreshState) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setStatusMessage(
        hasQueryFilters
          ? '검색 결과를 불러오는 중입니다.'
          : 'students 테이블을 불러오는 중입니다.',
      )
    } else {
      setIsLoadingMoreStudents(true)
      setStatusMessage('학생 목록을 더 불러오는 중입니다.')
    }

    setErrorMessage('')

    const { data, error, count } = await buildStudentQuery(
      keyword,
      gradeValue,
      classValue,
    ).range(from, to)

    if (requestId !== latestRequestIdRef.current) {
      return
    }

    if (error) {
      if (reset) {
        setStudents([])
        nextRangeStartRef.current = 0
        setTotalStudentCount(0)
        setHasMoreStudents(false)
      }

      setErrorMessage(getFriendlySupabaseErrorMessage('select', error))
      setStatusMessage('학생 목록을 불러오지 못했습니다.')
      setIsLoading(false)
      setIsRefreshing(false)
      setIsLoadingMoreStudents(false)
      return
    }

    const nextChunk = data ?? []
    const nextTotalCount = count ?? nextChunk.length
    const nextLoadedCount = from + nextChunk.length

    nextRangeStartRef.current = nextLoadedCount
    setTotalStudentCount(nextTotalCount)
    setHasMoreStudents(nextLoadedCount < nextTotalCount)

    setStudents((previous) => {
      if (reset) {
        return nextChunk
      }

      const previousIds = new Set(previous.map((student) => student.id))
      const mergedChunk = nextChunk.filter((student) => !previousIds.has(student.id))

      return [...previous, ...mergedChunk]
    })

    if (!nextTotalCount) {
      setStatusMessage(
        hasQueryFilters
          ? '조건에 맞는 학생이 없습니다.'
          : '등록된 학생이 아직 없습니다.',
      )
    } else {
      setStatusMessage(
        hasQueryFilters
          ? `검색 결과 ${nextTotalCount}명 중 ${nextLoadedCount}명을 표시하고 있습니다.`
          : `전체 학생 ${nextTotalCount}명 중 ${nextLoadedCount}명을 표시하고 있습니다.`,
      )
    }

    setIsLoading(false)
    setIsRefreshing(false)
    setIsLoadingMoreStudents(false)
  }

  async function handleGoogleSignIn() {
    if (!supabase) {
      setAuthErrorMessage(getSupabaseEnvHelpMessage())
      return
    }

    setIsSigningIn(true)
    setAuthErrorMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      setAuthErrorMessage(getFriendlyAuthErrorMessage(error))
      setIsSigningIn(false)
      return
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    setIsSigningOut(true)
    setErrorMessage('')
    setStatusMessage('로그아웃하는 중입니다.')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage(getFriendlyAuthErrorMessage(error))
      setStatusMessage('로그아웃에 실패했습니다.')
      setIsSigningOut(false)
      return
    }
  }

  async function handleAddTestStudent() {
    if (!supabase || !authUserId) {
      return
    }

    setIsCreatingTest(true)
    setErrorMessage('')
    setStatusMessage('테스트 학생을 추가하는 중입니다.')

    const { data: latestStudentRows, error: latestStudentError } = await supabase
      .from('students')
      .select('student_num')
      .eq('grade', 1)
      .eq('class_num', 1)
      .order('student_num', { ascending: false })
      .limit(1)

    if (latestStudentError) {
      setErrorMessage(getFriendlySupabaseErrorMessage('insert', latestStudentError))
      setStatusMessage('테스트 학생 번호를 계산하지 못했습니다.')
      setIsCreatingTest(false)
      return
    }

    const nextStudentNumber = (latestStudentRows?.[0]?.student_num ?? 0) + 1

    const payload = {
      name: `테스트 학생 ${nextStudentNumber}`,
      grade: 1,
      class_num: 1,
      student_num: nextStudentNumber,
    }

    const { error } = await supabase.from('students').insert(payload)

    if (error) {
      setErrorMessage(getFriendlySupabaseErrorMessage('insert', error))
      setStatusMessage('테스트 학생 추가에 실패했습니다.')
      setIsCreatingTest(false)
      return
    }

    setStatusMessage('테스트 학생이 추가되었습니다.')
    setIsCreatingTest(false)
    await loadStudents({ reset: true, showRefreshState: true })
  }

  function handleSelectStudent(student, sourceView = activeView) {
    setSelectedStudent(student)
    setCounselingRefreshKey(0)
    setExpandedCounselingRecordId(null)
    setStatusMessage(
      sourceView === 'counseling'
        ? `${student.name} 학생의 상담 화면을 열었습니다.`
        : `${student.name} 학생을 선택했습니다.`,
    )
  }

  function handleOpenCounselingRecordFromHome(record) {
    if (!previewStudent) {
      return
    }

    setSelectedStudent(previewStudent)
    setExpandedCounselingRecordId(record.id)
    setActiveView('counseling')
    setIsManagementMenuOpen(false)
    setIsCounselingShortcutPending(true)
    setStatusMessage(`${previewStudent.name} 학생의 상담 기록을 열었습니다.`)
  }

  function handleCounselingSaveSuccess(studentName) {
    setCounselingRefreshKey((previous) => previous + 1)
    setStatusMessage(`${studentName} 학생의 상담 기록을 저장했습니다.`)
  }

  function updateStudentAvatarState(studentId, avatarUrl) {
    setStudents((previous) =>
      previous.map((student) =>
        student.id === studentId ? { ...student, avatar_url: avatarUrl } : student,
      ),
    )

    setSelectedStudent((previous) =>
      previous && previous.id === studentId
        ? { ...previous, avatar_url: avatarUrl }
        : previous,
    )
  }

  function setAvatarPreviewForStudent(studentId, nextPreviewUrl) {
    const previousPreviewUrl = avatarObjectUrlsRef.current[studentId]

    if (previousPreviewUrl && previousPreviewUrl !== nextPreviewUrl) {
      URL.revokeObjectURL(previousPreviewUrl)
    }

    if (nextPreviewUrl) {
      avatarObjectUrlsRef.current[studentId] = nextPreviewUrl
    } else {
      delete avatarObjectUrlsRef.current[studentId]
    }

    setAvatarPreviewUrls((previous) => {
      const next = { ...previous }

      if (nextPreviewUrl) {
        next[studentId] = nextPreviewUrl
      } else {
        delete next[studentId]
      }

      return next
    })
  }

  function setAvatarLoadFailed(studentId, hasFailed) {
    setAvatarLoadFailures((previous) => {
      const next = { ...previous }

      if (hasFailed) {
        next[studentId] = true
      } else {
        delete next[studentId]
      }

      return next
    })
  }

  function getDisplayedStudentAvatarSrc(student) {
    const previewUrl = avatarPreviewUrls[student.id]

    if (previewUrl) {
      return previewUrl
    }

    if (avatarLoadFailures[student.id]) {
      return ''
    }

    return getStudentAvatarUrl(student)
  }

  function openAvatarFilePicker() {
    if (!selectedStudent || isUploadingAvatar) {
      return
    }

    avatarFileInputRef.current?.click()
  }

  async function handleStudentAvatarChange(event) {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile || !selectedStudent || !supabase || !authUserId) {
      return
    }

    if (!selectedFile.type.startsWith('image/')) {
      setErrorMessage('이미지 파일만 업로드할 수 있습니다.')
      setStatusMessage('프로필 사진 업로드 형식을 확인해 주세요.')
      return
    }

    setIsUploadingAvatar(true)
    setErrorMessage('')
    setStatusMessage(`${selectedStudent.name} 학생의 프로필 사진을 업로드하는 중입니다.`)
    setAvatarLoadFailed(selectedStudent.id, false)

    const localPreviewUrl = URL.createObjectURL(selectedFile)
    setAvatarPreviewForStudent(selectedStudent.id, localPreviewUrl)

    const storagePath = createAvatarStoragePath(
      selectedStudent.id,
      selectedFile.name,
      authUserId,
    )

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, selectedFile, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      setErrorMessage(getFriendlyAvatarUploadErrorMessage(uploadError))
      setStatusMessage('프로필 사진 업로드에 실패했습니다.')
      setIsUploadingAvatar(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(storagePath)

    const { error: updateError } = await supabase
      .from('students')
      .update({ avatar_url: publicUrl })
      .eq('id', selectedStudent.id)

    if (updateError) {
      setErrorMessage(getFriendlyAvatarStudentUpdateErrorMessage(updateError))
      setStatusMessage('사진 URL 업데이트에 실패했습니다.')
      setIsUploadingAvatar(false)
      return
    }

    const displayAvatarUrl = withAvatarCacheBust(publicUrl)
    updateStudentAvatarState(selectedStudent.id, displayAvatarUrl)

    const isPublicImageReady = await verifyImageSource(displayAvatarUrl)

    if (isPublicImageReady) {
      setAvatarPreviewForStudent(selectedStudent.id, '')
    } else {
      setErrorMessage(
        '사진은 업로드되었지만 공개 이미지 응답이 아직 보이지 않습니다. avatars 버킷이 Public인지 확인해 주세요.',
      )
      setStatusMessage('프로필 사진 업로드는 완료되었지만 표시 확인이 필요합니다.')
    }

    if (isPublicImageReady) {
      setStatusMessage(`${selectedStudent.name} 학생의 프로필 사진이 업데이트되었습니다.`)
    }

    setIsUploadingAvatar(false)
  }

  function _handleEditStudent(student) {
    setActiveView('student-create')
    setIsCounselingShortcutPending(false)
    setIsManagementMenuOpen(false)
    setEditingStudentId(student.id)
    setErrorMessage('')
    setFormErrors({})
    setFormValues({
      name: student.name ?? '',
      grade: String(student.grade ?? ''),
      classNum: String(student.class_num ?? ''),
      studentNum: String(student.student_num ?? ''),
    })
    setStatusMessage(`${student.name} 학생 정보를 수정하는 중입니다.`)
  }

  async function _handleDeleteStudent(student) {
    if (!supabase || !authUserId) {
      return
    }

    const shouldDelete = window.confirm(
      `${student.name} 학생을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    )

    if (!shouldDelete) {
      return
    }

    setDeletingStudentId(student.id)
    setErrorMessage('')
    setStatusMessage(`${student.name} 학생을 삭제하는 중입니다.`)

    const { error } = await supabase.from('students').delete().eq('id', student.id)

    if (error) {
      setErrorMessage(getFriendlySupabaseErrorMessage('delete', error))
      setStatusMessage('학생 삭제 권한을 확인해 주세요.')
      setDeletingStudentId(null)
      return
    }

    if (editingStudentId === student.id) {
      resetStudentForm()
    }

    if (selectedStudentId === student.id) {
      clearSelectedStudent()
    }

    setDeletingStudentId(null)
    setStatusMessage(`${student.name} 학생을 삭제했습니다.`)
    await loadStudents({ reset: true, showRefreshState: true })
  }

  function handleStudentInputChange(event) {
    const { name, value } = event.target

    setFormValues((previous) => ({
      ...previous,
      [name]: value,
    }))

    setFormErrors((previous) => {
      if (!previous[name]) {
        return previous
      }

      return {
        ...previous,
        [name]: '',
      }
    })
  }

  function handleSearchTermChange(event) {
    setSearchTerm(event.target.value)
    clearSelectedStudent()
  }

  function handleClassChipClick(nextGrade, nextClass) {
    const shouldReset =
      selectedGrade === nextGrade && selectedClass === nextClass

    setSelectedGrade(shouldReset ? '' : nextGrade)
    setSelectedClass(shouldReset ? '' : nextClass)
    clearSelectedStudent()
  }

  async function handleSubmitStudent(event) {
    event.preventDefault()

    if (!supabase || !authUserId) {
      return
    }

    const validation = validateStudentForm(formValues)
    setFormErrors(validation.errors)

    if (!validation.payload) {
      setErrorMessage('')
      setStatusMessage('학생 입력값을 확인해 주세요.')
      return
    }

    let duplicateStudent = null

    try {
      duplicateStudent = await findDuplicateStudent(
        validation.payload,
        editingStudentId,
      )
    } catch (duplicateLookupError) {
      setErrorMessage(
        getFriendlySupabaseErrorMessage(
          editingStudentId ? 'update' : 'insert',
          duplicateLookupError,
        ),
      )
      setStatusMessage('중복 학생 여부를 확인하지 못했습니다.')
      return
    }

    if (duplicateStudent) {
      setFormErrors({
        studentNum: createDuplicateErrorMessage(validation.payload),
      })
      setErrorMessage('')
      setStatusMessage('중복된 학년, 반, 번호 조합인지 확인해 주세요.')
      return
    }

    const editingTargetId = editingStudentId

    setIsSubmittingForm(true)
    setErrorMessage('')
    setStatusMessage(
      editingTargetId
        ? `${validation.payload.name} 학생 정보를 수정하는 중입니다.`
        : `${validation.payload.name} 학생을 추가하는 중입니다.`,
    )

    const query = editingTargetId
      ? supabase
          .from('students')
          .update(validation.payload)
          .eq('id', editingTargetId)
      : supabase.from('students').insert(validation.payload)

    const { error } = await query

    if (error) {
      setErrorMessage(
        getFriendlySupabaseErrorMessage(
          editingTargetId ? 'update' : 'insert',
          error,
        ),
      )
      setStatusMessage(
        editingTargetId
          ? '학생 수정에 실패했습니다.'
          : '학생 추가에 실패했습니다.',
      )
      setIsSubmittingForm(false)
      return
    }

    const successStudentName = validation.payload.name

    if (editingTargetId && selectedStudentId === editingTargetId) {
      setSelectedStudent((previous) =>
        previous && previous.id === editingTargetId
          ? { ...previous, ...validation.payload }
          : previous,
      )
    }

    resetStudentForm()
    setStatusMessage(
      editingTargetId
        ? `${successStudentName} 학생 정보를 수정했습니다.`
        : `${successStudentName} 학생을 추가했습니다.`,
    )
    setIsSubmittingForm(false)
    await loadStudents({ reset: true, showRefreshState: true })
  }

  useEffect(() => {
    const pageElement = pageRef.current
    if (!pageElement) {
      return
    }

    let animationFrameId = 0

    const syncStickyHeights = () => {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = window.requestAnimationFrame(() => {
        const nextHeaderHeight = Math.ceil(
          appHeaderRef.current?.getBoundingClientRect().height ?? 88,
        )
        const nextDiscoveryHeight = Math.ceil(
          studentDiscoveryRef.current?.getBoundingClientRect().height ?? 0,
        )

        pageElement.style.setProperty('--sticky-header-height', `${nextHeaderHeight}px`)
        pageElement.style.setProperty(
          '--sticky-discovery-height',
          `${nextDiscoveryHeight}px`,
        )
      })
    }

    syncStickyHeights()
    window.addEventListener('resize', syncStickyHeights)

    if (typeof window.ResizeObserver !== 'function') {
      return () => {
        window.cancelAnimationFrame(animationFrameId)
        window.removeEventListener('resize', syncStickyHeights)
      }
    }

    const resizeObserver = new window.ResizeObserver(() => {
      syncStickyHeights()
    })

    if (appHeaderRef.current) {
      resizeObserver.observe(appHeaderRef.current)
    }

    if (studentDiscoveryRef.current) {
      resizeObserver.observe(studentDiscoveryRef.current)
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', syncStickyHeights)
      resizeObserver.disconnect()
    }
  }, [activeView, selectedGrade])

  useEffect(() => {
    return () => {
      clearManagementMenuCloseTimeout()
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 320)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    function applyNextSession(nextSession) {
      if (!isMounted) {
        return
      }

      const nextUser = nextSession?.user ?? null

      setAuthUser(nextUser)
      setIsAuthLoading(false)
      setIsSigningIn(false)
      setIsSigningOut(false)

      if (!nextUser) {
        setAuthErrorMessage('')
        resetProtectedState()
        return
      }

      setAuthErrorMessage('')
      setStatusMessage('학생 데이터를 불러오는 중입니다.')
    }

    void (async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (error) {
        setAuthErrorMessage(getFriendlyAuthErrorMessage(error))
        setIsAuthLoading(false)
        resetProtectedState()
        return
      }

      applyNextSession(data.session ?? null)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applyNextSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(avatarObjectUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [])

  const runStudentQueryReset = useEffectEvent(() => {
    void loadStudents({ reset: true })
  })

  const runStudentLoadMore = useEffectEvent(() => {
    if (
      !hasSupabaseEnv ||
      !authUserId ||
      !isStudentWorkspaceView ||
      isLoading ||
      isRefreshing ||
      isLoadingMoreStudents ||
      !hasMoreStudents
    ) {
      return
    }

    void loadStudents({ reset: false })
  })

  useEffect(() => {
    if (!hasSupabaseEnv || !authUserId || !isStudentWorkspaceView) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      runStudentQueryReset()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    debouncedSearchTerm,
    selectedGrade,
    selectedClass,
    activeView,
    authUserId,
    isStudentWorkspaceView,
  ])

  useEffect(() => {
    if (!authUserId || !isStudentWorkspaceView) {
      return
    }

    const target = loadMoreSentinelRef.current

    if (!target) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          runStudentLoadMore()
        }
      },
      {
        root: studentGridScrollRef.current,
        rootMargin: '240px 0px',
      },
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [
    activeView,
    authUserId,
    hasMoreStudents,
    isLoading,
    isRefreshing,
    isLoadingMoreStudents,
    isStudentWorkspaceView,
  ])

  useEffect(() => {
    if (activeView !== 'counseling' || !isCounselingShortcutPending) {
      return
    }

    let frameId = 0
    let nestedFrameId = 0

    frameId = window.requestAnimationFrame(() => {
      nestedFrameId = window.requestAnimationFrame(() => {
        detailColumnRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        })
        setIsCounselingShortcutPending(false)
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(nestedFrameId)
    }
  }, [activeView, isCounselingShortcutPending])

  useEffect(() => {
    if (!supabase || !authUserId || !isStudentWorkspaceView || !students.length) {
      const timeoutId = window.setTimeout(() => {
        setCounselingCountMap({})
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    let isMounted = true
    const requestId = counselingCountRequestIdRef.current + 1
    counselingCountRequestIdRef.current = requestId

    const studentIds = students.map((student) => student.id).filter(Boolean)
    const chunkSize = 200

    void (async () => {
      const nextCountMap = {}

      for (let index = 0; index < studentIds.length; index += chunkSize) {
        const chunk = studentIds.slice(index, index + chunkSize)
        let rangeStart = 0

        while (true) {
          const { data, error } = await supabase
            .from('counseling_records')
            .select('student_id')
            .in('student_id', chunk)
            .range(
              rangeStart,
              rangeStart + COUNSELING_COUNT_PAGE_SIZE - 1,
            )

          if (!isMounted || requestId !== counselingCountRequestIdRef.current) {
            return
          }

          if (error) {
            setCounselingCountMap({})
            return
          }

          const nextRecords = data ?? []

          for (const record of nextRecords) {
            const studentId = record.student_id
            if (!studentId) {
              continue
            }

            nextCountMap[studentId] = (nextCountMap[studentId] ?? 0) + 1
          }

          if (nextRecords.length < COUNSELING_COUNT_PAGE_SIZE) {
            break
          }

          rangeStart += COUNSELING_COUNT_PAGE_SIZE
        }
      }

      if (!isMounted || requestId !== counselingCountRequestIdRef.current) {
        return
      }

      setCounselingCountMap(nextCountMap)
    })()

    return () => {
      isMounted = false
    }
  }, [authUserId, isStudentWorkspaceView, students])

  const hasVisibleStudents = students.length > 0
  const isEditing = editingStudentId !== null
  const isBusy =
    isLoading ||
    isRefreshing ||
    isCreatingTest ||
    isSubmittingForm ||
    isUploadingAvatar ||
    isSigningOut ||
    deletingStudentId !== null
  const hasActiveFilters = Boolean(
    searchTerm.trim() || selectedGrade || selectedClass,
  )
  const isCounselingView = activeView === 'counseling'
  const visibleSelectedStudent =
    students.find((student) => student.id === selectedStudentId) ?? null
  const previewStudent = visibleSelectedStudent
  const previewStudentCounselingCount = previewStudent
    ? counselingCountMap[previewStudent.id] ?? 0
    : 0
  const groupedStudents = groupStudentsBySchoolPrefix(students)

  const studentListSection = hasVisibleStudents ? (
    <section
      className={`list-card list-card--student-grid ${
        isCounselingView ? 'list-card--counseling' : 'list-card--home'
      }`}
    >
      <div className="card-header card-header--student-list">
        <div>
          <h2>학생 목록</h2>
        </div>
        <span className="card-count">
          {students.length}/{totalStudentCount}명
        </span>
      </div>

      <div
        className={`student-grid ${
          isCounselingView ? 'student-grid--counseling' : 'student-grid--home'
        }`}
        ref={studentGridScrollRef}
      >
        <div className="student-grid__groups">
          {groupedStudents.map((group) => (
            <ul
              className={`student-grid__list ${
                isCounselingView
                  ? 'student-grid__list--counseling'
                  : 'student-grid__list--home'
              }`}
              key={group.key}
            >
              {group.students.map((student) => (
                <li
                  className={`student-grid__item student-grid__item--grade-${student.grade} ${
                    isCounselingView
                      ? 'student-grid__item--counseling'
                      : 'student-grid__item--home'
                  } ${selectedStudentId === student.id ? 'is-selected' : ''}`}
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectStudent(student)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelectStudent(student)
                    }
                  }}
                >
                  <div
                    className={`student-avatar student-grid__avatar ${
                      isCounselingView ? 'student-grid__avatar--counseling' : ''
                    }`}
                  >
                    {getDisplayedStudentAvatarSrc(student) ? (
                      <img
                        src={getDisplayedStudentAvatarSrc(student)}
                        alt=""
                        loading="lazy"
                        onError={() => setAvatarLoadFailed(student.id, true)}
                      />
                    ) : (
                      <span
                        style={{
                          backgroundColor: getStudentAvatarTheme(student).background,
                          color: getStudentAvatarTheme(student).color,
                        }}
                      >
                        {getStudentInitial(student)}
                      </span>
                    )}
                  </div>

                  <div
                    className={`student-grid__content ${
                      isCounselingView ? 'student-grid__content--counseling' : ''
                    }`}
                  >
                    <div
                      className={`student-grid__identity ${
                        isCounselingView ? 'student-grid__identity--counseling' : ''
                      }`}
                    >
                      <p className="student-grid__school-number">
                        {formatSchoolNumber(student)}
                      </p>
                      <strong className="student-grid__name">{student.name}</strong>
                    </div>
                    <span className="student-grid__count">
                      상담 {counselingCountMap[student.id] ?? 0}회
                    </span>
                  </div>

                </li>
              ))}
            </ul>
          ))}
          {isLoadingMoreStudents ? (
            <div className="infinite-status">다음 20명의 학생을 불러오는 중입니다.</div>
          ) : null}

          {hasMoreStudents ? (
            <div className="infinite-sentinel" ref={loadMoreSentinelRef}>
              <span>스크롤을 아래로 내리면 다음 학생을 자동으로 불러옵니다.</span>
            </div>
          ) : null}

          {!hasMoreStudents && totalStudentCount > PAGE_SIZE ? (
            <div className="infinite-status is-complete">
              현재 조건의 학생을 모두 불러왔습니다.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  ) : null

  const homeHistoryPreviewSection = (
    <div className="home-history-card">
      <CounselingHistoryPanel
        studentId={previewStudent?.id ?? null}
        studentName={previewStudent?.name ?? '학생'}
        refreshKey={counselingRefreshKey}
        eyebrow=""
        title="상담 내역"
        showCountBadge={false}
        variant="home-preview"
        onRecordOpen={handleOpenCounselingRecordFromHome}
        summarySlot={
          previewStudent ? (
            <section
              className={`student-grid__item student-grid__item--summary student-grid__item--grade-${previewStudent.grade}`}
            >
              <div className="student-avatar student-grid__avatar">
                {getDisplayedStudentAvatarSrc(previewStudent) ? (
                  <img
                    src={getDisplayedStudentAvatarSrc(previewStudent)}
                    alt=""
                    loading="lazy"
                    onError={() => setAvatarLoadFailed(previewStudent.id, true)}
                  />
                ) : (
                  <span
                    style={{
                      backgroundColor: getStudentAvatarTheme(previewStudent).background,
                      color: getStudentAvatarTheme(previewStudent).color,
                    }}
                  >
                    {getStudentInitial(previewStudent)}
                  </span>
                )}
              </div>

              <div className="student-grid__content">
                <div className="student-grid__identity">
                  <p className="student-grid__school-number">
                    {`${previewStudent.grade}학년 ${previewStudent.class_num}반 ${previewStudent.student_num}번`}
                  </p>
                  <strong className="student-grid__name">{previewStudent.name}</strong>
                </div>
                <span className="student-grid__count">
                  상담 {previewStudentCounselingCount}회
                </span>
              </div>
            </section>
          ) : null
        }
        emptyMessage={
          previewStudent
            ? `${previewStudent.name} 학생의 상담 기록이 아직 없습니다.`
            : '학생 카드를 클릭하면 상담 내역이 표시됩니다.'
        }
      />
    </div>
  )

  const studentFormSection = (
    <section className="form-card">
      <div className="card-header form-header">
        <div>
          <p className="section-label">Create Student</p>
          <h2>{isEditing ? '학생 수정' : '학생 추가'}</h2>
          <p className="form-description">
            학생 추가, 수정, 삭제 이후에도 목록과 검색 결과가 자연스럽게
            갱신되도록 구성했습니다.
          </p>
        </div>

        <div className="form-header-actions">
          {isEditing ? (
            <button
              className="ghost-button"
              type="button"
              onClick={resetStudentForm}
              disabled={isBusy}
            >
              수정 취소
            </button>
          ) : null}

          <button
            className="secondary-button"
            type="button"
            onClick={handleAddTestStudent}
            disabled={isBusy}
          >
            {isCreatingTest ? '추가 중...' : '테스트 학생 추가하기'}
          </button>
        </div>
      </div>

      <form className="student-form" onSubmit={handleSubmitStudent} noValidate>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">이름</span>
            <input
              className={`field-input ${formErrors.name ? 'is-error' : ''}`}
              name="name"
              type="text"
              value={formValues.name}
              onChange={handleStudentInputChange}
              placeholder="예: 김지우"
              autoComplete="off"
            />
            <span className={`field-message ${formErrors.name ? 'is-error' : ''}`}>
              {formErrors.name || '학생 이름을 입력해 주세요.'}
            </span>
          </label>

          <label className="field">
            <span className="field-label">학년</span>
            <input
              className={`field-input ${formErrors.grade ? 'is-error' : ''}`}
              name="grade"
              type="text"
              inputMode="numeric"
              value={formValues.grade}
              onChange={handleStudentInputChange}
              placeholder="예: 1"
              autoComplete="off"
            />
            <span className={`field-message ${formErrors.grade ? 'is-error' : ''}`}>
              {formErrors.grade || '1부터 99 사이 숫자를 입력해 주세요.'}
            </span>
          </label>

          <label className="field">
            <span className="field-label">반</span>
            <input
              className={`field-input ${formErrors.classNum ? 'is-error' : ''}`}
              name="classNum"
              type="text"
              inputMode="numeric"
              value={formValues.classNum}
              onChange={handleStudentInputChange}
              placeholder="예: 3"
              autoComplete="off"
            />
            <span className={`field-message ${formErrors.classNum ? 'is-error' : ''}`}>
              {formErrors.classNum || '1부터 99 사이 숫자를 입력해 주세요.'}
            </span>
          </label>

          <label className="field">
            <span className="field-label">번호</span>
            <input
              className={`field-input ${formErrors.studentNum ? 'is-error' : ''}`}
              name="studentNum"
              type="text"
              inputMode="numeric"
              value={formValues.studentNum}
              onChange={handleStudentInputChange}
              placeholder="예: 12"
              autoComplete="off"
            />
            <span className={`field-message ${formErrors.studentNum ? 'is-error' : ''}`}>
              {formErrors.studentNum || '1부터 99 사이 숫자를 입력해 주세요.'}
            </span>
          </label>
        </div>

        <div className="form-footer">
          <p className="form-note">같은 학년, 반, 번호 조합은 한 번만 등록할 수 있습니다.</p>
          <button className="primary-button" type="submit" disabled={isBusy}>
            {isSubmittingForm
              ? isEditing
                ? '학생 수정 중...'
                : '학생 추가 중...'
              : isEditing
                ? '학생 수정'
                : '학생 추가'}
          </button>
        </div>
      </form>
    </section>
  )

  const batchUploadSection = (
    <BatchAvatarUpload
      authUserId={authUserId}
      onAvatarUpdated={updateStudentAvatarState}
      onStatusMessage={setStatusMessage}
    />
  )

  if (!hasSupabaseEnv) {
    return (
      <main className="page page--auth">
        <Login
          errorMessage={getSupabaseEnvHelpMessage()}
          isSigningIn={false}
          hasSupabaseEnv={false}
          onGoogleSignIn={handleGoogleSignIn}
        />
      </main>
    )
  }

  if (isAuthLoading) {
    return (
      <main className="page page--auth">
        <section className="auth-shell">
          <div className="auth-panel">
            <section className="empty-card auth-loading-card">
              <div className="empty-icon">확인</div>
              <h2>로그인 상태를 확인하는 중입니다</h2>
              <p>유효한 세션이 있으면 바로 학생 관리 화면으로 연결됩니다.</p>
            </section>
          </div>
        </section>
      </main>
    )
  }

  if (!authUser) {
    return (
      <main className="page page--auth">
        <Login
          errorMessage={authErrorMessage}
          isSigningIn={isSigningIn}
          hasSupabaseEnv={hasSupabaseEnv}
          onGoogleSignIn={handleGoogleSignIn}
        />
      </main>
    )
  }

  const studentView = (
    <>
      <section className="hero-card">
        <div className="hero-content">
          <p className="hero-badge">Student Dashboard</p>
          <h1>학생 목록과 상담 기록을 한 번에 관리해요</h1>
          <p className="hero-copy">
            검색, 학급 선택, 무한 스크롤 기반 목록으로 많은 학생 데이터도 빠르게
            확인할 수 있도록 구성했습니다.
          </p>
        </div>

        <div className="hero-side">
          <div className="summary-chip">
            <span>{hasActiveFilters ? '현재 검색 결과' : '전체 학생 수'}</span>
            <strong>{isLoading ? '불러오는 중' : `${totalStudentCount}명`}</strong>
          </div>
          <div className="summary-chip is-active">
            <span>보안 상태</span>
            <strong>로그인한 사용자만 접근 가능</strong>
          </div>
        </div>
      </section>

      <section className="student-discovery" ref={studentDiscoveryRef}>
        <div className="student-discovery__inner">
          <div className="student-discovery__filters student-discovery__filters--inline">
            <div className="student-discovery__filter-block student-discovery__filter-block--grade">
              <div className="student-discovery__filter-row">
                <h2 className="student-discovery__title">
                  <span className="student-discovery__title-icon" aria-hidden="true">
                    📚
                  </span>
                  <span className="student-discovery__title-text">학급선택</span>
                </h2>
                <div
                  className="chip-row chip-row--class-picker"
                  role="tablist"
                  aria-label="학급 선택"
                >
                  {CLASS_FILTER_OPTIONS.map((option) => (
                    <button
                      key={`${option.grade}-${option.classNum}`}
                      className={`chip-button chip-button--grade-${option.grade} ${
                        selectedGrade === option.grade && selectedClass === option.classNum
                          ? 'is-active'
                          : ''
                      }`}
                      type="button"
                      onClick={() => handleClassChipClick(option.grade, option.classNum)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className={`workspace ${
          isCounselingView ? 'workspace--counseling' : 'workspace--home'
        }`}
      >
        <div className="main-column">
          {isLoading && !hasVisibleStudents ? (
            isCounselingView ? (
              <section className="list-card">
                <div className="card-header card-header--student-list">
                  <div>
                    <h2>학생 목록</h2>
                  </div>
                </div>

                <div className="skeleton-list" aria-hidden="true">
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                  <div className="skeleton-row" />
                </div>
              </section>
            ) : (
              <div className="home-overview-grid">
                <section className="list-card">
                  <div className="card-header card-header--student-list">
                    <div>
                      <h2>학생 목록</h2>
                    </div>
                  </div>

                  <div className="skeleton-list" aria-hidden="true">
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                  </div>
                </section>

                {homeHistoryPreviewSection}
              </div>
            )
          ) : null}

          {!isLoading && !totalStudentCount && !hasActiveFilters ? (
            <section className="empty-card">
              <div className="empty-icon">+</div>
              <h2>아직 등록된 학생이 없습니다</h2>
              <p>
                상단 학생관리 메뉴의 학생 추가에서 첫 학생을 등록해 보세요.
              </p>
            </section>
          ) : null}

          {!isLoading && !totalStudentCount && hasActiveFilters ? (
            <section className="empty-card">
              <div className="empty-icon">0</div>
              <h2>조건에 맞는 학생이 없습니다</h2>
              <p>검색어를 조금 다르게 입력하거나 학급 선택을 다시 확인해 보세요.</p>
            </section>
          ) : null}

          {hasVisibleStudents ? (
            isCounselingView ? (
              studentListSection
            ) : (
              <div className="home-overview-grid">
                {studentListSection}
                {homeHistoryPreviewSection}
              </div>
            )
          ) : null}
        </div>

        {isCounselingView ? (
          <aside className="detail-column" ref={detailColumnRef}>
            <section className="detail-card">
              {!selectedStudent ? (
                <div className="detail-placeholder">
                  <div className="empty-icon">상</div>
                  <h2>학생을 선택하면 학생 상담 폼이 열립니다</h2>
                  <p>
                    왼쪽 학생 카드를 클릭하면 해당 학생의 상담 입력 폼과 과거 상담
                    내역이 이 영역에 함께 표시됩니다.
                  </p>
                </div>
              ) : (
                <>
                  <div className="detail-header">
                    <div className="detail-profile">
                      <button
                        className="detail-profile__avatar-button"
                        type="button"
                        onClick={openAvatarFilePicker}
                        disabled={isUploadingAvatar}
                        aria-label={`${selectedStudent.name} 학생 프로필 사진 업로드`}
                      >
                        <div className="detail-profile__avatar">
                          {getDisplayedStudentAvatarSrc(selectedStudent) ? (
                            <img
                              src={getDisplayedStudentAvatarSrc(selectedStudent)}
                              alt={`${selectedStudent.name} 프로필`}
                              className="detail-profile__avatar-image"
                              onError={() => setAvatarLoadFailed(selectedStudent.id, true)}
                            />
                          ) : (
                            <span
                              className="detail-profile__fallback"
                              style={{
                                backgroundColor: getStudentAvatarTheme(selectedStudent).background,
                                color: getStudentAvatarTheme(selectedStudent).color,
                              }}
                            >
                              {getStudentInitial(selectedStudent)}
                            </span>
                          )}

                          {isUploadingAvatar ? (
                            <span className="detail-profile__overlay" aria-hidden="true">
                              <span className="avatar-spinner" />
                            </span>
                          ) : null}
                        </div>
                      </button>

                      <input
                        ref={avatarFileInputRef}
                        className="visually-hidden"
                        type="file"
                        accept="image/*"
                        onChange={handleStudentAvatarChange}
                      />

                      <div className="detail-profile__copy">
                        <h2>
                          {selectedStudent.grade}학년 {selectedStudent.class_num}반{' '}
                          {selectedStudent.student_num}번 {selectedStudent.name}
                        </h2>
                      </div>
                    </div>

                    <div className="detail-profile__actions">
                      <button
                        className="ghost-button camera-button"
                        type="button"
                        onClick={openAvatarFilePicker}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? '업로드 중...' : '📷 카메라'}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={clearSelectedStudent}
                      >
                        선택 해제
                      </button>
                    </div>
                  </div>

                  <section className="detail-section">
                    <div className="section-row">
                      <div />
                    </div>

                    <p className="detail-note">
                      새 상담을 저장하면 같은 화면 아래의 과거 상담 기록 목록이
                      자동으로 갱신됩니다.
                    </p>

                    <CounselingForm
                      key={`${selectedStudent.id}-${counselingRefreshKey}`}
                      studentId={selectedStudent.id}
                      studentName={selectedStudent.name}
                      expandedRecordId={expandedCounselingRecordId}
                      onSaveSuccess={handleCounselingSaveSuccess}
                    />
                  </section>
                </>
              )}
            </section>
          </aside>
        ) : null}
      </div>
    </>
  )

  const studentCreateView = (
    <div className="workspace workspace--home">
      <div className="main-column">{studentFormSection}</div>
    </div>
  )

  const photoMatchingView = (
    <div className="workspace workspace--home">
      <div className="main-column">{batchUploadSection}</div>
    </div>
  )

  return (
    <main className="page" ref={pageRef}>
      <section className="app-header" ref={appHeaderRef}>
        <div className="app-header__identity">
          <span className="school-logo" aria-hidden="true">
            👨‍👩‍👧‍👦
          </span>

          <div className="app-header__brand">
            <h2>학생관리</h2>
            <span className="app-header__build-badge">{APP_BUILD_LABEL}</span>
          </div>

          <nav className="app-header__nav" aria-label="주요 화면 이동">
            <button
              className={`app-header__nav-button ${
                activeView === 'home' ? 'is-active' : ''
              }`}
              type="button"
              onClick={handleOpenHomeView}
            >
              홈
            </button>

            <div
              className={`app-header__nav-dropdown ${
                isManagementMenuOpen ? 'is-open' : ''
              }`}
              onMouseEnter={openManagementMenu}
              onMouseLeave={scheduleCloseManagementMenu}
              onFocus={openManagementMenu}
              onBlur={handleManagementMenuBlur}
            >
              <button
                className={`app-header__nav-button app-header__nav-button--dropdown ${
                  isManagementMenuOpen ||
                  activeView === 'counseling' ||
                  activeView === 'dashboard' ||
                  activeView === 'student-create' ||
                  activeView === 'photo-matching'
                    ? 'is-active'
                    : ''
                }`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={isManagementMenuOpen}
                onClick={() => {
                  if (isManagementMenuOpen) {
                    closeManagementMenu()
                  } else {
                    openManagementMenu()
                  }
                }}
              >
                <span>학생관리</span>
                <span className="app-header__nav-chevron" aria-hidden="true" />
              </button>

              <div className="app-header__mega-menu" role="menu" aria-label="학생관리 메뉴">
                <div className="app-header__mega-menu-grid">
                  <button
                    className="app-header__mega-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeManagementMenu()
                      handleOpenCounselingView()
                    }}
                  >
                    <span className="app-header__mega-item-icon" aria-hidden="true">
                      📒
                    </span>
                    <span className="app-header__mega-item-copy">
                      <strong>학생상담</strong>
                      <span>학생별 상담 입력과 기록 확인</span>
                    </span>
                  </button>

                  <button
                    className="app-header__mega-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeManagementMenu()
                      handleOpenDashboardView()
                    }}
                  >
                    <span className="app-header__mega-item-icon" aria-hidden="true">
                      📚
                    </span>
                    <span className="app-header__mega-item-copy">
                      <strong>상담통계</strong>
                      <span>전체 상담 현황과 분야별 추이 보기</span>
                    </span>
                  </button>

                  <button
                    className="app-header__mega-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeManagementMenu()
                      handleOpenStudentFormView()
                    }}
                  >
                    <span className="app-header__mega-item-icon" aria-hidden="true">
                      🧑
                    </span>
                    <span className="app-header__mega-item-copy">
                      <strong>학생 추가</strong>
                      <span>신규 학생 등록과 정보 수정</span>
                    </span>
                  </button>

                  <button
                    className="app-header__mega-item"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeManagementMenu()
                      handleOpenBatchUploadView()
                    }}
                  >
                    <span className="app-header__mega-item-icon" aria-hidden="true">
                      📷
                    </span>
                    <span className="app-header__mega-item-copy">
                      <strong>사진 매칭</strong>
                      <span>프로필 사진 일괄 업로드와 매칭</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </nav>
        </div>

        <div className="app-header__actions">
          <div className="app-header__search">
            <label className="app-header__search-field">
              <span className="visually-hidden">학생 검색</span>
              <input
                className="app-header__search-input"
                type="search"
                value={searchTerm}
                onChange={handleSearchTermChange}
                placeholder="학생 이름 또는 학번 검색"
                autoComplete="off"
                aria-invalid={Boolean(errorMessage)}
                title={errorMessage || statusMessage}
              />
            </label>
          </div>

          <div className="profile-chip">
            <div className="profile-chip__avatar" aria-hidden="true">
              {getUserAvatarUrl(authUser) ? (
                <img src={getUserAvatarUrl(authUser)} alt="" />
              ) : (
                <span>{getUserInitial(authUser)}</span>
              )}
            </div>

            <div className="profile-chip__copy">
              <strong>{getUserDisplayName(authUser)}</strong>
            </div>
          </div>

          <button
            className="ghost-button"
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </section>

      {activeView === 'dashboard'
        ? <Dashboard />
        : activeView === 'student-create'
          ? studentCreateView
          : activeView === 'photo-matching'
            ? photoMatchingView
            : studentView}
    </main>
  )
}

export default App

