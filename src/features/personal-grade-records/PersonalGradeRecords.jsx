import schoolLogoUrl from '../../assets/dongsuyeong-school-logo.svg'

const SCHOOL_YEAR = '2026'

function Line({ dash = false, x1, x2, y1, y2 }) {
  return (
    <line
      className={dash ? 'pgr-line pgr-line--dash' : 'pgr-line'}
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
    />
  )
}

function Box({ fill = 'none', height, width, x, y }) {
  return (
    <rect
      className="pgr-box"
      fill={fill}
      height={height}
      width={width}
      x={x}
      y={y}
    />
  )
}

function Grid({ dash = true, xs, ys }) {
  const x = xs[0]
  const y = ys[0]
  const width = xs[xs.length - 1] - x
  const height = ys[ys.length - 1] - y

  return (
    <g>
      <Box height={height} width={width} x={x} y={y} />
      {xs.slice(1, -1).map((lineX) => (
        <Line dash={dash} key={`x-${lineX}`} x1={lineX} x2={lineX} y1={y} y2={y + height} />
      ))}
      {ys.slice(1, -1).map((lineY) => (
        <Line dash={dash} key={`y-${lineY}`} x1={x} x2={x + width} y1={lineY} y2={lineY} />
      ))}
    </g>
  )
}

function Label({ children, x, y }) {
  return (
    <text className="pgr-text pgr-label" textAnchor="middle" x={x} y={y}>
      {String(children)
        .split('\n')
        .map((line, index) => (
          <tspan dy={index === 0 ? 0 : 19} key={line} x={x}>
            {line}
          </tspan>
        ))}
    </text>
  )
}

function Txt({
  anchor = 'middle',
  children,
  className = '',
  size,
  weight,
  x,
  y,
}) {
  return (
    <text
      className={`pgr-text ${className}`}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      x={x}
      y={y}
    >
      {children}
    </text>
  )
}

function Multi({ anchor = 'middle', className = '', lines, size = 12, x, y }) {
  return (
    <text
      className={`pgr-text ${className}`}
      fontSize={size}
      textAnchor={anchor}
      x={x}
      y={y}
    >
      {lines.map((line, index) => (
        <tspan dy={index === 0 ? 0 : size + 2} key={`${line}-${index}`} x={x}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function PersonalGradeRecords() {
  return (
    <section className="personal-grade-records-shell">
      <div className="dashboard-header-card personal-grade-records-toolbar">
        <div>
          <p className="section-label">학교업무</p>
          <h1>개인내신성적관리부</h1>
        </div>
      </div>

      <section
        className="personal-grade-records-preview"
        aria-label="개인내신성적관리부 양식 미리보기"
      >
        <article className="personal-grade-records-paper">
          <svg
            className="personal-grade-records-svg"
            role="img"
            viewBox="0 0 1024 768"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>2026학년도 개인 내신성적 관리부 양식</title>
            <rect fill="#ffffff" height="768" width="1024" />

            <g>
              <Box height={86} width={234} x={144} y={38} />
              <Line x1={144} x2={378} y1={60} y2={60} />
              <Line x1={144} x2={378} y1={84} y2={84} />
              <Line x1={144} x2={378} y1={104} y2={104} />
              <Line x1={184} x2={184} y1={84} y2={124} />
              <Line x1={226} x2={226} y1={84} y2={124} />
              <Line x1={264} x2={264} y1={84} y2={124} />
              <Txt className="pgr-school-name" size={16} x={261} y={54}>
                동 수 영 중 학 교
              </Txt>
              <Txt size={14} x={261} y={77}>
                ( <tspan className="pgr-school-year">{SCHOOL_YEAR}</tspan> )학년도 입학(전입)
              </Txt>
              <Txt size={13} x={164} y={104}>성별</Txt>
              <Txt size={13} x={205} y={97}>남</Txt>
              <Txt size={13} x={245} y={104}>성명</Txt>
              <Txt size={13} x={205} y={118}>여</Txt>
            </g>

            <g>
              <Box fill="#d9ffd2" height={36} width={244} x={399} y={42} />
              <Txt className="pgr-title" size={25} weight={900} x={521} y={68}>
                개인 내신성적 관리부
              </Txt>
              <image height={46} href={schoolLogoUrl} preserveAspectRatio="xMidYMid meet" width={185} x={457} y={84} />
            </g>

            <g>
              <Grid dash={false} xs={[665, 701, 736, 771, 821, 891, 977]} ys={[38, 61, 82, 103, 124]} />
              <Txt size={12} x={683} y={55}>학년</Txt>
              <Txt size={12} x={718} y={55}>반</Txt>
              <Txt size={12} x={753} y={55}>번호</Txt>
              <Txt size={12} x={796} y={55}>학생이름</Txt>
              <Txt size={12} x={856} y={55}>학생확인</Txt>
              <Txt size={12} x={934} y={55}>담임교사</Txt>
              {[1, 2, 3].map((grade, index) => (
                <g key={grade}>
                  <Txt size={13} x={683} y={76 + index * 21}>{grade}</Txt>
                  <Txt size={12} x={960} y={76 + index * 21}>(인)</Txt>
                </g>
              ))}
            </g>

            <g>
              <Box fill="#eeeeee" height={151} width={52} x={144} y={132} />
              <Label x={170} y={196}>출결{'\n'}상황</Label>
              <Grid xs={[196, 232, 287, 342, 397, 452, 516, 594, 664]} ys={[132, 155, 188, 220, 252, 283]} />
              <Line x1={232} x2={452} y1={155} y2={155} />
              <Box height={151} width={313} x={664} y={132} />
              <Line x1={664} x2={977} y1={188} y2={188} />
              <Txt size={12} x={214} y={177}>학년</Txt>
              <Txt size={13} x={342} y={148}>출결상황</Txt>
              <Multi lines={['미인정', '결석']} size={12} x={260} y={171} />
              <Multi lines={['미인정', '지각']} size={12} x={315} y={171} />
              <Multi lines={['미인정', '조퇴']} size={12} x={370} y={171} />
              <Multi lines={['미인정', '결과']} size={12} x={425} y={171} />
              <Multi lines={['미인정결석', '학년별합계']} size={12} x={484} y={163} />
              <Multi lines={['마감', '기준']} size={12} x={555} y={163} />
              <Multi lines={['미인정결석', '3년 총합계']} size={12} x={629} y={163} />
              {[1, 2, 3].map((grade, index) => (
                <g key={`attendance-${grade}`}>
                  <Txt size={14} x={214} y={210 + index * 32}>{grade}</Txt>
                  <Txt size={13} x={508} y={210 + index * 32}>일</Txt>
                </g>
              ))}
              <Txt className="pgr-blue" size={12} x={555} y={210}>학년종료일</Txt>
              <Txt className="pgr-blue" size={12} x={555} y={242}>학년종료일</Txt>
              <Multi className="pgr-blue" lines={['내신성적', '산출일']} size={12} x={555} y={268} />
              <Txt size={14} x={629} y={238}>점</Txt>
              <Multi
                anchor="start"
                className="pgr-note-text"
                lines={[
                  '※출결상황 점수는 부산시 고입지침을 따름.',
                  '미인정 지각, 미인정 조퇴, 미인정 결과는 그 횟수를 합산',
                  '하여 3회를 미인정 결석 1일로 계산(2회 이하는 버림)',
                ]}
                size={12}
                x={670}
                y={146}
              />
              <Grid dash={false} xs={[664, 743, 820, 899, 977]} ys={[188, 207, 226, 245, 264, 283]} />
              <Txt size={12} x={704} y={202}>미인정결석일</Txt>
              <Txt size={12} x={781} y={202}>부여점수</Txt>
              <Txt size={12} x={860} y={202}>미인정결석일</Txt>
              <Txt size={12} x={938} y={202}>부여점수</Txt>
              {[
                ['0일', '21점', '9 ~ 10일', '16점'],
                ['1 ~ 2일', '20점', '11 ~ 12일', '15점'],
                ['3 ~ 4일', '19점', '13 ~ 14일', '14점'],
                ['5 ~ 6일', '18점', '15 ~ 16일', '13점'],
              ].map((row, index) => row.map((value, colIndex) => (
                <Txt key={`${value}-${index}-${colIndex}`} size={12} x={[704, 781, 860, 938][colIndex]} y={221 + index * 19}>
                  {value}
                </Txt>
              )))}
              <Txt size={12} x={704} y={279}>7 ~ 8일</Txt>
              <Txt size={12} x={781} y={279}>17점</Txt>
              <Txt size={12} x={860} y={279}>17일 이상</Txt>
              <Txt size={12} x={938} y={279}>12점</Txt>
            </g>

            <g>
              <Box fill="#eeeeee" height={146} width={52} x={144} y={289} />
              <Label x={170} y={354}>자율{'\n'}활동</Label>
              <Grid xs={[196, 232, 287, 342, 397, 452, 664]} ys={[289, 341, 372, 403, 435]} />
              <Box height={146} width={313} x={664} y={289} />
              <Line x1={664} x2={977} y1={341} y2={341} />
              <Txt size={13} x={214} y={322}>학년</Txt>
              <Txt size={13} x={260} y={322}>기본점수</Txt>
              <Txt size={13} x={315} y={322}>가점</Txt>
              <Txt size={13} x={370} y={322}>감점</Txt>
              <Txt size={13} x={425} y={322}>합계</Txt>
              <Txt size={13} x={558} y={322}>비고(가점·감점 사유)</Txt>
              <Txt size={14} x={214} y={361}>1</Txt>
              <Txt size={14} x={260} y={361}>3</Txt>
              <Txt size={14} x={315} y={361}>·</Txt>
              <Txt size={14} x={370} y={361}>·</Txt>
              <Txt size={14} x={425} y={361}>3</Txt>
              <Txt size={14} x={214} y={392}>2</Txt>
              <Txt size={14} x={214} y={424}>3</Txt>
              <Multi
                anchor="start"
                className="pgr-note-text"
                lines={[
                  '※창체활동 가감점은 학교규정을 따름.',
                  '가점과 가산점은 학년별 최대 1점까지 인정함.',
                  '심의사항: 중도면직, 전입, 전출, 태만, 행정소송 등의 경우',
                ]}
                size={12}
                x={670}
                y={303}
              />
              <Grid dash={false} xs={[664, 716, 820, 872, 977]} ys={[341, 357, 372, 388, 404, 420, 435]} />
              <Multi lines={['가점', '1점']} size={12} x={690} y={369} />
              <Multi lines={['감점', '1점']} size={12} x={846} y={369} />
              <Multi lines={['학생회장·부회장', '학급반장·부반장', '선도위원', '방송위원', '학급활동우수자(심의)', '기타(분리도우미 등)']} size={11} x={768} y={354} />
              <Multi lines={['학교폭력 처분', '학교징계 처분', '성적부정행위', '(심의에 따름)', '벌점 20점이상', '기타(심의사항)']} size={11} x={924} y={354} />
            </g>

            <g>
              <Box fill="#eeeeee" height={128} width={52} x={144} y={439} />
              <Label x={170} y={497}>동아리{'\n'}활동</Label>
              <Grid xs={[196, 232, 342, 397, 452, 507, 562, 664]} ys={[439, 484, 512, 540, 567]} />
              <Box height={128} width={313} x={664} y={439} />
              <Txt size={13} x={214} y={467}>학년</Txt>
              <Txt size={13} x={287} y={467}>부서명</Txt>
              <Txt size={13} x={370} y={467}>기본점수</Txt>
              <Txt size={13} x={425} y={467}>가점</Txt>
              <Txt size={13} x={480} y={467}>감점</Txt>
              <Txt size={13} x={535} y={467}>합계</Txt>
              <Txt size={13} x={613} y={467}>비고(가감점 사유)</Txt>
              <Txt size={14} x={214} y={502}>1</Txt>
              <Txt size={14} x={370} y={502}>3</Txt>
              <Txt size={14} x={425} y={502}>·</Txt>
              <Txt size={14} x={480} y={502}>·</Txt>
              <Txt size={14} x={535} y={502}>3</Txt>
              <Txt size={14} x={214} y={530}>2</Txt>
              <Txt size={14} x={214} y={558}>3</Txt>
              <Multi
                anchor="start"
                className="pgr-note-text"
                lines={[
                  '※창체활동 가감점은 학교규정을 따름.',
                  '가점과 감점은 학년별 최대 1점까지 인정함.',
                  '심의사항: 전입, 전출, 동아리 활동 기여자, 태만 등의 경우',
                ]}
                size={12}
                x={670}
                y={455}
              />
            </g>

            <g>
              <Box fill="#eeeeee" height={163} width={52} x={144} y={572} />
              <Label x={170} y={638}>봉사{'\n'}활동</Label>
              <Grid xs={[196, 232, 342, 397, 452, 507, 562, 664]} ys={[572, 620, 658, 696, 735]} />
              <Box height={163} width={313} x={664} y={572} />
              <Txt size={13} x={214} y={603}>학년</Txt>
              <Txt size={13} x={287} y={603}>봉사시간(누계)</Txt>
              <Txt size={13} x={370} y={603}>기본점수</Txt>
              <Txt size={13} x={425} y={603}>가점</Txt>
              <Txt size={13} x={480} y={603}>감점</Txt>
              <Txt size={13} x={535} y={603}>합계</Txt>
              <Txt size={13} x={613} y={603}>비고(가감점 사유)</Txt>
              <Txt size={14} x={214} y={641}>1</Txt>
              <Txt size={14} x={370} y={641}>3</Txt>
              <Txt size={14} x={425} y={641}>·</Txt>
              <Line dash x1={452} x2={507} y1={658} y2={620} />
              <Txt size={14} x={535} y={641}>3</Txt>
              <Txt size={14} x={214} y={679}>2</Txt>
              <Line dash x1={452} x2={507} y1={696} y2={658} />
              <Txt size={14} x={214} y={718}>3</Txt>
              <Line dash x1={452} x2={507} y1={735} y2={696} />
              <Multi
                anchor="start"
                className="pgr-note-text"
                lines={[
                  '※창체활동 가감점은 학교규정을 따름.',
                  '가점은 학년별 최대 1점까지 인정함. 심의사항: 타지역전입',
                ]}
                size={12}
                x={670}
                y={589}
              />
              <Txt className="pgr-red" size={13} x={746} y={638}>부산시 봉사활동 점수 기준</Txt>
              <Grid dash={false} xs={[674, 721, 831]} ys={[650, 669, 688, 707]} />
              <Txt size={12} x={698} y={664}>4점</Txt>
              <Txt size={12} x={776} y={664}>연간 20시간 이상</Txt>
              <Txt size={12} x={698} y={683}>3점</Txt>
              <Txt size={12} x={776} y={683}>연간 10시간 이상</Txt>
              <Txt size={12} x={698} y={702}>2점</Txt>
              <Txt size={12} x={776} y={702}>연간 10시간 미만</Txt>
              <Multi
                anchor="start"
                className="pgr-note-text"
                lines={['* 가산점 : 봉사상 수상', '  (학년별 상위 4%까지)', '  1년→1점']}
                size={12}
                x={850}
                y={650}
              />
            </g>
          </svg>
        </article>
      </section>
    </section>
  )
}

export default PersonalGradeRecords
