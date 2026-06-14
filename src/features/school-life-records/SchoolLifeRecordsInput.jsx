import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  fetchClassSchoolLifeRecordRows,
  fetchClassStudentRows,
  fetchClubDepartmentOptions,
  fetchClubDepartmentStudentRows,
  fetchComparableSchoolLifeRecordRows,
  fetchSchoolLifeRecordRows,
  fetchSchoolLifeRecordComparisonRows,
  fetchSubjectAbilityReferenceRows,
  getSchoolLifeRecordErrorMessage,
  saveSubjectAbilityReferenceFile,
  saveSubjectAbilityReferenceText,
  saveSchoolLifeRecordValue,
} from './schoolLifeRecordsRepository.js'
import {
  extractPdfTextFromFile,
  isPdfFile,
} from './pdfTextExtractor.js'
import './SchoolLifeRecordsInput.css'

export const SELF_GOVERNMENT_SECTION_ID = 'self-government'
const CLUB_SECTION_ID = 'club'
const SPORTS_CLUB_SECTION_ID = 'sports-club'
const SUBJECT_ABILITY_SECTION_ID = 'subject-ability'
const ACTIVITY_STORAGE_KEY = 'dsy-school-life-self-government-activities-v1'
const RECORD_STORAGE_KEY = 'dsy-school-life-record-values-v1'
const DEFAULT_ACTIVITY_YEAR = '2026'
const SELF_GOVERNMENT_MIN_LENGTH = 350
const SELF_GOVERNMENT_MAX_LENGTH = 450
const CLUB_RECORD_MIN_LENGTH = 100
const CLUB_RECORD_MAX_LENGTH = 200
const MAX_RECORD_SIMILARITY = 0.5
const CAUTION_RECORD_SIMILARITY = 0.3
const SIMILARITY_HIGHLIGHT_MIN_WORDS = 4
const SIMILARITY_HIGHLIGHT_MAX_WORDS = 8
const SIMILARITY_HIGHLIGHT_MIN_COMPACT_LENGTH = 12
const ACTIVITY_PHRASE_COMPARE_WINDOW = 180
const MIN_REPEATED_ACTIVITY_PHRASE_LENGTH = 30
const MAX_DIVERSITY_REPAIR_ATTEMPTS = 2
const CLUB_DIVERSITY_REPAIR_ATTEMPTS = 4
const SIMILARITY_SCOPE_CLASS = 'class'
const SIMILARITY_SCOPE_GRADE = 'grade'
const SIMILARITY_SCOPE_ALL = 'all'
const SUBJECT_REFERENCE_TYPE_STANDARD = 'standard'
const SUBJECT_REFERENCE_TYPE_LEVEL = 'level'
const SUBJECT_REFERENCE_TYPE_EVALUATION = 'evaluation'
const LEGACY_SUBJECT_REFERENCE_TYPE_ASSIGNMENT = 'assignment'
const SUBJECT_REFERENCE_PROMPT_LIMIT = 5500
export const SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL = 'personal'
export const SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS = 'class'
export const SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY = 'similarity'

const SUBJECT_ABILITY_SUBJECT_OPTIONS = [
  { id: 'korean', label: '국어' },
  { id: 'ethics', label: '도덕' },
  { id: 'social-studies', label: '사회' },
  { id: 'math', label: '수학' },
  { id: 'science', label: '과학' },
  { id: 'english', label: '영어' },
  { id: 'information', label: '정보' },
  { id: 'technology-home-economics', label: '기가' },
  { id: 'music', label: '음악' },
  { id: 'art', label: '미술' },
  { id: 'pe', label: '체육' },
  { id: 'hanja', label: '한문' },
]

const MUSIC_SUBJECT_COMPETENCY_OPTIONS = [
  '가창 능력',
  '기악 연주',
  '신체 표현',
  '앙상블 조율',
  '감정 표현력',
  '무대 수행력',
  '청음 및 음감',
  '음악 분석력',
  '맥락 이해력',
  '비평적 사고',
  '다양성 존중',
  '심미적 감수성',
  '음악 창작력',
  '디지털 활용',
  '문제 해결력',
  '융합적 사고',
  '음악적 상상',
  '협업 팀워크',
  '경청과 공감',
  '인내와 끈기',
  '문화적 소통',
  '정서적 조절',
]

const emptySchoolLifeQualities = {
  competencies: [],
  characters: [],
}

const similarityScopeOptions = [
  {
    id: SIMILARITY_SCOPE_CLASS,
    label: '우리 반',
  },
  {
    id: SIMILARITY_SCOPE_GRADE,
    label: '같은 학년',
  },
  {
    id: SIMILARITY_SCOPE_ALL,
    label: '전체 학년',
  },
]

const selfGovernmentRecordSection = {
  id: SELF_GOVERNMENT_SECTION_ID,
  label: '자율자치 활동',
  placeholder: '자율자치 활동 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 자율자치 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '학급 자치 활동에 성실히 참여하고 맡은 역할을 책임감 있게 수행함.',
}

const clubRecordSection = {
  id: CLUB_SECTION_ID,
  label: '동아리 활동',
  placeholder: '동아리 활동 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 동아리 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '동아리 활동에 꾸준히 참여하며 활동 과정에서 맡은 역할을 성실히 수행함.',
}

const sportsClubRecordSection = {
  id: SPORTS_CLUB_SECTION_ID,
  label: '학교스포츠클럽',
  placeholder: '학교스포츠클럽 활동 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 학교스포츠클럽 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '학교스포츠클럽 활동에 성실히 참여하며 규칙을 지키고 친구들과 협력하는 태도를 보임.',
}

const careerRecordSection = {
  id: 'career',
  label: '진로 활동',
  placeholder: '진로 활동 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 진로 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '진로 활동에 성실히 참여하며 자신의 흥미와 강점을 살피고 진로 목표를 구체화함.',
}

const freeSemesterSubjectRecordSection = {
  id: 'free-semester-subject',
  label: '자유학기(주제선택)',
  placeholder: '자유학기 주제선택 활동 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 자유학기 주제선택 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '자유학기 주제선택 활동에 성실히 참여하며 주제에 대한 흥미와 이해를 넓힘.',
}

const freeSemesterCareerRecordSection = {
  id: 'free-semester-career',
  label: '자유학기(진로선택)',
  placeholder: '자유학기 진로선택 활동 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 자유학기 진로선택 활동 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '자유학기 진로선택 활동에 성실히 참여하며 자신의 흥미와 진로 방향을 탐색함.',
}

const subjectAbilityRecordSection = {
  id: SUBJECT_ABILITY_SECTION_ID,
  label: '과목 세부능력특기사항',
  placeholder: '과목 세부능력특기사항 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 과목세부능력특기사항 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '수업 활동에 성실히 참여하며 학습 내용을 이해하고 과제 수행 과정에서 자신의 생각을 구체적으로 표현함.',
}

const behaviorRecordSection = {
  id: 'behavior',
  label: '행동특성 및 종합의견',
  placeholder: '행동특성 및 종합의견 내용을 입력하세요.',
  promptGuide:
    '중학교 학교생활기록부의 행동특성 및 종합의견 내용을 교사가 기록하는 문체로 작성해 주세요.',
  fallbackMemo:
    '학교생활에 성실히 참여하며 자신의 강점을 바탕으로 공동체 안에서 긍정적인 태도를 보임.',
}

const personalRecordSections = [
  selfGovernmentRecordSection,
  clubRecordSection,
  sportsClubRecordSection,
  careerRecordSection,
  freeSemesterSubjectRecordSection,
  freeSemesterCareerRecordSection,
  subjectAbilityRecordSection,
  behaviorRecordSection,
]

const classRecordSections = [
  selfGovernmentRecordSection,
  clubRecordSection,
  sportsClubRecordSection,
  careerRecordSection,
  freeSemesterSubjectRecordSection,
  freeSemesterCareerRecordSection,
  subjectAbilityRecordSection,
  behaviorRecordSection,
]

const allRecordSections = [
  selfGovernmentRecordSection,
  clubRecordSection,
  sportsClubRecordSection,
  careerRecordSection,
  freeSemesterSubjectRecordSection,
  freeSemesterCareerRecordSection,
  subjectAbilityRecordSection,
  behaviorRecordSection,
]

const SERVICE_ACTIVITY_KEYWORDS = [
  '봉사',
  '나눔',
  '기부',
  '모금',
  '대청소',
  '환경정화',
  '정화활동',
  '캠페인',
]

const CAREER_ACTIVITY_KEYWORDS = ['진로', '직업', '꿈', '진학', '고교학점제']

const ACTIVITY_TOPIC_GUIDES = [
  {
    keywords: ['학교폭력', '폭력예방', '사이버폭력', '따돌림'],
    focus:
      '학교폭력의 유형과 피해, 방관하지 않는 태도, 신고와 도움 요청, 갈등의 평화적 해결',
    requiredTerms: [
      '따돌림',
      '언어폭력',
      '사이버폭력',
      '피해',
      '방관',
      '신고',
      '도움 요청',
      '갈등',
      '평화',
    ],
    fallbackFocus:
      '학교폭력의 유형과 피해를 이해하고 방관하지 않는 태도와 신고 및 도움 요청 방법을 익혔으며',
  },
  {
    keywords: ['아동학대', '학대예방'],
    focus:
      '아동의 권리와 안전, 학대의 유형과 위험 신호, 신뢰할 수 있는 어른에게 도움을 요청하는 방법',
    requiredTerms: [
      '권리',
      '안전',
      '위험 신호',
      '신고',
      '도움 요청',
      '보호',
    ],
    fallbackFocus:
      '아동의 권리와 안전을 이해하고 학대의 위험 신호를 살피며 필요한 경우 도움을 요청하는 방법을 익혔으며',
  },
  {
    keywords: ['안전', '재난', '화재', '지진', '교통', '응급', '심폐소생'],
    focus:
      '위험 상황 예측, 안전수칙 준수, 사고 예방, 대피와 응급 대처 방법',
    requiredTerms: ['위험', '안전수칙', '사고', '대피', '대처', '응급'],
    fallbackFocus:
      '위험 상황을 예측하고 안전수칙을 지키며 사고 예방과 대피 및 응급 대처 방법을 익혔으며',
  },
  {
    keywords: ['장애', '인식개선'],
    focus:
      '장애 인권, 편견 줄이기, 접근성과 정당한 편의, 서로의 차이를 존중하는 태도',
    requiredTerms: ['인권', '편견', '접근성', '존중', '차이', '편의'],
    fallbackFocus:
      '장애 인권과 접근성의 의미를 이해하고 편견을 줄이며 서로의 차이를 존중하는 태도를 익혔으며',
  },
  {
    keywords: ['생명존중', '자살', '마음건강', '정서'],
    focus:
      '생명의 소중함, 마음 건강을 돌보는 방법, 위기 신호 파악, 도움 요청',
    requiredTerms: ['생명', '마음', '위기', '도움 요청', '상담', '존중'],
    fallbackFocus:
      '생명의 소중함과 마음 건강을 돌보는 방법을 이해하고 위기 신호를 발견하면 도움을 요청하는 태도를 익혔으며',
  },
  {
    keywords: ['흡연', '음주', '약물', '마약'],
    focus:
      '건강에 미치는 영향, 유해 물질 거절 방법, 예방을 위한 생활 습관과 책임 있는 선택',
    requiredTerms: ['건강', '유해', '거절', '생활 습관', '책임'],
    fallbackFocus:
      '유해 물질이 건강에 미치는 영향을 이해하고 권유를 거절하며 예방을 위한 생활 습관을 익혔으며',
  },
  {
    keywords: ['성폭력', '성교육', '성희롱', '성매매', '디지털 성범죄'],
    focus:
      '자기 몸의 경계 존중, 동의의 의미, 피해 예방, 신고와 도움 요청, 디지털 안전',
    requiredTerms: ['경계', '동의', '피해', '신고', '도움 요청', '디지털'],
    fallbackFocus:
      '자기 몸의 경계와 동의의 의미를 이해하고 피해 예방과 신고 및 도움 요청 방법을 익혔으며',
  },
  {
    keywords: ['정보통신', '개인정보', '인터넷', '스마트폰', '디지털', '저작권'],
    focus:
      '개인정보 보호, 사이버 예절, 저작권 존중, 디지털 공간에서의 책임 있는 행동',
    requiredTerms: ['보호', '사이버', '예절', '저작권', '책임'],
    fallbackFocus:
      '개인정보 보호와 사이버 예절의 필요성을 이해하고 디지털 공간에서 책임 있게 행동하는 방법을 익혔으며',
  },
  {
    keywords: ['인권', '양성평등', '다문화', '차별'],
    focus:
      '인권 감수성, 차별 예방, 다양한 배경과 관점 존중, 평등한 관계 형성',
    requiredTerms: ['인권', '차별', '존중', '평등', '다양성', '관점'],
    fallbackFocus:
      '인권 감수성과 차별 예방의 중요성을 이해하고 다양한 배경과 관점을 존중하는 태도를 익혔으며',
  },
  {
    keywords: ['자치', '학급회의', '학생회', '선거'],
    focus:
      '민주적 의사결정, 의견 제안과 경청, 역할 분담, 학급 공동체 문제 해결',
    requiredTerms: ['의견', '경청', '의사결정', '역할', '학급', '공동체'],
    fallbackFocus:
      '민주적인 의사결정 과정을 이해하고 의견을 제안하며 친구들의 생각을 경청하는 태도를 익혔으며',
  },
  {
    keywords: CAREER_ACTIVITY_KEYWORDS,
    focus:
      '자신의 흥미와 강점 탐색, 직업 세계 이해, 진로 목표 설정과 실천 계획',
    requiredTerms: ['흥미', '강점', '직업 세계', '목표', '계획'],
    fallbackFocus:
      '자신의 흥미와 강점을 탐색하고 직업 세계를 이해하며 진로 목표와 실천 계획을 구체화했으며',
  },
  {
    keywords: SERVICE_ACTIVITY_KEYWORDS,
    focus:
      '주변을 살피는 태도, 맡은 역할 수행, 공동체에 필요한 도움 제공, 환경과 생활 공간 개선',
    requiredTerms: ['도움', '역할', '공동체', '환경', '실천', '배려'],
    fallbackFocus:
      '주변에 필요한 도움을 살피고 맡은 역할을 수행하며 공동체와 생활 공간을 개선하는 태도를 익혔으며',
  },
  {
    keywords: ['독도', '통일', '나라사랑', '민주시민'],
    focus:
      '공동체와 사회 문제에 대한 관심, 역사와 평화의 가치, 시민으로서의 책임',
    requiredTerms: ['역사', '평화', '시민', '책임', '공동체', '사회'],
    fallbackFocus:
      '역사와 평화의 가치를 이해하고 공동체와 사회 문제에 관심을 갖는 시민의 책임을 익혔으며',
  },
]

const DEFAULT_ACTIVITY_TOPIC_GUIDE = {
  focus:
    '활동명에 포함된 핵심 주제어와 실제로 배운 내용, 그 활동에서 실천할 수 있는 구체적 행동',
  requiredTerms: [],
  fallbackFocus:
    '활동명에 담긴 핵심 주제와 배운 내용을 연결하여 필요한 태도와 실천 방법을 정리했으며',
}

const ACTIVITY_EXPRESSION_VARIANTS = [
  {
    keywords: ['학교폭력', '폭력예방', '사이버폭력', '따돌림'],
    focusVariants: [
      '장난과 폭력의 경계를 구분하고 피해 학생의 입장에서 상황을 바라보는 내용',
      '언어폭력, 따돌림, 사이버폭력 사례를 통해 방관의 문제와 신고 절차를 생각하는 내용',
      '갈등이 커지기 전에 도움을 요청하고 안전한 관계를 회복하는 방법',
      '피해를 발견했을 때 혼자 해결하려 하지 않고 주변 어른과 연결하는 태도',
    ],
    fallbackFocuses: [
      '장난과 폭력의 경계를 구분하고 피해 학생의 입장에서 상황을 바라보며 도움 요청 절차를 확인했으며',
      '언어폭력과 사이버폭력 사례를 살피며 방관의 문제를 이해하고 안전한 신고 방법을 익혔으며',
      '갈등 상황에서 감정적으로 대응하기보다 주변 어른에게 알리고 도움을 구하는 절차를 정리했으며',
      '친구 관계에서 생길 수 있는 폭력의 신호를 살피고 피해를 줄이기 위한 말과 행동을 생각했으며',
    ],
  },
  {
    keywords: ['아동학대', '학대예방'],
    focusVariants: [
      '아동의 권리, 안전한 보호 환경, 위험 신호를 알아차리는 방법',
      '학대 상황을 혼자 감추지 않고 신뢰할 수 있는 어른에게 알리는 절차',
      '몸과 마음의 안전을 지키기 위해 도움을 요청하는 구체적 방법',
      '권리 침해 상황을 발견했을 때 필요한 보호와 신고의 의미',
    ],
    fallbackFocuses: [
      '아동의 권리와 안전한 보호 환경의 의미를 알고 위험 신호를 알아차리는 방법을 익혔으며',
      '학대가 의심되는 상황을 혼자 감추지 않고 신뢰할 수 있는 어른에게 알리는 절차를 확인했으며',
      '몸과 마음의 안전을 지키기 위해 필요한 도움을 요청하는 방법을 구체적으로 정리했으며',
      '권리 침해 상황을 발견했을 때 보호와 신고가 왜 필요한지 생각했으며',
    ],
  },
  {
    keywords: ['안전', '재난', '화재', '지진', '교통', '응급', '심폐소생'],
    focusVariants: [
      '위험 징후를 미리 살피고 상황별 안전수칙을 적용하는 방법',
      '대피 순서, 주변 확인, 침착한 대응처럼 실제 장면에서 필요한 절차',
      '사고 예방을 위해 자신의 행동과 주변 환경을 점검하는 태도',
      '응급 상황에서 당황하지 않고 도움을 요청하는 과정',
    ],
    fallbackFocuses: [
      '위험 징후를 미리 살피고 상황에 맞는 안전수칙을 적용하는 방법을 확인했으며',
      '대피 순서와 주변 확인 절차를 익히며 실제 장면에서 침착하게 행동하는 방법을 정리했으며',
      '사고 예방을 위해 자신의 행동과 주변 환경을 점검하는 태도를 익혔으며',
      '응급 상황에서 당황하지 않고 도움을 요청하며 필요한 절차를 따르는 방법을 익혔으며',
    ],
  },
  {
    keywords: ['장애', '인식개선'],
    focusVariants: [
      '장애를 개인의 문제가 아니라 접근성과 지원 환경의 관점에서 이해하는 내용',
      '편견이 생기는 장면을 살피고 서로 다른 생활 방식을 존중하는 태도',
      '정당한 편의와 배리어프리의 의미를 학교생활 장면과 연결하는 내용',
      '도움이 필요한 상황에서 상대의 의사를 먼저 확인하는 태도',
    ],
    fallbackFocuses: [
      '장애를 개인의 문제가 아니라 접근성과 지원 환경의 관점에서 이해했으며',
      '편견이 생기는 장면을 살피고 서로 다른 생활 방식을 존중하는 태도를 익혔으며',
      '정당한 편의와 배리어프리의 의미를 학교생활 장면과 연결해 생각했으며',
      '도움이 필요한 상황에서도 상대의 의사를 먼저 확인하는 태도의 중요성을 이해했으며',
    ],
  },
  {
    keywords: ['자치', '학급회의', '학생회', '선거'],
    focusVariants: [
      '학급 안건을 제안하고 의견을 모아 결정하는 민주적 절차',
      '역할을 나누고 약속을 정하며 학급 운영에 참여하는 과정',
      '다수 의견과 소수 의견을 함께 살피며 합의점을 찾는 태도',
      '학급의 문제를 함께 발견하고 해결 방법을 정하는 경험',
    ],
    fallbackFocuses: [
      '학급 안건을 제안하고 의견을 모아 결정하는 민주적 절차를 이해했으며',
      '역할을 나누고 약속을 정하며 학급 운영에 참여하는 과정을 익혔으며',
      '다수 의견과 소수 의견을 함께 살피며 합의점을 찾는 태도를 배웠으며',
      '학급의 문제를 함께 발견하고 해결 방법을 정하는 경험을 했으며',
    ],
  },
  {
    keywords: SERVICE_ACTIVITY_KEYWORDS,
    focusVariants: [
      '공간의 변화를 살피고 필요한 일을 찾아 공동의 환경을 정돈하는 과정',
      '맡은 구역과 역할을 확인하며 생활 공간을 함께 관리하는 태도',
      '친구들과 순서를 나누어 실천하고 활동 후 달라진 점을 돌아보는 내용',
      '봉사를 단순한 청소가 아니라 함께 쓰는 공간을 책임지는 경험으로 이해하는 내용',
    ],
    fallbackFocuses: [
      '공간의 변화를 살피고 필요한 일을 찾아 공동의 환경을 정돈하는 경험을 했으며',
      '맡은 구역과 역할을 확인하며 생활 공간을 함께 관리하는 태도를 익혔으며',
      '친구들과 순서를 나누어 실천하고 활동 후 달라진 점을 돌아보았으며',
      '봉사를 단순한 청소가 아니라 함께 쓰는 공간을 책임지는 경험으로 이해했으며',
    ],
  },
]

const QUALITY_ACTIVITY_KEYWORD_REQUIREMENTS = [
  {
    qualities: ['봉사정신', '나눔'],
    keywords: SERVICE_ACTIVITY_KEYWORDS,
    instruction:
      '봉사정신과 나눔은 봉사, 기부, 모금, 대청소, 환경정화처럼 실제 봉사 성격이 있는 활동에서만 사용하고 예방교육 문장에는 쓰지 마세요.',
  },
  {
    qualities: ['진로탐색'],
    keywords: CAREER_ACTIVITY_KEYWORDS,
    instruction:
      '진로탐색은 진로, 직업, 진학 관련 활동에서만 사용하고 예방교육 문장에는 쓰지 마세요.',
  },
]

const QUALITY_EXPRESSION_GUIDES = {
  의사소통: {
    activity: '자신의 생각을 분명히 전하고 친구의 의견을 차분히 들으며',
    growth: '서로 다른 의견을 조율하는',
    prompt:
      '자신의 생각을 분명히 말하고 친구의 의견을 경청하며 합의점을 찾는 모습',
  },
  협업: {
    activity: '친구와 역할을 나누고 필요한 절차를 함께 확인하며',
    growth: '공동의 약속을 함께 점검하는',
    prompt: '역할 분담, 함께 확인하기, 공동의 해결 과정에 참여하는 모습',
  },
  자기관리: {
    activity: '해야 할 일을 스스로 점검하고 차분히 실천 순서를 세우며',
    growth: '자신의 생활 습관을 점검하는',
    prompt: '스스로 준비하고 행동을 돌아보며 생활 속 실천으로 이어가는 모습',
  },
  문제해결: {
    activity: '상황의 원인과 해결 절차를 따져 보며',
    growth: '문제 상황에서 해결 방법을 찾아가는',
    prompt: '문제의 원인을 살피고 해결 절차를 선택해 적용하는 모습',
  },
  '창의적 사고': {
    activity: '익숙한 상황에서도 새로운 실천 방법을 떠올리며',
    growth: '다양한 해결 방안을 생각하는',
    prompt: '새로운 관점, 다양한 해결 방법, 생활 속 적용 방안을 떠올리는 모습',
  },
  '비판적 사고': {
    activity: '상황을 그대로 받아들이기보다 근거와 결과를 따져 보며',
    growth: '근거를 바탕으로 판단하는',
    prompt: '근거와 결과를 따져 보고 바른 판단 기준을 세우는 모습',
  },
  정보활용: {
    activity: '필요한 정보를 확인하고 상황에 맞게 활용하며',
    growth: '확인한 정보를 생활 속 판단에 활용하는',
    prompt: '필요한 정보를 찾고 확인한 뒤 실제 상황에 적용하는 모습',
  },
  진로탐색: {
    activity: '자신의 흥미와 강점을 활동 내용과 연결해 살피며',
    growth: '자신의 강점과 목표를 구체화하는',
    prompt: '흥미와 강점을 탐색하고 진로 목표와 실천 계획으로 연결하는 모습',
  },
  학습주도성: {
    activity: '궁금한 점을 스스로 확인하고 배운 내용을 정리하며',
    growth: '배운 내용을 스스로 정리하는',
    prompt: '궁금한 점을 확인하고 배운 내용을 자기 생활과 연결하는 모습',
  },
  갈등조정: {
    activity: '서로 다른 입장을 비교하고 평화로운 해결 방법을 찾으며',
    growth: '갈등 상황을 차분히 조정하는',
    prompt: '서로 다른 입장을 듣고 갈등을 평화롭게 조정하는 모습',
  },
  의사결정: {
    activity: '여러 선택지를 비교하며 책임 있는 판단을 연습하고',
    growth: '상황에 맞는 선택을 책임 있게 하는',
    prompt: '여러 대안을 비교하고 책임 있는 선택으로 이어가는 모습',
  },
  탐구력: {
    activity: '활동의 이유와 절차를 질문하며 핵심 내용을 확인하고',
    growth: '궁금한 점을 끝까지 확인하는',
    prompt: '왜 필요한지 질문하고 절차와 이유를 확인해 이해를 넓히는 모습',
  },
  실행력: {
    activity: '배운 내용을 바로 실천할 방법으로 옮기며',
    growth: '알게 된 내용을 행동으로 옮기는',
    prompt: '알게 된 내용을 구체적인 행동과 실천 계획으로 옮기는 모습',
  },
  적응력: {
    activity: '상황 변화에 맞게 자신의 역할과 행동을 조정하며',
    growth: '새로운 상황에 맞게 행동을 조정하는',
    prompt: '새로운 상황이나 역할 변화에 맞추어 행동을 조정하는 모습',
  },
  표현력: {
    activity: '배운 내용을 자신의 말로 정리해 표현하며',
    growth: '생각을 알맞은 말로 표현하는',
    prompt: '배운 내용을 자신의 언어로 정리하고 알맞게 표현하는 모습',
  },
  성실함: {
    activity: '활동의 기본 절차를 놓치지 않고 꾸준히 참여하며',
    growth: '맡은 과정을 꾸준히 이어 가는',
    prompt: '정해진 절차를 꾸준히 지키고 성실하게 참여하는 모습',
  },
  배려심: {
    activity: '상대의 어려움과 입장을 먼저 살피며',
    growth: '주변의 상황을 세심하게 살피는',
    prompt: '상대의 어려움과 입장을 먼저 살피고 배려하는 모습',
  },
  존중: {
    activity: '서로의 권리와 생각의 차이를 인정하며',
    growth: '다른 사람의 권리와 생각을 존중하는',
    prompt: '서로의 권리와 생각의 차이를 인정하고 존중하는 모습',
  },
  책임감: {
    activity: '자신이 맡은 역할과 지켜야 할 약속을 분명히 인식하며',
    growth: '맡은 역할을 끝까지 책임지는',
    prompt: '맡은 역할과 약속을 끝까지 지키려는 모습',
  },
  정직함: {
    activity: '상황을 사실대로 바라보고 바른 선택의 필요성을 생각하며',
    growth: '정직한 판단을 생활 속에서 실천하는',
    prompt: '사실을 바탕으로 판단하고 바른 선택을 하려는 모습',
  },
  예의: {
    activity: '상대에게 필요한 말과 행동을 조심스럽게 선택하며',
    growth: '예의를 갖춰 관계를 이어 가는',
    prompt: '상대에게 예의를 갖추고 상황에 맞는 말과 행동을 선택하는 모습',
  },
  공감: {
    activity: '피해자와 주변 친구의 입장에서 상황을 살피며',
    growth: '타인의 감정과 처지를 헤아리는',
    prompt: '타인의 감정과 처지를 헤아리고 필요한 도움을 생각하는 모습',
  },
  끈기: {
    activity: '어려운 내용도 끝까지 확인하며',
    growth: '쉽게 멈추지 않고 꾸준히 확인하는',
    prompt: '어려운 내용도 끝까지 확인하고 꾸준히 실천하는 모습',
  },
  나눔: {
    activity: '주변에 필요한 도움을 찾아 함께 나누며',
    growth: '필요한 도움을 기꺼이 나누는',
    prompt: '봉사 성격의 활동에서 필요한 도움을 찾아 나누는 모습',
  },
  긍정성: {
    activity: '활동의 의미를 긍정적으로 받아들이고 실천 가능성을 찾으며',
    growth: '상황을 긍정적으로 바라보는',
    prompt: '활동의 의미를 긍정적으로 받아들이고 실천 가능성을 찾는 모습',
  },
  인내심: {
    activity: '쉽게 지나치기 쉬운 절차도 차근차근 확인하며',
    growth: '차분히 지속하는',
    prompt: '절차를 차근차근 확인하고 차분히 지속하는 모습',
  },
  질서의식: {
    activity: '공동체의 규칙과 안전 약속을 정확히 확인하며',
    growth: '규칙과 약속을 생활 속에서 지키는',
    prompt: '규칙, 질서, 안전 약속을 확인하고 지키려는 모습',
  },
  친절함: {
    activity: '친구가 이해하기 어려운 부분을 부드럽게 도우며',
    growth: '친구에게 필요한 도움을 따뜻하게 전하는',
    prompt: '친구에게 필요한 도움을 부드럽게 전하고 관계를 살피는 모습',
  },
  신뢰감: {
    activity: '약속한 역할을 안정적으로 수행하려 노력하며',
    growth: '믿고 맡길 수 있는 태도를 보이는',
    prompt: '약속과 역할을 안정적으로 지켜 신뢰를 주는 모습',
  },
  봉사정신: {
    activity: '공동체에 필요한 일을 먼저 찾아 실천하며',
    growth: '공동체를 위해 필요한 일을 실천하는',
    prompt: '봉사 성격의 활동에서 공동체에 필요한 일을 먼저 찾아 실천하는 모습',
  },
}

const DEFAULT_QUALITY_EXPRESSION_GUIDE = {
  activity: '활동에서 확인한 내용을 구체적인 상황과 견주어 보며',
  growth: '확인한 내용을 실제 선택으로 옮기는',
  prompt: '활동에서 배운 내용을 구체적인 행동으로 옮기는 모습',
}

const DEFAULT_QUALITY_ACTIVITY_PHRASES = [
  '활동에서 확인한 내용을 구체적인 상황과 견주어 보며',
  '교육 내용을 자신에게 일어날 수 있는 장면으로 바꾸어 생각하며',
  '배운 절차를 실제 학급 상황에 적용할 방법을 떠올리며',
  '활동의 핵심 내용을 자신의 말로 정리하며',
  '필요한 행동을 스스로 점검하고 다음 상황을 예상하며',
  '주변에서 비슷한 상황이 생겼을 때의 대처를 생각하며',
  '활동 중 알게 된 기준을 자신의 행동과 비교하며',
  '친구들과 나눌 수 있는 실천 방법을 떠올리며',
]

const DEFAULT_GROWTH_PHRASES = [
  '확인한 내용을 실제 선택으로 옮기는',
  '상황에 맞게 판단하고 실천하는',
  '배운 절차를 차분히 떠올리는',
  '자신의 역할을 구체적으로 점검하는',
  '필요한 행동을 먼저 생각하는',
  '학급 상황을 살피며 참여하는',
  '활동의 의미를 다음 경험과 연결하는',
  '친구들과 약속을 확인하는',
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

function createInitialRecordValues() {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const savedValue = window.localStorage.getItem(RECORD_STORAGE_KEY)
    const parsedValue = savedValue ? JSON.parse(savedValue) : {}

    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue
      : {}
  } catch {
    return {}
  }
}

function getClassActivityKey(selectedGrade, selectedClass, selectedStudent) {
  const grade = selectedGrade || selectedStudent?.grade || 'all'
  const classNum = selectedClass || selectedStudent?.class_num || 'all'

  return `${grade}-${classNum}`
}

function getStudentRecordKey(sectionId, studentId) {
  return `${sectionId}:${studentId ?? 'empty'}`
}

function getSubjectAbilitySectionId(subjectId) {
  return `${SUBJECT_ABILITY_SECTION_ID}:${subjectId || SUBJECT_ABILITY_SUBJECT_OPTIONS[0].id}`
}

function getSubjectAbilitySubjectOption(subjectId) {
  return (
    SUBJECT_ABILITY_SUBJECT_OPTIONS.find((option) => option.id === subjectId) ??
    SUBJECT_ABILITY_SUBJECT_OPTIONS[0]
  )
}

function getSubjectAbilityCompetencyOptions(subjectId, defaultOptions = []) {
  if (subjectId === 'music') {
    return MUSIC_SUBJECT_COMPETENCY_OPTIONS
  }

  return defaultOptions
}

function getKnownRecordSectionIds() {
  return Array.from(
    new Set([
      ...allRecordSections.map((section) => section.id),
      ...SUBJECT_ABILITY_SUBJECT_OPTIONS.map((subject) =>
        getSubjectAbilitySectionId(subject.id),
      ),
    ]),
  )
}

function getSubjectReferenceKey(subjectId, referenceType) {
  return `${subjectId || SUBJECT_ABILITY_SUBJECT_OPTIONS[0].id}:${referenceType}`
}

function getSubjectReferenceTypeLabel(referenceType) {
  if (referenceType === SUBJECT_REFERENCE_TYPE_STANDARD) {
    return '성취기준'
  }

  if (
    referenceType === SUBJECT_REFERENCE_TYPE_EVALUATION ||
    referenceType === LEGACY_SUBJECT_REFERENCE_TYPE_ASSIGNMENT
  ) {
    return '평가항목'
  }

  return '성취수준'
}

function truncateSubjectReferenceText(value) {
  const text = String(value ?? '').trim()

  if (text.length <= SUBJECT_REFERENCE_PROMPT_LIMIT) {
    return text
  }

  return `${text.slice(0, SUBJECT_REFERENCE_PROMPT_LIMIT)}\n...[참고자료 일부 생략]`
}

function getClassGenerationStateKey(sectionId) {
  return `class:${sectionId}`
}

function getStudentSortValue(student) {
  return (
    Number(student?.grade ?? 0) * 1000000 +
    Number(student?.class_num ?? 0) * 10000 +
    Number(student?.student_num ?? 0)
  )
}

function sortClassStudents(students) {
  return [...(students ?? [])].sort(
    (left, right) => getStudentSortValue(left) - getStudentSortValue(right),
  )
}

function getStudentDisplayLabel(student) {
  return `${student.grade}학년 ${student.class_num}반 ${student.student_num}번 ${student.name}`
}

function getStudentCodeLabel(student) {
  return `${student.grade}${student.class_num}${String(student.student_num).padStart(2, '0')}`
}

function getStudentSimilarityIdentityLabel(student) {
  return `${getStudentCodeLabel(student)} ${student.name ?? ''}`.trim()
}

function getSimilarityScopeLabel(scope) {
  return (
    similarityScopeOptions.find((option) => option.id === scope)?.label ??
    similarityScopeOptions[0].label
  )
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

function normalizeKeywordSource(value) {
  return String(value ?? '').replace(/\s+/g, '').toLowerCase()
}

function includesAnyKeyword(value, keywords) {
  const normalizedValue = normalizeKeywordSource(value)

  return keywords.some((keyword) =>
    normalizedValue.includes(normalizeKeywordSource(keyword)),
  )
}

function getActivityTopicGuide(activityContent) {
  return (
    ACTIVITY_TOPIC_GUIDES.find((guide) =>
      includesAnyKeyword(activityContent, guide.keywords),
    ) ?? DEFAULT_ACTIVITY_TOPIC_GUIDE
  )
}

function getActivityExpressionVariant(activityContent) {
  return ACTIVITY_EXPRESSION_VARIANTS.find((variant) =>
    includesAnyKeyword(activityContent, variant.keywords),
  )
}

function getActivityFocusCandidates(activityContent) {
  const guide = getActivityTopicGuide(activityContent)
  const variant = getActivityExpressionVariant(activityContent)

  return variant?.focusVariants?.length ? variant.focusVariants : [guide.focus]
}

function getActivityFallbackFocus(activityContent, usedFocuses = new Set()) {
  const guide = getActivityTopicGuide(activityContent)
  const variant = getActivityExpressionVariant(activityContent)
  const fallbackFocuses =
    variant?.fallbackFocuses?.length ? variant.fallbackFocuses : [guide.fallbackFocus]
  const availableFocuses = fallbackFocuses.filter((focus) => !usedFocuses.has(focus))
  const selectedFocus = getRandomItem(availableFocuses.length ? availableFocuses : fallbackFocuses)

  if (selectedFocus) {
    usedFocuses.add(selectedFocus)
  }

  return selectedFocus ?? guide.fallbackFocus
}

function formatActivityFocusRowsForPrompt(activityRows) {
  return activityRows
    .map((row) => {
      const activityName = formatActivityForRecordSentence(row)
      const focusCandidates = getActivityFocusCandidates(row.content)

      return `${activityName}: ${focusCandidates.join(' / ')} 중 하나를 중심으로 작성하되 문장을 그대로 복사하지 말 것`
    })
    .join('\n')
}

function getQualityRestrictionInstructions(selectedQualities) {
  return QUALITY_ACTIVITY_KEYWORD_REQUIREMENTS.map((rule) => {
    const matchedQualities = selectedQualities.filter((quality) =>
      rule.qualities.includes(quality),
    )

    return matchedQualities.length ? rule.instruction : ''
  }).filter(Boolean)
}

function getQualityExpressionGuide(quality) {
  return QUALITY_EXPRESSION_GUIDES[quality] ?? DEFAULT_QUALITY_EXPRESSION_GUIDE
}

function getQualityActivityPhrase(quality, usedActivityPhrases = new Set()) {
  if (quality && QUALITY_EXPRESSION_GUIDES[quality]) {
    return QUALITY_EXPRESSION_GUIDES[quality].activity
  }

  const availablePhrases = DEFAULT_QUALITY_ACTIVITY_PHRASES.filter(
    (phrase) => !usedActivityPhrases.has(phrase),
  )
  const selectedPhrase = getRandomItem(
    availablePhrases.length ? availablePhrases : DEFAULT_QUALITY_ACTIVITY_PHRASES,
  )

  if (selectedPhrase) {
    usedActivityPhrases.add(selectedPhrase)
  }

  return selectedPhrase ?? DEFAULT_QUALITY_EXPRESSION_GUIDE.activity
}

function getGrowthPhrase(qualityWords = []) {
  const selectedQuality = getRandomItem(qualityWords)

  if (selectedQuality && QUALITY_EXPRESSION_GUIDES[selectedQuality]) {
    return QUALITY_EXPRESSION_GUIDES[selectedQuality].growth
  }

  return getRandomItem(DEFAULT_GROWTH_PHRASES) ?? DEFAULT_QUALITY_EXPRESSION_GUIDE.growth
}

function getRandomItem(items) {
  if (!items.length) {
    return undefined
  }

  return items[Math.floor(Math.random() * items.length)]
}

function formatQualityExpressionGuidesForPrompt(qualities) {
  return [...new Set(qualities)]
    .map((quality) => {
      const guide = getQualityExpressionGuide(quality)

      return `${quality}: ${guide.prompt}`
    })
    .join('\n')
}

function filterQualitiesBySelectedActivities(qualities, selectedActivityRows) {
  if (!selectedActivityRows.length) {
    return qualities
  }

  return qualities.filter((quality) => {
    const rule = QUALITY_ACTIVITY_KEYWORD_REQUIREMENTS.find((candidate) =>
      candidate.qualities.includes(quality),
    )

    if (!rule) {
      return true
    }

    return selectedActivityRows.some((activity) =>
      includesAnyKeyword(activity.content, rule.keywords),
    )
  })
}

function getAllowedSchoolLifeQualitiesForActivities(
  schoolLifeQualities,
  selectedActivityRows,
) {
  return {
    competencies: filterQualitiesBySelectedActivities(
      schoolLifeQualities.competencies ?? [],
      selectedActivityRows,
    ),
    characters: filterQualitiesBySelectedActivities(
      schoolLifeQualities.characters ?? [],
      selectedActivityRows,
    ),
  }
}

function getActivityDateSortValue(activity) {
  const recordDate = formatDateForRecord(activity.date)
  const dateMatch = recordDate.match(/^(\d{4})\.(\d{2})\.(\d{2})\.$/u)

  if (!dateMatch) {
    return Number.MAX_SAFE_INTEGER
  }

  return Number(`${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`)
}

function sortActivityRowsByDate(activityRows) {
  return activityRows
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => {
      const dateDifference =
        getActivityDateSortValue(left.activity) -
        getActivityDateSortValue(right.activity)

      return dateDifference || left.index - right.index
    })
    .map(({ activity }) => activity)
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

  return sortActivityRowsByDate(
    shuffledRows.slice(0, Math.min(targetCount, shuffledRows.length)),
  )
}

function getRandomQualityWords(schoolLifeQualities, targetCount = 4) {
  const qualityWords = [
    ...(schoolLifeQualities.competencies ?? []),
    ...(schoolLifeQualities.characters ?? []),
  ].filter(Boolean)
  const shuffledWords = [...new Set(qualityWords)]

  for (let index = shuffledWords.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledWords[index], shuffledWords[randomIndex]] = [
      shuffledWords[randomIndex],
      shuffledWords[index],
    ]
  }

  return shuffledWords.slice(0, targetCount)
}

function getRandomSchoolLifeQualitySelection(
  schoolLifeQualityOptions,
  minCount = 7,
  maxCount = 12,
) {
  const groupedOptions = [
    ...(schoolLifeQualityOptions.competencies ?? []).map((value) => ({
      group: 'competencies',
      value,
    })),
    ...(schoolLifeQualityOptions.characters ?? []).map((value) => ({
      group: 'characters',
      value,
    })),
  ].filter((option) => option.value)
  const uniqueOptions = []
  const usedValues = new Set()

  groupedOptions.forEach((option) => {
    if (usedValues.has(option.value)) {
      return
    }

    usedValues.add(option.value)
    uniqueOptions.push(option)
  })

  for (let index = uniqueOptions.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[uniqueOptions[index], uniqueOptions[randomIndex]] = [
      uniqueOptions[randomIndex],
      uniqueOptions[index],
    ]
  }

  const targetCount =
    Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount
  const selectedOptions = uniqueOptions.slice(
    0,
    Math.min(targetCount, uniqueOptions.length),
  )
  const selectedGroups = new Set(selectedOptions.map((option) => option.group))

  ;['competencies', 'characters'].forEach((group) => {
    if (selectedGroups.has(group) || !selectedOptions.length) {
      return
    }

    const replacementOption = uniqueOptions.find(
      (option) => option.group === group,
    )

    if (!replacementOption) {
      return
    }

    const replaceIndex = selectedOptions.findIndex(
      (option) => option.group !== group,
    )

    if (replaceIndex >= 0) {
      selectedOptions[replaceIndex] = replacementOption
    }
  })

  return {
    competencies: selectedOptions
      .filter((option) => option.group === 'competencies')
      .map((option) => option.value),
    characters: selectedOptions
      .filter((option) => option.group === 'characters')
      .map((option) => option.value),
  }
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

function normalizeGeneratedRecordPunctuation(text) {
  const terminalEndingPattern =
    /(했음|하였음|였음|었음|았음|익혔음|이해했음|보였음|나타냈음|참여했음|수행했음|정리했음|확인했음|생각했음|적용했음|발전시켰음|확장했음|기여했음|실천했음|구체화했음|함|됨|임|보임|나타냄|기여함|실천함|확인함|정리함|발전시킴|확장함|참여함|수행함|이해함|탐색함|구체화함|익힘)/
  let normalizedText = String(text ?? '')
    .replace(/，/g, ',')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([.!?])\s*,/g, '$1')
    .trim()

  normalizedText = normalizedText.replace(
    new RegExp(`(${terminalEndingPattern.source})\\s*,\\s*(?=[가-힣0-9])`, 'gu'),
    '$1. ',
  )
  normalizedText = normalizedText
    .replace(/\s+/g, ' ')
    .replace(/([.!?]){2,}/g, '$1')
    .replace(/,\s*$/u, '.')
    .trim()

  if (normalizedText && !/[.!?]$/u.test(normalizedText)) {
    normalizedText = `${normalizedText}.`
  }

  return normalizedText
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

function isWithinClubRecordLength(text) {
  const textLength = getRecordTextLength(text)
  return textLength >= CLUB_RECORD_MIN_LENGTH && textLength <= CLUB_RECORD_MAX_LENGTH
}

function normalizeHangulText(value) {
  return String(value ?? '').replace(/[^가-힣]/g, '')
}

function getClubDepartmentTopicKeywords(departmentName) {
  const compactDepartmentName = normalizeHangulText(departmentName)
  const knownTopicWords = [
    '축구',
    '농구',
    '배구',
    '배드민턴',
    '탁구',
    '피구',
    '뉴스포츠',
    '기타',
    '밴드',
    '음악',
    '미술',
    '만화',
    '댄스',
    '독서',
    '과학',
    '탐구',
    '상담',
    '요리',
    '코딩',
    '영어',
    '수학',
    '방송',
    '합창',
    '연극',
    '영화',
    '공예',
    '체스',
  ]
  const keywords = new Set()

  if (compactDepartmentName.length >= 2) {
    keywords.add(compactDepartmentName)
  }

  const trimmedDepartmentName = compactDepartmentName
    .replace(/^기초탄탄/u, '')
    .replace(/(스쿨|교실|클럽|동아리|부서|부|반)$/u, '')

  if (trimmedDepartmentName.length >= 2) {
    keywords.add(trimmedDepartmentName)
  }

  knownTopicWords.forEach((topicWord) => {
    if (compactDepartmentName.includes(topicWord)) {
      keywords.add(topicWord)
    }
  })

  return Array.from(keywords)
}

function isClubGeneratedRecordOnTopic(text, departmentName) {
  const topicKeywords = getClubDepartmentTopicKeywords(departmentName)

  if (!topicKeywords.length) {
    return true
  }

  const compactText = normalizeHangulText(text)

  return topicKeywords.some((keyword) => compactText.includes(keyword))
}

function isValidClubGeneratedText(text, departmentName = '') {
  return (
    isLikelyKoreanRecordText(text, false) &&
    isWithinClubRecordLength(text) &&
    isClubGeneratedRecordOnTopic(text, departmentName)
  )
}

function fitClubRecordLength(text) {
  let fittedText = normalizeGeneratedRecordPunctuation(text)

  if (getRecordTextLength(fittedText) <= CLUB_RECORD_MAX_LENGTH) {
    return fittedText
  }

  let clippedText = Array.from(fittedText)
    .slice(0, CLUB_RECORD_MAX_LENGTH)
    .join('')
    .trim()
  const sentenceBoundaryIndex = Math.max(
    clippedText.lastIndexOf('.'),
    clippedText.lastIndexOf('!'),
    clippedText.lastIndexOf('?'),
  )

  if (sentenceBoundaryIndex >= CLUB_RECORD_MIN_LENGTH) {
    clippedText = clippedText.slice(0, sentenceBoundaryIndex + 1).trim()
  } else {
    const softBoundaryIndex = Math.max(
      clippedText.lastIndexOf(','),
      clippedText.lastIndexOf(' '),
    )

    if (softBoundaryIndex >= CLUB_RECORD_MIN_LENGTH) {
      clippedText = clippedText.slice(0, softBoundaryIndex).trim()
    }
  }

  clippedText = clippedText.replace(/[,\s]+$/u, '').trim()

  if (clippedText && !/[.!?]$/u.test(clippedText)) {
    clippedText = `${clippedText}.`
  }

  return clippedText
}

function isUsableClubGeneratedText(text) {
  return isLikelyKoreanRecordText(text, false) && isWithinClubRecordLength(text)
}

const CLUB_RECORD_WRITING_VARIANTS = [
  {
    id: 'preparation',
    instruction:
      '첫 문장은 준비물, 순서, 역할 확인 장면에서 시작하고, 두 번째 문장은 보완점이나 다음 연습 방향을 정리하는 흐름으로 쓰세요.',
  },
  {
    id: 'practice',
    instruction:
      '첫 문장은 반복 연습이나 수행 장면을 중심으로 쓰고, 두 번째 문장은 친구와 맞춘 점이나 달라진 참여 태도를 쓰세요.',
  },
  {
    id: 'feedback',
    instruction:
      '첫 문장은 친구의 의견이나 교사의 안내를 듣고 조정한 장면으로 시작하고, 두 번째 문장은 스스로 고친 점을 쓰세요.',
  },
  {
    id: 'inquiry',
    instruction:
      '첫 문장은 활동 원리, 규칙, 방법을 질문하거나 확인한 장면으로 쓰고, 두 번째 문장은 알게 된 내용을 적용한 장면으로 쓰세요.',
  },
  {
    id: 'role',
    instruction:
      '첫 문장은 모둠이나 팀 안에서 맡은 역할을 수행한 장면을 쓰고, 두 번째 문장은 협력 과정에서 드러난 태도를 쓰세요.',
  },
  {
    id: 'reflection',
    instruction:
      '첫 문장은 활동 후 잘된 점과 아쉬운 점을 돌아본 장면으로 쓰고, 두 번째 문장은 다음 참여 방식의 변화를 쓰세요.',
  },
]

function getClubWritingVariant(index = 0) {
  const normalizedIndex = Math.abs(Number(index) || 0)

  return CLUB_RECORD_WRITING_VARIANTS[
    normalizedIndex % CLUB_RECORD_WRITING_VARIANTS.length
  ]
}

function rotateClubCharacterWords(characterWords = [], offset = 0) {
  const uniqueWords = [...new Set(characterWords.filter(Boolean))]

  if (!uniqueWords.length) {
    return []
  }

  const normalizedOffset = Math.abs(Number(offset) || 0) % uniqueWords.length

  return [
    ...uniqueWords.slice(normalizedOffset),
    ...uniqueWords.slice(0, normalizedOffset),
  ]
}

function formatClubQualityClause(characterWords = [], offset = 0) {
  const selectedWords = rotateClubCharacterWords(characterWords, offset).slice(0, 2)

  if (!selectedWords.length) {
    return '성실한 태도로'
  }

  return `${selectedWords.join('과 ')}을 바탕으로`
}

function buildClubFallbackRecord(
  departmentName,
  characterWords = [],
  writingVariant = getClubWritingVariant(),
  qualityOffset = 0,
) {
  const departmentLabel = String(departmentName ?? '').trim() || '동아리'
  const qualityClause = formatClubQualityClause(characterWords, qualityOffset)
  let fallbackText = ''

  switch (writingVariant?.id) {
    case 'practice':
      fallbackText = `${departmentLabel} 활동에서 반복 연습이 필요한 부분을 찾아 ${qualityClause} 기본 동작과 참여 방법을 익혔음. 친구들과 수행 결과를 맞추어 보며 부족한 부분을 다시 시도하고 안정적으로 활동에 참여함.`
      break
    case 'feedback':
      fallbackText = `${departmentLabel} 활동에서 친구의 의견과 안내를 듣고 자신의 수행 방법을 조정하며 ${qualityClause} 참여했음. 활동 중 잘 맞지 않는 부분을 차분히 고치고 함께 정한 방향에 맞추어 맡은 일을 마무리함.`
      break
    case 'inquiry':
      fallbackText = `${departmentLabel} 활동에서 규칙과 방법을 질문하며 필요한 내용을 확인하고 ${qualityClause} 활동 과정을 이해했음. 알게 된 점을 실제 수행에 적용하며 친구들과 결과를 비교하고 다음 활동에 필요한 점을 정리함.`
      break
    case 'role':
      fallbackText = `${departmentLabel} 활동에서 팀 안의 역할과 순서를 확인하고 ${qualityClause} 맡은 부분을 수행했음. 친구들과 필요한 도움을 주고받으며 활동 흐름을 맞추고 공동의 결과가 나아지도록 노력함.`
      break
    case 'reflection':
      fallbackText = `${departmentLabel} 활동 후 잘된 점과 보완할 점을 돌아보며 ${qualityClause} 자신의 참여 태도를 점검했음. 다음 활동에서는 준비 과정과 수행 순서를 더 꼼꼼히 살피려는 모습을 보임.`
      break
    case 'preparation':
    default:
      fallbackText = `${departmentLabel} 활동에서 준비물과 활동 순서를 먼저 확인하고 ${qualityClause} 맡은 역할을 차분히 수행했음. 친구들과 결과를 비교하며 보완할 점을 찾고 다음 활동에 필요한 연습 방향을 스스로 정리함.`
      break
  }

  return fitClubRecordLength(fallbackText)
}

function createClubFallbackCandidate(
  departmentName,
  characterWords = [],
  comparableRows = [],
  startIndex = 0,
) {
  let bestCandidate = {
    similarityResult: {
      isTooSimilar: true,
      maxScore: Number.POSITIVE_INFINITY,
      topMatches: [],
    },
    text: '',
  }

  for (let attempt = 0; attempt < CLUB_RECORD_WRITING_VARIANTS.length; attempt += 1) {
    const writingVariant = getClubWritingVariant(startIndex + attempt)
    const candidateText = buildClubFallbackRecord(
      departmentName,
      characterWords,
      writingVariant,
      startIndex + attempt,
    )
    const similarityResult = getRecordSimilarityResult(
      candidateText,
      comparableRows,
    )

    if (
      !bestCandidate.text ||
      similarityResult.maxScore < bestCandidate.similarityResult.maxScore
    ) {
      bestCandidate = {
        similarityResult,
        text: candidateText,
      }
    }

    if (!similarityResult.isTooSimilar) {
      break
    }
  }

  return bestCandidate
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

function formatActivityForRecordSentence(activity) {
  const recordDate = formatDateForRecord(activity.date)
  return recordDate ? `${activity.content}(${recordDate})` : activity.content
}

function isActivityMentionedInText(text, activity) {
  const compactText = normalizeKeywordSource(text)
  const formattedActivity = formatActivityForRecordSentence(activity)
  const candidates = [
    formattedActivity,
    activity.content,
    formatDateForRecord(activity.date)
      ? `${activity.content}${formatDateForRecord(activity.date)}`
      : '',
  ].filter(Boolean)

  return candidates.some((candidate) =>
    compactText.includes(normalizeKeywordSource(candidate)),
  )
}

function getActivityMentionIndex(text, activity) {
  const candidates = [
    formatActivityForRecordSentence(activity),
    activity.content,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const candidateIndex = text.indexOf(candidate)

    if (candidateIndex >= 0) {
      return candidateIndex
    }
  }

  return -1
}

function isGeneratedRecordGroundedInActivities(text, activityRows) {
  if (!activityRows.length) {
    return true
  }

  return activityRows.every((activity) => {
    if (!isActivityMentionedInText(text, activity)) {
      return false
    }

    const guide = getActivityTopicGuide(activity.content)

    if (!guide.requiredTerms.length) {
      return true
    }

    const mentionIndex = getActivityMentionIndex(text, activity)
    const activitySegment =
      mentionIndex >= 0 ? text.slice(mentionIndex, mentionIndex + 170) : text
    const compactSegment = normalizeKeywordSource(activitySegment)

    return guide.requiredTerms.some((term) =>
      compactSegment.includes(normalizeKeywordSource(term)),
    )
  })
}

function isGeneratedRecordStructuredByActivityPairs(text, activityRows) {
  if (activityRows.length <= 1) {
    return true
  }

  const firstSentenceEndMatch = /음\./u.exec(text)

  if (!firstSentenceEndMatch) {
    return false
  }

  const firstSentence = text.slice(
    0,
    firstSentenceEndMatch.index + firstSentenceEndMatch[0].length,
  )
  const firstTwoActivities = activityRows.slice(0, 2)
  const remainingActivities = activityRows.slice(2)

  return (
    /음\.$/u.test(firstSentence.trim()) &&
    firstTwoActivities.every((activity) =>
      isActivityMentionedInText(firstSentence, activity),
    ) &&
    !remainingActivities.some((activity) =>
      isActivityMentionedInText(firstSentence, activity),
    )
  )
}

function hasMechanicalQualityLabeling(text, qualities) {
  const compactText = normalizeKeywordSource(text)

  return [...new Set(qualities)].some((quality) => {
    const compactQuality = normalizeKeywordSource(quality)

    return (
      compactText.includes(`${compactQuality}을바탕으로`) ||
      compactText.includes(`${compactQuality}를바탕으로`) ||
      compactText.includes(`${compactQuality}에바탕을두고`)
    )
  })
}

function hasRepeatedGenericClosing(text) {
  const compactText = normalizeKeywordSource(text)

  return (
    compactText.includes('긍정적인학급분위기형성에기여함') ||
    compactText.includes('활동과정에서친구의의견을경청하고필요한도움을주며') ||
    compactText.includes('활동내용을자신의생활과연결하며') ||
    compactText.includes('배운내용을생활속태도로이어가는') ||
    compactText.includes('이후활동내용을다시확인하며')
  )
}

function hasBrokenRecordEnding(text) {
  return /(?:그치함|핵심함|바탕함|연결함|태도함|모습함|내용함)\.?$/u.test(
    normalizeKeywordSource(text),
  )
}

function normalizeRecordForSimilarity(text) {
  return String(text ?? '')
    .replace(/\d{4}\.\d{2}\.\d{2}\./g, '')
    .replace(/\d{1,2}[./-]\d{1,2}/g, '')
    .replace(/[()[\]{}.,!?。'"“”‘’\s]/g, '')
    .trim()
}

function createNgramSet(text, size) {
  const normalizedText = normalizeRecordForSimilarity(text)
  const ngrams = new Set()

  if (normalizedText.length < size) {
    if (normalizedText) {
      ngrams.add(normalizedText)
    }

    return ngrams
  }

  for (let index = 0; index <= normalizedText.length - size; index += 1) {
    ngrams.add(normalizedText.slice(index, index + size))
  }

  return ngrams
}

function calculateSetOverlap(leftSet, rightSet) {
  if (!leftSet.size || !rightSet.size) {
    return 0
  }

  let intersectionCount = 0

  leftSet.forEach((value) => {
    if (rightSet.has(value)) {
      intersectionCount += 1
    }
  })

  const unionCount = leftSet.size + rightSet.size - intersectionCount
  const jaccardScore = unionCount ? intersectionCount / unionCount : 0
  const containmentScore =
    intersectionCount / Math.min(leftSet.size, rightSet.size)

  return Math.max(jaccardScore, containmentScore * 0.58)
}

function calculateRecordSimilarity(leftText, rightText) {
  const leftThreeGrams = createNgramSet(leftText, 3)
  const rightThreeGrams = createNgramSet(rightText, 3)
  const leftFourGrams = createNgramSet(leftText, 4)
  const rightFourGrams = createNgramSet(rightText, 4)
  const threeGramScore = calculateSetOverlap(leftThreeGrams, rightThreeGrams)
  const fourGramScore = calculateSetOverlap(leftFourGrams, rightFourGrams)

  return Math.max(threeGramScore * 0.55 + fourGramScore * 0.45)
}

function formatSimilarityPercent(score) {
  return `${Math.round(Number(score ?? 0) * 100)}%`
}

function getSimilarityTone(score) {
  if (score > MAX_RECORD_SIMILARITY) {
    return 'high'
  }

  if (score >= CAUTION_RECORD_SIMILARITY) {
    return 'caution'
  }

  return 'safe'
}

function getSimilarityToneLabel(score) {
  const tone = getSimilarityTone(score)

  if (tone === 'high') {
    return '수정 권장'
  }

  if (tone === 'caution') {
    return '주의'
  }

  return '안정'
}

function getRecordSimilarityResult(text, comparableRows) {
  const comparisons = (comparableRows ?? [])
    .map((row) => ({
      content: row.content ?? '',
      score: calculateRecordSimilarity(text, row.content),
      studentId: row.student_id,
    }))
    .filter((comparison) => comparison.content.trim())
    .sort((left, right) => right.score - left.score)

  return {
    isTooSimilar: (comparisons[0]?.score ?? 0) > MAX_RECORD_SIMILARITY,
    maxScore: comparisons[0]?.score ?? 0,
    topMatches: comparisons.slice(0, 3),
  }
}

function getRepeatedSimilarityPhrases(text, topMatches) {
  const compactText = normalizeRecordForSimilarity(text)
  const phrases = new Set()

  topMatches.forEach((match) => {
    const compactMatch = normalizeRecordForSimilarity(match.content)

    for (let size = 18; size >= 10 && phrases.size < 8; size -= 2) {
      for (
        let index = 0;
        index <= compactText.length - size && phrases.size < 8;
        index += 4
      ) {
        const phrase = compactText.slice(index, index + size)

        if (compactMatch.includes(phrase)) {
          phrases.add(phrase)
        }
      }
    }
  })

  return Array.from(phrases)
}

function normalizeSimilarityHighlightToken(token) {
  return String(token ?? '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\d]/gu, '')
    .trim()
}

function createHighlightTokenMap(text) {
  const sourceText = String(text ?? '')
  const tokens = []
  const tokenMatches = sourceText.matchAll(/\S+/gu)

  for (const match of tokenMatches) {
    const rawText = match[0]
    const cleanText = normalizeSimilarityHighlightToken(rawText)

    if (!cleanText) {
      continue
    }

    tokens.push({
      cleanText,
      end: match.index + rawText.length - 1,
      start: match.index,
    })
  }

  return {
    sourceText,
    tokens,
  }
}

function getHighlightPhraseKey(tokens) {
  return tokens.map((token) => token.cleanText).join('\u0001')
}

function isMeaningfulHighlightPhrase(tokens) {
  const compactLength = tokens.reduce(
    (sum, token) => sum + token.cleanText.length,
    0,
  )
  const contentWordCount = tokens.filter((token) => token.cleanText.length >= 2)
    .length

  return (
    tokens.length >= SIMILARITY_HIGHLIGHT_MIN_WORDS &&
    compactLength >= SIMILARITY_HIGHLIGHT_MIN_COMPACT_LENGTH &&
    contentWordCount >= 3
  )
}

function collectHighlightPhraseKeys(textMap) {
  const phraseKeys = new Set()

  for (
    let size = SIMILARITY_HIGHLIGHT_MIN_WORDS;
    size <= SIMILARITY_HIGHLIGHT_MAX_WORDS;
    size += 1
  ) {
    for (let start = 0; start <= textMap.tokens.length - size; start += 1) {
      const phraseTokens = textMap.tokens.slice(start, start + size)

      if (isMeaningfulHighlightPhrase(phraseTokens)) {
        phraseKeys.add(getHighlightPhraseKey(phraseTokens))
      }
    }
  }

  return phraseKeys
}

function getSharedSimilarityHighlightPhrases(leftText, rightText) {
  const leftMap = createHighlightTokenMap(leftText)
  const rightPhraseKeys = collectHighlightPhraseKeys(
    createHighlightTokenMap(rightText),
  )
  const selectedPhrases = []

  for (
    let size = SIMILARITY_HIGHLIGHT_MAX_WORDS;
    size >= SIMILARITY_HIGHLIGHT_MIN_WORDS && selectedPhrases.length < 10;
    size -= 1
  ) {
    for (
      let start = 0;
      start <= leftMap.tokens.length - size && selectedPhrases.length < 10;
      start += 1
    ) {
      const phraseTokens = leftMap.tokens.slice(start, start + size)

      if (!isMeaningfulHighlightPhrase(phraseTokens)) {
        continue
      }

      const phraseKey = getHighlightPhraseKey(phraseTokens)
      const isAlreadyCovered = selectedPhrases.some((phrase) =>
        phrase.key.includes(phraseKey),
      )

      if (rightPhraseKeys.has(phraseKey) && !isAlreadyCovered) {
        selectedPhrases.push({
          key: phraseKey,
          tokens: phraseTokens.map((token) => token.cleanText),
        })
      }
    }
  }

  return selectedPhrases
}

function addHighlightPhraseRangesToMask(textMap, phrases, highlightMask) {
  phrases.forEach((phrase) => {
    const phraseLength = phrase.tokens.length

    for (
      let start = 0;
      start <= textMap.tokens.length - phraseLength;
      start += 1
    ) {
      const candidateTokens = textMap.tokens.slice(start, start + phraseLength)
      const candidateKey = getHighlightPhraseKey(candidateTokens)

      if (candidateKey !== phrase.key) {
        continue
      }

      const originalStart = candidateTokens[0].start
      const originalEnd = candidateTokens[candidateTokens.length - 1].end

      for (let index = originalStart; index <= originalEnd; index += 1) {
        highlightMask[index] = true
      }
    }
  })
}

function createSimilarityHighlightSegments(text, phrases) {
  const textMap = createHighlightTokenMap(text)
  const highlightMask = Array(textMap.sourceText.length).fill(false)

  addHighlightPhraseRangesToMask(textMap, phrases, highlightMask)

  const segments = []
  let currentText = ''
  let currentHighlighted = false

  for (let index = 0; index < textMap.sourceText.length; index += 1) {
    const char = textMap.sourceText[index]
    const isHighlighted = highlightMask[index]

    if (currentText && isHighlighted !== currentHighlighted) {
      segments.push({
        isHighlighted: currentHighlighted,
        text: currentText,
      })
      currentText = ''
    }

    currentHighlighted = isHighlighted
    currentText += char
  }

  if (currentText) {
    segments.push({
      isHighlighted: currentHighlighted,
      text: currentText,
    })
  }

  return segments.length
    ? segments
    : [
        {
          isHighlighted: false,
          text,
        },
      ]
}

function createSimilarityHighlightPair(leftText, rightText) {
  const phrases = getSharedSimilarityHighlightPhrases(leftText, rightText)

  return {
    leftSegments: createSimilarityHighlightSegments(leftText, phrases),
    rightSegments: createSimilarityHighlightSegments(rightText, phrases),
  }
}

function getActivityReferenceTexts(activity) {
  return [
    formatActivityForRecordSentence(activity),
    activity.content,
    formatDateForRecord(activity.date)
      ? `${activity.content}${formatDateForRecord(activity.date)}`
      : '',
  ]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
}

function getActivityFollowupSegment(text, activity, activityRows = []) {
  const sourceText = String(text ?? '')
  const activityReferences = getActivityReferenceTexts(activity)
  const matchedReference = activityReferences
    .map((reference) => ({
      index: sourceText.indexOf(reference),
      reference,
    }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => left.index - right.index)[0]

  if (!matchedReference) {
    return ''
  }

  const segmentStart = matchedReference.index + matchedReference.reference.length
  const rawSegment = sourceText.slice(
    segmentStart,
    segmentStart + ACTIVITY_PHRASE_COMPARE_WINDOW,
  )
  const boundaryIndexes = []
  const sentenceBoundaryIndex = rawSegment.search(/[.!?]/u)

  if (sentenceBoundaryIndex > 0) {
    boundaryIndexes.push(sentenceBoundaryIndex)
  }

  activityRows
    .filter((candidate) => candidate !== activity)
    .forEach((candidate) => {
      getActivityReferenceTexts(candidate).forEach((reference) => {
        const referenceIndex = rawSegment.indexOf(reference)

        if (referenceIndex > 0) {
          boundaryIndexes.push(referenceIndex)
        }
      })
    })

  const segmentEnd = boundaryIndexes.length
    ? Math.min(...boundaryIndexes)
    : rawSegment.length

  return rawSegment.slice(0, segmentEnd).trim()
}

function normalizeActivityPhraseForComparison(text) {
  return normalizeRecordForSimilarity(text)
}

function getLongestCommonSubstringLength(leftText, rightText) {
  const leftChars = Array.from(leftText)
  const rightChars = Array.from(rightText)

  if (!leftChars.length || !rightChars.length) {
    return 0
  }

  let previousRow = Array(rightChars.length + 1).fill(0)
  let currentRow = Array(rightChars.length + 1).fill(0)
  let longestLength = 0

  for (let leftIndex = 1; leftIndex <= leftChars.length; leftIndex += 1) {
    currentRow.fill(0)

    for (
      let rightIndex = 1;
      rightIndex <= rightChars.length;
      rightIndex += 1
    ) {
      if (leftChars[leftIndex - 1] !== rightChars[rightIndex - 1]) {
        continue
      }

      currentRow[rightIndex] = previousRow[rightIndex - 1] + 1
      longestLength = Math.max(longestLength, currentRow[rightIndex])
    }

    const nextPreviousRow = previousRow
    previousRow = currentRow
    currentRow = nextPreviousRow
  }

  return longestLength
}

function getRepeatedActivityPhraseResult(
  text,
  selectedActivityRows,
  comparableRows = [],
) {
  let bestMatch = {
    activityName: '',
    isRepeated: false,
    sharedLength: 0,
    similarityScore: 0,
    studentId: null,
  }

  if (!selectedActivityRows.length || !comparableRows.length) {
    return bestMatch
  }

  selectedActivityRows.forEach((activity) => {
    const candidateSegment = normalizeActivityPhraseForComparison(
      getActivityFollowupSegment(text, activity, selectedActivityRows),
    )

    if (candidateSegment.length < MIN_REPEATED_ACTIVITY_PHRASE_LENGTH) {
      return
    }

    comparableRows.forEach((row) => {
      const comparisonSegment = normalizeActivityPhraseForComparison(
        getActivityFollowupSegment(
          row.content,
          activity,
          selectedActivityRows,
        ),
      )

      if (comparisonSegment.length < MIN_REPEATED_ACTIVITY_PHRASE_LENGTH) {
        return
      }

      const sharedLength = getLongestCommonSubstringLength(
        candidateSegment,
        comparisonSegment,
      )
      const shortestLength = Math.min(
        candidateSegment.length,
        comparisonSegment.length,
      )
      const similarityScore = shortestLength
        ? sharedLength / shortestLength
        : 0

      if (sharedLength > bestMatch.sharedLength) {
        bestMatch = {
          activityName: formatActivityForRecordSentence(activity),
          isRepeated:
            sharedLength >= MIN_REPEATED_ACTIVITY_PHRASE_LENGTH,
          sharedLength,
          similarityScore,
          studentId: row.student_id ?? null,
        }
      }
    })
  })

  return bestMatch
}

function hasRepeatedActivityPhrase(text, selectedActivityRows, comparableRows) {
  return getRepeatedActivityPhraseResult(
    text,
    selectedActivityRows,
    comparableRows,
  ).isRepeated
}

function createDiversityInstruction(generatedText, similarityResult, attemptNumber) {
  if (!similarityResult?.topMatches?.length) {
    return ''
  }

  const repeatedPhrases = getRepeatedSimilarityPhrases(
    generatedText,
    similarityResult.topMatches,
  )
  const matchedExamples = similarityResult.topMatches
    .map((match, index) => {
      const snippet = Array.from(match.content).slice(0, 180).join('')
      return `${index + 1}. 유사도 ${Math.round(match.score * 100)}%: ${snippet}`
    })
    .join('\n')
  const repeatedPhraseText = repeatedPhrases.length
    ? `\n반복 금지 표현 조각: ${repeatedPhrases.join(' / ')}`
    : ''

  return [
    `[차별화 재작성 지시 ${attemptNumber}]`,
    `방금 생성문이 같은 학급 기존 문장과 ${Math.round(
      similarityResult.maxScore * 100,
    )}% 유사했습니다. 최종 문장은 기존 문장과 체감 유사도 50% 이하가 되도록 다시 작성하세요.`,
    '활동 순서와 2문장 구조는 유지하되, 첫 문장의 연결 방식, 두 번째 문장의 시작, 마무리 관점, 역량/품성 표현을 모두 바꾸세요.',
    '아래 기존 문장과 같은 구절, 같은 마무리, 같은 "생활 속/학교생활 속/이어 가려 함" 전개를 반복하지 마세요.',
    '"활동 내용을 자신의 생활과 연결하며" 같은 공통 시작 표현과 "이후 활동 내용을 다시 확인하며" 같은 공통 마무리는 금지입니다.',
    matchedExamples,
    repeatedPhraseText,
  ]
    .filter(Boolean)
    .join('\n')
}

function createActivityPhraseDiversityInstruction(activityPhraseResult, attemptNumber) {
  if (!activityPhraseResult?.isRepeated) {
    return ''
  }

  return [
    `[활동별 중복 문구 수정 지시 ${attemptNumber}]`,
    `${activityPhraseResult.activityName} 활동 뒤 설명에서 기존 학생 문장과 ${activityPhraseResult.sharedLength}자 이상 연속으로 같은 표현이 반복되었습니다.`,
    '활동명과 날짜는 유지하되, 그 뒤의 배운 점, 태도, 실천 장면을 다른 어휘와 문장 구조로 다시 쓰세요.',
    '특히 "응급 상황에서 당황하지 않고 도움을 요청하며 필요한 절차를 따르는"처럼 그대로 반복되는 활동 설명 문구는 쓰지 마세요.',
  ].join('\n')
}

function isQualityAllowedForActivity(quality, activityContent) {
  const rule = QUALITY_ACTIVITY_KEYWORD_REQUIREMENTS.find((candidate) =>
    candidate.qualities.includes(quality),
  )

  return !rule || includesAnyKeyword(activityContent, rule.keywords)
}

function getQualityForActivity(qualityWords, activityContent, usedQualities) {
  const quality = qualityWords.find(
    (candidate) =>
      !usedQualities.has(candidate) &&
      isQualityAllowedForActivity(candidate, activityContent),
  )

  if (quality) {
    usedQualities.add(quality)
  }

  return quality
}

function createActivityFallbackClause(
  activity,
  qualityWords,
  usedQualities,
  usedFocuses,
  usedActivityPhrases,
) {
  const quality = getQualityForActivity(
    qualityWords,
    activity.content,
    usedQualities,
  )
  const qualityPhrase = getQualityActivityPhrase(quality, usedActivityPhrases)
  const focusPhrase = getActivityFallbackFocus(activity.content, usedFocuses)

  return `${formatActivityForRecordSentence(activity)}에서 ${qualityPhrase} ${focusPhrase}`
}

function closeFallbackClauseAsSentence(clause) {
  return clause
    .replace(/익혔으며$/u, '익혔음')
    .replace(/구체화했으며$/u, '구체화했음')
    .replace(/정리했으며$/u, '정리했음')
    .replace(/했으며$/u, '했음')
}

function getLengthAdditions(qualityWords = []) {
  const growthPhrase = getGrowthPhrase(qualityWords)

  return [
    `남은 과정에서도 ${growthPhrase} 태도를 차분히 다져 감`,
    '상황에 맞는 실천 방법을 스스로 점검하고 실제 장면에서 필요한 행동을 떠올림',
    '친구들과 필요한 약속을 확인하며 활동에서 배운 절차를 구체적인 선택으로 연결함',
    '자신의 행동을 돌아보고 활동별 핵심 내용을 다음 참여 과정에 활용하려 노력함',
    '활동 후 달라진 생각을 정리하며 다음 참여 장면에서 실천할 방법을 구체화함',
    '학급 안에서 마주칠 수 있는 비슷한 상황을 떠올리고 필요한 말과 행동을 정리함',
  ]
}

function getShortLengthAdditions() {
  return [
    '실천 방법을 스스로 점검함',
    '배운 절차를 상황에 맞게 떠올림',
    '학교생활 속 선택으로 연결함',
  ]
}

function createClosingSentence(remainingClauses, qualityWords) {
  const growthPhrase = getGrowthPhrase(qualityWords)
  const secondSentenceStart = remainingClauses.length
    ? `${remainingClauses.join(', ')},`
    : '앞선 활동을 되짚으며'
  const closingTemplates = [
    `${secondSentenceStart} 배운 절차와 약속을 쉬는 시간과 모둠 활동에서 떠올리며 ${growthPhrase} 태도를 구체화함.`,
    `${secondSentenceStart} 활동별 핵심 내용을 자신의 참여 방식과 연결해 보고 ${growthPhrase} 모습을 차분히 다져 감.`,
    `${secondSentenceStart} 상황별 대처 방법을 친구들과 확인하면서 ${growthPhrase} 자세를 실제 학급 장면에 적용함.`,
    `${secondSentenceStart} 알게 된 내용을 단순히 기억하는 데 그치지 않고 다음 활동에서 실천할 기준으로 삼음.`,
    `${secondSentenceStart} 각 활동에서 확인한 약속과 절차를 바탕으로 자신이 할 수 있는 역할을 다시 정리함.`,
    `${secondSentenceStart} 활동 후 달라진 생각을 정리하고 비슷한 상황에서 먼저 살펴야 할 점을 분명히 함.`,
    `${secondSentenceStart} 친구들과 함께 지켜야 할 약속을 다시 확인하며 다음 참여 장면에서 필요한 행동을 구체화함.`,
    `${secondSentenceStart} 배운 내용을 한 가지 태도로 묶기보다 상황별로 다르게 적용할 방법을 생각함.`,
  ]

  return getRandomItem(closingTemplates)
}

function trimSelfGovernmentRecordLength(text) {
  if (getRecordTextLength(text) <= SELF_GOVERNMENT_MAX_LENGTH) {
    return text
  }

  const clippedText = Array.from(text)
    .slice(0, SELF_GOVERNMENT_MAX_LENGTH + 1)
    .join('')
  const lastPeriodIndex = clippedText.lastIndexOf('.')

  if (lastPeriodIndex >= SELF_GOVERNMENT_MIN_LENGTH) {
    return clippedText.slice(0, lastPeriodIndex + 1).trim()
  }

  const closingText = ' 내용을 정리함.'
  const baseText = Array.from(text)
    .slice(0, SELF_GOVERNMENT_MAX_LENGTH - getRecordTextLength(closingText))
    .join('')
  const naturalBoundary = Math.max(
    baseText.lastIndexOf(','),
    baseText.lastIndexOf('며'),
    baseText.lastIndexOf('고'),
    baseText.lastIndexOf('하여'),
  )
  const trimmedBase =
    naturalBoundary >= SELF_GOVERNMENT_MIN_LENGTH - 20
      ? baseText.slice(0, naturalBoundary)
      : baseText

  return `${trimmedBase.replace(/[,\s]+$/u, '')}${closingText}`.trim()
}

function fitSelfGovernmentRecordLength(text, qualityWords = []) {
  let fittedText = cleanGeneratedRecordText(text)
  const additions = getLengthAdditions(qualityWords)

  for (
    let index = 0;
    getRecordTextLength(fittedText) < SELF_GOVERNMENT_MIN_LENGTH &&
    index < additions.length;
    index += 1
  ) {
    const nextText = fittedText.replace(/[.!?。]$/u, `, ${additions[index]}.`)

    if (getRecordTextLength(nextText) <= SELF_GOVERNMENT_MAX_LENGTH) {
      fittedText = nextText
    }
  }

  const shortAdditions = getShortLengthAdditions()

  for (
    let index = 0;
    getRecordTextLength(fittedText) < SELF_GOVERNMENT_MIN_LENGTH &&
    index < shortAdditions.length;
    index += 1
  ) {
    const nextText = fittedText.replace(/[.!?。]$/u, `, ${shortAdditions[index]}.`)

    if (getRecordTextLength(nextText) <= SELF_GOVERNMENT_MAX_LENGTH) {
      fittedText = nextText
    }
  }

  const normalizedText = normalizeGeneratedRecordPunctuation(
    trimSelfGovernmentRecordLength(fittedText),
  )

  if (getRecordTextLength(normalizedText) <= SELF_GOVERNMENT_MAX_LENGTH) {
    return normalizedText
  }

  return normalizeGeneratedRecordPunctuation(
    trimSelfGovernmentRecordLength(normalizedText),
  )
}

function buildSelfGovernmentFallbackRecord(selectedActivityRows, schoolLifeQualities) {
  const activities = sortActivityRowsByDate(
    selectedActivityRows.length
      ? selectedActivityRows
      : [
          { date: '2026.03.13.', content: '학급자치활동 조직' },
          { date: '2026.04.01.', content: '체험활동 안전교육' },
          { date: '2026.05.11.', content: '장애인식개선교육' },
        ],
  )
  const allowedSchoolLifeQualities = getAllowedSchoolLifeQualitiesForActivities(
    schoolLifeQualities,
    activities,
  )
  const qualityWords = getRandomQualityWords(allowedSchoolLifeQualities)
  const usedQualities = new Set()
  const usedFocuses = new Set()
  const usedActivityPhrases = new Set()
  const clauses = activities
    .slice(0, 4)
    .map((activity) =>
      createActivityFallbackClause(
        activity,
        qualityWords,
        usedQualities,
        usedFocuses,
        usedActivityPhrases,
      ),
    )
  const firstSentenceClauses = clauses.slice(0, Math.min(2, clauses.length))
  const remainingClauses = clauses.slice(2)
  const firstSentence =
    firstSentenceClauses.length > 0
      ? `${closeFallbackClauseAsSentence(firstSentenceClauses.join(', '))}.`
      : ''
  const secondSentence = firstSentence
    ? createClosingSentence(
        remainingClauses,
        Array.from(usedQualities).length
          ? Array.from(usedQualities)
          : qualityWords,
      )
    : `활동 내용을 되짚으며 필요한 도움과 지켜야 할 약속을 스스로 확인하고, 배운 내용을 학교생활 속 판단과 실천으로 연결하려는 태도를 보임.`

  return fitSelfGovernmentRecordLength(
    [firstSentence, secondSentence].filter(Boolean).join(' '),
    Array.from(usedQualities).length ? Array.from(usedQualities) : qualityWords,
  )
}

function SchoolLifeRecordsInput({
  inputMode = SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL,
  onClassStudentListChange,
  onHeaderActionsChange,
  onSchoolLifeQualitySelectionsChange,
  onSubjectAbilityHeaderStateChange,
  onToast,
  personalSectionId = SELF_GOVERNMENT_SECTION_ID,
  schoolLifeQualities = emptySchoolLifeQualities,
  schoolLifeQualityOptions = emptySchoolLifeQualities,
  selectedClass = '',
  selectedGrade = '',
  selectedStudent,
  students = [],
}) {
  const [recordValues, setRecordValues] = useState(createInitialRecordValues)
  const [generatingSectionIds, setGeneratingSectionIds] = useState({})
  const [activityTextsByClass, setActivityTextsByClass] = useState(
    createInitialActivityTextsByClass,
  )
  const [isActivityEditorOpen, setIsActivityEditorOpen] = useState(false)
  const [classSimilarityReport, setClassSimilarityReport] = useState(null)
  const [classStudentRowsState, setClassStudentRowsState] = useState({
    isLoading: false,
    rows: [],
    scopeKey: '',
  })
  const [clubDepartmentOptionsState, setClubDepartmentOptionsState] = useState({
    isLoading: false,
    options: [],
  })
  const [selectedClubDepartment, setSelectedClubDepartment] = useState('')
  const [clubDepartmentStudentsState, setClubDepartmentStudentsState] =
    useState({
      departmentName: '',
      isLoading: false,
      rows: [],
    })
  const [similarityScope, setSimilarityScope] = useState(
    SIMILARITY_SCOPE_CLASS,
  )
  const [classSectionId, setClassSectionId] = useState(
    SELF_GOVERNMENT_SECTION_ID,
  )
  const [selectedSubjectAbilitySubjectId, setSelectedSubjectAbilitySubjectId] =
    useState(SUBJECT_ABILITY_SUBJECT_OPTIONS[0].id)
  const [isClassSectionPickerCollapsed, setIsClassSectionPickerCollapsed] =
    useState(false)
  const [isSubjectAbilityPickerCollapsed, setIsSubjectAbilityPickerCollapsed] =
    useState(false)
  const [isSubjectEvaluationEditorOpen, setIsSubjectEvaluationEditorOpen] =
    useState(false)
  const achievementStandardFileInputRef = useRef(null)
  const [subjectAbilityUploadFiles, setSubjectAbilityUploadFiles] = useState({})
  const [subjectAbilityReferenceRows, setSubjectAbilityReferenceRows] = useState(
    {},
  )
  const [subjectAbilityReferenceUploading, setSubjectAbilityReferenceUploading] =
    useState({})
  const subjectEvaluationSaveTimersRef = useRef({})
  const classActivityKey = getClassActivityKey(
    selectedGrade,
    selectedClass,
    selectedStudent,
  )
  const activityText = activityTextsByClass[classActivityKey] ?? ''
  const activityRows = useMemo(
    () => sortActivityRowsByDate(parseActivityRows(activityText)),
    [activityText],
  )
  const recordValuesRef = useRef(recordValues)
  const remoteSaveTimersRef = useRef({})
  const lastRemoteStorageErrorRef = useRef('')
  const emitClassStudentListChange = useEffectEvent((nextList) => {
    onClassStudentListChange?.(nextList)
  })
  const selectedStudentId = selectedStudent?.id ?? null
  const activeClassGrade = selectedGrade || selectedStudent?.grade || ''
  const activeClassNum = selectedClass || selectedStudent?.class_num || ''
  const isClassWideRecordMode =
    inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS ||
    inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY
  const classSimilarityScopeKey = `${activeClassGrade || ''}-${activeClassNum || ''}`
  const loadedClassStudents = useMemo(
    () =>
      sortClassStudents(
        students.filter((student) => {
          if (!activeClassGrade || !activeClassNum) {
            return false
          }

          return (
            String(student.grade) === String(activeClassGrade) &&
            String(student.class_num) === String(activeClassNum)
          )
        }),
      ),
    [activeClassGrade, activeClassNum, students],
  )
  const hasCompleteClassStudentRows =
    classStudentRowsState.scopeKey === classSimilarityScopeKey &&
    classStudentRowsState.rows.length > 0
  const isClassStudentRowsLoading =
    classStudentRowsState.scopeKey === classSimilarityScopeKey &&
    classStudentRowsState.isLoading
  const classSelectedSection =
    classRecordSections.find((section) => section.id === classSectionId) ??
    classRecordSections[0]
  const isClassSubjectAbilitySection =
    classSelectedSection.id === SUBJECT_ABILITY_SECTION_ID
  const selectedSubjectAbilitySubject = getSubjectAbilitySubjectOption(
    selectedSubjectAbilitySubjectId,
  )
  const selectedSubjectAbilityCompetencyOptions =
    getSubjectAbilityCompetencyOptions(
      selectedSubjectAbilitySubject.id,
      schoolLifeQualityOptions.competencies ?? [],
    )
  const visibleSubjectAbilitySubjects = isSubjectAbilityPickerCollapsed
    ? [selectedSubjectAbilitySubject]
    : SUBJECT_ABILITY_SUBJECT_OPTIONS
  const classRecordSectionId = isClassSubjectAbilitySection
    ? getSubjectAbilitySectionId(selectedSubjectAbilitySubject.id)
    : classSelectedSection.id
  const classRecordSectionLabel = isClassSubjectAbilitySection
    ? `${classSelectedSection.label}(${selectedSubjectAbilitySubject.label})`
    : classSelectedSection.label
  const classRecordSectionPlaceholder = isClassSubjectAbilitySection
    ? `${selectedSubjectAbilitySubject.label} 과목 세부능력특기사항 내용을 입력하세요.`
    : classSelectedSection.placeholder
  const selectedSubjectAbilityUploadKey = selectedSubjectAbilitySubject.id
  const selectedAchievementStandardReference =
    subjectAbilityReferenceRows[
      getSubjectReferenceKey(
        selectedSubjectAbilityUploadKey,
        SUBJECT_REFERENCE_TYPE_STANDARD,
      )
    ] ?? null
  const selectedAchievementStandardFileName =
    selectedAchievementStandardReference?.file_name ??
    subjectAbilityUploadFiles[
      getSubjectReferenceKey(
        selectedSubjectAbilityUploadKey,
        SUBJECT_REFERENCE_TYPE_STANDARD,
      )
    ] ??
    ''
  const selectedSubjectEvaluationReference =
    subjectAbilityReferenceRows[
      getSubjectReferenceKey(
        selectedSubjectAbilityUploadKey,
        SUBJECT_REFERENCE_TYPE_EVALUATION,
      )
    ] ??
    subjectAbilityReferenceRows[
      getSubjectReferenceKey(
        selectedSubjectAbilityUploadKey,
        LEGACY_SUBJECT_REFERENCE_TYPE_ASSIGNMENT,
      )
    ] ??
    null
  const selectedSubjectEvaluationText =
    selectedSubjectEvaluationReference?.extracted_text ?? ''
  const isSelectedAchievementStandardUploading = Boolean(
    subjectAbilityReferenceUploading[
      getSubjectReferenceKey(
        selectedSubjectAbilityUploadKey,
        SUBJECT_REFERENCE_TYPE_STANDARD,
      )
    ],
  )
  const visibleClassRecordSections = isClassSectionPickerCollapsed
    ? [classSelectedSection]
    : classRecordSections
  const activeSimilaritySectionId = classRecordSectionId
  const classScopedStudents = useMemo(
    () =>
      hasCompleteClassStudentRows
        ? classStudentRowsState.rows
        : loadedClassStudents,
    [classStudentRowsState.rows, hasCompleteClassStudentRows, loadedClassStudents],
  )
  const isClubDepartmentStudentList =
    inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS &&
    classSelectedSection.id === CLUB_SECTION_ID &&
    Boolean(selectedClubDepartment)
  const selectedClassStudents = useMemo(() => {
    if (isClubDepartmentStudentList) {
      return clubDepartmentStudentsState.departmentName === selectedClubDepartment
        ? clubDepartmentStudentsState.rows
        : []
    }

    return classScopedStudents
  }, [
    classScopedStudents,
    clubDepartmentStudentsState.departmentName,
    clubDepartmentStudentsState.rows,
    isClubDepartmentStudentList,
    selectedClubDepartment,
  ])
  const isClubDepartmentStudentsLoading =
    isClubDepartmentStudentList &&
    clubDepartmentStudentsState.departmentName === selectedClubDepartment &&
    clubDepartmentStudentsState.isLoading
  const isClubDepartmentStudentsPending =
    isClubDepartmentStudentList &&
    clubDepartmentStudentsState.departmentName !== selectedClubDepartment
  const isClubDepartmentStudentsBusy =
    isClubDepartmentStudentsPending ||
    (isClubDepartmentStudentsLoading && !selectedClassStudents.length)
  const selectedClassStudentIds = useMemo(
    () => selectedClassStudents.map((student) => student.id).filter(Boolean),
    [selectedClassStudents],
  )
  const selectedClassStudentIdKey = selectedClassStudentIds.join(',')
  const classGenerationStateKey = getClassGenerationStateKey(
    classSelectedSection.id,
  )
  const isGeneratingClassSection = Boolean(
    generatingSectionIds[classGenerationStateKey],
  )
  const activeClassSimilarityReport =
    classSimilarityReport?.sectionId === activeSimilaritySectionId &&
    classSimilarityReport?.scopeKey === classSimilarityScopeKey &&
    classSimilarityReport?.similarityScope === similarityScope
      ? classSimilarityReport
      : null
  const personalSelectedSection =
    personalRecordSections.find((section) => section.id === personalSectionId) ??
    personalRecordSections[0]
  const isPersonalSubjectAbilitySection =
    personalSelectedSection.id === SUBJECT_ABILITY_SECTION_ID
  const personalRecordSectionId = isPersonalSubjectAbilitySection
    ? getSubjectAbilitySectionId(selectedSubjectAbilitySubject.id)
    : personalSelectedSection.id
  const personalRecordSectionLabel = isPersonalSubjectAbilitySection
    ? `${personalSelectedSection.label}(${selectedSubjectAbilitySubject.label})`
    : personalSelectedSection.label
  const personalRecordSectionPlaceholder = isPersonalSubjectAbilitySection
    ? `${selectedSubjectAbilitySubject.label} 과목 세부능력특기사항 내용을 입력하세요.`
    : personalSelectedSection.placeholder
  const personalEffectiveSelectedSection = isPersonalSubjectAbilitySection
    ? {
        ...personalSelectedSection,
        id: personalRecordSectionId,
        label: personalRecordSectionLabel,
        placeholder: personalRecordSectionPlaceholder,
      }
    : personalSelectedSection
  const isPersonalSelfGovernmentSection =
    personalSelectedSection.id === SELF_GOVERNMENT_SECTION_ID
  const classLabel =
    activeClassGrade || activeClassNum
      ? `${activeClassGrade || ''}학년 ${activeClassNum || ''}반`
      : '현재 학급'
  const classListLabel = isClubDepartmentStudentList
    ? `${selectedClubDepartment} 동아리`
    : classLabel
  const classStudentCountLabel = isClubDepartmentStudentsBusy
    ? '불러오는 중...'
    : `${selectedClassStudents.length}명`
  const classStudentEmptyMessage = isClubDepartmentStudentList
    ? '선택한 동아리 부서의 학생이 없습니다.'
    : '선택한 학급의 학생이 없습니다.'

  const showRemoteStorageError = useCallback(
    (error) => {
      const message = getSchoolLifeRecordErrorMessage(error)

      if (lastRemoteStorageErrorRef.current === message) {
        return
      }

      lastRemoteStorageErrorRef.current = message
      onToast?.(message, 'error')
    },
    [onToast],
  )

  const persistRemoteRecordValue = useCallback(
    async (studentId, sectionId, value) => {
      const { error } = await saveSchoolLifeRecordValue({
        content: value,
        schoolYear: DEFAULT_ACTIVITY_YEAR,
        sectionId,
        studentId,
      })

      if (error) {
        showRemoteStorageError(error)
      }
    },
    [showRemoteStorageError],
  )

  useEffect(() => {
    let isMounted = true

    async function loadCompleteClassStudents() {
      if (
        !isClassWideRecordMode ||
        !activeClassGrade ||
        !activeClassNum
      ) {
        setClassStudentRowsState({
          isLoading: false,
          rows: [],
          scopeKey: '',
        })
        return
      }

      setClassStudentRowsState((previous) => ({
        isLoading: true,
        rows:
          previous.scopeKey === classSimilarityScopeKey ? previous.rows : [],
        scopeKey: classSimilarityScopeKey,
      }))

      const { data, error } = await fetchClassStudentRows({
        classNum: activeClassNum,
        grade: activeClassGrade,
      })

      if (!isMounted) {
        return
      }

      if (error) {
        showRemoteStorageError(error)
        setClassStudentRowsState((previous) => ({
          ...previous,
          isLoading: false,
        }))
        return
      }

      setClassStudentRowsState({
        isLoading: false,
        rows: sortClassStudents(data ?? []),
        scopeKey: classSimilarityScopeKey,
      })
    }

    void loadCompleteClassStudents()

    return () => {
      isMounted = false
    }
  }, [
    activeClassGrade,
    activeClassNum,
    classSimilarityScopeKey,
    isClassWideRecordMode,
    showRemoteStorageError,
  ])

  useEffect(() => {
    let isMounted = true

    async function loadClubDepartmentOptions() {
      if (
        inputMode !== SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS ||
        classSelectedSection.id !== CLUB_SECTION_ID
      ) {
        return
      }

      setClubDepartmentOptionsState((previous) => ({
        ...previous,
        isLoading: true,
      }))

      const { data, error } = await fetchClubDepartmentOptions({
        schoolYear: DEFAULT_ACTIVITY_YEAR,
      })

      if (!isMounted) {
        return
      }

      if (error) {
        showRemoteStorageError(error)
        setClubDepartmentOptionsState((previous) => ({
          ...previous,
          isLoading: false,
        }))
        return
      }

      setClubDepartmentOptionsState({
        isLoading: false,
        options: data ?? [],
      })
    }

    void loadClubDepartmentOptions()

    return () => {
      isMounted = false
    }
  }, [classSelectedSection.id, inputMode, showRemoteStorageError])

  useEffect(() => {
    let isMounted = true

    async function loadClubDepartmentStudents() {
      if (
        inputMode !== SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS ||
        classSelectedSection.id !== CLUB_SECTION_ID ||
        !selectedClubDepartment
      ) {
        return
      }

      setClubDepartmentStudentsState((previous) => ({
        departmentName: selectedClubDepartment,
        isLoading: true,
        rows:
          previous.departmentName === selectedClubDepartment
            ? previous.rows
            : [],
      }))

      const { data, error } = await fetchClubDepartmentStudentRows({
        departmentName: selectedClubDepartment,
        schoolYear: DEFAULT_ACTIVITY_YEAR,
      })

      if (!isMounted) {
        return
      }

      if (error) {
        showRemoteStorageError(error)
        setClubDepartmentStudentsState((previous) => ({
          ...previous,
          isLoading: false,
        }))
        return
      }

      setClubDepartmentStudentsState({
        departmentName: selectedClubDepartment,
        isLoading: false,
        rows: sortClassStudents(data ?? []),
      })
    }

    void loadClubDepartmentStudents()

    return () => {
      isMounted = false
    }
  }, [
    classSelectedSection.id,
    inputMode,
    selectedClubDepartment,
    showRemoteStorageError,
  ])

  useEffect(() => {
    if (
      inputMode !== SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS ||
      !isClubDepartmentStudentList
    ) {
      emitClassStudentListChange(null)
      return
    }

    emitClassStudentListChange({
      isActive: true,
      isLoading: isClubDepartmentStudentsBusy,
      label: selectedClubDepartment,
      students: selectedClassStudents,
    })
  }, [
    inputMode,
    isClubDepartmentStudentList,
    isClubDepartmentStudentsBusy,
    selectedClassStudents,
    selectedClubDepartment,
  ])

  useEffect(() => {
    recordValuesRef.current = recordValues
  }, [recordValues])

  useEffect(() => {
    onHeaderActionsChange?.(null)

    return () => {
      onHeaderActionsChange?.(null)
    }
  }, [onHeaderActionsChange])

  useEffect(() => {
    if (!onSubjectAbilityHeaderStateChange) {
      return
    }

    if (
      inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL &&
      isPersonalSubjectAbilitySection
    ) {
      onSubjectAbilityHeaderStateChange({
        competencyOptions: isSubjectAbilityPickerCollapsed
          ? selectedSubjectAbilityCompetencyOptions
          : [],
        isSubjectPickerCollapsed: isSubjectAbilityPickerCollapsed,
        onSubjectButtonClick: (subjectId) => {
          const nextSubject = getSubjectAbilitySubjectOption(subjectId)

          if (
            isSubjectAbilityPickerCollapsed &&
            selectedSubjectAbilitySubject.id === nextSubject.id
          ) {
            setIsSubjectAbilityPickerCollapsed(false)
            return
          }

          setSelectedSubjectAbilitySubjectId(nextSubject.id)
          setIsSubjectAbilityPickerCollapsed(true)
          setClassSimilarityReport(null)
        },
        selectedSubjectId: selectedSubjectAbilitySubject.id,
        subjectId: selectedSubjectAbilitySubject.id,
        subjectLabel: selectedSubjectAbilitySubject.label,
        subjects: SUBJECT_ABILITY_SUBJECT_OPTIONS,
      })
      return () => {
        onSubjectAbilityHeaderStateChange(null)
      }
    }

    onSubjectAbilityHeaderStateChange(null)

    return () => {
      onSubjectAbilityHeaderStateChange(null)
    }
  }, [
    inputMode,
    isPersonalSubjectAbilitySection,
    isSubjectAbilityPickerCollapsed,
    onSubjectAbilityHeaderStateChange,
    selectedSubjectAbilityCompetencyOptions,
    selectedSubjectAbilitySubject.id,
    selectedSubjectAbilitySubject.label,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify(activityTextsByClass),
    )
  }, [activityTextsByClass])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(recordValues))
  }, [recordValues])

  useEffect(() => {
    return () => {
      Object.values(remoteSaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      remoteSaveTimersRef.current = {}
      Object.values(subjectEvaluationSaveTimersRef.current).forEach(
        (timerId) => {
          window.clearTimeout(timerId)
        },
      )
      subjectEvaluationSaveTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadSubjectAbilityReferences() {
      const { data, error } = await fetchSubjectAbilityReferenceRows({
        schoolYear: DEFAULT_ACTIVITY_YEAR,
      })

      if (!isMounted) {
        return
      }

      if (error) {
        showRemoteStorageError(error)
        return
      }

      const nextRows = {}

      ;(data ?? []).forEach((row) => {
        nextRows[getSubjectReferenceKey(row.subject_id, row.reference_type)] =
          row
      })

      setSubjectAbilityReferenceRows(nextRows)
    }

    void loadSubjectAbilityReferences()

    return () => {
      isMounted = false
    }
  }, [showRemoteStorageError])

  useEffect(() => {
    let isMounted = true

    async function loadRemoteRecordValues() {
      if (!selectedStudentId) {
        return
      }

      const { data, error } = await fetchSchoolLifeRecordRows(
        selectedStudentId,
        DEFAULT_ACTIVITY_YEAR,
      )

      if (!isMounted) {
        return
      }

      if (error) {
        showRemoteStorageError(error)
        return
      }

      const remoteRows = data ?? []

      if (remoteRows.length) {
        setRecordValues((previous) => {
          const nextRecordValues = { ...previous }

          remoteRows.forEach((row) => {
            const recordKey = getStudentRecordKey(
              row.section_id,
              selectedStudentId,
            )
            const remoteContent = row.content ?? ''

            if (remoteContent?.trim()) {
              nextRecordValues[recordKey] = remoteContent
            } else {
              delete nextRecordValues[recordKey]
            }
          })

          return nextRecordValues
        })
        return
      }

      getKnownRecordSectionIds().forEach((sectionId) => {
        const cachedContent =
          recordValuesRef.current[
            getStudentRecordKey(sectionId, selectedStudentId)
          ] ?? ''

        if (cachedContent.trim()) {
          void persistRemoteRecordValue(
            selectedStudentId,
            sectionId,
            cachedContent,
          )
        }
      })
    }

    void loadRemoteRecordValues()

    return () => {
      isMounted = false
    }
  }, [persistRemoteRecordValue, selectedStudentId, showRemoteStorageError])

  useEffect(() => {
    let isMounted = true

    async function loadClassRecordValues() {
      if (
        !isClassWideRecordMode ||
        (!isClubDepartmentStudentList &&
          (!activeClassGrade || !activeClassNum)) ||
        !selectedClassStudentIds.length
      ) {
        return
      }

      const { data, error } = await fetchClassSchoolLifeRecordRows({
        classNum: activeClassNum,
        grade: activeClassGrade,
        schoolYear: DEFAULT_ACTIVITY_YEAR,
        studentIds: selectedClassStudentIds,
      })

      if (!isMounted) {
        return
      }

      if (error) {
        showRemoteStorageError(error)
        return
      }

      const remoteRows = data ?? []

      if (!remoteRows.length) {
        return
      }

      setRecordValues((previous) => {
        const nextRecordValues = { ...previous }

        remoteRows.forEach((row) => {
          const recordKey = getStudentRecordKey(row.section_id, row.student_id)

          if (row.content?.trim()) {
            nextRecordValues[recordKey] = row.content
          } else {
            delete nextRecordValues[recordKey]
          }
        })

        return nextRecordValues
      })
    }

    void loadClassRecordValues()

    return () => {
      isMounted = false
    }
  }, [
    activeClassGrade,
    activeClassNum,
    isClassWideRecordMode,
    isClubDepartmentStudentList,
    selectedClassStudentIdKey,
    selectedClassStudentIds,
    showRemoteStorageError,
  ])

  function getRecordKey(sectionId) {
    return getStudentRecordKey(sectionId, selectedStudentId)
  }

  function scheduleRemoteRecordSave(studentId, sectionId, value) {
    if (!studentId) {
      return
    }

    const recordKey = getStudentRecordKey(sectionId, studentId)
    const previousTimerId = remoteSaveTimersRef.current[recordKey]

    if (previousTimerId) {
      window.clearTimeout(previousTimerId)
    }

    remoteSaveTimersRef.current[recordKey] = window.setTimeout(() => {
      delete remoteSaveTimersRef.current[recordKey]
      void persistRemoteRecordValue(studentId, sectionId, value)
    }, 700)
  }

  function updateRecordValueForStudent(studentId, sectionId, value) {
    const recordKey = getStudentRecordKey(sectionId, studentId)

    setClassSimilarityReport((previous) =>
      previous?.sectionId === sectionId ? null : previous,
    )

    setRecordValues((previous) => {
      const nextRecordValues = { ...previous }

      if (value.trim()) {
        nextRecordValues[recordKey] = value
      } else {
        delete nextRecordValues[recordKey]
      }

      return nextRecordValues
    })

    scheduleRemoteRecordSave(studentId, sectionId, value)
  }

  function updateRecordValue(sectionId, value) {
    updateRecordValueForStudent(selectedStudentId, sectionId, value)
  }

  function updateActivityText(value) {
    setActivityTextsByClass((previous) => ({
      ...previous,
      [classActivityKey]: value,
    }))
  }

  function getSubjectAbilityReferencePromptContext(
    subjectId = selectedSubjectAbilitySubject.id,
  ) {
    const subject = getSubjectAbilitySubjectOption(subjectId)
    const standardReference =
      subjectAbilityReferenceRows[
        getSubjectReferenceKey(subject.id, SUBJECT_REFERENCE_TYPE_STANDARD)
      ]
    const levelReference =
      subjectAbilityReferenceRows[
        getSubjectReferenceKey(subject.id, SUBJECT_REFERENCE_TYPE_LEVEL)
      ]
    const evaluationReference =
      subjectAbilityReferenceRows[
        getSubjectReferenceKey(subject.id, SUBJECT_REFERENCE_TYPE_EVALUATION)
      ] ??
      subjectAbilityReferenceRows[
        getSubjectReferenceKey(
          subject.id,
          LEGACY_SUBJECT_REFERENCE_TYPE_ASSIGNMENT,
        )
      ]
    const referenceBlocks = [
      standardReference?.extracted_text
        ? `[${subject.label} 성취기준 및 성취수준 참고자료: ${standardReference.file_name}]\n${truncateSubjectReferenceText(
            standardReference.extracted_text,
          )}`
        : '',
      levelReference?.extracted_text
        ? `[${subject.label} 성취수준 참고자료: ${levelReference.file_name}]\n${truncateSubjectReferenceText(
            levelReference.extracted_text,
          )}`
        : '',
      evaluationReference?.extracted_text
        ? `[${subject.label} 평가항목 참고자료]\n${truncateSubjectReferenceText(
            evaluationReference.extracted_text,
          )}`
        : '',
    ].filter(Boolean)

    return referenceBlocks.join('\n\n')
  }

  async function handleSubjectAbilityUploadFileChange(event, uploadKind) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const targetSubject = selectedSubjectAbilitySubject
    const uploadLabel =
      uploadKind === SUBJECT_REFERENCE_TYPE_STANDARD
        ? '성취기준 및 성취수준'
        : getSubjectReferenceTypeLabel(uploadKind)
    const referenceKey = getSubjectReferenceKey(targetSubject.id, uploadKind)

    if (!isPdfFile(file)) {
      onToast?.('PDF 파일만 업로드할 수 있습니다.', 'error')
      return
    }

    setSubjectAbilityReferenceUploading((previous) => ({
      ...previous,
      [referenceKey]: true,
    }))

    try {
      const extractedText = await extractPdfTextFromFile(file)
      const { data, error } = await saveSubjectAbilityReferenceFile({
        extractedText,
        file,
        referenceType: uploadKind,
        schoolYear: DEFAULT_ACTIVITY_YEAR,
        subjectId: targetSubject.id,
      })

      if (error) {
        showRemoteStorageError(error)
        return
      }

      if (data) {
        setSubjectAbilityReferenceRows((previous) => ({
          ...previous,
          [referenceKey]: data,
        }))
      }

      setSubjectAbilityUploadFiles((previous) => ({
        ...previous,
        [referenceKey]: file.name,
      }))
      onToast?.(
        `${targetSubject.label} ${uploadLabel} PDF를 Supabase에 저장했습니다.`,
      )
    } catch (error) {
      onToast?.(
        error instanceof Error
          ? error.message
          : `${targetSubject.label} ${uploadLabel} PDF를 처리하지 못했습니다.`,
        'error',
      )
    } finally {
      setSubjectAbilityReferenceUploading((previous) => ({
        ...previous,
        [referenceKey]: false,
      }))
    }
  }

  function scheduleSubjectEvaluationSave(subjectId, value) {
    const referenceKey = getSubjectReferenceKey(
      subjectId,
      SUBJECT_REFERENCE_TYPE_EVALUATION,
    )
    const previousTimerId = subjectEvaluationSaveTimersRef.current[referenceKey]

    if (previousTimerId) {
      window.clearTimeout(previousTimerId)
    }

    subjectEvaluationSaveTimersRef.current[referenceKey] = window.setTimeout(
      async () => {
        delete subjectEvaluationSaveTimersRef.current[referenceKey]

        const { error } = await saveSubjectAbilityReferenceText({
          content: value,
          referenceType: SUBJECT_REFERENCE_TYPE_EVALUATION,
          schoolYear: DEFAULT_ACTIVITY_YEAR,
          subjectId,
        })

        if (error) {
          showRemoteStorageError(error)
        }

        if (!String(value ?? '').trim()) {
          await saveSubjectAbilityReferenceText({
            content: '',
            referenceType: LEGACY_SUBJECT_REFERENCE_TYPE_ASSIGNMENT,
            schoolYear: DEFAULT_ACTIVITY_YEAR,
            subjectId,
          })
        }
      },
      700,
    )
  }

  function updateSubjectEvaluationText(value) {
    const targetSubject = selectedSubjectAbilitySubject
    const referenceKey = getSubjectReferenceKey(
      targetSubject.id,
      SUBJECT_REFERENCE_TYPE_EVALUATION,
    )
    const legacyReferenceKey = getSubjectReferenceKey(
      targetSubject.id,
      LEGACY_SUBJECT_REFERENCE_TYPE_ASSIGNMENT,
    )

    setSubjectAbilityReferenceRows((previous) => {
      const nextRows = { ...previous }

      if (value.trim()) {
        nextRows[referenceKey] = {
          ...(previous[referenceKey] ?? previous[legacyReferenceKey] ?? {}),
          extracted_char_count: value.trim().length,
          extracted_text: value,
          file_name: '직접 입력',
          file_size: 0,
          reference_type: SUBJECT_REFERENCE_TYPE_EVALUATION,
          school_year: DEFAULT_ACTIVITY_YEAR,
          storage_path: '',
          subject_id: targetSubject.id,
        }
      } else {
        delete nextRows[referenceKey]
        delete nextRows[legacyReferenceKey]
      }

      return nextRows
    })
    scheduleSubjectEvaluationSave(targetSubject.id, value)
  }

  function renderSubjectAbilityUploadActions() {
    return (
      <>
        <div className="school-life-records-subject-upload-actions">
          <button
            className="school-life-records-subject-upload-button"
            type="button"
            title={selectedAchievementStandardFileName || undefined}
            disabled={isSelectedAchievementStandardUploading}
            onClick={() => achievementStandardFileInputRef.current?.click()}
          >
            {isSelectedAchievementStandardUploading
              ? '성취기준 & 수준 저장 중...'
              : selectedAchievementStandardFileName
                ? '성취기준 & 수준 저장됨'
                : '성취기준 & 수준 업로드'}
          </button>
          <button
            className={`school-life-records-subject-upload-button ${
              isSubjectEvaluationEditorOpen ? 'is-active' : ''
            }`}
            type="button"
            aria-expanded={isSubjectEvaluationEditorOpen}
            onClick={() =>
              setIsSubjectEvaluationEditorOpen((previous) => !previous)
            }
          >
            {selectedSubjectEvaluationText.trim() ? '평가항목 입력됨' : '평가항목'}
          </button>
          <input
            ref={achievementStandardFileInputRef}
            className="visually-hidden"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) =>
              handleSubjectAbilityUploadFileChange(
                event,
                SUBJECT_REFERENCE_TYPE_STANDARD,
              )
            }
          />
        </div>
        {isSubjectEvaluationEditorOpen ? (
          <label className="school-life-records-subject-evaluation-field">
            <span>평가항목</span>
            <textarea
              value={selectedSubjectEvaluationText}
              onChange={(event) =>
                updateSubjectEvaluationText(event.target.value)
              }
              placeholder={`${selectedSubjectAbilitySubject.label} 평가항목을 입력하세요.`}
            />
          </label>
        ) : null}
      </>
    )
  }

  function setSectionGenerationState(sectionId, isGenerating) {
    setGeneratingSectionIds((previous) => ({
      ...previous,
      [sectionId]: isGenerating,
    }))
  }

  function getClubCharacterQualitySelection() {
    const characterOptions =
      (schoolLifeQualityOptions.characters ?? []).length > 0
        ? schoolLifeQualityOptions.characters
        : schoolLifeQualities.characters ?? []

    return getRandomSchoolLifeQualitySelection(
      {
        competencies: [],
        characters: characterOptions,
      },
      7,
      12,
    )
  }

  function createClubDepartmentPromptInstruction(
    departmentName,
    characterWords = [],
    writingVariant = null,
    diversityInstruction = '',
  ) {
    const topicKeywords = getClubDepartmentTopicKeywords(departmentName)

    return [
      `동아리 부서명: ${departmentName}`,
      `반드시 ${departmentName} 활동 자체와 관련된 내용으로 작성하세요.`,
      characterWords.length
        ? `반영할 학생품성 7~12개: ${characterWords.join(', ')}. 이 품성 단어를 그대로 나열하지 말고 동아리 활동 중 보이는 태도와 행동으로 자연스럽게 녹여 쓰세요.`
        : '',
      topicKeywords.length
        ? `문장 안에 다음 핵심 주제 중 하나 이상이 자연스럽게 드러나야 합니다: ${topicKeywords.join(', ')}.`
        : '',
      writingVariant
        ? `이번 학생의 문장 전개 방식: ${writingVariant.instruction}`
        : '',
      `글자 수는 공백 포함 ${CLUB_RECORD_MIN_LENGTH}자 이상 ${CLUB_RECORD_MAX_LENGTH}자 이하로 작성하세요.`,
      '봉사, 나눔, 배려 같은 일반적 표현만으로 채우지 말고 해당 동아리에서 실제로 할 법한 연습, 탐구, 협력, 발표, 경기, 제작, 감상, 역할 수행 내용을 넣으세요.',
      '다른 학생과 같은 "활동에서 ... 익히고 ... 수행했음. 활동 중 ..." 문장 골격을 반복하지 말고 시작 장면, 서술 순서, 마무리 관점을 다르게 쓰세요.',
      diversityInstruction,
    ]
      .filter(Boolean)
      .join('\n')
  }

  function createRecordPrompt(
    section,
    currentText,
    selectedActivityRows = [],
    diversityInstruction = '',
    targetStudent = selectedStudent,
    targetSchoolLifeQualities = schoolLifeQualities,
  ) {
    const memo = currentText.trim()
    const studentContext = `${targetStudent.grade}학년 ${targetStudent.class_num}반 ${targetStudent.student_num}번`
    const isSelfGovernmentSection = section.id === SELF_GOVERNMENT_SECTION_ID
    const isClubSection = section.id === CLUB_SECTION_ID
    const isSubjectAbilitySection =
      section.id === SUBJECT_ABILITY_SECTION_ID ||
      String(section.id).startsWith(`${SUBJECT_ABILITY_SECTION_ID}:`)
    const subjectAbilitySubjectId = String(section.id).startsWith(
      `${SUBJECT_ABILITY_SECTION_ID}:`,
    )
      ? String(section.id).split(':')[1]
      : selectedSubjectAbilitySubject.id
    const subjectAbilitySubject =
      getSubjectAbilitySubjectOption(subjectAbilitySubjectId)
    const subjectReferenceContext = isSubjectAbilitySection
      ? getSubjectAbilityReferencePromptContext(subjectAbilitySubject.id)
      : ''
    const originalSelectedQualities = [
      ...(targetSchoolLifeQualities.competencies ?? []),
      ...(targetSchoolLifeQualities.characters ?? []),
    ]
    const subjectCompetencyOptions = getSubjectAbilityCompetencyOptions(
      subjectAbilitySubject.id,
      schoolLifeQualityOptions.competencies ?? [],
    )
    const selectedCompetencies = isSelfGovernmentSection
      ? filterQualitiesBySelectedActivities(
          targetSchoolLifeQualities.competencies ?? [],
          selectedActivityRows,
        )
      : isSubjectAbilitySection
        ? (targetSchoolLifeQualities.competencies ?? []).filter((quality) =>
            subjectCompetencyOptions.includes(quality),
          )
      : targetSchoolLifeQualities.competencies ?? []
    const selectedCharacters = isSelfGovernmentSection
      ? filterQualitiesBySelectedActivities(
          targetSchoolLifeQualities.characters ?? [],
          selectedActivityRows,
        )
      : targetSchoolLifeQualities.characters ?? []
    const qualityRestrictionInstructions =
      getQualityRestrictionInstructions(originalSelectedQualities)
    const qualityContext = [
      selectedCompetencies.length
        ? `학생역량: ${selectedCompetencies.join(', ')}`
        : '',
      selectedCharacters.length ? `품성: ${selectedCharacters.join(', ')}` : '',
    ].filter(Boolean)
    const qualityExpressionContext = formatQualityExpressionGuidesForPrompt([
      ...selectedCompetencies,
      ...selectedCharacters,
    ])
    const activityContext = formatActivityRowsForPrompt(selectedActivityRows)
    const activityFocusContext =
      formatActivityFocusRowsForPrompt(selectedActivityRows)

    return [
      section.promptGuide,
      '종결 어미 뒤에는 쉼표를 쓰지 말고 반드시 마침표를 쓰세요. 예: 익혔음, → 익혔음. / 기여함, → 기여함.',
      '아래 조건을 반드시 지켜서 완성된 한국어 생활기록부 문장만 출력하세요.',
      '영어 번역, 제목, 설명, 번호, 목록, 불릿, 마크다운 기호(*, **, #, -), 따옴표를 절대 쓰지 마세요.',
      '학생 이름은 넣지 말고, 과장된 표현은 피해 주세요.',
      isSelfGovernmentSection
        ? '한 문단으로 작성하고 최종 출력은 공백 포함 반드시 350자 이상 450자 이하로 맞추세요. 349자 이하는 실패이고 451자 이상도 실패입니다.'
        : isClubSection
          ? `관찰 가능한 행동 중심으로 자연스럽게 2문장, 공백 포함 ${CLUB_RECORD_MIN_LENGTH}자 이상 ${CLUB_RECORD_MAX_LENGTH}자 이하로 작성하세요.`
          : '관찰 가능한 행동 중심으로 자연스럽게 2문장, 180자 이내로 작성하세요.',
      isClubSection
        ? '동아리 활동명이나 부서명이 주어지면 그 제목에 걸맞은 구체적인 활동 내용, 역할 수행, 협력 태도, 연습이나 탐구 과정을 중심으로 작성하세요.'
        : '',
      isSubjectAbilitySection
        ? `${subjectAbilitySubject.label} 과목의 수업 관찰 내용, 배움의 과정, 수행 태도, 개념 이해를 중심으로 과목 세부능력특기사항을 작성하세요.`
        : '',
      isSubjectAbilitySection
        ? '업로드한 성취기준/성취수준 참고자료와 직접 입력한 평가항목이 있으면 핵심 개념과 도달 수준, 평가 내용을 반영하되, 자료 문장을 그대로 길게 베끼지 말고 학생의 관찰 가능한 행동과 연결하세요.'
        : '',
      isSelfGovernmentSection
        ? '아래에서 랜덤 선택된 자율자치 활동 3~4개만 활용하고, 출력은 반드시 활동내용(실시일) 형식을 문장 안에 넣어 이어 쓰세요. 예: 학교폭력 예방교육(2026.03.11.)을 통해 타인의 입장을 이해하고 갈등을 평화롭게 해결하는 방법을 배움.'
        : '관찰 가능한 행동과 태도 중심으로 작성하세요.',
      isSelfGovernmentSection
        ? '가장 중요한 기준은 실제 활동 주제입니다. 활동명을 끼워 넣은 뒤 봉사정신, 나눔, 공동체 의식 같은 일반 가치어로 내용을 채우지 말고, 각 활동명에 담긴 교육 주제와 직접 관련된 개념, 대처 방법, 실천 태도를 쓰세요.'
        : '',
      isSelfGovernmentSection
        ? '활동은 제공된 순서인 날짜순으로 서술하세요. 첫 문장은 첫 2개 활동만 쉼표와 ~며, ~고, ~하여 같은 연결어미로 이어 쓴 뒤 반드시 ~했음. 형태로 종결하세요.'
        : '',
      isSelfGovernmentSection
        ? '학생역량과 품성 단어는 활동 주제와 직접 어울릴 때만 보조적으로 반영하고, 활동의 실제 교육 내용을 대신하게 하지 마세요.'
        : '',
      isSelfGovernmentSection
        ? '반영할 학생 특성은 "적응력을 바탕으로", "협업을 바탕으로"처럼 단어만 바꿔 붙이지 말고, 실제 관찰 행동과 생각의 흐름으로 풀어 쓰세요.'
        : '',
      isSelfGovernmentSection
        ? '같은 마무리 문장이나 같은 표현을 학생마다 반복하지 말고, 선택된 역량과 품성에 따라 문장 전개와 결론이 분명히 달라지게 쓰세요.'
        : '',
      isSelfGovernmentSection
        ? '"활동 내용을 자신의 생활과 연결하며", "배운 내용을 생활 속 태도로 이어 가는", "이후 활동 내용을 다시 확인하며" 같은 표현은 사용하지 마세요.'
        : '',
      isSelfGovernmentSection
        ? '마지막 문장은 반드시 자연스러운 서술어로 끝내고, "그치함", "핵심함"처럼 단어가 잘린 표현이 나오지 않게 하세요.'
        : '',
      ...qualityRestrictionInstructions,
      isSelfGovernmentSection
        ? '두 번째 문장은 나머지 1~2개 활동을 이어서 서술하고, 입력된 활동자료 밖의 활동은 새로 만들지 마세요. 전체 문장은 원칙적으로 2문장으로 구성하세요.'
        : '',
      `학생 구분: ${studentContext}`,
      qualityContext.length
        ? `반영할 학생 특성: ${qualityContext.join(' / ')}`
        : '반영할 학생 특성: 선택된 항목이 없으면 참고 메모 중심으로 작성',
      isSelfGovernmentSection && activityContext
        ? `[이번 생성에 사용할 랜덤 선택 자율자치 활동자료]\n${activityContext}`
        : '',
      isSelfGovernmentSection && activityFocusContext
        ? `[활동별 작성 초점]\n${activityFocusContext}`
        : '',
      isSelfGovernmentSection && qualityExpressionContext
        ? `[역량/품성별 표현 방향]\n${qualityExpressionContext}`
        : '',
      isSubjectAbilitySection && subjectReferenceContext
        ? `[업로드한 과목 참고자료]\n${subjectReferenceContext}`
        : '',
      diversityInstruction,
      memo && isSelfGovernmentSection
        ? `기존 입력 내용은 그대로 베끼지 말고 필요한 사실만 참고하세요. 같은 문장 구조와 마무리는 반복하지 마세요: ${memo}`
        : '',
      memo && !isSelfGovernmentSection ? `참고 메모: ${memo}` : '',
      !memo ? `참고 메모: ${section.fallbackMemo}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  async function requestGeneratedRecordText(prompt) {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
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

    return normalizeGeneratedRecordPunctuation(cleanGeneratedRecordText(data.text))
  }

  function isValidSelfGovernmentGeneratedText(
    text,
    selectedActivityRows,
    selectedQualityWords,
    comparableRows = [],
  ) {
    return (
      isLikelyKoreanRecordText(text, true) &&
      isGeneratedRecordGroundedInActivities(text, selectedActivityRows) &&
      isGeneratedRecordStructuredByActivityPairs(text, selectedActivityRows) &&
      !hasMechanicalQualityLabeling(text, selectedQualityWords) &&
      !hasRepeatedGenericClosing(text) &&
      !hasRepeatedActivityPhrase(text, selectedActivityRows, comparableRows) &&
      !hasBrokenRecordEnding(text)
    )
  }

  async function handleGenerateRecord(section) {
    if (!selectedStudent) {
      return
    }

    const recordKey = getRecordKey(section.id)
    const currentText = recordValues[recordKey] ?? ''
    const isSelfGovernmentSection = section.id === SELF_GOVERNMENT_SECTION_ID
    const isClubSection = section.id === CLUB_SECTION_ID
    const clubQualitySelection = isClubSection
      ? getClubCharacterQualitySelection()
      : emptySchoolLifeQualities
    const selectedActivityRows = isSelfGovernmentSection
      ? getRandomActivityRows(activityRows)
      : []
    const allowedSchoolLifeQualities = isSelfGovernmentSection
      ? getAllowedSchoolLifeQualitiesForActivities(
          schoolLifeQualities,
          selectedActivityRows,
        )
      : clubQualitySelection
    const selectedQualityWords = isSelfGovernmentSection
      ? [
          ...allowedSchoolLifeQualities.competencies,
          ...allowedSchoolLifeQualities.characters,
        ]
      : []

    setSectionGenerationState(section.id, true)

    let comparableRows = []

    try {
      if (isSelfGovernmentSection || isClubSection) {
        const { data, error } = await fetchComparableSchoolLifeRecordRows({
          classNum: selectedStudent.class_num,
          grade: selectedStudent.grade,
          schoolYear: DEFAULT_ACTIVITY_YEAR,
          sectionId: section.id,
          studentId: selectedStudent.id,
        })

        if (error) {
          showRemoteStorageError(error)
        } else {
          comparableRows = data ?? []
        }
      }

      const isValidGeneratedText = (text) =>
        isLikelyKoreanRecordText(text, isSelfGovernmentSection) &&
        (!isSelfGovernmentSection ||
          isValidSelfGovernmentGeneratedText(
            text,
            selectedActivityRows,
            selectedQualityWords,
            comparableRows,
          )) &&
        (!isClubSection || isValidClubGeneratedText(text))

      let bestCandidate = null
      let bestSimilarityResult = {
        isTooSimilar: false,
        maxScore: 0,
        topMatches: [],
      }
      let diversityInstruction = ''

      for (
        let attempt = 0;
        attempt <= MAX_DIVERSITY_REPAIR_ATTEMPTS;
        attempt += 1
      ) {
        const promptDiversityInstruction = isClubSection
          ? [
              `이번 학생의 문장 전개 방식: ${
                getClubWritingVariant(
                  Number(selectedStudent.student_num ?? 0) + attempt,
                ).instruction
              }`,
              '동아리 활동 문장은 다른 학생과 같은 시작 표현, 같은 2문장 골격, 같은 마무리 표현을 반복하지 마세요.',
              diversityInstruction,
            ]
              .filter(Boolean)
              .join('\n')
          : diversityInstruction
        const rawGeneratedText = await requestGeneratedRecordText(
          createRecordPrompt(
            section,
            currentText,
            selectedActivityRows,
            promptDiversityInstruction,
            selectedStudent,
            isClubSection ? clubQualitySelection : schoolLifeQualities,
          ),
        )
        const generatedText = isClubSection
          ? fitClubRecordLength(rawGeneratedText)
          : rawGeneratedText
        const activityPhraseResult = isSelfGovernmentSection
          ? getRepeatedActivityPhraseResult(
              generatedText,
              selectedActivityRows,
              comparableRows,
            )
          : { isRepeated: false }

        if (activityPhraseResult.isRepeated) {
          diversityInstruction = createActivityPhraseDiversityInstruction(
            activityPhraseResult,
            attempt + 1,
          )
          continue
        }

        if (!isValidGeneratedText(generatedText)) {
          continue
        }

        const similarityResult = isSelfGovernmentSection || isClubSection
          ? getRecordSimilarityResult(generatedText, comparableRows)
          : { isTooSimilar: false, maxScore: 0, topMatches: [] }

        if (
          !bestCandidate ||
          similarityResult.maxScore < bestSimilarityResult.maxScore
        ) {
          bestCandidate = generatedText
          bestSimilarityResult = similarityResult
        }

        if (!similarityResult.isTooSimilar) {
          break
        }

        diversityInstruction = createDiversityInstruction(
          generatedText,
          similarityResult,
          attempt + 1,
        )
      }

      if (
        isSelfGovernmentSection &&
        bestCandidate &&
        bestSimilarityResult.isTooSimilar
      ) {
        const fallbackText = buildSelfGovernmentFallbackRecord(
          selectedActivityRows,
          schoolLifeQualities,
        )
        const fallbackSimilarityResult = getRecordSimilarityResult(
          fallbackText,
          comparableRows,
        )

        if (
          isValidGeneratedText(fallbackText) &&
          fallbackSimilarityResult.maxScore < bestSimilarityResult.maxScore
        ) {
          bestCandidate = fallbackText
          bestSimilarityResult = fallbackSimilarityResult
        }
      }

      if (!bestCandidate && isSelfGovernmentSection) {
        const fallbackText = buildSelfGovernmentFallbackRecord(
          selectedActivityRows,
          schoolLifeQualities,
        )
        const fallbackSimilarityResult = getRecordSimilarityResult(
          fallbackText,
          comparableRows,
        )

        bestCandidate = fallbackText
        bestSimilarityResult = fallbackSimilarityResult
      }

      if (isClubSection && bestCandidate && bestSimilarityResult.isTooSimilar) {
        const fallbackCandidate = createClubFallbackCandidate(
          section.label,
          clubQualitySelection.characters,
          comparableRows,
          Number(selectedStudent.student_num ?? 0),
        )

        if (
          fallbackCandidate.text &&
          fallbackCandidate.similarityResult.maxScore <
            bestSimilarityResult.maxScore
        ) {
          bestCandidate = fallbackCandidate.text
          bestSimilarityResult = fallbackCandidate.similarityResult
        }
      }

      if (!bestCandidate && isClubSection) {
        const fallbackCandidate = createClubFallbackCandidate(
          section.label,
          clubQualitySelection.characters,
          comparableRows,
          Number(selectedStudent.student_num ?? 0),
        )
        bestCandidate = fallbackCandidate.text
        bestSimilarityResult = fallbackCandidate.similarityResult
      }

      if (!bestCandidate || !isValidGeneratedText(bestCandidate)) {
        if (isSelfGovernmentSection) {
          const fallbackText = buildSelfGovernmentFallbackRecord(
            selectedActivityRows,
            schoolLifeQualities,
          )

          updateRecordValue(section.id, fallbackText)
          onToast?.(`${selectedStudent.name} 학생의 자율자치 활동 문장을 보정했습니다.`)
          return
        }

        if (isClubSection) {
          const fallbackCandidate = createClubFallbackCandidate(
            section.label,
            clubQualitySelection.characters,
            comparableRows,
            Number(selectedStudent.student_num ?? 0),
          )

          updateRecordValue(section.id, fallbackCandidate.text)
          onToast?.(`${selectedStudent.name} 학생의 동아리 활동 문장을 보정했습니다.`)
          return
        }

        throw new Error('한국어 생활기록부 문장으로 생성되지 않았습니다.')
      }

      updateRecordValue(section.id, bestCandidate)

      if (isSelfGovernmentSection && comparableRows.length) {
        const similarityPercent = Math.round(bestSimilarityResult.maxScore * 100)
        const similarityMessage =
          bestSimilarityResult.maxScore > MAX_RECORD_SIMILARITY
            ? ` 가장 낮은 유사도 후보(${similarityPercent}%)를 적용했습니다.`
            : ` 기존 문장과 유사도 ${similarityPercent}%로 생성했습니다.`

        onToast?.(
          `${selectedStudent.name} 학생의 ${section.label} 문장을 생성했습니다.${similarityMessage}`,
        )
        return
      }

      onToast?.(`${selectedStudent.name} 학생의 ${section.label} 문장을 생성했습니다.`)
    } catch (error) {
      if (isSelfGovernmentSection) {
        const fallbackText = buildSelfGovernmentFallbackRecord(
          selectedActivityRows,
          schoolLifeQualities,
        )

        updateRecordValue(section.id, fallbackText)
        onToast?.(
          `${selectedStudent.name} 학생의 자율자치 활동 문장을 활동 주제에 맞춰 보정했습니다.`,
        )
        return
      }

      if (isClubSection) {
        const fallbackCandidate = createClubFallbackCandidate(
          section.label,
          clubQualitySelection.characters,
          comparableRows,
          Number(selectedStudent.student_num ?? 0),
        )

        updateRecordValue(section.id, fallbackCandidate.text)
        onToast?.(`${selectedStudent.name} 학생의 동아리 활동 문장을 보정했습니다.`)
        return
      }

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

  function getBatchQualityOptions() {
    const optionCount =
      (schoolLifeQualityOptions.competencies ?? []).length +
      (schoolLifeQualityOptions.characters ?? []).length

    return optionCount ? schoolLifeQualityOptions : schoolLifeQualities
  }

  function getSelectedQualityWordsForActivities(
    qualitySelection,
    selectedActivityRows,
  ) {
    const allowedQualities = getAllowedSchoolLifeQualitiesForActivities(
      qualitySelection,
      selectedActivityRows,
    )

    return [
      ...allowedQualities.competencies,
      ...allowedQualities.characters,
    ]
  }

  async function handleGenerateClubDepartmentRecords() {
    if (
      classSelectedSection.id !== CLUB_SECTION_ID ||
      !selectedClubDepartment ||
      isClubDepartmentStudentsBusy ||
      !selectedClassStudents.length
    ) {
      return
    }

    setSectionGenerationState(classGenerationStateKey, true)

    const existingComparableRows = getCurrentClassComparableRows(
      classSelectedSection.id,
      selectedClassStudents,
    )
    const generatedRows = []
    let completedCount = 0
    let skippedCount = 0
    let fallbackCount = 0
    let tooSimilarCount = 0

    try {
      for (const [studentIndex, student] of selectedClassStudents.entries()) {
        const generatedStudentIds = new Set(
          generatedRows.map((row) => row.student_id),
        )
        const comparableRows = [
          ...existingComparableRows.filter(
            (row) =>
              row.student_id !== student.id &&
              !generatedStudentIds.has(row.student_id),
          ),
          ...generatedRows,
        ]
        const recordKey = getStudentRecordKey(classSelectedSection.id, student.id)
        const currentText = recordValuesRef.current[recordKey] ?? ''
        const clubQualitySelection = getClubCharacterQualitySelection()
        let generatedText = ''
        let bestCandidate = {
          similarityResult: {
            isTooSimilar: true,
            maxScore: Number.POSITIVE_INFINITY,
            topMatches: [],
          },
          text: '',
        }

        try {
          for (
            let attempt = 0;
            attempt <= CLUB_DIVERSITY_REPAIR_ATTEMPTS;
            attempt += 1
          ) {
            const writingVariant = getClubWritingVariant(studentIndex + attempt)
            const diversityInstruction = bestCandidate.text
              ? createDiversityInstruction(
                  bestCandidate.text,
                  bestCandidate.similarityResult,
                  attempt + 1,
                )
              : ''
            const nextGeneratedText = fitClubRecordLength(
              await requestGeneratedRecordText(
                createRecordPrompt(
                  classSelectedSection,
                  currentText,
                  [],
                  createClubDepartmentPromptInstruction(
                    selectedClubDepartment,
                    clubQualitySelection.characters,
                    writingVariant,
                    diversityInstruction,
                  ),
                  student,
                  clubQualitySelection,
                ),
              ),
            )
            const isValidClubText = isValidClubGeneratedText(
              nextGeneratedText,
              selectedClubDepartment,
            )

            if (!isValidClubText && !isUsableClubGeneratedText(nextGeneratedText)) {
              continue
            }

            const similarityResult = getRecordSimilarityResult(
              nextGeneratedText,
              comparableRows,
            )

            if (
              isValidClubText &&
              (!bestCandidate.text ||
                similarityResult.maxScore <
                  bestCandidate.similarityResult.maxScore)
            ) {
              bestCandidate = {
                similarityResult,
                text: nextGeneratedText,
              }
            }

            if (isValidClubText && !similarityResult.isTooSimilar) {
              generatedText = nextGeneratedText
              break
            }
          }

          const fallbackCandidate = createClubFallbackCandidate(
            selectedClubDepartment,
            clubQualitySelection.characters,
            comparableRows,
            studentIndex,
          )

          if (
            !generatedText &&
            (!bestCandidate.text ||
              fallbackCandidate.similarityResult.maxScore <
                bestCandidate.similarityResult.maxScore ||
              bestCandidate.similarityResult.isTooSimilar)
          ) {
            generatedText = fallbackCandidate.text
            fallbackCount += 1
          }

          if (!generatedText) {
            generatedText = bestCandidate.text
          }
        } catch {
          const fallbackCandidate = createClubFallbackCandidate(
            selectedClubDepartment,
            clubQualitySelection.characters,
            comparableRows,
            studentIndex,
          )
          generatedText = fallbackCandidate.text
          fallbackCount += 1
        }

        if (!generatedText || !isUsableClubGeneratedText(generatedText)) {
          skippedCount += 1
          continue
        }

        if (getRecordSimilarityResult(generatedText, comparableRows).isTooSimilar) {
          tooSimilarCount += 1
        }

        updateRecordValueForStudent(
          student.id,
          classSelectedSection.id,
          generatedText,
        )
        recordValuesRef.current = {
          ...recordValuesRef.current,
          [recordKey]: generatedText,
        }
        generatedRows.push({
          content: generatedText,
          student_id: student.id,
        })
        completedCount += 1
      }

      if (!completedCount) {
        onToast?.(
          '동아리 활동 문장을 입력하지 못했습니다. Gemini 연결 상태를 확인해 주세요.',
          'error',
        )
        return
      }

      onToast?.(
        `${selectedClubDepartment} ${completedCount}명 동아리 활동 문장을 입력했습니다.${
          fallbackCount ? ` ${fallbackCount}명은 보정 문장으로 입력했습니다.` : ''
        }${
          tooSimilarCount
            ? ` ${tooSimilarCount}명은 가장 낮은 유사도 후보를 적용했습니다.`
            : ' 유사도 50% 이하 기준으로 보정했습니다.'
        }${skippedCount ? ` ${skippedCount}명은 입력하지 못했습니다.` : ''}`,
      )
    } finally {
      setSectionGenerationState(classGenerationStateKey, false)
    }
  }

  async function resolveSelectedClassStudents() {
    if (!activeClassGrade || !activeClassNum) {
      return selectedClassStudents
    }

    if (hasCompleteClassStudentRows) {
      return classStudentRowsState.rows
    }

    const { data, error } = await fetchClassStudentRows({
      classNum: activeClassNum,
      grade: activeClassGrade,
    })

    if (error) {
      showRemoteStorageError(error)
      return selectedClassStudents
    }

    const nextRows = sortClassStudents(data ?? [])

    setClassStudentRowsState({
      isLoading: false,
      rows: nextRows,
      scopeKey: classSimilarityScopeKey,
    })

    return nextRows.length ? nextRows : selectedClassStudents
  }

  function getCurrentClassComparableRows(
    sectionId,
    targetStudents = selectedClassStudents,
  ) {
    return targetStudents
      .map((student) => ({
        content:
          recordValuesRef.current[getStudentRecordKey(sectionId, student.id)] ??
          '',
        student_id: student.id,
      }))
      .filter((row) => row.content.trim())
  }

  function createSimilarityReportPair(leftRow, rightRow) {
    const score = calculateRecordSimilarity(leftRow.content, rightRow.content)

    return {
      leftContent: leftRow.content,
      leftIdentityLabel: getStudentSimilarityIdentityLabel(leftRow.student),
      leftLabel: getStudentCodeLabel(leftRow.student),
      leftStudentId: leftRow.student.id,
      rightContent: rightRow.content,
      rightIdentityLabel: getStudentSimilarityIdentityLabel(rightRow.student),
      rightLabel: getStudentCodeLabel(rightRow.student),
      rightStudentId: rightRow.student.id,
      score,
      tone: getSimilarityTone(score),
    }
  }

  function addSimilarityHighlightPair(pair) {
    const highlightPair = createSimilarityHighlightPair(
      pair.leftContent,
      pair.rightContent,
    )

    return {
      ...pair,
      leftSegments: highlightPair.leftSegments,
      rightSegments: highlightPair.rightSegments,
    }
  }

  function createCurrentClassRecordRows(
    sectionId,
    targetStudents = selectedClassStudents,
  ) {
    return targetStudents
      .map((student) => {
        const recordKey = getStudentRecordKey(sectionId, student.id)
        const content = String(recordValuesRef.current[recordKey] ?? '').trim()

        return {
          content,
          student,
        }
      })
      .filter((row) => row.content)
  }

  function createClassSimilarityReport(
    sectionId,
    targetStudents = selectedClassStudents,
    comparisonRows = [],
    scope = SIMILARITY_SCOPE_CLASS,
  ) {
    const rows = createCurrentClassRecordRows(sectionId, targetStudents)
    const missingCount = targetStudents.length - rows.length
    const pairs = []

    if (scope === SIMILARITY_SCOPE_CLASS) {
      for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < rows.length;
          rightIndex += 1
        ) {
          pairs.push(createSimilarityReportPair(rows[leftIndex], rows[rightIndex]))
        }
      }
    } else {
      rows.forEach((leftRow) => {
        comparisonRows.forEach((rightRow) => {
          if (
            !rightRow.student ||
            !rightRow.content?.trim() ||
            rightRow.student_id === leftRow.student.id
          ) {
            return
          }

          pairs.push(createSimilarityReportPair(leftRow, rightRow))
        })
      })
    }

    pairs.sort((left, right) => right.score - left.score)

    return {
      checkedCount: rows.length,
      cautionCount: pairs.filter(
        (pair) =>
          pair.score >= CAUTION_RECORD_SIMILARITY &&
          pair.score <= MAX_RECORD_SIMILARITY,
      ).length,
      highCount: pairs.filter((pair) => pair.score > MAX_RECORD_SIMILARITY)
        .length,
      maxScore: pairs[0]?.score ?? 0,
      missingCount,
      pairCount: pairs.length,
      comparisonCount:
        scope === SIMILARITY_SCOPE_CLASS ? rows.length : comparisonRows.length,
      comparisonScopeLabel: getSimilarityScopeLabel(scope),
      pairs: pairs.slice(0, 20).map(addSimilarityHighlightPair),
      scopeKey: classSimilarityScopeKey,
      similarityScope: scope,
      sectionId,
    }
  }

  async function handleCheckClassSimilarity() {
    const sectionId = activeSimilaritySectionId
    const classStudentsForReport = await resolveSelectedClassStudents()
    let comparisonRows = []

    if (similarityScope !== SIMILARITY_SCOPE_CLASS) {
      const { data, error } = await fetchSchoolLifeRecordComparisonRows({
        classNum: activeClassNum,
        excludeStudentIds: classStudentsForReport
          .map((student) => student.id)
          .filter(Boolean),
        grade: activeClassGrade,
        schoolYear: DEFAULT_ACTIVITY_YEAR,
        scope: similarityScope,
        sectionId,
      })

      if (error) {
        showRemoteStorageError(error)
        return
      }

      comparisonRows = data ?? []
    }

    const report = createClassSimilarityReport(
      sectionId,
      classStudentsForReport,
      comparisonRows,
      similarityScope,
    )

    setClassSimilarityReport(report)

    if (report.pairCount < 1) {
      onToast?.(
        report.similarityScope === SIMILARITY_SCOPE_CLASS
          ? '유사도 검사를 하려면 입력된 학생 문장이 2명 이상 필요합니다.'
          : '선택한 범위에 비교할 저장 문장이 아직 없습니다.',
      )
      return
    }

    const resultMessage = report.highCount
      ? `${report.highCount}쌍이 50%를 초과했습니다.`
      : `최고 유사도 ${formatSimilarityPercent(report.maxScore)}로 확인했습니다.`

    onToast?.(`${classLabel} ${report.comparisonScopeLabel} 유사도 검사를 완료했습니다. ${resultMessage}`)
  }

  function createFallbackClassSelfGovernmentCandidate(
    comparableRows,
    initialActivityRows,
    initialQualitySelection,
  ) {
    let bestCandidate = {
      activityRows: initialActivityRows,
      qualitySelection: initialQualitySelection,
      similarityResult: {
        isTooSimilar: true,
        maxScore: Number.POSITIVE_INFINITY,
        topMatches: [],
      },
      text: '',
    }

    for (let attempt = 0; attempt < 14; attempt += 1) {
      const candidateActivityRows =
        attempt === 0 ? initialActivityRows : getRandomActivityRows(activityRows)
      const candidateQualitySelection =
        attempt === 0
          ? initialQualitySelection
          : getRandomSchoolLifeQualitySelection(getBatchQualityOptions(), 7, 12)
      const selectedQualityWords = getSelectedQualityWordsForActivities(
        candidateQualitySelection,
        candidateActivityRows,
      )
      const candidateText = buildSelfGovernmentFallbackRecord(
        candidateActivityRows,
        candidateQualitySelection,
      )

      if (
        !isValidSelfGovernmentGeneratedText(
          candidateText,
          candidateActivityRows,
          selectedQualityWords,
          comparableRows,
        )
      ) {
        continue
      }

      const similarityResult = getRecordSimilarityResult(
        candidateText,
        comparableRows,
      )

      if (
        !bestCandidate.text ||
        similarityResult.maxScore < bestCandidate.similarityResult.maxScore
      ) {
        bestCandidate = {
          activityRows: candidateActivityRows,
          qualitySelection: candidateQualitySelection,
          similarityResult,
          text: candidateText,
        }
      }

      if (!similarityResult.isTooSimilar) {
        break
      }
    }

    return bestCandidate
  }

  async function handleGenerateClassSelfGovernmentRecords() {
    if (
      classSelectedSection.id !== SELF_GOVERNMENT_SECTION_ID ||
      (!selectedClassStudents.length && (!activeClassGrade || !activeClassNum))
    ) {
      return
    }

    setSectionGenerationState(classGenerationStateKey, true)

    const generatedRows = []
    const nextQualitySelectionsByStudentId = {}
    let tooSimilarCount = 0

    try {
      const classStudentsForGeneration = await resolveSelectedClassStudents()

      if (!classStudentsForGeneration.length) {
        onToast?.(`${classLabel} 학생 목록을 불러오지 못했습니다. 학생 목록을 확인해 주세요.`, 'error')
        return
      }

      const existingComparableRows = getCurrentClassComparableRows(
        SELF_GOVERNMENT_SECTION_ID,
        classStudentsForGeneration,
      )

      for (const student of classStudentsForGeneration) {
        const generatedStudentIds = new Set(
          generatedRows.map((row) => row.student_id),
        )
        const comparableRows = [
          ...existingComparableRows.filter(
            (row) =>
              row.student_id !== student.id &&
              !generatedStudentIds.has(row.student_id),
          ),
          ...generatedRows,
        ]
        const recordKey = getStudentRecordKey(
          SELF_GOVERNMENT_SECTION_ID,
          student.id,
        )
        const currentText = recordValuesRef.current[recordKey] ?? ''
        const selectedActivityRows = getRandomActivityRows(activityRows)
        const qualitySelection = getRandomSchoolLifeQualitySelection(
          getBatchQualityOptions(),
          7,
          12,
        )
        const selectedQualityWords = getSelectedQualityWordsForActivities(
          qualitySelection,
          selectedActivityRows,
        )
        let bestCandidate = {
          activityRows: selectedActivityRows,
          qualitySelection,
          similarityResult: {
            isTooSimilar: true,
            maxScore: Number.POSITIVE_INFINITY,
            topMatches: [],
          },
          text: '',
        }
        let diversityInstruction = ''

        for (
          let attempt = 0;
          attempt <= MAX_DIVERSITY_REPAIR_ATTEMPTS;
          attempt += 1
        ) {
          let generatedText = ''

          try {
            generatedText = await requestGeneratedRecordText(
              createRecordPrompt(
                classSelectedSection,
                currentText,
                selectedActivityRows,
                diversityInstruction,
                student,
                qualitySelection,
              ),
            )
          } catch {
            break
          }

          const activityPhraseResult = getRepeatedActivityPhraseResult(
            generatedText,
            selectedActivityRows,
            comparableRows,
          )

          if (activityPhraseResult.isRepeated) {
            diversityInstruction = createActivityPhraseDiversityInstruction(
              activityPhraseResult,
              attempt + 1,
            )
            continue
          }

          if (
            !isValidSelfGovernmentGeneratedText(
              generatedText,
              selectedActivityRows,
              selectedQualityWords,
              comparableRows,
            )
          ) {
            continue
          }

          const similarityResult = getRecordSimilarityResult(
            generatedText,
            comparableRows,
          )

          if (
            !bestCandidate.text ||
            similarityResult.maxScore < bestCandidate.similarityResult.maxScore
          ) {
            bestCandidate = {
              activityRows: selectedActivityRows,
              qualitySelection,
              similarityResult,
              text: generatedText,
            }
          }

          if (!similarityResult.isTooSimilar) {
            break
          }

          diversityInstruction = createDiversityInstruction(
            generatedText,
            similarityResult,
            attempt + 1,
          )
        }

        if (!bestCandidate.text || bestCandidate.similarityResult.isTooSimilar) {
          const fallbackCandidate = createFallbackClassSelfGovernmentCandidate(
            comparableRows,
            selectedActivityRows,
            qualitySelection,
          )

          if (
            fallbackCandidate.text &&
            (!bestCandidate.text ||
              fallbackCandidate.similarityResult.maxScore <
                bestCandidate.similarityResult.maxScore)
          ) {
            bestCandidate = fallbackCandidate
          }
        }

        if (!bestCandidate.text) {
          bestCandidate = createFallbackClassSelfGovernmentCandidate(
            comparableRows,
            selectedActivityRows,
            qualitySelection,
          )
        }

        if (!bestCandidate.text) {
          continue
        }

        if (bestCandidate.similarityResult.isTooSimilar) {
          tooSimilarCount += 1
        }

        updateRecordValueForStudent(
          student.id,
          SELF_GOVERNMENT_SECTION_ID,
          bestCandidate.text,
        )
        recordValuesRef.current = {
          ...recordValuesRef.current,
          [recordKey]: bestCandidate.text,
        }
        generatedRows.push({
          content: bestCandidate.text,
          student_id: student.id,
        })
        nextQualitySelectionsByStudentId[student.id] =
          bestCandidate.qualitySelection
      }

      if (Object.keys(nextQualitySelectionsByStudentId).length) {
        onSchoolLifeQualitySelectionsChange?.(nextQualitySelectionsByStudentId)
      }

      const completedCount = generatedRows.length
      const similarityMessage = tooSimilarCount
        ? ` ${tooSimilarCount}명은 가장 낮은 유사도 후보를 적용했습니다.`
        : ' 유사도 50% 이하 기준으로 보정했습니다.'

      onToast?.(
        `${classLabel} ${completedCount}명 자율자치 활동을 생성했습니다.${similarityMessage}`,
      )
    } finally {
      setSectionGenerationState(classGenerationStateKey, false)
    }
  }

  if (!selectedStudent) {
    return null
  }

  return (
    <section className="detail-section school-life-records-shell">
      {inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_PERSONAL ? (
        <>
          {isPersonalSelfGovernmentSection ? (
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
              {isActivityEditorOpen ? '접기' : '편집'}
            </button>
          </div>
        </div>

        {!isActivityEditorOpen ? (
          <p className="school-life-records-activity-compact-summary">
            {activityRows.length
              ? `${activityRows[0].date ? `${activityRows[0].date} · ` : ''}${
                  activityRows[0].content
                }${activityRows.length > 1 ? ` 외 ${activityRows.length - 1}개` : ''}`
              : '활동자료를 등록하면 Gemini 생성에 반영됩니다.'}
          </p>
        ) : null}

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

        {isActivityEditorOpen && activityRows.length ? (
          <div
            className="school-life-records-activity-preview"
            aria-label="자율자치 활동자료 미리보기"
          >
            {activityRows.slice(0, 3).map((activity, index) => (
              <div
                className="school-life-records-activity-preview__row"
                key={`${activity.date}-${activity.content}-${index}`}
              >
                <span>{activity.date || '-'}</span>
                <strong>{activity.content}</strong>
              </div>
            ))}
            {activityRows.length > 3 ? (
              <p className="school-life-records-activity-preview__more">
                외 {activityRows.length - 3}개
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
          ) : null}

      <div className="school-life-records-fields" aria-label="학교생활기록부 입력">
        <section
          className="school-life-records-field-card"
          key={personalEffectiveSelectedSection.id}
        >
          <div className="school-life-records-field-card__header">
            <h2>{personalEffectiveSelectedSection.label}</h2>
          </div>

          {isPersonalSubjectAbilitySection ? (
            <>
              {renderSubjectAbilityUploadActions()}
            </>
          ) : null}

          <label className="school-life-records-field">
            <span className="visually-hidden">
              {selectedStudent.name} {personalEffectiveSelectedSection.label}
            </span>
            <textarea
              maxLength={
                personalEffectiveSelectedSection.id === SELF_GOVERNMENT_SECTION_ID
                  ? SELF_GOVERNMENT_MAX_LENGTH
                  : undefined
              }
              value={
                recordValues[getRecordKey(personalEffectiveSelectedSection.id)] ??
                ''
              }
              onChange={(event) =>
                updateRecordValue(
                  personalEffectiveSelectedSection.id,
                  event.target.value,
                )
              }
              placeholder={personalEffectiveSelectedSection.placeholder}
            />
          </label>

          <div className="school-life-records-ai-actions">
            <button
              className="school-life-records-ai-button"
              type="button"
              onClick={() => handleGenerateRecord(personalEffectiveSelectedSection)}
              disabled={Boolean(
                generatingSectionIds[personalEffectiveSelectedSection.id],
              )}
            >
              {generatingSectionIds[personalEffectiveSelectedSection.id]
                ? '생성 중...'
                : 'Gemini 생성'}
            </button>
          </div>
        </section>
      </div>
        </>
      ) : null}

      {inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_CLASS ? (
        <section className="school-life-records-class-card">
          <div className="school-life-records-class-card__header">
            <div>
              <p className="section-label">전체 입력</p>
              <h2>{classLabel}</h2>
            </div>

            {classSelectedSection.id === SELF_GOVERNMENT_SECTION_ID ? (
              <div className="school-life-records-class-card__actions">
                <button
                  className="school-life-records-ai-button school-life-records-ai-button--class"
                  type="button"
                  onClick={handleGenerateClassSelfGovernmentRecords}
                  disabled={
                    isGeneratingClassSection ||
                    isClassStudentRowsLoading ||
                    (!selectedClassStudents.length &&
                      (!activeClassGrade || !activeClassNum))
                  }
                >
                  {isGeneratingClassSection
                    ? '전체학생 생성 중...'
                    : isClassStudentRowsLoading
                      ? '학생목록 확인 중...'
                    : '전체학생 Gemini 생성'}
                </button>
              </div>
            ) : (
              <span className="school-life-records-activity-count">
                {classStudentCountLabel}
              </span>
            )}
          </div>

          <div
            className={`school-life-records-section-tabs school-life-records-section-tabs--class ${
              isClassSectionPickerCollapsed
                ? 'school-life-records-section-tabs--collapsed'
                : ''
            }`}
            aria-label="전체 입력 항목 선택"
            role="tablist"
          >
            {visibleClassRecordSections.map((section) => (
              <button
                aria-selected={classSectionId === section.id}
                className={`school-life-records-section-tab ${
                  classSectionId === section.id ? 'is-active' : ''
                }`}
                key={section.id}
                role="tab"
                type="button"
                onClick={() => {
                  if (
                    isClassSectionPickerCollapsed &&
                    section.id === classSectionId
                  ) {
                    setIsClassSectionPickerCollapsed(false)
                    return
                  }

                  setClassSectionId(section.id)
                  setIsClassSectionPickerCollapsed(true)
                  if (section.id !== CLUB_SECTION_ID) {
                    setSelectedClubDepartment('')
                  }
                }}
              >
                {section.label}
              </button>
            ))}
          </div>

          {isClassSubjectAbilitySection ? (
            <div
              className={`school-life-records-subject-tabs ${
                isSubjectAbilityPickerCollapsed
                  ? 'school-life-records-subject-tabs--collapsed'
                  : ''
              }`}
              aria-label="과목 세부능력특기사항 과목 선택"
              role="group"
            >
              {visibleSubjectAbilitySubjects.map((subject) => (
                <button
                  className={`school-life-records-subject-tab ${
                    selectedSubjectAbilitySubject.id === subject.id
                      ? 'is-active'
                      : ''
                  }`}
                  key={subject.id}
                  type="button"
                  aria-pressed={selectedSubjectAbilitySubject.id === subject.id}
                  onClick={() => {
                    if (
                      isSubjectAbilityPickerCollapsed &&
                      selectedSubjectAbilitySubject.id === subject.id
                    ) {
                      setIsSubjectAbilityPickerCollapsed(false)
                      return
                    }

                    setSelectedSubjectAbilitySubjectId(subject.id)
                    setIsSubjectAbilityPickerCollapsed(true)
                    setClassSimilarityReport(null)
                  }}
                >
                  {subject.label}
                </button>
              ))}
              {isSubjectAbilityPickerCollapsed
                ? renderSubjectAbilityUploadActions()
                : null}
            </div>
          ) : null}

          {classSelectedSection.id === CLUB_SECTION_ID ? (
            <div className="school-life-records-club-filter">
              <label className="school-life-records-club-filter__field">
                <span>동아리 부서</span>
                <select
                  value={selectedClubDepartment}
                  onChange={(event) =>
                    setSelectedClubDepartment(event.target.value)
                  }
                  disabled={clubDepartmentOptionsState.isLoading}
                >
                  <option value="">선택 학급 전체</option>
                  {clubDepartmentOptionsState.options.map((departmentName) => (
                    <option key={departmentName} value={departmentName}>
                      {departmentName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="school-life-records-club-filter__actions">
                <button
                  className="school-life-records-ai-button school-life-records-ai-button--club"
                  type="button"
                  onClick={handleGenerateClubDepartmentRecords}
                  disabled={
                    isGeneratingClassSection ||
                    !selectedClubDepartment ||
                    isClubDepartmentStudentsBusy ||
                    !selectedClassStudents.length
                  }
                >
                  {isGeneratingClassSection
                    ? '동아리 학생 생성 중...'
                    : '동아리 학생 Gemini 생성'}
                </button>
              </div>
            </div>
          ) : null}

          {selectedClassStudents.length ? (
            <div
              className="school-life-records-class-list"
              aria-label={`${classListLabel} 학생별 ${classRecordSectionLabel} 입력`}
            >
              {selectedClassStudents.map((student) => {
                const recordKey = getStudentRecordKey(
                  classRecordSectionId,
                  student.id,
                )

                return (
                  <section
                    className="school-life-records-class-row"
                    key={student.id}
                  >
                    <div className="school-life-records-class-row__header">
                      <strong>{getStudentDisplayLabel(student)}</strong>
                      <span>{classRecordSectionLabel}</span>
                    </div>

                    <label className="school-life-records-field">
                      <span className="visually-hidden">
                        {student.name} {classRecordSectionLabel}
                      </span>
                      <textarea
                        maxLength={
                          classRecordSectionId === SELF_GOVERNMENT_SECTION_ID
                            ? SELF_GOVERNMENT_MAX_LENGTH
                            : undefined
                        }
                        value={recordValues[recordKey] ?? ''}
                        onChange={(event) =>
                          updateRecordValueForStudent(
                            student.id,
                            classRecordSectionId,
                            event.target.value,
                          )
                        }
                        placeholder={classRecordSectionPlaceholder}
                      />
                    </label>
                  </section>
                )
              })}
            </div>
          ) : (
            <p className="school-life-records-class-empty">
              {classStudentEmptyMessage}
            </p>
          )}
        </section>
      ) : null}

      {inputMode === SCHOOL_LIFE_RECORD_INPUT_MODE_SIMILARITY ? (
        <section className="school-life-records-class-card">
          <div className="school-life-records-class-card__header">
            <div>
              <p className="section-label">유사도 검사</p>
              <h2>{classLabel}</h2>
            </div>

            <div className="school-life-records-class-card__actions school-life-records-class-card__actions--similarity">
              <div
                className="school-life-records-section-tabs school-life-records-section-tabs--class school-life-records-section-tabs--similarity"
                aria-label="유사도 검사 항목 선택"
                role="tablist"
              >
                {classRecordSections.map((section) => (
                  <button
                    aria-selected={classSectionId === section.id}
                    className={`school-life-records-section-tab ${
                      classSectionId === section.id ? 'is-active' : ''
                    }`}
                    key={section.id}
                    role="tab"
                    type="button"
                    onClick={() => {
                      setClassSectionId(section.id)
                      setClassSimilarityReport(null)
                      if (section.id !== CLUB_SECTION_ID) {
                        setSelectedClubDepartment('')
                      }
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              {isClassSubjectAbilitySection ? (
                <div
                  className="school-life-records-subject-tabs"
                  aria-label="과목 세부능력특기사항 과목 선택"
                  role="group"
                >
                  {SUBJECT_ABILITY_SUBJECT_OPTIONS.map((subject) => (
                    <button
                      className={`school-life-records-subject-tab ${
                        selectedSubjectAbilitySubject.id === subject.id
                          ? 'is-active'
                          : ''
                      }`}
                      key={subject.id}
                      type="button"
                      aria-pressed={
                        selectedSubjectAbilitySubject.id === subject.id
                      }
                      onClick={() => {
                        setSelectedSubjectAbilitySubjectId(subject.id)
                        setClassSimilarityReport(null)
                      }}
                    >
                      {subject.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="school-life-records-similarity-controls">
                <div
                  className="school-life-records-similarity-scope"
                  aria-label="유사도 비교 범위"
                  role="group"
                >
                  {similarityScopeOptions.map((option) => (
                    <button
                      className={`school-life-records-similarity-scope__button ${
                        similarityScope === option.id ? 'is-active' : ''
                      }`}
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSimilarityScope(option.id)
                        setClassSimilarityReport(null)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              <button
                className="school-life-records-check-button"
                type="button"
                onClick={handleCheckClassSimilarity}
                disabled={
                  isGeneratingClassSection ||
                  isClassStudentRowsLoading ||
                  (!classScopedStudents.length &&
                    (!activeClassGrade || !activeClassNum))
                }
              >
                유사도 검사
              </button>
              </div>
            </div>
          </div>

          {activeClassSimilarityReport ? (
            <section
              className={`school-life-records-similarity-panel ${
                activeClassSimilarityReport.highCount ? 'has-high' : ''
              }`}
              aria-label={`${classRecordSectionLabel} 유사도 검사 결과`}
            >
              <div className="school-life-records-similarity-panel__header">
                <div>
                  <p className="section-label">유사도 검사 결과</p>
                  <h3>
                    최고 유사도{' '}
                    {formatSimilarityPercent(activeClassSimilarityReport.maxScore)}
                  </h3>
                  <p className="school-life-records-similarity-panel__scope">
                    {activeClassSimilarityReport.similarityScope ===
                    SIMILARITY_SCOPE_CLASS
                      ? '우리 반 학생끼리 비교'
                      : `${classLabel} ↔ ${activeClassSimilarityReport.comparisonScopeLabel} 저장 문장 비교`}
                  </p>
                </div>
                <span
                  className={`school-life-records-similarity-badge school-life-records-similarity-badge--${getSimilarityTone(
                    activeClassSimilarityReport.maxScore,
                  )}`}
                >
                  {getSimilarityToneLabel(activeClassSimilarityReport.maxScore)}
                </span>
              </div>

              <div className="school-life-records-similarity-summary">
                <span>
                  입력 학생
                  <strong>{activeClassSimilarityReport.checkedCount}명</strong>
                </span>
                <span>
                  비교 대상
                  <strong>{activeClassSimilarityReport.comparisonCount}명</strong>
                </span>
                <span>
                  비교 쌍
                  <strong>{activeClassSimilarityReport.pairCount}쌍</strong>
                </span>
                <span>
                  50% 초과
                  <strong>{activeClassSimilarityReport.highCount}쌍</strong>
                </span>
                <span>
                  30~50%
                  <strong>{activeClassSimilarityReport.cautionCount}쌍</strong>
                </span>
              </div>

              {activeClassSimilarityReport.missingCount ? (
                <p className="school-life-records-similarity-note">
                  입력 내용이 없는 학생 {activeClassSimilarityReport.missingCount}명은
                  비교에서 제외했습니다.
                </p>
              ) : null}

              {activeClassSimilarityReport.pairCount < 1 ? (
                <p className="school-life-records-similarity-empty">
                  {activeClassSimilarityReport.similarityScope ===
                  SIMILARITY_SCOPE_CLASS
                    ? `입력된 ${classRecordSectionLabel} 문장이 2명 이상일 때 유사도를 비교할 수 있습니다.`
                    : '선택한 범위에 비교할 저장 문장이 아직 없습니다.'}
                </p>
              ) : (
                <div className="school-life-records-similarity-list">
                  {activeClassSimilarityReport.pairs.map((pair, index) => (
                    <details
                      className={`school-life-records-similarity-row school-life-records-similarity-row--${pair.tone}`}
                      key={`${pair.leftStudentId}-${pair.rightStudentId}`}
                      open={index < 3 && pair.score > MAX_RECORD_SIMILARITY}
                    >
                      <summary>
                        <span className="school-life-records-similarity-card">
                          <strong>
                            {pair.leftLabel} <b aria-hidden="true">↔</b>{' '}
                            {pair.rightLabel}
                          </strong>
                          <em>{formatSimilarityPercent(pair.score)}</em>
                        </span>
                      </summary>
                      <div className="school-life-records-similarity-row__texts">
                        <article>
                          <h4>{pair.leftIdentityLabel}</h4>
                          <p>
                            {pair.leftSegments.map((segment, segmentIndex) => (
                              <span
                                className={
                                  segment.isHighlighted
                                    ? 'school-life-records-similarity-highlight'
                                    : undefined
                                }
                                key={`${pair.leftStudentId}-left-${segmentIndex}`}
                              >
                                {segment.text}
                              </span>
                            ))}
                          </p>
                        </article>
                        <article>
                          <h4>{pair.rightIdentityLabel}</h4>
                          <p>
                            {pair.rightSegments.map((segment, segmentIndex) => (
                              <span
                                className={
                                  segment.isHighlighted
                                    ? 'school-life-records-similarity-highlight'
                                    : undefined
                                }
                                key={`${pair.rightStudentId}-right-${segmentIndex}`}
                              >
                                {segment.text}
                              </span>
                            ))}
                          </p>
                        </article>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section
              className="school-life-records-similarity-panel school-life-records-similarity-panel--empty"
              aria-label={`${classRecordSectionLabel} 유사도 검사 안내`}
            >
              <div className="school-life-records-similarity-panel__header">
                <div>
                  <p className="section-label">검사 전 확인</p>
                  <h3>{classRecordSectionLabel} 입력 내용을 비교합니다.</h3>
                  <p className="school-life-records-similarity-panel__scope">
                    비교 범위를 선택한 뒤 유사도 검사를 누르면 학생별 입력 문장의
                    유사한 부분을 확인할 수 있습니다.
                  </p>
                </div>
                <span className="school-life-records-similarity-badge school-life-records-similarity-badge--safe">
                  준비됨
                </span>
              </div>

              <div className="school-life-records-similarity-summary">
                <span>
                  입력 학생
                  <strong>{classScopedStudents.length}명</strong>
                </span>
                <span>
                  비교 범위
                  <strong>{getSimilarityScopeLabel(similarityScope)}</strong>
                </span>
                <span>
                  검사 항목
                  <strong>{classRecordSectionLabel}</strong>
                </span>
                <span>
                  기준
                  <strong>50%</strong>
                </span>
                <span>
                  상태
                  <strong>{isClassStudentRowsLoading ? '불러오는 중' : '대기'}</strong>
                </span>
              </div>

              <p className="school-life-records-similarity-empty">
                검사 결과가 아직 없습니다. 위쪽의 유사도 검사 버튼을 눌러 주세요.
              </p>
            </section>
          )}
        </section>
      ) : null}
    </section>
  )
}

export default SchoolLifeRecordsInput
