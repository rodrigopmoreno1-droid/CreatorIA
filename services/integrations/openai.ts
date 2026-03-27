type OpenAIJsonInput<T> = {
  system: string;
  prompt: string;
  fallback: T;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || process.env.API_OPENAI?.trim() || '';
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

export function hasOpenAIKey() {
  return Boolean(getOpenAiApiKey());
}

export async function callOpenAIJson<T>(input: OpenAIJsonInput<T>): Promise<T> {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    return input.fallback;
  }

  const model = input.model ?? process.env.OPENAI_JSON_MODEL ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: input.system
        },
        {
          role: 'user',
          content: input.prompt
        }
      ]
    })
  });

  if (!response.ok) {
    return input.fallback;
  }

  const payload = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const content = payload?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    return input.fallback;
  }

  const parsed = extractJsonObject(content);
  if (!parsed) {
    return input.fallback;
  }

  return parsed as T;
}
