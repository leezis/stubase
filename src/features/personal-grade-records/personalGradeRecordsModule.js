import PersonalGradeRecords from './PersonalGradeRecords.jsx'
import PersonalGradeRecordsImportControls from './PersonalGradeRecordsImportControls.jsx'
import PersonalGradeRecordsUploadStatus from './PersonalGradeRecordsUploadStatus.jsx'
import {
  PERSONAL_GRADE_RECORDS_VIEW_ID,
  personalGradeRecordsMenu,
} from './personalGradeRecordsConfig.js'

const firstGradeClassFilterOptions = [
  ...Array.from({ length: 7 }, (_, classIndex) => ({
    label: `1-${classIndex + 1}`,
    grade: '1',
    classNum: String(classIndex + 1),
  })),
  {
    label: '전체',
    grade: '1',
    classNum: '',
  },
]

export const personalGradeRecordsModule = {
  id: PERSONAL_GRADE_RECORDS_VIEW_ID,
  category: 'school-work',
  menu: personalGradeRecordsMenu,
  usesStudentWorkspace: true,
  studentWorkspace: {
    hero: {
      badge: 'School Work',
      title: '학생 목록과 개인내신성적관리부를 함께 확인해요',
      description: '학급 선택과 학생 목록을 기준으로 개인별 내신성적관리부를 관리합니다.',
    },
    studentBadge: '관리부',
    defaultFilters: {
      selectedGrade: '1',
      selectedClass: '',
    },
    classFilterOptions: firstGradeClassFilterOptions,
    HeaderActions: PersonalGradeRecordsImportControls,
    PlaceholderDetails: PersonalGradeRecordsUploadStatus,
    emptyState: {
      icon: '표',
      title: '학생을 선택하면 개인내신성적관리부가 열립니다',
      description: '왼쪽 학생 목록에서 학생을 선택해 주세요.',
    },
  },
  Component: PersonalGradeRecords,
}

export default personalGradeRecordsModule
