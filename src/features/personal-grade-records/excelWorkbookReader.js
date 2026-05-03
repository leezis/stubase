const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

function getTextContent(node) {
  return node?.textContent?.trim() ?? ''
}

function columnNameToIndex(columnName) {
  return columnName.split('').reduce((total, char) => {
    return total * 26 + char.charCodeAt(0) - 64
  }, 0) - 1
}

function getCellIndex(reference) {
  const columnName = reference?.match(/[A-Z]+/)?.[0] ?? ''
  return columnName ? columnNameToIndex(columnName) : 0
}

async function readSharedStrings(zip) {
  const sharedStringsFile = zip.file('xl/sharedStrings.xml')

  if (!sharedStringsFile) {
    return []
  }

  const xml = parseXml(await sharedStringsFile.async('text'))

  return Array.from(xml.getElementsByTagNameNS(SPREADSHEET_NS, 'si')).map((si) => {
    return Array.from(si.getElementsByTagNameNS(SPREADSHEET_NS, 't'))
      .map((textNode) => textNode.textContent ?? '')
      .join('')
  })
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute('t')

  if (type === 's') {
    const sharedIndex = Number(getTextContent(cell.getElementsByTagNameNS(SPREADSHEET_NS, 'v')[0]))
    return sharedStrings[sharedIndex] ?? ''
  }

  if (type === 'inlineStr') {
    return getTextContent(cell.getElementsByTagNameNS(SPREADSHEET_NS, 't')[0])
  }

  return getTextContent(cell.getElementsByTagNameNS(SPREADSHEET_NS, 'v')[0])
}

function readRows(sheetXmlText, sharedStrings) {
  const xml = parseXml(sheetXmlText)

  return Array.from(xml.getElementsByTagNameNS(SPREADSHEET_NS, 'row')).map((row) => {
    const values = []

    Array.from(row.getElementsByTagNameNS(SPREADSHEET_NS, 'c')).forEach((cell) => {
      values[getCellIndex(cell.getAttribute('r'))] = readCellValue(cell, sharedStrings)
    })

    return values.map((value) => value ?? '')
  })
}

export function parseGradeAndClass(rows) {
  const title = rows
    .flat()
    .find((value) => /(\d+)학년\s*(\d+)반/.test(value))
    ?.trim()
  const match = title?.match(/(\d+)학년\s*(\d+)반/)

  if (!match) {
    return {
      title: title ?? '',
      grade: null,
      classNum: null,
    }
  }

  return {
    title,
    grade: Number(match[1]),
    classNum: Number(match[2]),
  }
}

export async function readFirstWorksheetRows(file) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const sharedStrings = await readSharedStrings(zip)
  const firstSheetName = Object.keys(zip.files)
    .filter((fileName) => /^xl\/worksheets\/sheet\d+\.xml$/.test(fileName))
    .sort()[0]

  if (!firstSheetName) {
    throw new Error(`${file.name} 파일에서 시트를 찾지 못했습니다.`)
  }

  return readRows(await zip.file(firstSheetName).async('text'), sharedStrings)
}
