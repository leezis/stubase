import {
  parseGradeAndClass,
  readFirstWorksheetRows,
} from './excelWorkbookReader.js'

function normalizeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : ''
}

function parseAttendanceRows(rows, fileName) {
  const classInfo = parseGradeAndClass(rows)

  return rows.flatMap((row) => {
    const studentNumText = String(row[0] ?? '').trim()
    const studentName = String(row[1] ?? '').trim()

    if (!studentNumText || !studentName || !/^\d/.test(studentNumText)) {
      return []
    }

    return [{
      fileName,
      classTitle: classInfo.title,
      grade: classInfo.grade,
      classNum: classInfo.classNum,
      studentNum: Number(studentNumText),
      studentName,
      attendance: {
        unexcusedAbsence: normalizeNumber(row[4]),
        unexcusedTardy: normalizeNumber(row[7]),
        unexcusedEarlyLeave: normalizeNumber(row[10]),
        unexcusedResult: normalizeNumber(row[13]),
      },
    }]
  })
}

export async function parseAttendanceWorkbook(file) {
  return parseAttendanceRows(await readFirstWorksheetRows(file), file.name)
}

export async function parseAttendanceWorkbooks(files) {
  const importedGroups = await Promise.all(
    Array.from(files).map((file) => parseAttendanceWorkbook(file)),
  )

  return importedGroups.flat()
}
