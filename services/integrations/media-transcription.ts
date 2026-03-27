type TranscriptionProvider = 'gemini' | 'openai' | 'none';

export type MediaTranscriptionResult = {
  text: string;
  screenTextLead: string;
  provider: TranscriptionProvider;
  confidence: number | null;
  status: 'success' | 'failed';
  error: string;
  mimeType: string;
  sizeBytes: number;
  sourceUrl: string;
  language: string;
};

const GEMINI_UPLOAD_SAFE_BYTES = 15 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (CreatorAI; +https://creator-ia.vercel.app)';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripCodeFences(text: string) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function extractJsonObject(text: string) {
  const stripped = stripCodeFences(text);

  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function pickMimeType(responseMimeType: string | null, fallbackUrl: string) {
  if (responseMimeType && responseMimeType.trim()) {
    return responseMimeType.split(';')[0].trim();
  }

  if (/\.mp3(\?|#|$)/i.test(fallbackUrl)) {
    return 'audio/mpeg';
  }

  if (/\.m4a(\?|#|$)/i.test(fallbackUrl)) {
    return 'audio/mp4';
  }

  if (/\.mov(\?|#|$)/i.test(fallbackUrl)) {
    return 'video/quicktime';
  }

  return 'video/mp4';
}

function extractHtmlMediaUrl(html: string, baseUrl: string) {
  const patterns = [
    /<meta[^>]+property=["']og:video(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i,
    /"video_url"\s*:\s*"([^"]+)"/i,
    /"videoUrl"\s*:\s*"([^"]+)"/i,
    /"contentUrl"\s*:\s*"([^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return match[1];
      }
    }
  }

  return '';
}

async function fetchRemoteMedia(sourceUrl: string, depth = 0): Promise<{ mimeType: string; sizeBytes: number; base64: string }> {
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar a midia (${response.status}).`);
  }

  const responseMimeType = response.headers.get('content-type');
  const mimeType = pickMimeType(responseMimeType, sourceUrl);

  if (responseMimeType && /text\/html|application\/xhtml\+xml/i.test(responseMimeType) && depth < 1) {
    const html = await response.text();
    const nextUrl = extractHtmlMediaUrl(html, sourceUrl);

    if (nextUrl && nextUrl !== sourceUrl) {
      return fetchRemoteMedia(nextUrl, depth + 1);
    }

    throw new Error('A fonte retornou uma pagina HTML sem URL de video direta para transcricao.');
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    mimeType,
    sizeBytes: arrayBuffer.byteLength,
    base64: Buffer.from(arrayBuffer).toString('base64')
  };
}

async function transcribeWithGemini(sourceUrl: string, mimeType: string, base64: string) {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const prompt = [
    'Voce e um transcritor de videos curtos e reels para uma plataforma de estrategia de conteudo.',
    'Retorne apenas JSON valido, sem markdown e sem texto extra.',
    'Formato esperado:',
    '{"transcript":"","screenTextLead":"","language":"","confidence":0,"notes":""}',
    'Regras:',
    '- transcript: transcricao literal do que foi falado no audio.',
    '- screenTextLead: primeiras linhas de texto visivel na tela, se existirem.',
    '- language: idioma predominante do audio.',
    '- confidence: numero entre 0 e 1.',
    '- Se nao houver fala inteligivel, deixe transcript vazio.',
    '- Se o texto da tela nao estiver legivel, deixe screenTextLead vazio.',
    '- Nao resuma, nao analise, nao explique.'
  ].join('\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1200
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini transcription error ${response.status}.`);
  }

  const payload = await response.json().catch(() => null);
  const text = normalizeText(payload?.candidates?.[0]?.content?.parts?.[0]?.text);
  const parsed = text ? extractJsonObject(text) : null;
  const transcript = normalizeWhitespace(
    typeof parsed?.transcript === 'string' ? parsed.transcript : text && !text.startsWith('{') ? text : ''
  );
  const screenTextLead = normalizeWhitespace(typeof parsed?.screenTextLead === 'string' ? parsed.screenTextLead : '');
  const confidenceRaw = typeof parsed?.confidence === 'number' && Number.isFinite(parsed.confidence) ? parsed.confidence : null;
  const confidence = confidenceRaw !== null ? Math.max(0, Math.min(1, confidenceRaw)) : transcript ? 0.9 : null;
  const language = normalizeText(parsed?.language);

  return {
    text: transcript,
    screenTextLead,
    provider: 'gemini' as const,
    confidence,
    status: transcript ? ('success' as const) : ('failed' as const),
    error: transcript ? '' : 'Sem transcript legivel retornado pelo Gemini.',
    language
  };
}

async function transcribeWithOpenAI(sourceUrl: string, mimeType: string, base64: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.API_OPENAI?.trim() || '';

  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1';
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar a midia (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const fileName = sourceUrl.split('/').pop() || 'reel.mp4';
  const formData = new FormData();
  formData.append('model', model);
  formData.append('file', blob, fileName);
  formData.append('response_format', 'json');

  const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!transcriptionResponse.ok) {
    throw new Error(`OpenAI transcription error ${transcriptionResponse.status}.`);
  }

  const payload = (await transcriptionResponse.json().catch(() => null)) as { text?: string } | null;
  const transcript = normalizeWhitespace(payload?.text ?? '');

  return {
    text: transcript,
    screenTextLead: '',
    provider: 'openai' as const,
    confidence: transcript ? 0.95 : null,
    status: transcript ? ('success' as const) : ('failed' as const),
    error: transcript ? '' : 'Sem transcript legivel retornado pelo OpenAI.',
    language: ''
  };
}

export async function transcribeMediaFromUrl(input: {
  sourceUrl: string;
  mimeType?: string;
}) {
  const sourceUrl = normalizeText(input.sourceUrl);

  if (!sourceUrl) {
    return {
      text: '',
      screenTextLead: '',
      provider: 'none' as const,
      confidence: null,
      status: 'failed' as const,
      error: 'Sem URL de midia para transcricao.',
      mimeType: input.mimeType ?? '',
      sizeBytes: 0,
      sourceUrl: ''
    };
  }

  try {
    const media = await fetchRemoteMedia(sourceUrl);
    const mimeType = input.mimeType?.trim() || media.mimeType || 'video/mp4';

    if (process.env.OPENAI_API_KEY?.trim() || process.env.API_OPENAI?.trim()) {
      try {
        const openAiResult = await transcribeWithOpenAI(sourceUrl, mimeType, media.base64);
        if (openAiResult?.text) {
          return {
            ...openAiResult,
            mimeType,
            sizeBytes: media.sizeBytes,
            sourceUrl
          };
        }
      } catch {
        // Fall through to Gemini.
      }
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      return {
        text: '',
        screenTextLead: '',
        provider: 'none' as const,
        confidence: null,
        status: 'failed' as const,
        error: 'GEMINI_API_KEY nao configurado para transcricao.',
        mimeType,
        sizeBytes: media.sizeBytes,
        sourceUrl
      };
    }

    if (media.sizeBytes > GEMINI_UPLOAD_SAFE_BYTES) {
      return {
        text: '',
        screenTextLead: '',
        provider: 'none' as const,
        confidence: null,
        status: 'failed' as const,
        error: 'Midia grande demais para transcricao inline com Gemini neste fluxo.',
        mimeType,
        sizeBytes: media.sizeBytes,
        sourceUrl
      };
    }

    const geminiResult = await transcribeWithGemini(sourceUrl, mimeType, media.base64);

    return {
      ...geminiResult,
      mimeType,
      sizeBytes: media.sizeBytes,
      sourceUrl
    };
  } catch (error) {
    return {
      text: '',
      screenTextLead: '',
      provider: 'none' as const,
      confidence: null,
      status: 'failed' as const,
      error: error instanceof Error ? error.message : 'Falha ao transcrever a midia.',
      mimeType: input.mimeType ?? '',
      sizeBytes: 0,
      sourceUrl
    };
  }
}
