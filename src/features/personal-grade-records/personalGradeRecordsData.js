export const PERSONAL_GRADE_RECORD_SCHOOL_YEAR = '2026'

export const emptyPersonalGradeRecordData = {
  studentInfo: {
    gender: '',
  },
  attendance: {
    unexcusedAbsence: '',
    unexcusedTardy: '',
    unexcusedEarlyLeave: '',
    unexcusedResult: '',
  },
  selfGovernment: {
    classPresident: false,
    vicePresident: false,
    guidanceDisciplinaryAction: false,
    schoolViolenceDisciplinaryAction: false,
  },
  club: {
    clubActivity: {
      name: '',
      className: '',
      teacher: '',
    },
    autonomousClub: {
      name: '',
      teacher: '',
    },
  },
  volunteer: {
    hours: '',
    award: false,
  },
}

export function mergePersonalGradeRecordData(data = {}) {
  return {
    studentInfo: {
      ...emptyPersonalGradeRecordData.studentInfo,
      ...(data.studentInfo ?? {}),
    },
    attendance: {
      ...emptyPersonalGradeRecordData.attendance,
      ...(data.attendance ?? {}),
    },
    selfGovernment: {
      ...emptyPersonalGradeRecordData.selfGovernment,
      ...(data.selfGovernment ?? {}),
    },
    club: {
      clubActivity: {
        ...emptyPersonalGradeRecordData.club.clubActivity,
        ...(data.club?.clubActivity ?? {}),
      },
      autonomousClub: {
        ...emptyPersonalGradeRecordData.club.autonomousClub,
        ...(data.club?.autonomousClub ?? {}),
      },
    },
    volunteer: {
      ...emptyPersonalGradeRecordData.volunteer,
      ...(data.volunteer ?? {}),
    },
  }
}

export function getSchoolNumber(student) {
  if (!student) {
    return ''
  }

  return `${student.grade}-${student.class_num}-${student.student_num}`
}

export function getStudentDisplayName(student) {
  if (!student) {
    return ''
  }

  return `${student.grade}학년 ${student.class_num}반 ${student.student_num}번 ${student.name}`
}

function parseNumberValue(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function getNumberText(value) {
  return value === null || value === undefined ? '' : String(value)
}

function getBonusPenaltyText(value) {
  return value ? String(value) : '·'
}

export function hasVolunteerAward(volunteer = {}) {
  const award = volunteer.award

  if (typeof award === 'boolean') {
    return award
  }

  return String(award ?? '').trim() !== ''
}

function calculateAttendanceAbsenceTotal(attendance) {
  const unexcusedAbsence = parseNumberValue(attendance.unexcusedAbsence) ?? 0
  const unexcusedTardy = parseNumberValue(attendance.unexcusedTardy) ?? 0
  const unexcusedEarlyLeave = parseNumberValue(attendance.unexcusedEarlyLeave) ?? 0
  const unexcusedResult = parseNumberValue(attendance.unexcusedResult) ?? 0

  return unexcusedAbsence + Math.floor(
    (unexcusedTardy + unexcusedEarlyLeave + unexcusedResult) / 3,
  )
}

function calculateSelfGovernmentScores(selfGovernment) {
  const bonus = selfGovernment.classPresident || selfGovernment.vicePresident ? 1 : 0
  const penalty =
    selfGovernment.guidanceDisciplinaryAction ||
    selfGovernment.schoolViolenceDisciplinaryAction
      ? 1
      : 0
  const baseScore = 3

  return {
    bonus,
    penalty,
    total: baseScore + bonus - penalty,
  }
}

function calculateVolunteerScores(volunteer) {
  const hours = parseNumberValue(volunteer.hours)
  const bonus = hasVolunteerAward(volunteer) ? 1 : 0

  if (hours === null) {
    return {
      baseScore: null,
      bonus: bonus || null,
      total: null,
    }
  }

  const baseScore = hours >= 10 ? 4 : hours >= 5 ? 3 : 2

  return {
    baseScore,
    bonus,
    total: baseScore + bonus,
  }
}

export function buildPersonalGradeRecordPlaceholders(student, recordData) {
  const data = mergePersonalGradeRecordData(recordData)
  const presidentText = data.selfGovernment.classPresident ? '학급임원(반장)' : ''
  const vicePresidentText = data.selfGovernment.vicePresident ? '학급임원(부반장)' : ''
  const guidanceDisciplinaryActionText = data.selfGovernment.guidanceDisciplinaryAction
    ? '선도처분'
    : ''
  const schoolViolenceDisciplinaryActionText = data.selfGovernment.schoolViolenceDisciplinaryAction
    ? '학폭처분'
    : ''
  const selfGovernmentText = [
    presidentText,
    vicePresidentText,
    guidanceDisciplinaryActionText,
    schoolViolenceDisciplinaryActionText,
  ]
    .filter(Boolean)
    .join(', ')
  const attendanceAbsenceTotal = calculateAttendanceAbsenceTotal(data.attendance)
  const selfGovernmentScores = calculateSelfGovernmentScores(data.selfGovernment)
  const volunteerScores = calculateVolunteerScores(data.volunteer)

  return {
    학년도: PERSONAL_GRADE_RECORD_SCHOOL_YEAR,
    학년: String(student?.grade ?? ''),
    반: String(student?.class_num ?? ''),
    번호: String(student?.student_num ?? ''),
    이름: student?.name ?? '',
    학생이름: student?.name ?? '',
    성명: student?.name ?? '',
    담임교사: '',
    성별: data.studentInfo.gender,
    미인정결석: data.attendance.unexcusedAbsence,
    미인정지각: data.attendance.unexcusedTardy,
    미인정조퇴: data.attendance.unexcusedEarlyLeave,
    미인정결과: data.attendance.unexcusedResult,
    합계계산: getNumberText(attendanceAbsenceTotal),
    반장: presidentText,
    부반장: vicePresidentText,
    선도처분: guidanceDisciplinaryActionText,
    학폭처분: schoolViolenceDisciplinaryActionText,
    자율가점: getBonusPenaltyText(selfGovernmentScores.bonus),
    자율감점: getBonusPenaltyText(selfGovernmentScores.penalty),
    자율합계: getNumberText(selfGovernmentScores.total),
    임원: selfGovernmentText,
    자율자치활동: selfGovernmentText,
    동아리명: data.club.clubActivity.name,
    동아리활동: data.club.clubActivity.name,
    동아리활동부서반: data.club.clubActivity.className,
    동아리활동담당교사: data.club.clubActivity.teacher,
    자율동아리: data.club.autonomousClub.name,
    자율동아리명: data.club.autonomousClub.name,
    자율동아리담당교사: data.club.autonomousClub.teacher,
    봉사시간: data.volunteer.hours,
    봉사점수: getNumberText(volunteerScores.baseScore),
    봉사가점: getBonusPenaltyText(volunteerScores.bonus),
    봉사합계: getNumberText(volunteerScores.total),
    봉사상: hasVolunteerAward(data.volunteer) ? '봉사상' : '',
  }
}

export function createPersonalGradeRecordFileName(student, suffix = '개인내신성적관리부') {
  if (!student) {
    return `${PERSONAL_GRADE_RECORD_SCHOOL_YEAR}_${suffix}.hwpx`
  }

  const paddedNumber = String(student.student_num ?? '').padStart(2, '0')
  return `${PERSONAL_GRADE_RECORD_SCHOOL_YEAR}_${student.grade}-${student.class_num}_${paddedNumber}_${student.name}_${suffix}.hwpx`
}
