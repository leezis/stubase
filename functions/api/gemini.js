const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
const MAX_PROMPT_LENGTH = 16000
const MAX_REPAIR_ATTEMPTS = 4
const LONG_RECORD_MIN_LENGTH = 350
const LONG_RECORD_MAX_LENGTH = 450
const STRICT_SYSTEM_INSTRUCTION =
  '너는 중학교 교사가 학교생활기록부 문장을 작성하도록 돕는 보조자다. 모든 응답은 반드시 한국어 산문으로만 작성한다. 제목, 설명, 번호, 목록, 불릿, 마크다운, 영어 번역, 작성 안내 문구를 쓰지 말고 완성된 생활기록부 문장만 출력한다. 사용자가 활동명(실시일) 같은 출력 형식을 지정하면 반드시 그 형식을 지킨다. 활동자료가 주어지면 각 활동명에 담긴 실제 교육 주제와 직접 관련된 내용만 작성하고, 봉사정신, 나눔, 공동체 의식 같은 일반 가치어로 활동 내용을 대체하지 않는다. 학생역량과 품성은 단어 라벨로 붙이지 말고 관찰 가능한 행동과 사고 과정으로 풀어 쓴다.'

function jsonResponse(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  })
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()
}

function cleanGeneratedRecordText(text) {
  return String(text ?? '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/u, '')
        .replace(/^[-*ㆍ•]\s*/u, '')
        .replace(/^\d+[.)]\s*/u, '')
        .replace(/^\*\*(.+)\*\*$/u, '$1')
        .trim(),
    )
    .filter(Boolean)
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/[`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLongRecordPrompt(prompt) {
  return /350~450|400~450|500자 미만|자율자치/u.test(prompt)
}

function getRecordTextLength(text) {
  return Array.from(String(text ?? '')).length
}

function isWithinLongRecordLength(text) {
  const textLength = getRecordTextLength(text)
  return (
    textLength >= LONG_RECORD_MIN_LENGTH &&
    textLength <= LONG_RECORD_MAX_LENGTH
  )
}

function isLikelyKoreanRecordText(text, prompt = '') {
  const normalizedText = cleanGeneratedRecordText(text)
  const compactText = normalizedText.replace(/\s+/g, '')
  const koreanCount = normalizedText.match(/[가-힣]/g)?.length ?? 0
  const latinCount = normalizedText.match(/[A-Za-z]/g)?.length ?? 0
  const shouldEnforceLongLength = isLongRecordPrompt(prompt)
  const hasCompleteEnding = /[.!?。]$/u.test(normalizedText)
  const hasBrokenEnding =
    /(?:그치함|핵심함|바탕함|연결함|태도함|모습함|내용함)\.?$/u.test(compactText)
  const hasRepeatedGenericExpression =
    compactText.includes('활동내용을자신의생활과연결하며') ||
    compactText.includes('배운내용을생활속태도로이어가는') ||
    compactText.includes('이후활동내용을다시확인하며')
  const hasInstructionLeak =
    /\b(showing|conclude|conclusion|write|student|record|activity|empathy|kindness|conflict|resolution|politeness|March|semester)\b/i.test(
      normalizedText,
    )

  return (
    (!shouldEnforceLongLength || isWithinLongRecordLength(normalizedText)) &&
    koreanCount >= 20 &&
    latinCount <= Math.max(12, Math.floor(koreanCount * 0.08)) &&
    hasCompleteEnding &&
    !hasBrokenEnding &&
    !hasRepeatedGenericExpression &&
    !hasInstructionLeak
  )
}

function createGeminiPayload(prompt) {
  return {
    systemInstruction: {
      parts: [{ text: STRICT_SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              '최종 출력은 한국어 생활기록부 문장만 작성하세요.',
              '영어 단어, 번역문, 제목, 목록, 마크다운, 작성 설명을 출력하지 마세요.',
              '활동명이 주어진 요청에서는 활동명과 직접 관련된 교육 내용, 대처 방법, 실천 태도를 중심으로 쓰고 관련 없는 품성어로 내용을 채우지 마세요.',
              '"협업을 바탕으로", "적응력을 바탕으로"처럼 역량명만 바꿔 붙이는 표현을 쓰지 말고, 해당 역량이 드러나는 구체적 행동으로 풀어 쓰세요.',
              '학생마다 같은 마무리 문장을 반복하지 말고 활동과 역량에 맞는 다른 결론으로 마무리하세요.',
              '"활동 내용을 자신의 생활과 연결하며", "배운 내용을 생활 속 태도로 이어 가는", "이후 활동 내용을 다시 확인하며" 같은 반복 표현을 쓰지 마세요.',
              '마지막 문장은 반드시 자연스러운 서술어로 끝내고 단어가 중간에서 끊긴 문장을 출력하지 마세요.',
              isLongRecordPrompt(prompt)
                ? '최종 출력은 공백 포함 반드시 350자 이상 450자 이하로 작성하세요. 349자 이하와 451자 이상은 실패입니다.'
                : '',
              prompt,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1100,
    },
  }
}

function createRepairPrompt(originalPrompt, flawedText) {
  const flawedTextLength = getRecordTextLength(cleanGeneratedRecordText(flawedText))

  return [
    '아래 초안은 형식이 잘못되었습니다.',
    '초안의 영어 표현, 목록, 마크다운, 작성 지시 문구를 모두 버리고 한국어 생활기록부 문장만 다시 작성하세요.',
    '최종 출력은 한 문단의 한국어 산문만 허용됩니다. 원래 요청에 활동명(실시일) 형식이 있으면 그 형식을 유지하세요.',
    '활동명과 맞지 않는 일반 가치어로 채운 부분은 버리고, 각 활동명의 실제 교육 주제와 직접 관련된 내용으로 다시 작성하세요.',
    '역량명이나 품성명을 "~을 바탕으로"처럼 붙인 부분은 관찰 행동으로 바꾸고, 반복된 마무리 문장은 학생 특성에 맞게 새로 쓰세요.',
    isLongRecordPrompt(originalPrompt)
      ? `최종 출력은 공백 포함 반드시 350자 이상 450자 이하로 맞추세요. 현재 초안은 ${flawedTextLength}자입니다.`
      : '',
    '',
    '[원래 요청]',
    originalPrompt,
    '',
    '[잘못된 초안]',
    flawedText,
  ]
    .filter(Boolean)
    .join('\n')
}

async function requestGeminiText(apiKey, model, prompt) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(createGeminiPayload(prompt)),
    },
  )
  const data = await geminiResponse.json()

  if (!geminiResponse.ok) {
    throw new Response(
      JSON.stringify({
        error:
          data?.error?.message ??
          'Gemini API 응답을 처리하지 못했습니다.',
      }),
      {
        status: geminiResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return cleanGeneratedRecordText(extractGeminiText(data))
}

export async function onRequestPost(context) {
  const apiKey = context.env.GEMINI_API_KEY
  const model = context.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

  if (!apiKey) {
    return jsonResponse(
      { error: 'GEMINI_API_KEY가 설정되어 있지 않습니다.' },
      { status: 500 },
    )
  }

  let payload

  try {
    payload = await context.request.json()
  } catch {
    return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const prompt = String(payload?.prompt ?? '').trim()

  if (!prompt) {
    return jsonResponse({ error: '생성할 프롬프트가 필요합니다.' }, { status: 400 })
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonResponse(
      { error: `프롬프트는 ${MAX_PROMPT_LENGTH}자 이하로 입력해 주세요.` },
      { status: 400 },
    )
  }

  let generatedText = ''

  try {
    generatedText = await requestGeminiText(apiKey, model, prompt)

    for (
      let attempt = 0;
      attempt < MAX_REPAIR_ATTEMPTS &&
      !isLikelyKoreanRecordText(generatedText, prompt);
      attempt += 1
    ) {
      generatedText = await requestGeminiText(
        apiKey,
        model,
        createRepairPrompt(prompt, generatedText),
      )
    }
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    return jsonResponse(
      { error: 'Gemini API 응답을 처리하지 못했습니다.' },
      { status: 500 },
    )
  }

  if (!isLikelyKoreanRecordText(generatedText, prompt)) {
    const generatedTextLength = getRecordTextLength(generatedText)
    const lengthError = isLongRecordPrompt(prompt)
      ? ` 현재 ${generatedTextLength}자입니다.`
      : ''

    return jsonResponse(
      {
        error:
          `한국어 생활기록부 문장으로 생성되지 않았거나 350~450자 범위를 벗어났습니다.${lengthError} 다시 생성해 주세요.`,
      },
      { status: 502 },
    )
  }

  return jsonResponse({ text: generatedText })
}
