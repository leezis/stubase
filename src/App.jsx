import { useEffect, useEffectEvent, useRef, useState } from 'react'
import BatchAvatarUpload from './features/students/BatchAvatarUpload.jsx'
import CounselingForm, {
  CounselingHistoryPanel,
} from './features/counseling/CounselingForm.jsx'
import Dashboard from './features/dashboard/Dashboard.jsx'
import EmergencyContacts from './features/emergency-contacts/EmergencyContacts.jsx'
import personalGradeRecordsModule from './features/personal-grade-records/index.js'
import {
  PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
  mergePersonalGradeRecordData,
} from './features/personal-grade-records/personalGradeRecordsData.js'
import SchoolLifeRecordsInput, {
  SELF_GOVERNMENT_SECTION_ID,
  SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS,
  SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL,
  SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY,
} from './features/school-life-records/SchoolLifeRecordsInput.jsx'
import Login from './features/auth/Login.jsx'
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
const SCHOOL_LIFE_RECORDS_MODULE_ID = 'school-life-records-input'
const SCHOOL_LIFE_CLUB_SECTION_ID = 'club'
const SCHOOL_LIFE_SPORTS_CLUB_SECTION_ID = 'sports-club'
const SCHOOL_LIFE_FREE_SEMESTER_SUBJECT_SECTION_ID = 'free-semester-subject'
const SCHOOL_LIFE_FREE_SEMESTER_CAREER_SECTION_ID = 'free-semester-career'
const SCHOOL_LIFE_SUBJECT_ABILITY_SECTION_ID = 'subject-ability'
const SCHOOL_LIFE_BEHAVIOR_SECTION_ID = 'behavior'

const STUDENT_COMPETENCY_OPTIONS = [
  '의사소통',
  '협업',
  '자기관리',
  '문제해결',
  '창의적 사고',
  '비판적 사고',
  '정보활용',
  '진로탐색',
  '학습주도성',
  '갈등조정',
  '의사결정',
  '탐구력',
  '실행력',
  '적응력',
  '표현력',
  '공동체성',
  '리더십',
  '자기성찰',
  '자료해석',
  '디지털활용',
  '윤리적 판단',
  '계획수립',
  '상황판단',
  '협의조정',
]

const STUDENT_CHARACTER_OPTIONS = [
  '성실함',
  '배려심',
  '존중',
  '책임감',
  '정직함',
  '예의',
  '공감',
  '끈기',
  '나눔',
  '긍정성',
  '인내심',
  '질서의식',
  '친절함',
  '신뢰감',
  '봉사정신',
  '협동심',
  '공정성',
  '포용성',
  '자율성',
  '절제',
  '겸손',
  '관용',
  '배려실천',
  '약속이행',
]

const SCHOOL_LIFE_QUALITY_GROUPS = [
  {
    id: 'competencies',
    label: '학생\n역량',
    options: STUDENT_COMPETENCY_OPTIONS,
  },
  {
    id: 'characters',
    label: '학생\n품성',
    options: STUDENT_CHARACTER_OPTIONS,
  },
]

const SCHOOL_LIFE_PERSONAL_SECTION_OPTIONS = [
  {
    id: SELF_GOVERNMENT_SECTION_ID,
    label: '자율자치 활동',
  },
  {
    id: SCHOOL_LIFE_CLUB_SECTION_ID,
    label: '동아리 활동',
  },
  {
    id: SCHOOL_LIFE_SPORTS_CLUB_SECTION_ID,
    label: '학교스포츠클럽',
  },
  {
    id: 'career',
    label: '진로 활동',
  },
  {
    id: SCHOOL_LIFE_FREE_SEMESTER_SUBJECT_SECTION_ID,
    label: '자유학기(주제선택)',
  },
  {
    id: SCHOOL_LIFE_FREE_SEMESTER_CAREER_SECTION_ID,
    label: '자유학기(진로선택)',
  },
  {
    id: SCHOOL_LIFE_SUBJECT_ABILITY_SECTION_ID,
    label: '과목 세부능력특기사항',
  },
  {
    id: SCHOOL_LIFE_BEHAVIOR_SECTION_ID,
    label: '행동특성 및 종합의견',
  },
]

const emptySchoolLifeQualitySelection = {
  competencies: [],
  characters: [],
}

const emptySchoolLifeClubDepartments = {
  clubActivity: '',
  sportsClub: '',
  autonomousClub: '',
}

const SCHOOL_LIFE_CLUB_DEPARTMENT_ITEMS = [
  {
    id: 'clubActivity',
    label: '동아리활동 부서',
  },
  {
    id: 'sportsClub',
    label: '학교스포츠클럽 부서',
  },
  {
    id: 'autonomousClub',
    label: '자율동아리 부서',
  },
]

function normalizeSchoolLifeClubDepartment(value) {
  return String(value ?? '').trim()
}

function createSchoolLifeClubDepartments(recordData) {
  const data = mergePersonalGradeRecordData(recordData)

  return {
    clubActivity: normalizeSchoolLifeClubDepartment(data.club.clubActivity.name),
    sportsClub: normalizeSchoolLifeClubDepartment(data.club.clubActivity.className),
    autonomousClub: normalizeSchoolLifeClubDepartment(data.club.autonomousClub.name),
  }
}

function getRandomQualityOptions(options, minCount = 3, maxCount = 5) {
  const shuffledOptions = [...options]

  for (let index = shuffledOptions.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledOptions[index], shuffledOptions[randomIndex]] = [
      shuffledOptions[randomIndex],
      shuffledOptions[index],
    ]
  }

  const count =
    Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount

  return shuffledOptions.slice(0, Math.min(count, shuffledOptions.length))
}

const emergencyContactsModule = {
  id: 'emergency-contacts',
  category: 'school-work',
  menu: {
    icon: '☎',
    title: '비상연락망',
    description: '학급별 연락처 확인과 출력',
  },
  Component: EmergencyContacts,
}

const schoolLifeRecordsInputModule = {
  id: SCHOOL_LIFE_RECORDS_MODULE_ID,
  category: 'school-work',
  menu: {
    icon: '생',
    title: '학교생활기록부 입력',
    description: '학생별 생활기록부 입력 화면',
  },
  usesStudentWorkspace: true,
  studentWorkspace: {
    hero: {
      badge: 'School Work',
      title: '학급별 학교생활기록부 입력을 한 화면에서 진행해요',
      description: '학급 선택 후 학생 목록과 입력 영역을 함께 확인하며 기록을 작성합니다.',
    },
    studentBadge: '입력',
    defaultFilters: {
      selectedGrade: '1',
      selectedClass: '1',
    },
    autoSelectFirstStudent: true,
    emptyState: {
      icon: '생',
      title: '학생을 선택하면 학교생활기록부 입력 화면이 열립니다',
      description: '왼쪽 학생 목록에서 학생을 선택해 주세요.',
    },
  },
  Component: SchoolLifeRecordsInput,
}

const SCHOOL_WORK_MODULES = [
  emergencyContactsModule,
  personalGradeRecordsModule,
  schoolLifeRecordsInputModule,
]

const emptyStudentWorkspaceFilters = {
  selectedGrade: '',
  selectedClass: '',
}

const emptySchoolLifeRecordStudentListOverride = {
  isActive: false,
  label: '',
  students: [],
}

const CLASS_FILTER_OPTIONS = Array.from({ length: 3 }, (_, gradeIndex) =>
  Array.from({ length: 7 }, (_, classIndex) => ({
    label: `${gradeIndex + 1}-${classIndex + 1}`,
    grade: String(gradeIndex + 1),
    classNum: String(classIndex + 1),
  })),
).flat()

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
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [schoolWorkStudentFilters, setSchoolWorkStudentFilters] = useState({})
  const [schoolWorkDataRefreshKeys, setSchoolWorkDataRefreshKeys] = useState({})
  const [counselingRefreshKey, setCounselingRefreshKey] = useState(0)
  const [counselingCountMap, setCounselingCountMap] = useState({})
  const [expandedCounselingRecordId, setExpandedCounselingRecordId] =
    useState(null)
  const [schoolWorkSelectedStudentIds, setSchoolWorkSelectedStudentIds] =
    useState({})
  const [schoolWorkHeaderActions, setSchoolWorkHeaderActions] = useState(null)
  const [
    schoolLifeSubjectAbilityHeaderState,
    setSchoolLifeSubjectAbilityHeaderState,
  ] = useState(null)
  const [schoolLifeQualitySelections, setSchoolLifeQualitySelections] =
    useState({})
  const [schoolLifeClubDepartmentResult, setSchoolLifeClubDepartmentResult] =
    useState({
      departments: emptySchoolLifeClubDepartments,
      error: '',
      studentId: null,
    })
  const [schoolLifeRecordInputMode, setSchoolLifeRecordInputMode] = useState(
    SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL,
  )
  const [schoolLifeRecordPersonalSectionId, setSchoolLifeRecordPersonalSectionId] =
    useState(SELF_GOVERNMENT_SECTION_ID)
  const [
    schoolLifeRecordStudentListOverride,
    setSchoolLifeRecordStudentListOverride,
  ] = useState(emptySchoolLifeRecordStudentListOverride)
  const [toastMessage, setToastMessage] = useState('')
  const [toastTone, setToastTone] = useState('info')

  const authUserId = authUser?.id ?? ''
  const selectedStudentId = selectedStudent?.id ?? null
  const visibleSelectedStudent =
    students.find((student) => student.id === selectedStudentId) ?? null
  const previewStudent = visibleSelectedStudent
  const activeSchoolWorkModule = SCHOOL_WORK_MODULES.find(
    (module) => module.id === activeView,
  )
  const ActiveSchoolWorkModule = activeSchoolWorkModule?.Component ?? null
  const ActiveStudentWorkspaceHeaderActions =
    activeSchoolWorkModule?.studentWorkspace?.HeaderActions ?? null
  const ActiveStudentWorkspacePlaceholderDetails =
    activeSchoolWorkModule?.studentWorkspace?.PlaceholderDetails ?? null
  const activeSchoolWorkDataRefreshKey = activeSchoolWorkModule
    ? schoolWorkDataRefreshKeys[activeSchoolWorkModule.id] ?? 0
    : 0
  const isCounselingView = activeView === 'counseling'
  const isSchoolWorkStudentWorkspaceView = Boolean(
    activeSchoolWorkModule?.usesStudentWorkspace,
  )
  const activeSchoolWorkSelectedStudentId = isSchoolWorkStudentWorkspaceView
    ? schoolWorkSelectedStudentIds[activeSchoolWorkModule.id] ?? null
    : null
  const activeWorkspaceSelectedStudentId = isSchoolWorkStudentWorkspaceView
    ? activeSchoolWorkSelectedStudentId
    : selectedStudentId
  const isSchoolLifeRecordsInputView =
    activeSchoolWorkModule?.id === SCHOOL_LIFE_RECORDS_MODULE_ID
  const isSchoolLifeSelfGovernmentInputSelected =
    isSchoolLifeRecordsInputView &&
    schoolLifeRecordInputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL &&
    schoolLifeRecordPersonalSectionId === SELF_GOVERNMENT_SECTION_ID
  const isSchoolLifeSubjectAbilityInputSelected =
    isSchoolLifeRecordsInputView &&
    schoolLifeRecordInputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL &&
    schoolLifeRecordPersonalSectionId === SCHOOL_LIFE_SUBJECT_ABILITY_SECTION_ID
  const isSchoolLifeClubInputSelected =
    isSchoolLifeRecordsInputView &&
    schoolLifeRecordInputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL &&
    schoolLifeRecordPersonalSectionId === SCHOOL_LIFE_CLUB_SECTION_ID
  const shouldShowSchoolLifeSubjectAbilityCompetencyPicker =
    isSchoolLifeSubjectAbilityInputSelected &&
    Boolean(schoolLifeSubjectAbilityHeaderState?.competencyOptions?.length)
  const shouldShowSchoolLifeSubjectAbilitySubjectButtons =
    isSchoolLifeSubjectAbilityInputSelected &&
    Boolean(schoolLifeSubjectAbilityHeaderState?.subjects?.length) &&
    typeof schoolLifeSubjectAbilityHeaderState?.onSubjectButtonClick ===
      'function'
  const shouldShowSchoolLifeProfileQualityPicker =
    isSchoolLifeSelfGovernmentInputSelected ||
    shouldShowSchoolLifeSubjectAbilityCompetencyPicker
  const shouldShowActiveStudentDetailHeader =
    !isSchoolLifeRecordsInputView ||
    schoolLifeRecordInputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL
  const activeSchoolLifeClubDepartments =
    schoolLifeClubDepartmentResult.studentId === activeWorkspaceSelectedStudentId
      ? schoolLifeClubDepartmentResult.departments
      : emptySchoolLifeClubDepartments
  const isLoadingSchoolLifeClubDepartments =
    isSchoolLifeClubInputSelected &&
    Boolean(activeWorkspaceSelectedStudentId) &&
    Boolean(supabase) &&
    Boolean(authUserId) &&
    schoolLifeClubDepartmentResult.studentId !== activeWorkspaceSelectedStudentId
  const schoolLifeClubDepartmentsError =
    isSchoolLifeClubInputSelected && (!supabase || !authUserId)
      ? 'Supabase 연결 정보가 없어 동아리 부서를 불러올 수 없습니다.'
      : schoolLifeClubDepartmentResult.studentId === activeWorkspaceSelectedStudentId
        ? schoolLifeClubDepartmentResult.error
        : ''
  const activeSchoolLifeQualitySelection = activeWorkspaceSelectedStudentId
    ? schoolLifeQualitySelections[activeWorkspaceSelectedStudentId] ??
      emptySchoolLifeQualitySelection
    : emptySchoolLifeQualitySelection
  const activeSchoolWorkDefaultFilters =
    activeSchoolWorkModule?.studentWorkspace?.defaultFilters ??
    emptyStudentWorkspaceFilters
  const activeSchoolWorkStudentFilters = isSchoolWorkStudentWorkspaceView
    ? schoolWorkStudentFilters[activeSchoolWorkModule.id] ??
      activeSchoolWorkDefaultFilters
    : emptyStudentWorkspaceFilters
  const activeSelectedGrade = isSchoolWorkStudentWorkspaceView
    ? activeSchoolWorkStudentFilters.selectedGrade
    : selectedGrade
  const activeSelectedClass = isSchoolWorkStudentWorkspaceView
    ? activeSchoolWorkStudentFilters.selectedClass
    : selectedClass
  const isStudentDetailWorkspaceView =
    isCounselingView || isSchoolWorkStudentWorkspaceView
  const isStudentWorkspaceView =
    activeView === 'home' ||
    isStudentDetailWorkspaceView ||
    activeView === 'student-create' ||
    activeView === 'photo-matching'
  const isCounselingDataWorkspaceView = activeView === 'home' || isCounselingView
  const nextRangeStartRef = useRef(0)
  const latestRequestIdRef = useRef(0)
  const counselingCountRequestIdRef = useRef(0)
  const loadMoreSentinelRef = useRef(null)
  const studentGridScrollRef = useRef(null)
  const detailColumnRef = useRef(null)
  const managementMenuCloseTimeoutRef = useRef(null)
  const schoolWorkMenuCloseTimeoutRef = useRef(null)
  const pageRef = useRef(null)
  const appHeaderRef = useRef(null)
  const studentDiscoveryRef = useRef(null)
  const avatarFileInputRef = useRef(null)
  const avatarObjectUrlsRef = useRef({})
  const [isStudentDetailScrollPending, setIsStudentDetailScrollPending] =
    useState(false)
  const [isManagementMenuOpen, setIsManagementMenuOpen] = useState(false)
  const [isSchoolWorkMenuOpen, setIsSchoolWorkMenuOpen] = useState(false)

  function handleSchoolLifeRecordStudentListChange(nextList) {
    if (!nextList?.isActive) {
      setSchoolLifeRecordStudentListOverride((previous) =>
        previous.isActive ? emptySchoolLifeRecordStudentListOverride : previous,
      )

      if (
        activeSchoolWorkSelectedStudentId &&
        !students.some(
          (student) => student.id === activeSchoolWorkSelectedStudentId,
        ) &&
        students[0]
      ) {
        setSchoolWorkSelectedStudentIds((previous) => ({
          ...previous,
          [SCHOOL_LIFE_RECORDS_MODULE_ID]: students[0].id,
        }))
      }

      return
    }

    const nextStudents = nextList.students ?? []
    const nextKey = `${nextList.label ?? ''}:${nextStudents
      .map((student) => student.id)
      .join(',')}:${nextList.isLoading ? 'loading' : 'ready'}`

    setSchoolLifeRecordStudentListOverride((previous) =>
      previous.key === nextKey
        ? previous
        : {
            isActive: true,
            isLoading: Boolean(nextList.isLoading),
            key: nextKey,
            label: nextList.label ?? '',
            students: nextStudents,
          },
    )

    if (
      nextStudents.length &&
      !nextStudents.some(
        (student) => student.id === activeSchoolWorkSelectedStudentId,
      )
    ) {
      setSchoolWorkSelectedStudentIds((previous) => ({
        ...previous,
        [SCHOOL_LIFE_RECORDS_MODULE_ID]: nextStudents[0].id,
      }))
    }
  }

  function resetStudentForm() {
    setFormValues(initialStudentFormValues)
    setFormErrors({})
    setEditingStudentId(null)
  }

  function clearSelectedStudent() {
    setSelectedStudent(null)
  }

  function updateActiveSchoolWorkStudentFilters(updater) {
    const moduleId = activeSchoolWorkModule?.id

    if (!moduleId) {
      return
    }

    setSchoolWorkStudentFilters((previous) => {
      const currentFilters =
        previous[moduleId] ??
        activeSchoolWorkModule?.studentWorkspace?.defaultFilters ??
        emptyStudentWorkspaceFilters
      const nextFilters =
        typeof updater === 'function'
          ? updater(currentFilters)
          : { ...currentFilters, ...updater }

      return {
        ...previous,
        [moduleId]: nextFilters,
      }
    })
  }

  function clearSchoolWorkSelectedStudent(moduleId = activeSchoolWorkModule?.id) {
    if (!moduleId) {
      return
    }

    setSchoolWorkSelectedStudentIds((previous) => {
      if (!previous[moduleId]) {
        return previous
      }

      const next = { ...previous }
      delete next[moduleId]
      return next
    })
  }

  function refreshSchoolWorkModuleData(moduleId = activeSchoolWorkModule?.id) {
    if (!moduleId) {
      return
    }

    setSchoolWorkDataRefreshKeys((previous) => ({
      ...previous,
      [moduleId]: (previous[moduleId] ?? 0) + 1,
    }))
  }

  function showToast(message, tone = 'info') {
    setToastMessage(message)
    setToastTone(tone)
  }

  function setErrorMessage(message) {
    if (message) {
      showToast(message, 'error')
    }
  }

  function toggleSchoolLifeQualitySelection(groupId, option) {
    const studentId = activeWorkspaceSelectedStudentId

    if (!studentId) {
      return
    }

    setSchoolLifeQualitySelections((previous) => {
      const current = previous[studentId] ?? emptySchoolLifeQualitySelection
      const currentValues = current[groupId] ?? []
      const nextValues = currentValues.includes(option)
        ? currentValues.filter((value) => value !== option)
        : [...currentValues, option]

      return {
        ...previous,
        [studentId]: {
          ...emptySchoolLifeQualitySelection,
          ...current,
          [groupId]: nextValues,
        },
      }
    })
  }

  function handleRandomSelectSchoolLifeQualityGroup(groupId) {
    const studentId = activeWorkspaceSelectedStudentId
    const qualityGroup = SCHOOL_LIFE_QUALITY_GROUPS.find(
      (group) => group.id === groupId,
    )

    if (!studentId || !qualityGroup) {
      return
    }

    setSchoolLifeQualitySelections((previous) => {
      const current = previous[studentId] ?? emptySchoolLifeQualitySelection

      return {
        ...previous,
        [studentId]: {
          ...emptySchoolLifeQualitySelection,
          ...current,
          [groupId]: getRandomQualityOptions(qualityGroup.options, 7, 10),
        },
      }
    })

    showToast(
      `${activeWorkspaceSelectedStudent?.name ?? '학생'} 학생의 ${qualityGroup.label.replace(/\s+/g, '')}을 랜덤 선택했습니다.`,
    )
  }

  function handleRandomSelectSchoolLifeCompetencies(options) {
    const studentId = activeWorkspaceSelectedStudentId

    if (!studentId || !options?.length) {
      return
    }

    setSchoolLifeQualitySelections((previous) => {
      const current = previous[studentId] ?? emptySchoolLifeQualitySelection

      return {
        ...previous,
        [studentId]: {
          ...emptySchoolLifeQualitySelection,
          ...current,
          competencies: getRandomQualityOptions(options, 7, 10),
        },
      }
    })

    showToast(
      `${activeWorkspaceSelectedStudent?.name ?? '학생'} 학생의 학생역량을 랜덤 선택했습니다.`,
    )
  }

  function applySchoolLifeQualitySelectionsByStudent(nextSelectionsByStudentId) {
    setSchoolLifeQualitySelections((previous) => {
      const next = { ...previous }

      Object.entries(nextSelectionsByStudentId ?? {}).forEach(
        ([studentId, selection]) => {
          next[studentId] = {
            ...emptySchoolLifeQualitySelection,
            ...(previous[studentId] ?? {}),
            competencies: selection.competencies ?? [],
            characters: selection.characters ?? [],
          }
        },
      )

      return next
    })
  }

  function clearActiveWorkspaceSelectedStudent() {
    if (isSchoolWorkStudentWorkspaceView) {
      clearSchoolWorkSelectedStudent()
      return
    }

    clearSelectedStudent()
  }

  function handleOpenHomeView() {
    setActiveView('home')
    setIsStudentDetailScrollPending(false)
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setSchoolWorkHeaderActions(null)
  }

  function handleOpenCounselingView() {
    const nextStudent = selectedStudent ?? students[0] ?? null

    setActiveView('counseling')
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setExpandedCounselingRecordId(null)
    setSchoolWorkHeaderActions(null)

    if (nextStudent) {
      setSelectedStudent(nextStudent)
      setCounselingRefreshKey(0)
    }

    setIsStudentDetailScrollPending(true)
  }

  function handleOpenDashboardView() {
    setActiveView('dashboard')
    setIsStudentDetailScrollPending(false)
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setSchoolWorkHeaderActions(null)
  }

  function handleOpenStudentFormView() {
    setActiveView('student-create')
    setIsStudentDetailScrollPending(false)
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setSchoolWorkHeaderActions(null)
  }

  function handleOpenBatchUploadView() {
    setActiveView('photo-matching')
    setIsStudentDetailScrollPending(false)
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setSchoolWorkHeaderActions(null)
  }

  function handleOpenSchoolWorkModule(moduleId) {
    const nextModule = SCHOOL_WORK_MODULES.find((module) => module.id === moduleId)
    const defaultFilters =
      nextModule?.studentWorkspace?.defaultFilters ?? emptyStudentWorkspaceFilters
    const savedStudentId = nextModule?.usesStudentWorkspace
      ? schoolWorkSelectedStudentIds[moduleId] ?? null
      : null
    const savedStudent = savedStudentId
      ? students.find((student) => student.id === savedStudentId) ?? null
      : null
    const defaultFilteredStudent = nextModule?.usesStudentWorkspace
      ? students.find((student) => {
          const isGradeMatched =
            !defaultFilters.selectedGrade ||
            student.grade === Number(defaultFilters.selectedGrade)
          const isClassMatched =
            !defaultFilters.selectedClass ||
            student.class_num === Number(defaultFilters.selectedClass)

          return isGradeMatched && isClassMatched
        }) ?? null
      : null
    const nextStudent = nextModule?.usesStudentWorkspace
      ? savedStudent ?? defaultFilteredStudent
      : null

    setActiveView(moduleId)
    setIsStudentDetailScrollPending(false)
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setSchoolWorkHeaderActions(null)

    if (!nextModule?.usesStudentWorkspace) {
      return
    }

    setIsStudentDetailScrollPending(true)

    if (nextStudent) {
      setSchoolWorkSelectedStudentIds((previous) => ({
        ...previous,
        [nextModule.id]: nextStudent.id,
      }))
    }
  }

  function clearManagementMenuCloseTimeout() {
    if (managementMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(managementMenuCloseTimeoutRef.current)
      managementMenuCloseTimeoutRef.current = null
    }
  }

  function openManagementMenu() {
    clearManagementMenuCloseTimeout()
    setIsSchoolWorkMenuOpen(false)
    setIsManagementMenuOpen(true)
  }

  function closeManagementMenu() {
    clearManagementMenuCloseTimeout()
    setIsManagementMenuOpen(false)
  }

  function clearSchoolWorkMenuCloseTimeout() {
    if (schoolWorkMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(schoolWorkMenuCloseTimeoutRef.current)
      schoolWorkMenuCloseTimeoutRef.current = null
    }
  }

  function openSchoolWorkMenu() {
    clearSchoolWorkMenuCloseTimeout()
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(true)
  }

  function closeSchoolWorkMenu() {
    clearSchoolWorkMenuCloseTimeout()
    setIsSchoolWorkMenuOpen(false)
  }

  function scheduleCloseSchoolWorkMenu() {
    clearSchoolWorkMenuCloseTimeout()
    schoolWorkMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsSchoolWorkMenuOpen(false)
      schoolWorkMenuCloseTimeoutRef.current = null
    }, 260)
  }

  function handleSchoolWorkMenuBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return
    }

    scheduleCloseSchoolWorkMenu()
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
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setIsStudentDetailScrollPending(false)
    setStudents([])
    setSelectedStudent(null)
    setSchoolWorkSelectedStudentIds({})
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
    setSelectedGrade('')
    setSelectedClass('')
    setSchoolWorkStudentFilters({})
    setCounselingRefreshKey(0)
    setCounselingCountMap({})
  })

  function buildStudentQuery(gradeValue, classValue) {
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

    const gradeValue = activeSelectedGrade
    const classValue = activeSelectedClass
    const from = reset ? 0 : nextRangeStartRef.current
    const to = from + PAGE_SIZE - 1

    if (reset) {
      if (showRefreshState) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
    } else {
      setIsLoadingMoreStudents(true)
    }

    setErrorMessage('')

    const { data, error, count } = await buildStudentQuery(gradeValue, classValue).range(from, to)

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

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage(getFriendlyAuthErrorMessage(error))
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

    const { data: latestStudentRows, error: latestStudentError } = await supabase
      .from('students')
      .select('student_num')
      .eq('grade', 1)
      .eq('class_num', 1)
      .order('student_num', { ascending: false })
      .limit(1)

    if (latestStudentError) {
      setErrorMessage(getFriendlySupabaseErrorMessage('select', latestStudentError))
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
      setIsCreatingTest(false)
      return
    }

    setIsCreatingTest(false)
    await loadStudents({ reset: true, showRefreshState: true })
  }

  function handleSelectStudent(student, sourceView = activeView) {
    const sourceSchoolWorkModule = SCHOOL_WORK_MODULES.find(
      (module) => module.id === sourceView,
    )

    if (sourceSchoolWorkModule?.usesStudentWorkspace) {
      setSchoolWorkSelectedStudentIds((previous) => ({
        ...previous,
        [sourceSchoolWorkModule.id]: student.id,
      }))
      return
    }

    setSelectedStudent(student)
    setCounselingRefreshKey(0)
    setExpandedCounselingRecordId(null)
  }

  function handleOpenCounselingRecordFromHome(record) {
    if (!previewStudent) {
      return
    }

    setSelectedStudent(previewStudent)
    setExpandedCounselingRecordId(record.id)
    setActiveView('counseling')
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setIsStudentDetailScrollPending(true)
  }

  function handleOpenPreviewStudentCounseling() {
    if (!previewStudent) {
      return
    }

    setSelectedStudent(previewStudent)
    setCounselingRefreshKey(0)
    setExpandedCounselingRecordId(null)
    setActiveView('counseling')
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setIsStudentDetailScrollPending(true)
  }

  function handleOpenPreviewStudentPersonalGradeRecords() {
    if (!previewStudent) {
      return
    }

    const moduleId = personalGradeRecordsModule.id

    setSchoolWorkSelectedStudentIds((previous) => ({
      ...previous,
      [moduleId]: previewStudent.id,
    }))
    setSchoolWorkStudentFilters((previous) => {
      const currentFilters =
        previous[moduleId] ??
        personalGradeRecordsModule.studentWorkspace?.defaultFilters ??
        emptyStudentWorkspaceFilters

      return {
        ...previous,
        [moduleId]: {
          ...currentFilters,
          selectedGrade: String(previewStudent.grade ?? ''),
          selectedClass: String(previewStudent.class_num ?? ''),
        },
      }
    })
    setActiveView(moduleId)
    setIsManagementMenuOpen(false)
    setIsSchoolWorkMenuOpen(false)
    setIsStudentDetailScrollPending(true)
  }

  function handleCounselingSaveSuccess() {
    setCounselingRefreshKey((previous) => previous + 1)
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
      return
    }

    setIsUploadingAvatar(true)
    setErrorMessage('')
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
      setIsUploadingAvatar(false)
      return
    }

    const displayAvatarUrl = withAvatarCacheBust(publicUrl)
    updateStudentAvatarState(selectedStudent.id, displayAvatarUrl)

    const isPublicImageReady = await verifyImageSource(displayAvatarUrl)

    setAvatarPreviewForStudent(selectedStudent.id, '')

    if (!isPublicImageReady) {
      setErrorMessage(
        '사진은 업로드되었지만 공개 이미지 응답이 아직 보이지 않습니다. avatars 버킷이 Public인지 확인해 주세요.',
      )
    }

    setIsUploadingAvatar(false)
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

  function handleClassChipClick(nextGrade, nextClass) {
    const shouldReset =
      activeSelectedGrade === nextGrade && activeSelectedClass === nextClass
    const defaultFilters =
      activeSchoolWorkModule?.studentWorkspace?.defaultFilters ??
      emptyStudentWorkspaceFilters

    const effectiveGrade = isSchoolWorkStudentWorkspaceView
      ? shouldReset
        ? defaultFilters.selectedGrade
        : nextGrade
      : shouldReset
        ? ''
        : nextGrade
    const effectiveClass = isSchoolWorkStudentWorkspaceView
      ? shouldReset
        ? defaultFilters.selectedClass
        : nextClass
      : shouldReset
        ? ''
        : nextClass

    if (isSchoolWorkStudentWorkspaceView) {
      updateActiveSchoolWorkStudentFilters({
        selectedGrade: effectiveGrade,
        selectedClass: effectiveClass,
      })
    } else {
      setSelectedGrade(effectiveGrade)
      setSelectedClass(effectiveClass)
    }

    const currentStudent = isSchoolWorkStudentWorkspaceView
      ? activeSchoolWorkSelectedStudent
      : selectedStudent
    const stillMatches = currentStudent
      ? (!effectiveGrade || String(currentStudent.grade) === effectiveGrade) &&
        (!effectiveClass || String(currentStudent.class_num) === effectiveClass)
      : false

    if (!stillMatches) {
      clearActiveWorkspaceSelectedStudent()
    }
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
      return
    }

    if (duplicateStudent) {
      setFormErrors({
        studentNum: createDuplicateErrorMessage(validation.payload),
      })
      setErrorMessage('')
      return
    }

    const editingTargetId = editingStudentId

    setIsSubmittingForm(true)
    setErrorMessage('')

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
      setIsSubmittingForm(false)
      return
    }

    if (editingTargetId && selectedStudentId === editingTargetId) {
      setSelectedStudent((previous) =>
        previous && previous.id === editingTargetId
          ? { ...previous, ...validation.payload }
          : previous,
      )
    }

    resetStudentForm()
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
  }, [activeSelectedGrade, activeView])

  useEffect(() => {
    return () => {
      clearManagementMenuCloseTimeout()
      clearSchoolWorkMenuCloseTimeout()
    }
  }, [])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage('')
    }, 2400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toastMessage])

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

  const runPruneSelections = useEffectEvent((nextStudents) => {
    const validIds = new Set(nextStudents.map((student) => student.id))

    setSchoolWorkSelectedStudentIds((previous) => {
      const next = {}
      let didChange = false

      for (const [moduleId, studentId] of Object.entries(previous)) {
        if (validIds.has(studentId)) {
          next[moduleId] = studentId
        } else {
          didChange = true
        }
      }

      return didChange ? next : previous
    })

    setSelectedStudent((previous) =>
      previous && !validIds.has(previous.id) ? null : previous,
    )
  })

  const runAutoSelectFirstSchoolWorkStudent = useEffectEvent(
    (moduleId, studentId) => {
      setSchoolWorkSelectedStudentIds((previous) => ({
        ...previous,
        [moduleId]: studentId,
      }))
    },
  )

  useEffect(() => {
    if (!students.length) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      runPruneSelections(students)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [students])

  useEffect(() => {
    if (
      !isSchoolLifeClubInputSelected ||
      !activeWorkspaceSelectedStudentId ||
      !supabase ||
      !authUserId
    ) {
      return
    }

    let isMounted = true

    async function loadSchoolLifeClubDepartments() {
      const { data, error } = await supabase
        .from('personal_grade_records')
        .select('data')
        .eq('student_id', activeWorkspaceSelectedStudentId)
        .eq('school_year', PERSONAL_GRADE_RECORD_SCHOOL_YEAR)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (error) {
        setSchoolLifeClubDepartmentResult({
          departments: emptySchoolLifeClubDepartments,
          error: '개인내신성적관리부 동아리 자료를 불러오지 못했습니다.',
          studentId: activeWorkspaceSelectedStudentId,
        })
        return
      }

      setSchoolLifeClubDepartmentResult({
        departments: createSchoolLifeClubDepartments(data?.data ?? {}),
        error: '',
        studentId: activeWorkspaceSelectedStudentId,
      })
    }

    void loadSchoolLifeClubDepartments()

    return () => {
      isMounted = false
    }
  }, [
    activeWorkspaceSelectedStudentId,
    authUserId,
    isSchoolLifeClubInputSelected,
  ])

  useEffect(() => {
    const moduleId = activeSchoolWorkModule?.id

    if (
      !moduleId ||
      !isSchoolWorkStudentWorkspaceView ||
      !activeSchoolWorkModule?.studentWorkspace?.autoSelectFirstStudent ||
      activeSchoolWorkSelectedStudentId ||
      !students.length
    ) {
      return
    }

    const nextStudent = students.find((student) => {
      const gradeMatches =
        !activeSelectedGrade || String(student.grade) === activeSelectedGrade
      const classMatches =
        !activeSelectedClass || String(student.class_num) === activeSelectedClass

      return gradeMatches && classMatches
    })

    if (!nextStudent) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      runAutoSelectFirstSchoolWorkStudent(moduleId, nextStudent.id)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activeSchoolWorkModule,
    activeSchoolWorkSelectedStudentId,
    activeSelectedClass,
    activeSelectedGrade,
    isSchoolWorkStudentWorkspaceView,
    students,
  ])

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
    activeSelectedGrade,
    activeSelectedClass,
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
    if (!isStudentDetailWorkspaceView || !isStudentDetailScrollPending) {
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
        setIsStudentDetailScrollPending(false)
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(nestedFrameId)
    }
  }, [isStudentDetailScrollPending, isStudentDetailWorkspaceView])

  useEffect(() => {
    if (!isCounselingDataWorkspaceView) {
      return
    }

    if (!supabase || !authUserId || !students.length) {
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
  }, [authUserId, isCounselingDataWorkspaceView, students])

  const isSchoolLifeRecordStudentListOverridden =
    isSchoolLifeRecordsInputView &&
    schoolLifeRecordInputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS &&
    schoolLifeRecordStudentListOverride.isActive
  const visibleStudentList = isSchoolLifeRecordStudentListOverridden
    ? schoolLifeRecordStudentListOverride.students
    : students
  const visibleStudentTotalCount = isSchoolLifeRecordStudentListOverridden
    ? visibleStudentList.length
    : totalStudentCount
  const studentLookupList =
    isSchoolLifeRecordStudentListOverridden && visibleStudentList.length
    ? visibleStudentList
    : students
  const hasVisibleStudents =
    visibleStudentList.length > 0 || isSchoolLifeRecordStudentListOverridden
  const isEditing = editingStudentId !== null
  const isBusy =
    isLoading ||
    isRefreshing ||
    isCreatingTest ||
    isSubmittingForm ||
    isUploadingAvatar ||
    isSigningOut ||
    deletingStudentId !== null
  const hasActiveFilters = Boolean(activeSelectedGrade || activeSelectedClass)
  const activeSchoolWorkSelectedStudent = activeSchoolWorkSelectedStudentId
    ? studentLookupList.find(
        (student) => student.id === activeSchoolWorkSelectedStudentId,
      ) ?? null
    : null
  const activeWorkspaceSelectedStudent = isSchoolWorkStudentWorkspaceView
    ? activeSchoolWorkSelectedStudent
    : selectedStudent
  const previewStudentCounselingCount = previewStudent
    ? counselingCountMap[previewStudent.id] ?? 0
    : 0
  const groupedStudents = groupStudentsBySchoolPrefix(visibleStudentList)
  const defaultStudentWorkspaceHero = {
    badge: 'Student Dashboard',
    title: '학생 목록과 상담 기록을 한 번에 관리해요',
    description:
      '학급 선택과 무한 스크롤 기반 목록으로 많은 학생 데이터도 빠르게 확인할 수 있도록 구성했습니다.',
  }
  const studentWorkspaceHero = isSchoolWorkStudentWorkspaceView
    ? {
        ...defaultStudentWorkspaceHero,
        ...activeSchoolWorkModule?.studentWorkspace?.hero,
      }
    : defaultStudentWorkspaceHero
  const activeClassFilterOptions =
    activeSchoolWorkModule?.studentWorkspace?.classFilterOptions ??
    CLASS_FILTER_OPTIONS

  const studentListSection = hasVisibleStudents ? (
    <section
      className={`list-card list-card--student-grid ${
        isStudentDetailWorkspaceView ? 'list-card--counseling' : 'list-card--home'
      }`}
    >
      <div className="card-header card-header--student-list">
        <div>
          <h2>학생 목록</h2>
        </div>
        <span className="card-count">
          {visibleStudentList.length}/{visibleStudentTotalCount}명
        </span>
      </div>

      <div
        className={`student-grid ${
          isStudentDetailWorkspaceView ? 'student-grid--counseling' : 'student-grid--home'
        }`}
        ref={studentGridScrollRef}
      >
        <div className="student-grid__groups">
          {groupedStudents.map((group) => (
            <ul
              className={`student-grid__list ${
                isStudentDetailWorkspaceView
                  ? 'student-grid__list--counseling'
                  : 'student-grid__list--home'
              }`}
              key={group.key}
            >
              {group.students.map((student) => (
                <li
                  className={`student-grid__item student-grid__item--grade-${student.grade} ${
                    isStudentDetailWorkspaceView
                      ? 'student-grid__item--counseling'
                      : 'student-grid__item--home'
                  } ${
                    activeWorkspaceSelectedStudentId === student.id ? 'is-selected' : ''
                  }`}
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
                      isStudentDetailWorkspaceView ? 'student-grid__avatar--counseling' : ''
                    }`}
                  >
                    {getDisplayedStudentAvatarSrc(student) ? (
                      <img
                        src={getDisplayedStudentAvatarSrc(student)}
                        alt=""
                        loading="lazy"
                        onError={() => {
                          if (!isSchoolWorkStudentWorkspaceView) {
                            setAvatarLoadFailed(student.id, true)
                          }
                        }}
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
                      isStudentDetailWorkspaceView ? 'student-grid__content--counseling' : ''
                    }`}
                  >
                    <div
                      className={`student-grid__identity ${
                        isStudentDetailWorkspaceView ? 'student-grid__identity--counseling' : ''
                      }`}
                    >
                      <p className="student-grid__school-number">
                        {formatSchoolNumber(student)}
                      </p>
                      <strong className="student-grid__name">{student.name}</strong>
                    </div>
                    <span className="student-grid__count">
                      {isSchoolWorkStudentWorkspaceView
                        ? activeSchoolWorkModule?.studentWorkspace?.studentBadge ?? '선택'
                        : `상담 ${counselingCountMap[student.id] ?? 0}회`}
                    </span>
                  </div>

                </li>
              ))}
            </ul>
          ))}
          {!isSchoolLifeRecordStudentListOverridden && isLoadingMoreStudents ? (
            <div className="infinite-status">다음 20명의 학생을 불러오는 중입니다.</div>
          ) : null}

          {!isSchoolLifeRecordStudentListOverridden && hasMoreStudents ? (
            <div className="infinite-sentinel" ref={loadMoreSentinelRef}>
              <span>스크롤을 아래로 내리면 다음 학생을 자동으로 불러옵니다.</span>
            </div>
          ) : null}

          {!isSchoolLifeRecordStudentListOverridden &&
          !hasMoreStudents &&
          totalStudentCount > PAGE_SIZE ? (
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
                <div className="student-summary-actions">
                  <button
                    className="student-summary-action student-summary-action--counseling"
                    type="button"
                    onClick={handleOpenPreviewStudentCounseling}
                  >
                    학생상담
                  </button>
                  {Number(previewStudent.grade) === 1 ? (
                    <button
                      className="student-summary-action student-summary-action--grade-record"
                      type="button"
                      onClick={handleOpenPreviewStudentPersonalGradeRecords}
                    >
                      내신관리
                    </button>
                  ) : null}
                </div>
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
            학생 추가, 수정, 삭제 이후에도 목록과 학급 선택 결과가 자연스럽게
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

  const schoolLifeProfileQualityPicker = (
    <>
      {isSchoolLifeSelfGovernmentInputSelected ? (
        <div className="student-quality-picker-panel">
          <div
            className="student-quality-picker"
            aria-label="학생역량과 품성 선택"
          >
            {SCHOOL_LIFE_QUALITY_GROUPS.map((group) => (
              <div
                className={`student-quality-picker__group student-quality-picker__group--${group.id}`}
                key={group.id}
              >
                <button
                  className="student-quality-picker__label"
                  type="button"
                  aria-label={`${group.label.replace(/\s+/g, '')} 랜덤 선택`}
                  onClick={() =>
                    handleRandomSelectSchoolLifeQualityGroup(group.id)
                  }
                >
                  {group.label}
                </button>
                <div
                  className={`student-quality-picker__options student-quality-picker__options--${group.id}`}
                >
                  {group.options.map((option) => {
                    const isSelected =
                      activeSchoolLifeQualitySelection[group.id]?.includes(
                        option,
                      ) ?? false

                    return (
                      <button
                        className={`student-quality-picker__button student-quality-picker__button--${group.id} ${
                          isSelected ? 'is-selected' : ''
                        }`}
                        type="button"
                        key={option}
                        aria-pressed={isSelected}
                        onClick={() =>
                          toggleSchoolLifeQualitySelection(group.id, option)
                        }
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {shouldShowSchoolLifeSubjectAbilityCompetencyPicker ? (
        <div className="student-quality-picker-panel">
          <div
            className="student-quality-picker"
            aria-label={`${schoolLifeSubjectAbilityHeaderState.subjectLabel} 학생역량 선택`}
          >
            <div className="student-quality-picker__group student-quality-picker__group--competencies">
              <button
                className="student-quality-picker__label"
                type="button"
                aria-label="학생역량 랜덤 선택"
                onClick={() =>
                  handleRandomSelectSchoolLifeCompetencies(
                    schoolLifeSubjectAbilityHeaderState.competencyOptions,
                  )
                }
              >
                {'학생\n역량'}
              </button>
              <div className="student-quality-picker__options student-quality-picker__options--competencies">
                {schoolLifeSubjectAbilityHeaderState.competencyOptions.map(
                  (option) => {
                    const isSelected =
                      activeSchoolLifeQualitySelection.competencies?.includes(
                        option,
                      ) ?? false

                    return (
                      <button
                        className={`student-quality-picker__button student-quality-picker__button--competencies ${
                          isSelected ? 'is-selected' : ''
                        }`}
                        type="button"
                        key={option}
                        aria-pressed={isSelected}
                        onClick={() =>
                          toggleSchoolLifeQualitySelection(
                            'competencies',
                            option,
                          )
                        }
                      >
                        {option}
                      </button>
                    )
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  const studentView = (
    <>
      <section className="hero-card">
        <div className="hero-content">
          <p className="hero-badge">{studentWorkspaceHero.badge}</p>
          <h1>{studentWorkspaceHero.title}</h1>
          <p className="hero-copy">{studentWorkspaceHero.description}</p>
        </div>

        <div className="hero-side">
          <div className="summary-chip">
            <span>{hasActiveFilters ? '현재 선택 조건' : '전체 학생 수'}</span>
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
                  className={`chip-row chip-row--class-picker ${
                    activeView === 'home' ||
                    activeSchoolWorkModule?.id === personalGradeRecordsModule.id
                      ? 'chip-row--personal-grade-records'
                      : ''
                  }`}
                  role="tablist"
                  aria-label="학급 선택"
                >
                  {activeClassFilterOptions.map((option) => (
                    <button
                      key={`${option.grade}-${option.classNum}`}
                      className={`chip-button chip-button--grade-${option.grade || 'all'} ${
                        activeSelectedGrade === option.grade &&
                        activeSelectedClass === option.classNum
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
                {ActiveStudentWorkspaceHeaderActions ? (
                  <div className="student-discovery__module-actions">
                    <ActiveStudentWorkspaceHeaderActions
                      selectedClass={activeSelectedClass}
                      selectedGrade={activeSelectedGrade}
                      selectedStudent={activeWorkspaceSelectedStudent}
                      onImportComplete={() =>
                        refreshSchoolWorkModuleData(activeSchoolWorkModule?.id)
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className={`workspace ${
          isStudentDetailWorkspaceView ? 'workspace--counseling' : 'workspace--home'
        }`}
      >
        <div className="main-column">
          {isLoading && !hasVisibleStudents ? (
            isStudentDetailWorkspaceView ? (
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
              <p>학급 선택을 다시 확인해 보세요.</p>
            </section>
          ) : null}

          {hasVisibleStudents ? (
            isStudentDetailWorkspaceView ? (
              studentListSection
            ) : (
              <div className="home-overview-grid">
                {studentListSection}
                {homeHistoryPreviewSection}
              </div>
            )
          ) : null}
        </div>

        {isStudentDetailWorkspaceView ? (
          <aside className="detail-column" ref={detailColumnRef}>
            <section className="detail-card">
              {!activeWorkspaceSelectedStudent ? (
                <div className="detail-placeholder">
                  <div className="empty-icon">
                    {isCounselingView
                      ? '상'
                      : activeSchoolWorkModule?.studentWorkspace?.emptyState?.icon ?? '업'}
                  </div>
                  <h2>
                    {isCounselingView
                      ? '학생을 선택하면 학생 상담 폼이 열립니다'
                      : activeSchoolWorkModule?.studentWorkspace?.emptyState?.title}
                  </h2>
                  <p>
                    {isCounselingView
                      ? '왼쪽 학생 카드를 클릭하면 해당 학생의 상담 입력 폼과 과거 상담 내역이 이 영역에 함께 표시됩니다.'
                      : activeSchoolWorkModule?.studentWorkspace?.emptyState?.description}
                  </p>
                  {!isCounselingView && ActiveStudentWorkspacePlaceholderDetails ? (
                    <ActiveStudentWorkspacePlaceholderDetails
                      dataRefreshKey={activeSchoolWorkDataRefreshKey}
                      selectedClass={activeSelectedClass}
                      selectedGrade={activeSelectedGrade}
                    />
                  ) : null}
                </div>
              ) : (
                <>
                  {isSchoolLifeRecordsInputView ? (
                    <div
                      className="school-life-records-mode-tabs school-life-records-mode-tabs--profile-top"
                      aria-label="학교생활기록부 입력 방식"
                      role="tablist"
                    >
                      <button
                        aria-selected={
                          schoolLifeRecordInputMode ===
                          SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL
                        }
                        className={`school-life-records-mode-tab ${
                          schoolLifeRecordInputMode ===
                          SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL
                            ? 'is-active'
                            : ''
                        }`}
                        role="tab"
                        type="button"
                        onClick={() =>
                          setSchoolLifeRecordInputMode(
                            SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL,
                          )
                        }
                      >
                        개인별 입력
                      </button>
                      <button
                        aria-selected={
                          schoolLifeRecordInputMode ===
                          SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS
                        }
                        className={`school-life-records-mode-tab ${
                          schoolLifeRecordInputMode ===
                          SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS
                            ? 'is-active'
                            : ''
                        }`}
                        role="tab"
                        type="button"
                        onClick={() =>
                          setSchoolLifeRecordInputMode(
                            SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS,
                          )
                        }
                      >
                        전체 입력
                      </button>
                      <button
                        aria-selected={
                          schoolLifeRecordInputMode ===
                          SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY
                        }
                        className={`school-life-records-mode-tab ${
                          schoolLifeRecordInputMode ===
                          SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY
                            ? 'is-active'
                            : ''
                        }`}
                        role="tab"
                        type="button"
                        onClick={() =>
                          setSchoolLifeRecordInputMode(
                            SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY,
                          )
                        }
                      >
                        유사도 검사
                      </button>
                    </div>
                  ) : null}

                  {isSchoolLifeRecordsInputView &&
                  schoolLifeRecordInputMode ===
                    SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL ? (
                    <div
                      className="school-life-records-section-tabs school-life-records-personal-section-tabs"
                      aria-label="개인별 입력 항목 선택"
                      role="tablist"
                    >
                      {SCHOOL_LIFE_PERSONAL_SECTION_OPTIONS.map((section) => (
                        <button
                          aria-selected={
                            schoolLifeRecordPersonalSectionId === section.id
                          }
                          className={`school-life-records-section-tab ${
                            schoolLifeRecordPersonalSectionId === section.id
                              ? 'is-active'
                              : ''
                          }`}
                          key={section.id}
                          role="tab"
                          type="button"
                          onClick={() =>
                            setSchoolLifeRecordPersonalSectionId(section.id)
                          }
                        >
                          {section.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {shouldShowActiveStudentDetailHeader ? (
                  <div className="detail-header">
                    <div
                      className={`detail-profile ${
                        isSchoolLifeRecordsInputView
                          ? 'detail-profile--record-input'
                          : ''
                      } ${
                        isSchoolLifeClubInputSelected
                          ? 'detail-profile--club-input'
                          : ''
                      }`}
                    >
                      {isSchoolLifeRecordsInputView ? (
                        <div className="detail-profile__identity-stack">
                          <div className="detail-profile__student-stack">
                            <div className="detail-profile__avatar-button detail-profile__avatar-button--static">
                              <div className="detail-profile__avatar">
                                {getDisplayedStudentAvatarSrc(activeWorkspaceSelectedStudent) ? (
                                  <img
                                    src={getDisplayedStudentAvatarSrc(activeWorkspaceSelectedStudent)}
                                    alt={`${activeWorkspaceSelectedStudent.name} 프로필`}
                                    className="detail-profile__avatar-image"
                                  />
                                ) : (
                                  <span
                                    className="detail-profile__fallback"
                                    style={{
                                      backgroundColor: getStudentAvatarTheme(activeWorkspaceSelectedStudent).background,
                                      color: getStudentAvatarTheme(activeWorkspaceSelectedStudent).color,
                                    }}
                                  >
                                    {getStudentInitial(activeWorkspaceSelectedStudent)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <h2 className="detail-profile__caption">
                              {activeWorkspaceSelectedStudent.grade}학년{' '}
                              {activeWorkspaceSelectedStudent.class_num}반{' '}
                              {activeWorkspaceSelectedStudent.student_num}번{' '}
                              {activeWorkspaceSelectedStudent.name}
                            </h2>
                          </div>
                          {shouldShowSchoolLifeProfileQualityPicker ? (
                            <div className="detail-profile__quality-inline">
                              {schoolLifeProfileQualityPicker}
                            </div>
                          ) : null}
                          {shouldShowSchoolLifeSubjectAbilitySubjectButtons ? (
                            <div
                              className="detail-profile__subject-buttons"
                              aria-label="과목 세부능력특기사항 과목 선택"
                              role="group"
                            >
                              {schoolLifeSubjectAbilityHeaderState.subjects.map(
                                (subject) => (
                                  <button
                                    className={`detail-profile__subject-button ${
                                      schoolLifeSubjectAbilityHeaderState.selectedSubjectId ===
                                      subject.id
                                        ? 'is-active'
                                        : ''
                                    }`}
                                    type="button"
                                    key={subject.id}
                                    aria-pressed={
                                      schoolLifeSubjectAbilityHeaderState.selectedSubjectId ===
                                      subject.id
                                    }
                                    onClick={() =>
                                      schoolLifeSubjectAbilityHeaderState.onSubjectButtonClick(
                                        subject.id,
                                      )
                                    }
                                  >
                                    {subject.label}
                                  </button>
                                ),
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : isCounselingView ? (
                        <button
                          className="detail-profile__avatar-button"
                          type="button"
                          onClick={openAvatarFilePicker}
                          disabled={isUploadingAvatar}
                          aria-label={`${activeWorkspaceSelectedStudent.name} 학생 프로필 사진 업로드`}
                        >
                          <div className="detail-profile__avatar">
                            {getDisplayedStudentAvatarSrc(activeWorkspaceSelectedStudent) ? (
                              <img
                                src={getDisplayedStudentAvatarSrc(activeWorkspaceSelectedStudent)}
                                alt={`${activeWorkspaceSelectedStudent.name} 프로필`}
                                className="detail-profile__avatar-image"
                                onError={() =>
                                  setAvatarLoadFailed(activeWorkspaceSelectedStudent.id, true)
                                }
                              />
                            ) : (
                              <span
                                className="detail-profile__fallback"
                                style={{
                                  backgroundColor: getStudentAvatarTheme(activeWorkspaceSelectedStudent).background,
                                  color: getStudentAvatarTheme(activeWorkspaceSelectedStudent).color,
                                }}
                              >
                                {getStudentInitial(activeWorkspaceSelectedStudent)}
                              </span>
                            )}

                            {isUploadingAvatar ? (
                              <span className="detail-profile__overlay" aria-hidden="true">
                                <span className="avatar-spinner" />
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ) : (
                        <div className="detail-profile__avatar-button detail-profile__avatar-button--static">
                          <div className="detail-profile__avatar">
                            {getDisplayedStudentAvatarSrc(activeWorkspaceSelectedStudent) ? (
                              <img
                                src={getDisplayedStudentAvatarSrc(activeWorkspaceSelectedStudent)}
                                alt={`${activeWorkspaceSelectedStudent.name} 프로필`}
                                className="detail-profile__avatar-image"
                              />
                            ) : (
                              <span
                                className="detail-profile__fallback"
                                style={{
                                  backgroundColor: getStudentAvatarTheme(activeWorkspaceSelectedStudent).background,
                                  color: getStudentAvatarTheme(activeWorkspaceSelectedStudent).color,
                                }}
                              >
                                {getStudentInitial(activeWorkspaceSelectedStudent)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {isSchoolLifeClubInputSelected ? (
                        <div
                          className="school-life-club-departments"
                          aria-label="동아리 활동 부서 정보"
                        >
                          {SCHOOL_LIFE_CLUB_DEPARTMENT_ITEMS.map((item) => {
                            const value =
                              activeSchoolLifeClubDepartments[item.id]

                            return (
                              <div
                                className={`school-life-club-department school-life-club-department--${item.id}`}
                                key={item.id}
                              >
                                <span>{item.label}</span>
                                <strong
                                  className={`school-life-club-department__value ${
                                    !isLoadingSchoolLifeClubDepartments && !value
                                      ? 'is-empty'
                                      : ''
                                  }`}
                                >
                                  {isLoadingSchoolLifeClubDepartments
                                    ? '불러오는 중...'
                                    : value || '미입력'}
                                </strong>
                              </div>
                            )
                          })}

                          {schoolLifeClubDepartmentsError ? (
                            <p className="school-life-club-departments__error">
                              {schoolLifeClubDepartmentsError}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {isCounselingView ? (
                        <input
                          ref={avatarFileInputRef}
                          className="visually-hidden"
                          type="file"
                          accept="image/*"
                          onChange={handleStudentAvatarChange}
                        />
                      ) : null}

                      {!isSchoolLifeRecordsInputView ? (
                      <div className="detail-profile__copy">
                        {!isSchoolLifeRecordsInputView ? (
                          <h2>
                            {activeWorkspaceSelectedStudent.grade}학년{' '}
                            {activeWorkspaceSelectedStudent.class_num}반{' '}
                            {activeWorkspaceSelectedStudent.student_num}번{' '}
                            {activeWorkspaceSelectedStudent.name}
                          </h2>
                        ) : null}
                      </div>
                      ) : null}
                    </div>

                    {isCounselingView ||
                    schoolWorkHeaderActions ||
                    !isSchoolLifeRecordsInputView ? (
                      <div className="detail-profile__actions">
                        {isCounselingView ? (
                          <button
                            className="ghost-button camera-button"
                            type="button"
                            onClick={openAvatarFilePicker}
                            disabled={isUploadingAvatar}
                          >
                            {isUploadingAvatar ? '업로드 중...' : '📷 카메라'}
                          </button>
                        ) : null}
                        {schoolWorkHeaderActions ? (
                          schoolWorkHeaderActions
                        ) : (
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={clearActiveWorkspaceSelectedStudent}
                          >
                            선택 해제
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  ) : null}

                  {isCounselingView ? (
                    <section className="detail-section">
                      <div className="section-row">
                        <div />
                      </div>

                      <p className="detail-note">
                        새 상담을 저장하면 같은 화면 아래의 과거 상담 기록 목록이
                        자동으로 갱신됩니다.
                      </p>

                      <CounselingForm
                        key={activeWorkspaceSelectedStudent.id}
                        studentId={activeWorkspaceSelectedStudent.id}
                        studentName={activeWorkspaceSelectedStudent.name}
                        expandedRecordId={expandedCounselingRecordId}
                        onSaveSuccess={handleCounselingSaveSuccess}
                      />
                    </section>
                  ) : ActiveSchoolWorkModule ? (
                    <ActiveSchoolWorkModule
                      dataRefreshKey={activeSchoolWorkDataRefreshKey}
                      inputMode={schoolLifeRecordInputMode}
                      onClassStudentListChange={
                        handleSchoolLifeRecordStudentListChange
                      }
                      onHeaderActionsChange={setSchoolWorkHeaderActions}
                      onSchoolLifeQualitySelectionsChange={
                        applySchoolLifeQualitySelectionsByStudent
                      }
                      onSubjectAbilityHeaderStateChange={
                        setSchoolLifeSubjectAbilityHeaderState
                      }
                      onToast={showToast}
                      personalSectionId={schoolLifeRecordPersonalSectionId}
                      schoolLifeQualities={
                        isSchoolLifeSelfGovernmentInputSelected ||
                        isSchoolLifeSubjectAbilityInputSelected
                          ? activeSchoolLifeQualitySelection
                          : emptySchoolLifeQualitySelection
                      }
                      schoolLifeQualityOptions={{
                        competencies: STUDENT_COMPETENCY_OPTIONS,
                        characters: STUDENT_CHARACTER_OPTIONS,
                      }}
                      selectedClass={activeSelectedClass}
                      selectedGrade={activeSelectedGrade}
                      selectedStudent={activeWorkspaceSelectedStudent}
                      students={students}
                    />
                  ) : null}
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

  const toast = toastMessage ? (
    <div className={`toast toast--${toastTone}`} role="status" aria-live="polite">
      <strong>{toastTone === 'error' ? '처리 실패' : '저장 완료'}</strong>
      <p>{toastMessage}</p>
    </div>
  ) : null

  return (
    <main className="page" ref={pageRef}>
      {toast}
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

            <div
              className={`app-header__nav-dropdown ${
                isSchoolWorkMenuOpen ? 'is-open' : ''
              }`}
              onMouseEnter={openSchoolWorkMenu}
              onMouseLeave={scheduleCloseSchoolWorkMenu}
              onFocus={openSchoolWorkMenu}
              onBlur={handleSchoolWorkMenuBlur}
            >
              <button
                className={`app-header__nav-button app-header__nav-button--dropdown ${
                  isSchoolWorkMenuOpen || ActiveSchoolWorkModule
                    ? 'is-active'
                    : ''
                }`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={isSchoolWorkMenuOpen}
                onClick={() => {
                  if (isSchoolWorkMenuOpen) {
                    closeSchoolWorkMenu()
                  } else {
                    openSchoolWorkMenu()
                  }
                }}
              >
                <span>학교업무</span>
                <span className="app-header__nav-chevron" aria-hidden="true" />
              </button>

              <div
                className="app-header__mega-menu app-header__mega-menu--compact"
                role="menu"
                aria-label="학교업무 메뉴"
              >
                <div className="app-header__mega-menu-grid">
                  {SCHOOL_WORK_MODULES.map((module) => (
                    <button
                      className="app-header__mega-item"
                      key={module.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeSchoolWorkMenu()
                        handleOpenSchoolWorkModule(module.id)
                      }}
                    >
                      <span className="app-header__mega-item-icon" aria-hidden="true">
                        {module.menu.icon}
                      </span>
                      <span className="app-header__mega-item-copy">
                        <strong>{module.menu.title}</strong>
                        <span>{module.menu.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </div>

        <div className="app-header__actions">
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
        : isSchoolWorkStudentWorkspaceView
          ? studentView
          : ActiveSchoolWorkModule
          ? <ActiveSchoolWorkModule />
          : activeView === 'student-create'
            ? studentCreateView
            : activeView === 'photo-matching'
              ? photoMatchingView
              : studentView}
    </main>
  )
}

export default App
