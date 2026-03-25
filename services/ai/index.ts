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

function getProvider() {
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic' as const;
  }

  if (process.env.GEMINI_API_KEY) {
    return 'gemini' as const;
  }

  return 'mock' as const;
}

async function callProvider(prompt: string) {
  const provider = getProvider();

  if (provider === 'mock') {
    return null;
  }

  try {
    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1200,
          temperature: 0.7,
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
            temperature: 0.7,
            maxOutputTokens: 1200
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini error ${response.status}`);
    }

    const payload = await response.json();
    return payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

function fallbackList(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);
}

function fallbackIdea(topic: string, index: number) {
  return {
    title: `${topic} - ideia ${index + 1}`,
    hook: `Mostre como ${topic.toLowerCase()} resolve um problema real sem parecer vendedor.`,
    format: index % 2 === 0 ? 'Reels' : 'Carrossel',
    angle: index % 2 === 0 ? 'educação' : 'prova social'
  };
}

export async function generateIdeas(input: IdeaInput) {
  const prompt = [
    'Gere ideias de conteúdo em português do Brasil.',
    `Tema: ${input.topic}`,
    input.product ? `Produto: ${input.product}` : null,
    input.audience ? `Público: ${input.audience}` : null,
    `Retorne uma lista curta com título, hook, formato e ângulo.`
  ]
    .filter(Boolean)
    .join('\n');

  const response = await callProvider(prompt);
  if (!response) {
    const count = input.count ?? 5;
    return Array.from({ length: count }, (_, index) => fallbackIdea(input.topic, index));
  }

  return response;
}

export async function generateHooks(input: { topic: string; count?: number }) {
  const count = input.count ?? 7;
  const prompt = `Crie ${count} ganchos curtos e fortes em português sobre: ${input.topic}.`;
  const response = await callProvider(prompt);

  if (!response) {
    return fallbackList(`Gancho sobre ${input.topic}`, count);
  }

  return response;
}

export async function generateScript(input: ScriptInput) {
  const prompt = [
    'Crie um roteiro de vídeo curto em português do Brasil.',
    `Tema: ${input.topic}`,
    input.goal ? `Objetivo: ${input.goal}` : null,
    input.tone ? `Tom: ${input.tone}` : null,
    'Inclua: gancho, takes, CTA e legenda curta.'
  ]
    .filter(Boolean)
    .join('\n');

  const response = await callProvider(prompt);

  return (
    response ?? {
      hook: `Se você quer ${input.topic.toLowerCase()}, faça isso sem complicar.`,
      spoken: `Hoje eu vou te mostrar como ${input.topic.toLowerCase()} de forma simples.`,
      takes: ['abertura com dor', 'prova visual', 'passo a passo', 'resultado', 'CTA'],
      cta: 'Comente “quero” para receber o material.',
      caption: `Roteiro sobre ${input.topic}`
    }
  );
}

export async function generateStoryboard(input: ScriptInput) {
  const prompt = `Crie um storyboard simples para o tema: ${input.topic}. Retorne 4 frames em português.`;
  const response = await callProvider(prompt);

  return response ?? { frames: ['Frame 1', 'Frame 2', 'Frame 3', 'Frame 4'] };
}

export async function generateStories(input: StoryInput) {
  const count = input.count ?? 5;
  const prompt = `Crie uma sequência de ${count} stories sobre ${input.theme}, com CTA e lógica de retenção.`;
  const response = await callProvider(prompt);

  return (
    response ?? {
      sequence: Array.from({ length: count }, (_, index) => `Story ${index + 1} sobre ${input.theme}`)
    }
  );
}

export async function generateCaption(input: { topic: string; tone?: string }) {
  const prompt = `Escreva uma legenda curta e humana sobre ${input.topic}. Tom: ${input.tone ?? 'natural'}.`;
  const response = await callProvider(prompt);

  return response ?? `Legenda humana sobre ${input.topic}.`;
}

export async function rewriteHumanTone(input: { text: string }) {
  const prompt = `Reescreva este texto com tom humano, direto e natural:\n\n${input.text}`;
  const response = await callProvider(prompt);

  return response ?? input.text;
}

export async function analyzeMetrics(input: MetricsInput) {
  const prompt = [
    'Analise métricas de conteúdo e devolva pontos acionáveis.',
    input.summary,
    input.series ? `Séries: ${JSON.stringify(input.series)}` : null
  ]
    .filter(Boolean)
    .join('\n');
  const response = await callProvider(prompt);

  return (
    response ?? {
      summary: 'Alcance e engajamento estão crescendo com posts de bastidor e prova social.',
      insights: ['Aumentar reels', 'Postar mais stories interativos', 'Refinar CTA'],
      risks: ['Muito conteúdo genérico', 'Pouca repetição de formatos vencedores']
    }
  );
}

export async function analyzeCompetitors(input: CompetitorInput) {
  const prompt = `Analise estes concorrentes (${input.competitors.join(', ')}) no nicho ${input.niche ?? 'geral'} e devolva insights`;
  const response = await callProvider(prompt);

  return (
    response ?? {
      summary: 'Concorrentes fortes usam bastidores, prova social e CTAs de DM.',
      opportunities: ['Reels de bastidor', 'Stories com enquete', 'Carrosséis educacionais'],
      watchouts: ['Postar muito institucional', 'Ignorar comentários e respostas']
    }
  );
}

export async function suggestCalendar(input: CalendarInput) {
  const prompt = `Sugira um calendário de conteúdo para ${input.month} com foco em ${input.product ?? 'crescimento de marca'}.`;
  const response = await callProvider(prompt);

  return (
    response ?? {
      month: input.month,
      items: [
        { date: `${input.month}-03`, title: 'Reels de bastidor', channel: 'Reels' },
        { date: `${input.month}-07`, title: 'Stories de enquete', channel: 'Stories' },
        { date: `${input.month}-11`, title: 'Carrossel educativo', channel: 'Feed' }
      ]
    }
  );
}

export async function chatWithAi(input: ChatInput) {
  const prompt = [
    `Você é a IA do workspace ${input.workspace ?? 'ContentOS'}.`,
    'Responda em português brasileiro, com clareza e foco prático.',
    input.context ? `Contexto: ${input.context}` : null,
    `Pedido do usuário: ${input.prompt}`
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await callProvider(prompt);

  return (
    response ??
    `Posso ajudar com ideias, roteiros, stories, métricas, concorrentes e calendário. Para: ${input.prompt}`
  );
}
