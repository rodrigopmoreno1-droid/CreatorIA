type IdeaInput = {
  topic: string;
  audience?: string;
  product?: string;
  count?: number;
};

type ScriptInput = {
  topic: string;
  goal?: string;
  tone?: string;
};

type StoryInput = {
  theme: string;
  count?: number;
};

type MetricsInput = {
  summary: string;
  series?: Array<{ name: string; value: number }>;
};

type CompetitorInput = {
  competitors: string[];
  niche?: string;
};

type CalendarInput = {
  month: string;
  product?: string;
};

type ChatInput = {
  prompt: string;
  workspace?: string;
  context?: string;
};

type Provider = 'anthropic' | 'gemini';

function getProviderCandidates(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push('gemini');
  }

  return providers;
}

async function callAnthropic(prompt: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 1400,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic error ${response.status}`);
  }

  const payload = await response.json();
  return payload?.content?.[0]?.text ?? null;
}

async function callGemini(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1400
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}`);
  }

  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callProvider(prompt: string) {
  const providers = getProviderCandidates();

  for (const provider of providers) {
    try {
      const response = provider === 'anthropic' ? await callAnthropic(prompt) : await callGemini(prompt);
      if (response) {
        return response;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractJsonFragment(input: string) {
  const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i) ?? input.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const arrayStart = input.indexOf('[');
  const objectStart = input.indexOf('{');
  const start = [arrayStart, objectStart].filter((value) => value >= 0).sort((a, b) => a - b)[0];

  if (typeof start !== 'number') {
    return null;
  }

  const candidate = input.slice(start).trim();
  return candidate;
}

function parseStructuredResponse<T>(response: string | null, fallback: T): T {
  if (!response) {
    return fallback;
  }

  const fragment = extractJsonFragment(response);
  if (!fragment) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(fragment);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function fallbackIdea(topic: string, index: number) {
  return {
    title: `${topic} - ideia ${index + 1}`,
    hook: `Mostre como ${topic.toLowerCase()} resolve um problema real sem parecer vendedor.`,
    format: index % 2 === 0 ? 'Reels' : 'Carrossel',
    angle: index % 2 === 0 ? 'educacao' : 'prova_social'
  };
}

export async function generateIdeas(input: IdeaInput) {
  const fallback = Array.from({ length: input.count ?? 5 }, (_, index) => fallbackIdea(input.topic, index));
  const prompt = [
    'Voce e um estrategista de conteudo.',
    'Responda somente JSON valido.',
    `Retorne um array com ${fallback.length} objetos no formato [{"title":"", "hook":"", "format":"", "angle":""}].`,
    `Tema: ${input.topic}`,
    input.product ? `Produto: ${input.product}` : null,
    input.audience ? `Publico: ${input.audience}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateHooks(input: { topic: string; count?: number }) {
  const fallback = Array.from({ length: input.count ?? 7 }, (_, index) => `Gancho ${index + 1} sobre ${input.topic}`);
  const prompt = [
    'Voce e um copywriter de videos curtos.',
    'Responda somente JSON valido.',
    `Retorne um array com ${fallback.length} strings curtas e fortes.`,
    `Tema: ${input.topic}`
  ].join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateScript(input: ScriptInput) {
  const fallback = {
    title: `Roteiro sobre ${input.topic}`,
    hook: `Se voce quer ${input.topic.toLowerCase()}, faca isso sem complicar.`,
    spoken: `Hoje eu vou te mostrar como ${input.topic.toLowerCase()} de forma simples.`,
    takes: ['abertura com dor', 'prova visual', 'passo a passo', 'resultado', 'CTA'],
    cta: 'Comente "quero" para receber o material.',
    caption: `Legenda pronta sobre ${input.topic}`
  };
  const prompt = [
    'Voce cria roteiros de conteudo em portugues do Brasil.',
    'Responda somente JSON valido.',
    'Formato esperado: {"title":"","hook":"","spoken":"","takes":["","",""],"cta":"","caption":""}.',
    `Tema: ${input.topic}`,
    input.goal ? `Objetivo: ${input.goal}` : null,
    input.tone ? `Tom: ${input.tone}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateStoryboard(input: ScriptInput) {
  const fallback = {
    frames: [
      `Abertura forte sobre ${input.topic}`,
      'Cena de prova visual',
      'Explicacao do processo',
      'Fechamento com CTA'
    ]
  };
  const prompt = [
    'Voce cria storyboards simples para videos curtos.',
    'Responda somente JSON valido.',
    'Formato esperado: {"frames":["","","",""]}.',
    `Tema: ${input.topic}`
  ].join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateStories(input: StoryInput) {
  const fallback = {
    sequence: Array.from({ length: input.count ?? 5 }, (_, index) => ({
      title: `Story ${index + 1}`,
      hook: `${input.theme} com foco em retencao e CTA.`,
      cta: index === (input.count ?? 5) - 1 ? 'Responder DM' : 'Continuar vendo',
      time: `${String(8 + index).padStart(2, '0')}:00`
    }))
  };
  const prompt = [
    'Voce cria sequencias de stories para Instagram.',
    'Responda somente JSON valido.',
    'Formato esperado: {"sequence":[{"title":"","hook":"","cta":"","time":""}]}.',
    `Tema: ${input.theme}`,
    `Quantidade: ${input.count ?? 5}`
  ].join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function generateCaption(input: { topic: string; tone?: string }) {
  const fallback = { caption: `Legenda humana sobre ${input.topic}.` };
  const prompt = [
    'Voce escreve legendas em portugues do Brasil.',
    'Responda somente JSON valido.',
    'Formato esperado: {"caption":""}.',
    `Tema: ${input.topic}`,
    `Tom: ${input.tone ?? 'natural'}`
  ].join('\n');

  const parsed = parseStructuredResponse(await callProvider(prompt), fallback);
  return parsed.caption;
}

export async function rewriteHumanTone(input: { text: string }) {
  const fallback = { text: input.text };
  const prompt = [
    'Reescreva o texto com tom humano, claro e natural.',
    'Responda somente JSON valido.',
    'Formato esperado: {"text":""}.',
    input.text
  ].join('\n\n');

  const parsed = parseStructuredResponse(await callProvider(prompt), fallback);
  return parsed.text;
}

export async function analyzeMetrics(input: MetricsInput) {
  const fallback = {
    summary: 'Alcance e engajamento estao crescendo com posts de bastidor e prova social.',
    insights: ['Aumentar reels', 'Postar mais stories interativos', 'Refinar CTA'],
    risks: ['Muito conteudo generico', 'Pouca repeticao de formatos vencedores']
  };
  const prompt = [
    'Voce analisa metricas de conteudo.',
    'Responda somente JSON valido.',
    'Formato esperado: {"summary":"","insights":[""],"risks":[""]}.',
    `Resumo: ${input.summary}`,
    input.series ? `Series: ${JSON.stringify(input.series)}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function analyzeCompetitors(input: CompetitorInput) {
  const fallback = {
    summary: 'Concorrentes fortes usam bastidores, prova social e CTAs de DM.',
    opportunities: ['Reels de bastidor', 'Stories com enquete', 'Carrosseis educacionais'],
    watchouts: ['Postar muito institucional', 'Ignorar comentarios e respostas']
  };
  const prompt = [
    'Voce analisa concorrentes digitais.',
    'Responda somente JSON valido.',
    'Formato esperado: {"summary":"","opportunities":[""],"watchouts":[""]}.',
    `Concorrentes: ${input.competitors.join(', ')}`,
    `Nicho: ${input.niche ?? 'geral'}`
  ].join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function suggestCalendar(input: CalendarInput) {
  const fallback = {
    month: input.month,
    items: [
      { date: `${input.month}-03`, title: 'Reels de bastidor', channel: 'Reels' },
      { date: `${input.month}-07`, title: 'Stories de enquete', channel: 'Stories' },
      { date: `${input.month}-11`, title: 'Carrossel educativo', channel: 'Feed' }
    ]
  };
  const prompt = [
    'Voce planeja calendarios editoriais.',
    'Responda somente JSON valido.',
    'Formato esperado: {"month":"","items":[{"date":"","title":"","channel":""}]}.',
    `Mes: ${input.month}`,
    `Produto: ${input.product ?? 'crescimento de marca'}`
  ].join('\n');

  return parseStructuredResponse(await callProvider(prompt), fallback);
}

export async function chatWithAi(input: ChatInput) {
  const prompt = [
    `Voce e a IA do workspace ${input.workspace ?? 'ContentOS'}.`,
    'Responda em portugues brasileiro, de forma pratica, curta e clara.',
    input.context ? `Contexto: ${input.context}` : null,
    `Pedido do usuario: ${input.prompt}`
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await callProvider(prompt);

  return (
    response ??
    `Posso ajudar com ideias, roteiros, stories, metricas, concorrentes e calendario. Para: ${input.prompt}`
  );
}
