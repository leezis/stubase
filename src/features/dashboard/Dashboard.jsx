import { useEffect, useEffectEvent, useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { getSupabaseEnvHelpMessage, hasSupabaseEnv, supabase } from '../../lib/supabase'

const CHART_COLORS = [
  '#8dbbff',
  '#b4cdfd',
  '#a7d8de',
  '#cad9f2',
  '#d6e4fb',
  '#b9c7e6',
]
const DASHBOARD_FETCH_PAGE_SIZE = 1000
const DASHBOARD_GRADES = [1, 2, 3]
const DASHBOARD_CLASSES = Array.from({ length: 7 }, (_, index) => index + 1)

async function fetchAllRows(tableName, selectColumns) {
  const records = []
  let rangeStart = 0

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .range(rangeStart, rangeStart + DASHBOARD_FETCH_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error }
    }

    const nextChunk = data ?? []
    records.push(...nextChunk)

    if (nextChunk.length < DASHBOARD_FETCH_PAGE_SIZE) {
      return { data: records, error: null }
    }

    rangeStart += DASHBOARD_FETCH_PAGE_SIZE
  }
}

function createEmptyGradeClassStats() {
  return DASHBOARD_GRADES.map((grade) => ({
    grade,
    totalValue: 0,
    classes: DASHBOARD_CLASSES.map((classNum) => ({
      classNum,
      value: 0,
    })),
  }))
}

function createGradeClassStats(records, students) {
  const studentClassMap = new Map(
    students.map((student) => [
      student.id,
      {
        grade: Number(student.grade),
        classNum: Number(student.class_num),
      },
    ]),
  )
  const gradeClassCountMap = new Map()

  records.forEach((record) => {
    const studentClass = studentClassMap.get(record.student_id)

    if (
      !studentClass ||
      !DASHBOARD_GRADES.includes(studentClass.grade) ||
      !DASHBOARD_CLASSES.includes(studentClass.classNum)
    ) {
      return
    }

    const classKey = `${studentClass.grade}-${studentClass.classNum}`
    gradeClassCountMap.set(
      classKey,
      (gradeClassCountMap.get(classKey) ?? 0) + 1,
    )
  })

  return DASHBOARD_GRADES.map((grade) => {
    const classes = DASHBOARD_CLASSES.map((classNum) => ({
      classNum,
      value: gradeClassCountMap.get(`${grade}-${classNum}`) ?? 0,
    }))

    return {
      grade,
      totalValue: classes.reduce(
        (total, classStat) => total + classStat.value,
        0,
      ),
      classes,
    }
  })
}

function getDashboardErrorMessage(error) {
  const rawMessage = error?.message ?? ''

  if (rawMessage.includes('counseling_records')) {
    return '상담 기록 데이터를 불러오지 못했습니다. Supabase 설정을 확인해 주세요.'
  }

  if (rawMessage.includes('students')) {
    return '학생 데이터를 불러오지 못했습니다. Supabase 설정을 확인해 주세요.'
  }

  return rawMessage || '상담 통계를 불러오지 못했습니다.'
}

function getGradeTotalValue(gradeStat) {
  if (Number.isFinite(gradeStat.totalValue)) {
    return gradeStat.totalValue
  }

  return (gradeStat.classes ?? []).reduce(
    (total, classStat) => total + (Number(classStat.value) || 0),
    0,
  )
}

function Dashboard() {
  const [isLoading, setIsLoading] = useState(hasSupabaseEnv)
  const [errorMessage, setErrorMessage] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [categoryStats, setCategoryStats] = useState([])
  const [gradeClassStats, setGradeClassStats] = useState(
    createEmptyGradeClassStats,
  )

  async function loadDashboardData() {
    if (!supabase) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    const [recordsResult, studentsResult] = await Promise.all([
      fetchAllRows('counseling_records', 'student_id, category'),
      fetchAllRows('students', 'id, grade, class_num'),
    ])
    const error = recordsResult.error ?? studentsResult.error

    if (error) {
      setTotalCount(0)
      setCategoryStats([])
      setGradeClassStats(createEmptyGradeClassStats())
      setErrorMessage(getDashboardErrorMessage(error))
      setIsLoading(false)
      return
    }

    const nextRecords = recordsResult.data ?? []
    const nextStudents = studentsResult.data ?? []
    const categoryCountMap = nextRecords.reduce((accumulator, record) => {
      const categoryName = String(record.category ?? '').trim() || '미분류'
      accumulator[categoryName] = (accumulator[categoryName] ?? 0) + 1
      return accumulator
    }, {})

    const nextCategoryStats = Object.entries(categoryCountMap)
      .map(([name, value], index) => ({
        name,
        value,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((left, right) => right.value - left.value)

    setTotalCount(nextRecords.length)
    setCategoryStats(nextCategoryStats)
    setGradeClassStats(createGradeClassStats(nextRecords, nextStudents))
    setIsLoading(false)
  }

  const runDashboardLoad = useEffectEvent(() => {
    void loadDashboardData()
  })

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      runDashboardLoad()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  if (!hasSupabaseEnv) {
    return (
      <section className="empty-card">
        <div className="empty-icon">!</div>
        <h2>통계 대시보드를 열기 전에 Supabase 연결이 필요합니다</h2>
        <p>{getSupabaseEnvHelpMessage()}</p>
      </section>
    )
  }

  const hasStats = totalCount > 0

  return (
    <section className="dashboard-shell">
      <div className="dashboard-header-card">
        <div>
          <h1>부서 보고용 통계 대시보드</h1>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <section className="dashboard-card dashboard-card--emphasis dashboard-total-card">
          <p className="dashboard-card-label">총 상담 건수</p>
          <strong className="dashboard-card-value">
            {isLoading ? '집계 중' : `${totalCount}건`}
          </strong>
        </section>

        <section className="dashboard-card">
          <p className="dashboard-card-label">집계된 상담 분야 수</p>
          <strong className="dashboard-card-value">
            {isLoading ? '-' : `${categoryStats.length}개`}
          </strong>
        </section>
      </div>

      {errorMessage ? (
        <section className="dashboard-card">
          <p className="detail-error">{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage ? (
        <>
          <div className="dashboard-grade-grid">
            {gradeClassStats.map((gradeStat) => {
              const gradeTotalValue = getGradeTotalValue(gradeStat)

              return (
                <section
                  className={`dashboard-card dashboard-grade-card dashboard-grade-card--grade-${gradeStat.grade}`}
                  key={gradeStat.grade}
                >
                  <h2>{gradeStat.grade}학년 전체 학급 상담 현황</h2>
                  <ul className="dashboard-class-list">
                    {gradeStat.classes.map((classStat) => (
                      <li
                        className={`dashboard-class-item dashboard-class-item--grade-${gradeStat.grade}`}
                        key={`${gradeStat.grade}-${classStat.classNum}`}
                      >
                        <strong className="dashboard-class-name">
                          {gradeStat.grade}-{classStat.classNum}
                        </strong>
                        <span className="dashboard-class-total">
                          상담 {isLoading ? '-' : `${classStat.value}건`}
                        </span>
                      </li>
                    ))}
                    <li
                      className={`dashboard-class-item dashboard-class-item--grade-${gradeStat.grade} dashboard-class-item--total`}
                      key={`${gradeStat.grade}-total`}
                    >
                      <strong className="dashboard-class-name dashboard-class-name--total">
                        전체학급
                      </strong>
                      <span className="dashboard-class-total">
                        상담 {isLoading ? '-' : `${gradeTotalValue}건`}
                      </span>
                    </li>
                  </ul>
                </section>
              )
            })}
          </div>

          <div className="dashboard-grid">
            <section className="dashboard-card dashboard-chart-card">
              <div className="dashboard-section-header">
                <div>
                  <h2>분야별 상담 통계</h2>
                </div>
              </div>

              {isLoading ? (
                <div className="record-skeleton-list" aria-hidden="true">
                  <div className="record-skeleton" />
                  <div className="record-skeleton" />
                </div>
              ) : null}

              {!isLoading && !hasStats ? (
                <div className="dashboard-empty">
                  <p>아직 집계할 상담 데이터가 없습니다.</p>
                </div>
              ) : null}

              {!isLoading && hasStats ? (
                <div className="dashboard-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryStats}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={76}
                        outerRadius={122}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {categoryStats.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}건`, '상담 건수']}
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid rgba(229, 233, 240, 0.98)',
                          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-section-header">
                <div>
                  <h2>분야별 누적 건수</h2>
                </div>
              </div>

              {isLoading ? (
                <div className="record-skeleton-list" aria-hidden="true">
                  <div className="record-skeleton" />
                  <div className="record-skeleton" />
                </div>
              ) : null}

              {!isLoading && !hasStats ? (
                <div className="dashboard-empty">
                  <p>상담 데이터가 들어오면 여기에 분야별 통계가 표시됩니다.</p>
                </div>
              ) : null}

              {!isLoading && hasStats ? (
                <ul className="dashboard-breakdown-list">
                  {categoryStats.map((item) => (
                    <li className="dashboard-breakdown-item" key={item.name}>
                      <div
                        className="dashboard-breakdown-dot"
                        style={{ backgroundColor: item.fill }}
                      />
                      <div className="dashboard-breakdown-main">
                        <strong>{item.name}</strong>
                        <span>
                          {Math.round((item.value / totalCount) * 100)}%
                        </span>
                      </div>
                      <span className="dashboard-breakdown-value">
                        {item.value}건
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default Dashboard
