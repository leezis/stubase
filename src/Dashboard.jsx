import { useEffect, useEffectEvent, useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { getSupabaseEnvHelpMessage, hasSupabaseEnv, supabase } from './lib/supabase'

const CHART_COLORS = [
  '#8dbbff',
  '#b4cdfd',
  '#a7d8de',
  '#cad9f2',
  '#d6e4fb',
  '#b9c7e6',
]

function Dashboard() {
  const [isLoading, setIsLoading] = useState(hasSupabaseEnv)
  const [errorMessage, setErrorMessage] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [categoryStats, setCategoryStats] = useState([])

  async function loadDashboardData() {
    if (!supabase) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('counseling_records')
      .select('id, category')

    if (error) {
      setTotalCount(0)
      setCategoryStats([])
      setErrorMessage(error.message)
      setIsLoading(false)
      return
    }

    const nextRecords = data ?? []
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
          <p className="hero-badge">Department Dashboard</p>
          <h1>부서 보고용 통계 대시보드</h1>
          <p className="hero-copy">
            counseling_records 전체 데이터를 바탕으로 이번 학기 상담 현황을 한눈에
            볼 수 있게 정리했습니다.
          </p>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <section className="dashboard-card dashboard-card--emphasis">
          <p className="dashboard-card-label">이번 학기 총 상담 건수</p>
          <strong className="dashboard-card-value">
            {isLoading ? '집계 중' : `${totalCount}건`}
          </strong>
          <p className="dashboard-card-note">
            counseling_records 테이블의 전체 상담 건수를 집계했습니다.
          </p>
        </section>

        <section className="dashboard-card">
          <p className="dashboard-card-label">집계된 상담 분야 수</p>
          <strong className="dashboard-card-value">
            {isLoading ? '-' : `${categoryStats.length}개`}
          </strong>
          <p className="dashboard-card-note">
            학업, 진로, 교우관계 등 현재 누적된 분야 기준입니다.
          </p>
        </section>
      </div>

      {errorMessage ? (
        <section className="dashboard-card">
          <p className="detail-error">{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage ? (
        <div className="dashboard-grid">
          <section className="dashboard-card dashboard-chart-card">
            <div className="dashboard-section-header">
              <div>
                <p className="section-label">Pie Chart</p>
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
                <p className="section-label">Breakdown</p>
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
      ) : null}
    </section>
  )
}

export default Dashboard
