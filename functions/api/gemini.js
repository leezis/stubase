const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
const MAX_PROMPT_LENGTH = 4000

function jsonResponse(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  })
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

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 320,
        },
      }),
    },
  )

  const data = await geminiResponse.json()

  if (!geminiResponse.ok) {
    return jsonResponse(
      {
        error:
          data?.error?.message ??
          'Gemini API 응답을 처리하지 못했습니다.',
      },
      { status: geminiResponse.status },
    )
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  return jsonResponse({ text: text || '' })
}
