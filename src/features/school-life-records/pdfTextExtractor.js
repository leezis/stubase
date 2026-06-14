import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_EXTRACTED_PDF_TEXT_LENGTH = 120000

function normalizeExtractedPdfText(value) {
  return String(value ?? '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function isPdfFile(file) {
  const fileName = String(file?.name ?? '').toLowerCase()
  return file?.type === 'application/pdf' || fileName.endsWith('.pdf')
}

export async function extractPdfTextFromFile(file) {
  if (!isPdfFile(file)) {
    throw new Error('PDF 파일만 업로드할 수 있습니다.')
  }

  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => item.str)
      .filter(Boolean)
      .join(' ')

    if (pageText.trim()) {
      pageTexts.push(pageText)
    }
  }

  const extractedText = normalizeExtractedPdfText(pageTexts.join('\n\n'))

  if (!extractedText) {
    throw new Error(
      '텍스트를 추출하지 못했습니다. 스캔본 PDF라면 OCR 처리된 PDF를 업로드해 주세요.',
    )
  }

  return extractedText.slice(0, MAX_EXTRACTED_PDF_TEXT_LENGTH)
}
