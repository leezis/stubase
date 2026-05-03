import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildPersonalGradeRecordPlaceholders,
  createPersonalGradeRecordFileName,
} from '../src/features/personal-grade-records/personalGradeRecordsData.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const port = Number(process.env.PERSONAL_GRADE_HWP_PORT || 4186)
const templatePath = path.join(repoRoot, 'public', 'forms', 'personal-grade-record-template.hwpx')
const workerScriptPath = path.join(repoRoot, 'scripts', 'personal-grade-hwp-worker.ps1')
const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
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
let hwpWorkerProcess = null
let hwpWorkerStdout = ''
const pendingHwpJobs = new Map()

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 5 * 1024 * 1024) {
        request.destroy()
        reject(new Error('Request body is too large.'))
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function rejectPendingHwpJobs(error) {
  for (const pendingJob of pendingHwpJobs.values()) {
    clearTimeout(pendingJob.timeout)
    pendingJob.reject(error)
  }

  pendingHwpJobs.clear()
}

function handleHwpWorkerLine(line) {
  if (!line.trim()) {
    return
  }

  let message

  try {
    message = JSON.parse(line)
  } catch (error) {
    console.error('Could not parse HWP worker response:', line, error)
    return
  }

  const pendingJob = pendingHwpJobs.get(message.id)
  if (!pendingJob) {
    return
  }

  clearTimeout(pendingJob.timeout)
  pendingHwpJobs.delete(message.id)

  if (message.ok) {
    pendingJob.resolve()
    return
  }

  pendingJob.reject(new Error(message.error || 'HWP worker job failed.'))
}

function ensureHwpWorker() {
  if (hwpWorkerProcess && !hwpWorkerProcess.killed) {
    return hwpWorkerProcess
  }

  hwpWorkerStdout = ''
  hwpWorkerProcess = spawn(
    powershellPath,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', workerScriptPath],
    {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )

  hwpWorkerProcess.stdout.setEncoding('utf8')
  hwpWorkerProcess.stderr.setEncoding('utf8')

  hwpWorkerProcess.stdout.on('data', (chunk) => {
    hwpWorkerStdout += chunk

    while (hwpWorkerStdout.includes('\n')) {
      const newlineIndex = hwpWorkerStdout.indexOf('\n')
      const line = hwpWorkerStdout.slice(0, newlineIndex)
      hwpWorkerStdout = hwpWorkerStdout.slice(newlineIndex + 1)
      handleHwpWorkerLine(line)
    }
  })

  hwpWorkerProcess.stderr.on('data', (chunk) => {
    console.error(chunk.trim())
  })

  hwpWorkerProcess.on('error', (error) => {
    rejectPendingHwpJobs(error)
  })

  hwpWorkerProcess.on('exit', (code) => {
    const error = new Error(`HWP worker exited${code === null ? '' : ` with code ${code}`}.`)
    hwpWorkerProcess = null
    rejectPendingHwpJobs(error)
  })

  return hwpWorkerProcess
}

function runHwpWorkerJob(job) {
  return new Promise((resolve, reject) => {
    const worker = ensureHwpWorker()
    const id = randomUUID()
    const timeout = setTimeout(
      () => {
        pendingHwpJobs.delete(id)
        reject(new Error('HWP worker job timed out.'))
      },
      180000,
    )

    pendingHwpJobs.set(id, { resolve, reject, timeout })

    try {
      worker.stdin.write(`${JSON.stringify({ id, ...job })}\n`, 'utf8')
    } catch (error) {
      clearTimeout(timeout)
      pendingHwpJobs.delete(id)
      reject(error)
    }
  })
}

function stopHwpWorker() {
  if (!hwpWorkerProcess || hwpWorkerProcess.killed) {
    return
  }

  try {
    hwpWorkerProcess.stdin.write('__quit__\n')
    hwpWorkerProcess.stdin.end()
  } catch {
    hwpWorkerProcess.kill()
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopHwpWorker()
    process.exit(0)
  })
}

process.on('exit', () => {
  stopHwpWorker()
})

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

function shouldStoreWithoutCompression(fileName) {
  return (
    fileName === 'mimetype' ||
    fileName === 'version.xml' ||
    /^BinData\/.+\.(jpe?g|png)$/i.test(fileName) ||
    /^Preview\/.+\.(jpe?g|png)$/i.test(fileName)
  )
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

function replaceContentHpfSections(contentHpf, sectionCount) {
  const sectionItems = Array.from(
    { length: sectionCount },
    (_, index) =>
      `<opf:item id="section${index}" href="Contents/section${index}.xml" media-type="application/xml"/>`,
  ).join('')
  const sectionSpineItems = Array.from(
    { length: sectionCount },
    (_, index) => `<opf:itemref idref="section${index}" linear="yes"/>`,
  ).join('')

  return removeScriptReferences(contentHpf)
    .replace(
      /<opf:item id="section0" href="Contents\/section0\.xml" media-type="application\/xml"\/>/,
      sectionItems,
    )
    .replace(/<opf:itemref idref="section0" linear="yes"\/>/, sectionSpineItems)
}

async function generateHwpxBufferFromZip(zip) {
  const mimeTypeText = await zip.file('mimetype')?.async('text')
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

  return Buffer.from(patchHwpxZipMetadata(generatedArrayBuffer))
}

function updateLineSegmentHeight(paragraph, height) {
  const baseline = Math.round(height * 0.85)
  const spacing = Math.round(height * 0.6)

  return paragraph
    .replace(/vertsize="\d+"/, `vertsize="${height}"`)
    .replace(/textheight="\d+"/, `textheight="${height}"`)
    .replace(/baseline="\d+"/, `baseline="${baseline}"`)
    .replace(/spacing="\d+"/, `spacing="${spacing}"`)
}

function setSingleLineSegmentHeight(paragraph, height, defaultHorzSize, defaultVertPos = 0) {
  const baseline = Math.round(height * 0.85)
  const spacing = Math.round(height * 0.6)
  const firstLineSegment = paragraph.match(/<hp:lineseg[^>]*\/>/)?.[0]
  const vertPos = firstLineSegment?.match(/vertpos="(\d+)"/)?.[1] ?? defaultVertPos
  const horzSize = firstLineSegment?.match(/horzsize="(\d+)"/)?.[1] ?? defaultHorzSize
  const lineSegmentArray = `<hp:linesegarray><hp:lineseg textpos="0" vertpos="${vertPos}" vertsize="${height}" textheight="${height}" baseline="${baseline}" spacing="${spacing}" horzpos="0" horzsize="${horzSize}" flags="393216"/></hp:linesegarray>`

  if (/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/.test(paragraph)) {
    return paragraph.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/, lineSegmentArray)
  }

  return paragraph.replace('</hp:p>', `${lineSegmentArray}</hp:p>`)
}

function findRunCharPrId(xmlText, targetText) {
  const index = xmlText.indexOf(targetText)

  if (index < 0) {
    return null
  }

  const runStart = xmlText.lastIndexOf('<hp:run', index)
  const runEnd = xmlText.indexOf('</hp:run>', index) + '</hp:run>'.length

  if (runStart < 0 || runEnd < '</hp:run>'.length) {
    return null
  }

  return xmlText.slice(runStart, runEnd).match(/charPrIDRef="(\d+)"/)?.[1] ?? null
}

function updateParagraphContainingText(xmlText, targetText, updater) {
  let nextXmlText = xmlText
  let fromIndex = 0

  while (true) {
    const index = nextXmlText.indexOf(targetText, fromIndex)

    if (index < 0) {
      return nextXmlText
    }

    const paragraphStart = nextXmlText.lastIndexOf('<hp:p', index)
    const paragraphEnd = nextXmlText.indexOf('</hp:p>', index) + '</hp:p>'.length

    if (paragraphStart < 0 || paragraphEnd < '</hp:p>'.length) {
      fromIndex = index + targetText.length
      continue
    }

    const paragraph = nextXmlText.slice(paragraphStart, paragraphEnd)
    const nextParagraph = updater(paragraph)
    nextXmlText =
      nextXmlText.slice(0, paragraphStart) +
      nextParagraph +
      nextXmlText.slice(paragraphEnd)
    fromIndex = paragraphStart + nextParagraph.length
  }
}

function updateCharPrHeight(headerXml, charPrId, height) {
  return headerXml.replace(
    new RegExp(`<hh:charPr[^>]*id="${charPrId}"[^>]*>[\\s\\S]*?<\\/hh:charPr>`),
    (charPr) => charPr.replace(/height="\d+"/, `height="${height}"`),
  )
}

function getMaxCharPrId(headerXml) {
  const ids = [...headerXml.matchAll(/<hh:charPr[^>]*id="(\d+)"/g)].map((match) =>
    Number(match[1]),
  )

  return ids.length ? Math.max(...ids) : 0
}

function incrementCharPropertiesItemCount(headerXml) {
  return headerXml.replace(
    /<hh:charProperties itemCnt="(\d+)"/,
    (_, count) => `<hh:charProperties itemCnt="${Number(count) + 1}"`,
  )
}

function createDerivedCharPr(headerXml, sourceCharPrId, transformCharPr) {
  const sourceCharPr = headerXml.match(
    new RegExp(`<hh:charPr[^>]*id="${sourceCharPrId}"[^>]*>[\\s\\S]*?<\\/hh:charPr>`),
  )?.[0]

  if (!sourceCharPr) {
    return {
      charPrId: sourceCharPrId,
      headerXml,
    }
  }

  const charPrId = String(getMaxCharPrId(headerXml) + 1)
  const nextCharPr = transformCharPr(sourceCharPr.replace(`id="${sourceCharPrId}"`, `id="${charPrId}"`))
  const insertIndex = headerXml.indexOf('</hh:charProperties>')
  const nextHeaderXml = incrementCharPropertiesItemCount(
    headerXml.slice(0, insertIndex) + nextCharPr + headerXml.slice(insertIndex),
  )

  return {
    charPrId,
    headerXml: nextHeaderXml,
  }
}

function retargetRunsContainingText(xmlText, targetText, charPrId) {
  let nextXmlText = xmlText
  let fromIndex = 0

  while (true) {
    const index = nextXmlText.indexOf(targetText, fromIndex)

    if (index < 0) {
      return nextXmlText
    }

    const runStart = nextXmlText.lastIndexOf('<hp:run', index)
    const runEnd = nextXmlText.indexOf('</hp:run>', index) + '</hp:run>'.length

    if (runStart < 0 || runEnd < '</hp:run>'.length) {
      fromIndex = index + targetText.length
      continue
    }

    const run = nextXmlText.slice(runStart, runEnd)
    const nextRun = run.replace(/charPrIDRef="\d+"/, `charPrIDRef="${charPrId}"`)
    nextXmlText = nextXmlText.slice(0, runStart) + nextRun + nextXmlText.slice(runEnd)
    fromIndex = runStart + nextRun.length
  }
}

async function postprocessGeneratedHwpxBuffer(hwpxBuffer) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(hwpxBuffer)
  const sectionFileNames = Object.keys(zip.files).filter((fileName) => {
    return /^Contents\/section\d+\.xml$/.test(fileName) && !zip.files[fileName].dir
  })
  const volunteerAwardNoteTexts = [
    {
      text: '* 가산점 : 봉사상 수상',
      vertPos: 0,
    },
    {
      text: '  (학년별 상위 4%까지)',
      vertPos: 1352,
    },
  ]
  const noteCharPrIds = new Set()
  const titleText = '개인 내신성적 관리부'
  let titleSourceCharPrId = null
  let headerXml = await zip.file('Contents/header.xml')?.async('text')
  let titleCharPrId = null
  let wasChanged = false

  if (headerXml) {
    for (const fileName of sectionFileNames) {
      const sectionXml = await zip.file(fileName).async('text')
      titleSourceCharPrId = findRunCharPrId(sectionXml, titleText)

      if (titleSourceCharPrId) {
        break
      }
    }

    if (titleSourceCharPrId) {
      const derivedCharPr = createDerivedCharPr(headerXml, titleSourceCharPrId, (charPr) =>
        charPr
          .replace(/height="\d+"/, 'height="1900"')
          .replace(
            /<hh:fontRef[^>]*\/>/,
            '<hh:fontRef hangul="2" latin="2" hanja="2" japanese="2" other="2" symbol="2" user="2"/>',
          )
          .replace(/<hh:bold\/>/g, ''),
      )

      titleCharPrId = derivedCharPr.charPrId
      headerXml = derivedCharPr.headerXml
      wasChanged = true
    }
  }

  for (const fileName of sectionFileNames) {
    let sectionXml = await zip.file(fileName).async('text')
    let nextSectionXml = sectionXml

    if (titleCharPrId) {
      nextSectionXml = retargetRunsContainingText(nextSectionXml, titleText, titleCharPrId)
      nextSectionXml = updateParagraphContainingText(nextSectionXml, titleText, (paragraph) =>
        setSingleLineSegmentHeight(paragraph, 1900, 19644),
      )
    }

    volunteerAwardNoteTexts.forEach(({ text: noteText, vertPos }) => {
      const charPrId = findRunCharPrId(nextSectionXml, noteText)

      if (charPrId) {
        noteCharPrIds.add(charPrId)
      }

      nextSectionXml = updateParagraphContainingText(nextSectionXml, noteText, (paragraph) =>
        setSingleLineSegmentHeight(paragraph, 1000, 11780, vertPos),
      )
    })

    if (nextSectionXml !== sectionXml) {
      zip.file(fileName, nextSectionXml, { createFolders: false })
      wasChanged = true
    }
  }

  if (headerXml && noteCharPrIds.size) {
    const nextHeaderXml = [...noteCharPrIds].reduce((nextXml, charPrId) => {
      return updateCharPrHeight(nextXml, charPrId, 1000)
    }, headerXml)

    if (nextHeaderXml !== headerXml) {
      headerXml = nextHeaderXml
      wasChanged = true
    }
  }

  if (headerXml) {
    zip.file('Contents/header.xml', headerXml, { createFolders: false })
  }

  return wasChanged ? generateHwpxBufferFromZip(zip) : hwpxBuffer
}

async function createHwpxWithHancom(student, recordData) {
  const workDirectory = path.join(tmpdir(), `personal-grade-hwpx-${randomUUID()}`)
  const payloadPath = path.join(workDirectory, 'payload.json')
  const outputPath = path.join(workDirectory, 'output.hwpx')

  await mkdir(workDirectory, { recursive: true })

  try {
    const placeholders = buildPersonalGradeRecordPlaceholders(student, recordData)
    await writeFile(
      payloadPath,
      JSON.stringify({
        placeholders,
        nameText: student?.name ?? '',
      }),
      'utf8',
    )

    await runHwpWorkerJob({
      templatePath,
      payloadPath,
      outputPath,
    })

    return await postprocessGeneratedHwpxBuffer(await readFile(outputPath))
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

async function createCombinedHwpxSource(records) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await readFile(templatePath))
  const sectionTemplate = await zip.file('Contents/section0.xml')?.async('text')
  const contentHpf = await zip.file('Contents/content.hpf')?.async('text')

  if (!sectionTemplate || !contentHpf) {
    throw new Error('개인내신성적관리부 HWPX 템플릿의 본문을 찾지 못했습니다.')
  }

  for (const fileName of Object.keys(zip.files)) {
    if (/^Contents\/section\d+\.xml$/.test(fileName)) {
      zip.remove(fileName)
    }
  }

  records.forEach((record, index) => {
    const placeholders = buildPersonalGradeRecordPlaceholders(record.student, record.recordData)
    zip.file(`Contents/section${index}.xml`, replacePlaceholders(sectionTemplate, placeholders), {
      createFolders: false,
    })
  })

  zip.file('Contents/content.hpf', replaceContentHpfSections(contentHpf, records.length), {
    createFolders: false,
  })

  ;['Scripts/headerScripts.js', 'Scripts/sourceScripts.js'].forEach((fileName) => {
    if (zip.file(fileName)) {
      zip.remove(fileName)
    }
  })

  Object.keys(zip.files)
    .filter((fileName) => zip.files[fileName].dir && fileName === 'Scripts/')
    .forEach((fileName) => zip.remove(fileName))

  return generateHwpxBufferFromZip(zip)
}

async function createCombinedHwpxWithHancom(records) {
  const workDirectory = path.join(tmpdir(), `personal-grade-combined-hwpx-${randomUUID()}`)
  const payloadPath = path.join(workDirectory, 'payload.json')
  const outputPath = path.join(workDirectory, 'combined-output.hwpx')

  await mkdir(workDirectory, { recursive: true })

  try {
    await writeFile(
      payloadPath,
      JSON.stringify({
        records: records.map((record) => ({
          placeholders: buildPersonalGradeRecordPlaceholders(record.student, record.recordData),
          nameText: record.student?.name ?? '',
        })),
      }),
      'utf8',
    )
    await runHwpWorkerJob({
      mode: 'combine',
      templatePath,
      payloadPath,
      outputPath,
    })

    return await postprocessGeneratedHwpxBuffer(await readFile(outputPath))
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    response.end()
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  if (
    request.method !== 'POST' ||
    !['/personal-grade-records/hwpx', '/personal-grade-records/class-hwpx'].includes(
      url.pathname,
    )
  ) {
    sendJson(response, 404, { error: 'Not found.' })
    return
  }

  try {
    const payload = JSON.parse(await readRequestBody(request))

    if (url.pathname === '/personal-grade-records/class-hwpx') {
      const records = Array.isArray(payload.records) ? payload.records : []

      if (!records.length) {
        throw new Error('통합 저장할 학생 데이터가 없습니다.')
      }

      const fileName = payload.fileName || '학급_개인내신성적관리부.hwpx'
      const hwpxBuffer = await createCombinedHwpxWithHancom(records)

      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/haansofthwpx',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      })
      response.end(hwpxBuffer)
      return
    }

    const student = payload.student
    const recordData = payload.recordData
    const fileName = createPersonalGradeRecordFileName(student)
    const hwpxBuffer = await createHwpxWithHancom(student, recordData)

    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/haansofthwpx',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    })
    response.end(hwpxBuffer)
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'HWPX export failed.',
    })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Personal grade HWP export server listening on http://127.0.0.1:${port}`)
})
