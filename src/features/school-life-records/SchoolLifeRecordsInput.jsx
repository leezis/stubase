import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchComparableSchoolLifeRecordRows,
  fetchSchoolLifeRecordRows,
  getSchoolLifeRecordErrorMessage,
  saveSchoolLifeRecordValue,
} from './schoolLifeRecordsRepository.js'
import './SchoolLifeRecordsInput.css'

const SELF_GOVERNMENT_SECTION_ID = 'self-government'
const ACTIVITY_STORAGE_KEY = 'dsy-school-life-self-government-activities-v1'
const RECORD_STORAGE_KEY = 'dsy-school-life-record-values-v1'
const DEFAULT_ACTIVITY_YEAR = '2026'
const SELF_GOVERNMENT_MIN_LENGTH = 350
const SELF_GOVERNMENT_MAX_LENGTH = 450
const MAX_RECORD_SIMILARITY = 0.5
const MAX_DIVERSITY_REPAIR_ATTEMPTS = 2

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
  activity: '활동 내용을 자신의 생활과 연결하며',
  growth: '배운 내용을 생활 속 태도로 이어 가는',
  prompt: '활동에서 배운 내용을 구체적인 행동으로 옮기는 모습',
}

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
    compactText.includes('활동과정에서친구의의견을경청하고필요한도움을주며')
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
    matchedExamples,
    repeatedPhraseText,
  ]
    .filter(Boolean)
    .join('\n')
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
) {
  const quality = getQualityForActivity(
    qualityWords,
    activity.content,
    usedQualities,
  )
  const qualityPhrase = getQualityExpressionGuide(quality).activity
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
  const growthPhrase =
    getQualityExpressionGuide(getRandomItem(qualityWords)).growth ??
    DEFAULT_QUALITY_EXPRESSION_GUIDE.growth

  return [
    `이후 활동 내용을 다시 확인하며 ${growthPhrase} 태도를 차분히 다져 감`,
    '상황에 맞는 실천 방법을 스스로 점검하고 실제 장면에서 필요한 행동을 떠올림',
    '친구들과 필요한 약속을 확인하며 활동에서 배운 절차를 구체적인 선택으로 연결함',
    '자신의 행동을 돌아보고 활동별 핵심 내용을 다음 참여 과정에 활용하려 노력함',
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
  const growthPhrase =
    getQualityExpressionGuide(getRandomItem(qualityWords)).growth ??
    DEFAULT_QUALITY_EXPRESSION_GUIDE.growth
  const secondSentenceStart = remainingClauses.length
    ? `${remainingClauses.join(', ')},`
    : '앞선 활동을 되짚으며'
  const closingTemplates = [
    `${secondSentenceStart} 배운 절차와 약속을 쉬는 시간과 모둠 활동에서 떠올리며 ${growthPhrase} 태도를 구체화함.`,
    `${secondSentenceStart} 활동별 핵심 내용을 자신의 참여 방식과 연결해 보고 ${growthPhrase} 모습을 차분히 다져 감.`,
    `${secondSentenceStart} 상황별 대처 방법을 친구들과 확인하면서 ${growthPhrase} 자세를 실제 학급 장면에 적용함.`,
    `${secondSentenceStart} 알게 된 내용을 단순히 기억하는 데 그치지 않고 다음 활동에서 실천할 기준으로 삼음.`,
    `${secondSentenceStart} 각 활동에서 확인한 약속과 절차를 바탕으로 자신이 할 수 있는 역할을 다시 정리함.`,
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

  return trimSelfGovernmentRecordLength(fittedText)
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
  const clauses = activities
    .slice(0, 4)
    .map((activity) =>
      createActivityFallbackClause(
        activity,
        qualityWords,
        usedQualities,
        usedFocuses,
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
  onHeaderActionsChange,
  onToast,
  schoolLifeQualities = emptySchoolLifeQualities,
  selectedClass = '',
  selectedGrade = '',
  selectedStudent,
}) {
  const [recordValues, setRecordValues] = useState(createInitialRecordValues)
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
  const activityRows = useMemo(
    () => sortActivityRowsByDate(parseActivityRows(activityText)),
    [activityText],
  )
  const recordValuesRef = useRef(recordValues)
  const remoteSaveTimersRef = useRef({})
  const lastRemoteStorageErrorRef = useRef('')
  const selectedStudentId = selectedStudent?.id ?? null
  const classLabel =
    selectedGrade || selectedClass
      ? `${selectedGrade || selectedStudent?.grade || ''}학년 ${
          selectedClass || selectedStudent?.class_num || ''
        }반`
      : '현재 학급'

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
    recordValuesRef.current = recordValues
  }, [recordValues])

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
    }
  }, [])

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
        const rowsBySectionId = new Map(
          remoteRows.map((row) => [row.section_id, row.content ?? '']),
        )

        setRecordValues((previous) => {
          const nextRecordValues = { ...previous }

          recordSections.forEach((section) => {
            const recordKey = getStudentRecordKey(section.id, selectedStudentId)
            const remoteContent = rowsBySectionId.get(section.id)

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

      recordSections.forEach((section) => {
        const cachedContent =
          recordValuesRef.current[
            getStudentRecordKey(section.id, selectedStudentId)
          ] ?? ''

        if (cachedContent.trim()) {
          void persistRemoteRecordValue(
            selectedStudentId,
            section.id,
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

  function updateRecordValue(sectionId, value) {
    const recordKey = getRecordKey(sectionId)
    const recordStudentId = selectedStudentId

    setRecordValues((previous) => {
      const nextRecordValues = { ...previous }

      if (value.trim()) {
        nextRecordValues[recordKey] = value
      } else {
        delete nextRecordValues[recordKey]
      }

      return nextRecordValues
    })

    scheduleRemoteRecordSave(recordStudentId, sectionId, value)
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

  function createRecordPrompt(
    section,
    currentText,
    selectedActivityRows = [],
    diversityInstruction = '',
  ) {
    const memo = currentText.trim()
    const studentContext = `${selectedStudent.grade}학년 ${selectedStudent.class_num}반 ${selectedStudent.student_num}번`
    const isSelfGovernmentSection = section.id === SELF_GOVERNMENT_SECTION_ID
    const originalSelectedQualities = [
      ...(schoolLifeQualities.competencies ?? []),
      ...(schoolLifeQualities.characters ?? []),
    ]
    const selectedCompetencies = isSelfGovernmentSection
      ? filterQualitiesBySelectedActivities(
          schoolLifeQualities.competencies ?? [],
          selectedActivityRows,
        )
      : schoolLifeQualities.competencies ?? []
    const selectedCharacters = isSelfGovernmentSection
      ? filterQualitiesBySelectedActivities(
          schoolLifeQualities.characters ?? [],
          selectedActivityRows,
        )
      : schoolLifeQualities.characters ?? []
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
      '아래 조건을 반드시 지켜서 완성된 한국어 생활기록부 문장만 출력하세요.',
      '영어 번역, 제목, 설명, 번호, 목록, 불릿, 마크다운 기호(*, **, #, -), 따옴표를 절대 쓰지 마세요.',
      '학생 이름은 넣지 말고, 과장된 표현은 피해 주세요.',
      isSelfGovernmentSection
        ? '한 문단으로 작성하고 최종 출력은 공백 포함 반드시 350자 이상 450자 이하로 맞추세요. 349자 이하는 실패이고 451자 이상도 실패입니다.'
        : '관찰 가능한 행동 중심으로 자연스럽게 2문장, 180자 이내로 작성하세요.',
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

    return cleanGeneratedRecordText(data.text)
  }

  async function handleGenerateRecord(section) {
    if (!selectedStudent) {
      return
    }

    const recordKey = getRecordKey(section.id)
    const currentText = recordValues[recordKey] ?? ''
    const isSelfGovernmentSection = section.id === SELF_GOVERNMENT_SECTION_ID
    const selectedActivityRows = isSelfGovernmentSection
      ? getRandomActivityRows(activityRows)
      : []
    const allowedSchoolLifeQualities = isSelfGovernmentSection
      ? getAllowedSchoolLifeQualitiesForActivities(
          schoolLifeQualities,
          selectedActivityRows,
        )
      : emptySchoolLifeQualities
    const selectedQualityWords = isSelfGovernmentSection
      ? [
          ...allowedSchoolLifeQualities.competencies,
          ...allowedSchoolLifeQualities.characters,
        ]
      : []

    setSectionGenerationState(section.id, true)

    try {
      let comparableRows = []

      if (isSelfGovernmentSection) {
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
          (isGeneratedRecordGroundedInActivities(
            text,
            selectedActivityRows,
          ) &&
            isGeneratedRecordStructuredByActivityPairs(
              text,
              selectedActivityRows,
            ) &&
            !hasMechanicalQualityLabeling(
              text,
              selectedQualityWords,
            ) &&
            !hasRepeatedGenericClosing(text) &&
            !hasBrokenRecordEnding(text)))

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
        const generatedText = await requestGeneratedRecordText(
          createRecordPrompt(
            section,
            currentText,
            selectedActivityRows,
            diversityInstruction,
          ),
        )

        if (!isValidGeneratedText(generatedText)) {
          continue
        }

        const similarityResult = isSelfGovernmentSection
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
