import {
  buildPersonalGradeRecordPlaceholders,
  createPersonalGradeRecordFileName,
} from './personalGradeRecordsData.js'

const HWPX_TEMPLATE_PATH = '/forms/personal-grade-record-template.hwpx'
const LOCAL_HWP_EXPORT_API_URL = 'http://127.0.0.1:4186/personal-grade-records/hwpx'
const LOCAL_HWP_CLASS_EXPORT_API_URL = 'http://127.0.0.1:4186/personal-grade-records/class-hwpx'
const ZIP_LOCAL_FILE_HEADER = 0x04034b50
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50
const ZIP_DEFLATE_METHOD = 8
const HWPX_ZIP_VERSION_NEEDED = 20
const HWPX_ZIP_VERSION_MADE_BY = 0x0b17
const HWPX_ZIP_DEFLATE_FLAG = 4
const HWPX_ZIP_FILE_TIME = 0
const HWPX_ZIP_FILE_DATE = 33
const HWPX_ZIP_EXTERNAL_ATTRIBUTES = 0x81800020

function shouldStoreWithoutCompression(fileName) {
  return (
    fileName === 'mimetype' ||
    fileName === 'version.xml' ||
    /^BinData\/.+\.(jpe?g|png)$/i.test(fileName) ||
    /^Preview\/.+\.(jpe?g|png)$/i.test(fileName)
  )
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function replacePlaceholders(xmlText, placeholders) {
  return Object.entries(placeholders).reduce((nextText, [key, value]) => {
    return nextText.replaceAll(`{{${key}}}`, escapeXml(value))
  }, xmlText)
}

function removeScriptReferences(xmlText) {
  return xmlText
    .replace(/<opf:item[^>]+href="Scripts\/headerScripts\.js"[^>]*\/>/g, '')
    .replace(/<opf:item[^>]+href="Scripts\/sourceScripts\.js"[^>]*\/>/g, '')
    .replace(/<opf:itemref[^>]+idref="headersc"[^>]*\/>/g, '')
    .replace(/<opf:itemref[^>]+idref="sourcesc"[^>]*\/>/g, '')
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function createHwpxBlobWithLocalHancom(student, recordData) {
  const response = await fetch(LOCAL_HWP_EXPORT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ student, recordData }),
  })

  if (!response.ok) {
    let errorMessage = 'Hancom HWP local export failed.'

    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || errorMessage
    } catch {
      // Use the default message when the local server does not return JSON.
    }

    throw new Error(errorMessage)
  }

  return response.blob()
}

async function createClassHwpxBlobWithLocalHancom(studentsWithRecords, fileName) {
  const response = await fetch(LOCAL_HWP_CLASS_EXPORT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      records: studentsWithRecords,
    }),
  })

  if (!response.ok) {
    let errorMessage = 'Hancom HWP class export failed.'

    try {
      const errorBody = await response.json()
      errorMessage = errorBody.error || errorMessage
    } catch {
      // Use the default message when the local server does not return JSON.
    }

    throw new Error(errorMessage)
  }

  return response.blob()
}

function getZipFlagForMethod(method) {
  return method === ZIP_DEFLATE_METHOD ? HWPX_ZIP_DEFLATE_FLAG : 0
}

function patchHwpxZipMetadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (
    offset + 30 <= bytes.length &&
    view.getUint32(offset, true) === ZIP_LOCAL_FILE_HEADER
  ) {
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraFieldLength = view.getUint16(offset + 28, true)

    view.setUint16(offset + 4, HWPX_ZIP_VERSION_NEEDED, true)
    view.setUint16(offset + 6, getZipFlagForMethod(method), true)
    view.setUint16(offset + 10, HWPX_ZIP_FILE_TIME, true)
    view.setUint16(offset + 12, HWPX_ZIP_FILE_DATE, true)

    offset += 30 + fileNameLength + extraFieldLength + compressedSize
  }

  while (offset + 46 <= bytes.length) {
    const signature = view.getUint32(offset, true)

    if (signature === ZIP_END_OF_CENTRAL_DIRECTORY) {
      break
    }

    if (signature !== ZIP_CENTRAL_FILE_HEADER) {
      offset += 1
      continue
    }

    const method = view.getUint16(offset + 10, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraFieldLength = view.getUint16(offset + 30, true)
    const fileCommentLength = view.getUint16(offset + 32, true)

    view.setUint16(offset + 4, HWPX_ZIP_VERSION_MADE_BY, true)
    view.setUint16(offset + 6, HWPX_ZIP_VERSION_NEEDED, true)
    view.setUint16(offset + 8, getZipFlagForMethod(method), true)
    view.setUint16(offset + 12, HWPX_ZIP_FILE_TIME, true)
    view.setUint16(offset + 14, HWPX_ZIP_FILE_DATE, true)
    view.setUint32(offset + 38, HWPX_ZIP_EXTERNAL_ATTRIBUTES, true)

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  return bytes
}

export async function createPersonalGradeRecordHwpxBlob(student, recordData) {
  const { default: JSZip } = await import('jszip')
  const response = await fetch(HWPX_TEMPLATE_PATH)

  if (!response.ok) {
    throw new Error('개인내신성적관리부 HWPX 템플릿을 불러오지 못했습니다.')
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const mimeTypeText = await zip.file('mimetype')?.async('text')
  const placeholders = buildPersonalGradeRecordPlaceholders(student, recordData)
  const xmlFiles = Object.keys(zip.files).filter((fileName) => {
    return (fileName.endsWith('.xml') || fileName.endsWith('.hpf')) && !zip.files[fileName].dir
  })

  await Promise.all(
    xmlFiles.map(async (fileName) => {
      const xmlText = await zip.file(fileName).async('text')
      const replacedXmlText = replacePlaceholders(xmlText, placeholders)

      zip.file(
        fileName,
        fileName === 'Contents/content.hpf'
          ? removeScriptReferences(replacedXmlText)
          : replacedXmlText,
        {
          createFolders: false,
        },
      )
    }),
  )

  ;['Scripts/headerScripts.js', 'Scripts/sourceScripts.js'].forEach((fileName) => {
    if (zip.file(fileName)) {
      zip.remove(fileName)
    }
  })

  Object.keys(zip.files)
    .filter((fileName) => zip.files[fileName].dir && fileName === 'Scripts/')
    .forEach((fileName) => zip.remove(fileName))

  const storedBinaryFiles = Object.keys(zip.files).filter((fileName) => {
    return shouldStoreWithoutCompression(fileName) && fileName !== 'mimetype'
  })

  await Promise.all(
    storedBinaryFiles.map(async (fileName) => {
      const fileData = await zip.file(fileName).async('arraybuffer')
      zip.file(fileName, fileData, {
        binary: true,
        compression: 'STORE',
        createFolders: false,
      })
    }),
  )

  if (mimeTypeText) {
    zip.file('mimetype', mimeTypeText, { compression: 'STORE' })
  }

  const generatedArrayBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
    mimeType: 'application/haansofthwpx',
  })

  return new Blob([patchHwpxZipMetadata(generatedArrayBuffer)], {
    type: 'application/haansofthwpx',
  })
}

export async function downloadPersonalGradeRecordHwpx(student, recordData) {
  const blob = await createHwpxBlobWithLocalHancom(student, recordData)
  downloadBlob(blob, createPersonalGradeRecordFileName(student))
}

export async function downloadClassPersonalGradeRecordZip(studentsWithRecords, zipName) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  for (const { student, recordData } of studentsWithRecords) {
    const hwpxBlob = await createHwpxBlobWithLocalHancom(student, recordData)
    zip.file(createPersonalGradeRecordFileName(student), hwpxBlob)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, zipName)
}

export async function downloadCombinedClassPersonalGradeRecordHwpx(
  studentsWithRecords,
  fileName,
) {
  const blob = await createClassHwpxBlobWithLocalHancom(studentsWithRecords, fileName)
  downloadBlob(blob, fileName)
}
