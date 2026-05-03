import {
  parseGradeAndClass,
  readFirstWorksheetRows,
} from './excelWorkbookReader.js'

function parseClubRows(rows, fileName) {
  const classInfo = parseGradeAndClass(rows)
  const records = []
  let currentRecord = null

  rows.forEach((row) => {
    const studentNumText = String(row[0] ?? '').trim()
    const studentName = String(row[1] ?? '').trim()
    const clubName = String(row[2] ?? '').trim()
    const clubClassName = String(row[3] ?? '').trim()
    const teacherName = String(row[4] ?? '').trim()

    if (!clubName || studentNumText === '번 호') {
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
        clubActivity: {
          name: clubName,
          className: clubClassName,
          teacher: teacherName,
        },
        autonomousClub: {
          name: '',
          teacher: '',
        },
      }
      records.push(currentRecord)
      return
    }

    if (currentRecord) {
      currentRecord.autonomousClub = {
        name: clubName,
        teacher: teacherName,
      }
    }
  })

  return records
}

export async function parseClubActivityWorkbook(file) {
  return parseClubRows(await readFirstWorksheetRows(file), file.name)
}

export async function parseClubActivityWorkbooks(files) {
  const importedGroups = await Promise.all(
    Array.from(files).map((file) => parseClubActivityWorkbook(file)),
  )

  return importedGroups.flat()
}
