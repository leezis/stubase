import {
  parseGradeAndClass,
  readFirstWorksheetRows,
} from './excelWorkbookReader.js'

function normalizeHours(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return ''
  }

  return Number.isInteger(number) ? String(number) : String(number)
}

function parseVolunteerRows(rows, fileName) {
  const classInfo = parseGradeAndClass(rows)
  const records = []
  let currentRecord = null

  rows.forEach((row) => {
    const studentNumText = String(row[0] ?? '').trim()
    const studentName = String(row[1] ?? '').trim()
    const cumulativeHours = normalizeHours(row[8])

    if (studentNumText === '번호') {
      return
    }

    if (studentNumText && studentName && /^\d/.test(studentNumText)) {
      currentRecord = {
        fileName,
        classTitle: classInfo.title,
        grade: classInfo.grade,
        classNum: classInfo.classNum,
        studentNum: Number(studentNumText),
        studentName,
        volunteer: {
          hours: cumulativeHours,
        },
      }
      records.push(currentRecord)
      return
    }

    if (currentRecord && cumulativeHours) {
      currentRecord.volunteer.hours = cumulativeHours
    }
  })

  return records
}

export async function parseVolunteerWorkbook(file) {
  return parseVolunteerRows(await readFirstWorksheetRows(file), file.name)
}

export async function parseVolunteerWorkbooks(files) {
  const importedGroups = await Promise.all(
    Array.from(files).map((file) => parseVolunteerWorkbook(file)),
  )

  return importedGroups.flat()
}
