import { callOpenAIJson, hasOpenAIKey } from '@/services/integrations/openai';
import type { CompetitorAnalysisFacts } from '@/lib/competitor-intelligence';
import type {
  CompetitorActionRecommendation,
  CompetitorSignalReview,
  CompetitorSignalSource,
  CompetitorSourceSnapshot,
  CompetitorValidatedCta,
  CompetitorValidatedHook,
  CompetitorValidatedTheme
} from '@/types/competitor-intelligence';

type SignalCandidate = {
  text: string;
  sourceUrl: string;
  source: CompetitorSignalSource;
  score: number;
};

type OpenAiSignalReview = {
  status: 'processing' | 'incomplete' | 'completed';
  transcriptCoverage: number;
  reelsTotal: number;
  reelsTranscribed: number;
  hooks: CompetitorValidatedHook[];
  ctas: CompetitorValidatedCta[];
  themes: CompetitorValidatedTheme[];
  actions: CompetitorActionRecommendation[];
  notes: string[];
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function firstSentence(text: string) {
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/^(.+?[.!?…])(?:\s|$)/);
  return normalizeWhitespace(match?.[1] ?? trimmed).slice(0, 220);
}

function lastSentence(text: string) {
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) {
    return '';
  }

  const sentences = trimmed.split(/(?<=[.!?…])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  return normalizeWhitespace(sentences[sentences.length - 1] ?? trimmed).slice(0, 220);
}

function splitSentences(text: string) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
}

function extractHashtags(text: string) {
  return [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase()))];
}

function extractCtaSentence(value: string) {
  const sentences = splitSentences(value);
  const ctaSentence = sentences.find((sentence) => /(comenta|salva|compartilha|compartilhe|direct|dm|manda|me chama|link na bio|clica|segue|inscreva|guarda|envia|me chama no direct|manda no direct)/i.test(sentence));

  return normalizeWhitespace(ctaSentence ?? sentences[sentences.length - 1] ?? '').slice(0, 220);
}

function scoreCandidate(source: CompetitorSignalSource, text: string, base = 60) {
  const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
  let score = base;
  if (source === 'transcript') {
    score += 25;
  }
  if (words > 14) {
    score += 5;
  }
  if (words < 4) {
    score -= 15;
  }
  return Math.max(0, Math.min(100, score));
}

function buildHookCandidates(snapshot: CompetitorSourceSnapshot): SignalCandidate[] {
  const posts = [...snapshot.topPosts]
    .sort((left, right) => {
      const leftTranscript = left.transcriptStatus === 'success' && normalizeText(left.transcriptText) ? 1 : 0;
      const rightTranscript = right.transcriptStatus === 'success' && normalizeText(right.transcriptText) ? 1 : 0;
      return rightTranscript - leftTranscript || right.postedAt.localeCompare(left.postedAt);
    })
    .slice(0, 10);

  const candidates: SignalCandidate[] = [];

  for (const post of posts) {
    const transcriptLead = firstSentence(post.transcriptText);
    const captionLead = firstSentence(post.captionLead || post.caption || post.screenTextLead || '');

    if (post.transcriptStatus === 'success' && transcriptLead) {
      candidates.push({
        text: transcriptLead,
        sourceUrl: post.sourceUrl,
        source: 'transcript',
        score: scoreCandidate('transcript', transcriptLead, 72)
      });
      continue;
    }

    if (captionLead) {
      candidates.push({
        text: captionLead,
        sourceUrl: post.sourceUrl,
        source: 'caption',
        score: scoreCandidate('caption', captionLead, 58)
      });
    }
  }

  return uniqueBy(candidates, (item) => slugify(item.text));
}

function buildCtaCandidates(snapshot: CompetitorSourceSnapshot): SignalCandidate[] {
  const candidates: SignalCandidate[] = [];

  for (const post of snapshot.topPosts.slice(0, 10)) {
    const transcriptCta = extractCtaSentence(post.transcriptText);
    const captionCta = extractCtaSentence([post.caption, post.accessibilityCaption, post.captionLead].filter(Boolean).join(' '));

    if (post.transcriptStatus === 'success' && transcriptCta) {
      candidates.push({
        text: transcriptCta,
        sourceUrl: post.sourceUrl,
        source: 'transcript',
        score: scoreCandidate('transcript', transcriptCta, 74)
      });
      continue;
    }

    if (captionCta) {
      candidates.push({
        text: captionCta,
        sourceUrl: post.sourceUrl,
        source: 'caption',
        score: scoreCandidate('caption', captionCta, 56)
      });
    }
  }

  return uniqueBy(candidates, (item) => slugify(item.text));
}

function buildThemeCandidates(snapshot: CompetitorSourceSnapshot, facts: CompetitorAnalysisFacts): SignalCandidate[] {
  const candidates: SignalCandidate[] = [];
  const posts = snapshot.topPosts.slice(0, 10);

  facts.recurringThemes.slice(0, 10).forEach((theme, index) => {
    const sourcePost = posts[index % Math.max(1, posts.length)];
    const fallbackSourceUrl = snapshot.instagram?.handle
      ? `https://www.instagram.com/${snapshot.instagram.handle}/`
      : '';
    candidates.push({
      text: theme,
      sourceUrl: sourcePost?.sourceUrl ?? fallbackSourceUrl,
      source: 'caption',
      score: Math.max(50, 80 - index * 4)
    });
  });

  posts.forEach((post) => {
    const text = normalizeWhitespace([post.transcriptText, post.caption, post.captionLead].filter(Boolean).join(' '));
    extractHashtags(text).slice(0, 3).forEach((tag) => {
      candidates.push({
        text: tag.replace(/^#/, ''),
        sourceUrl: post.sourceUrl,
        source: 'hashtag',
        score: post.transcriptStatus === 'success' ? 70 : 55
      });
    });
  });

  return uniqueBy(candidates, (item) => slugify(item.text));
}

function buildFallbackActions(facts: CompetitorAnalysisFacts, competitorName: string): CompetitorActionRecommendation[] {
  const topTheme = facts.recurringThemes[0] ?? 'tema principal';
  const topHook = facts.hookPatterns[0] ?? 'abertura direta';
  const topCta = facts.ctaPatterns[0] ?? 'comentarios';
  const dominantFormat = facts.formatMix[0]?.format ?? 'reels';

  return [
    {
      title: `Gerar 10 hooks a partir de ${topTheme}`,
      why: `O perfil repete sinais fortes de ${topHook.toLowerCase()} e isso vira repertorio rapido.`,
      impact: 'Conteudo',
      executeLabel: 'Executar',
      priority: 1,
      sourceUrls: []
    },
    {
      title: `Criar CTA de ${topCta} para o ${dominantFormat}`,
      why: 'Ajusta o fechamento do conteudo para o comportamento dominante do perfil.',
      impact: 'Creator AI',
      executeLabel: 'Executar',
      priority: 2,
      sourceUrls: []
    },
    {
      title: 'Salvar padrões validados no Banco',
      why: `Centraliza ${topTheme} como repertorio para futuras geracoes e cronogramas.`,
      impact: 'Banco',
      executeLabel: 'Executar',
      priority: 3,
      sourceUrls: []
    }
  ];
}

function fallbackReview(snapshot: CompetitorSourceSnapshot, facts: CompetitorAnalysisFacts): OpenAiSignalReview {
  const hooks = buildHookCandidates(snapshot)
    .slice(0, 10)
    .map((item) => ({
      text: item.text,
      sourceUrl: item.sourceUrl,
      source: item.source,
      score: item.score
    }));

  const ctas: CompetitorValidatedCta[] = [];
  for (const item of buildCtaCandidates(snapshot).slice(0, 10)) {
    ctas.push({
      text: item.text,
      sourceUrl: item.sourceUrl,
      source: item.source,
      score: item.score,
      category: normalizeCtaCategory(
        /(comenta|coment)/i.test(item.text)
          ? 'comentario'
          : /(direct|dm|mensagem|me chama)/i.test(item.text)
            ? 'direct'
            : /(link|bio|clica|acesse)/i.test(item.text)
              ? 'link'
              : /(salva|guarda)/i.test(item.text)
                ? 'salvar'
                : /(compartilha|envia|manda)/i.test(item.text)
                  ? 'compartilhar'
                  : /(segue|acompanha)/i.test(item.text)
                    ? 'seguir'
                    : /(venda|compre|garanta|saiba mais)/i.test(item.text)
                      ? 'conversao'
                      : 'outro'
      )
    });
  }

  const themes = uniqueBy(
    buildThemeCandidates(snapshot, facts).map((item) => ({
      text: item.text,
      example: facts.topCaptions.find((caption) => caption.toLowerCase().includes(item.text.toLowerCase())) ?? facts.topCaptions[0] ?? '',
      sourceUrl: item.sourceUrl,
      source: item.source,
      score: item.score
    })),
    (item) => slugify(item.text)
  ).slice(0, 10);

  return {
    status: facts.transcriptCoverage >= 0.7 ? 'completed' : 'incomplete',
    transcriptCoverage: facts.transcriptCoverage,
    reelsTotal: snapshot.reelsAnalyzed,
    reelsTranscribed: facts.transcriptCount,
    hooks,
    ctas,
    themes,
    actions: buildFallbackActions(facts, snapshot.instagram?.fullName ?? snapshot.instagram?.handle ?? 'perfil'),
    notes: facts.transcriptCoverage >= 0.7
      ? ['Validacao local utilizada como fallback por indisponibilidade do provedor OpenAI.']
      : ['Analise mantida em processamento parcial por cobertura de transcricao insuficiente.']
  };
}

function normalizeActionImpact(value: unknown): CompetitorActionRecommendation['impact'] {
  return value === 'Creator AI' || value === 'Banco' ? value : 'Conteudo';
}

function normalizeSignalSource(value: unknown): CompetitorSignalSource {
  return value === 'transcript' || value === 'caption' || value === 'hashtag' || value === 'screen' ? value : 'caption';
}

function normalizeCtaCategory(value: unknown): CompetitorValidatedCta['category'] {
  return value === 'comentario' ||
    value === 'direct' ||
    value === 'link' ||
    value === 'salvar' ||
    value === 'compartilhar' ||
    value === 'seguir' ||
    value === 'conversao' ||
    value === 'outro'
    ? (value as CompetitorValidatedCta['category'])
    : 'outro';
}

function normalizeOpenAiReview(payload: unknown, fallback: OpenAiSignalReview): OpenAiSignalReview {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const raw = payload as Record<string, unknown>;

  const hooks = Array.isArray(raw.hooks)
    ? raw.hooks
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const record = item as Record<string, unknown>;
          const text = normalizeWhitespace(normalizeText(record.text));
          if (!text) {
            return null;
          }
          return {
            text,
            sourceUrl: normalizeText(record.sourceUrl),
            source: normalizeSignalSource(record.source),
            score: typeof record.score === 'number' && Number.isFinite(record.score) ? Math.max(0, Math.min(100, record.score)) : 60
          } satisfies CompetitorValidatedHook;
        })
        .filter((item): item is CompetitorValidatedHook => Boolean(item))
    : fallback.hooks;

  const ctas: CompetitorValidatedCta[] = [];
  if (Array.isArray(raw.ctas)) {
    for (const item of raw.ctas) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const text = normalizeWhitespace(normalizeText(record.text));
      if (!text) {
        continue;
      }

      ctas.push({
        text,
        category: normalizeCtaCategory(record.category),
        sourceUrl: normalizeText(record.sourceUrl),
        source: normalizeSignalSource(record.source),
        score: typeof record.score === 'number' && Number.isFinite(record.score) ? Math.max(0, Math.min(100, record.score)) : 55
      });
    }
  } else {
    ctas.push(...fallback.ctas);
  }

  const themes = Array.isArray(raw.themes)
    ? raw.themes
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const record = item as Record<string, unknown>;
          const text = normalizeWhitespace(normalizeText(record.text));
          if (!text) {
            return null;
          }
          return {
            text,
            example: normalizeWhitespace(normalizeText(record.example)),
            sourceUrl: normalizeText(record.sourceUrl),
            source: normalizeSignalSource(record.source),
            score: typeof record.score === 'number' && Number.isFinite(record.score) ? Math.max(0, Math.min(100, record.score)) : 50
          } satisfies CompetitorValidatedTheme;
        })
        .filter((item): item is CompetitorValidatedTheme => Boolean(item))
    : fallback.themes;

  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const record = item as Record<string, unknown>;
          const title = normalizeWhitespace(normalizeText(record.title));
          if (!title) {
            return null;
          }
          const why = normalizeWhitespace(normalizeText(record.why));
          return {
            title,
            why,
            impact: normalizeActionImpact(record.impact),
            executeLabel: normalizeWhitespace(normalizeText(record.executeLabel)) || 'Executar',
            priority: typeof record.priority === 'number' && Number.isFinite(record.priority) ? record.priority : 99,
            sourceUrls: Array.isArray(record.sourceUrls) ? record.sourceUrls.map((item) => normalizeText(item)).filter(Boolean) : []
          } satisfies CompetitorActionRecommendation;
        })
        .filter((item): item is CompetitorActionRecommendation => Boolean(item))
        .sort((left, right) => left.priority - right.priority)
        .slice(0, 6)
    : fallback.actions;

  const transcriptCoverage = typeof raw.transcriptCoverage === 'number' && Number.isFinite(raw.transcriptCoverage)
    ? Math.max(0, Math.min(1, raw.transcriptCoverage))
    : fallback.transcriptCoverage;

  const status: OpenAiSignalReview['status'] =
    raw.status === 'completed' || raw.status === 'processing' || raw.status === 'incomplete'
      ? raw.status
      : fallback.status;

  const notes = Array.isArray(raw.notes) ? raw.notes.map((note) => normalizeText(note)).filter(Boolean) : fallback.notes;

  return {
    status,
    transcriptCoverage,
    reelsTotal: typeof raw.reelsTotal === 'number' && Number.isFinite(raw.reelsTotal) ? raw.reelsTotal : fallback.reelsTotal,
    reelsTranscribed: typeof raw.reelsTranscribed === 'number' && Number.isFinite(raw.reelsTranscribed) ? raw.reelsTranscribed : fallback.reelsTranscribed,
    hooks: uniqueBy(hooks, (item) => slugify(item.text)).slice(0, 10),
    ctas: uniqueBy(ctas, (item) => slugify(item.text)).slice(0, 10),
    themes: uniqueBy(themes, (item) => slugify(item.text)).slice(0, 10),
    actions,
    notes
  };
}

function buildOpenAiPrompt(snapshot: CompetitorSourceSnapshot, facts: CompetitorAnalysisFacts) {
  const hookCandidates = buildHookCandidates(snapshot).slice(0, 18);
  const ctaCandidates = buildCtaCandidates(snapshot).slice(0, 18);
  const themeCandidates = buildThemeCandidates(snapshot, facts).slice(0, 20);

  return JSON.stringify(
    {
      instructions: [
        'Valide apenas sinais reais e acionaveis.',
        'Hooks precisam soar como abertura falada de creator, nao legenda longa.',
        'CTAs precisam ser chamadas reais de acao e trazer categoria clara.',
        'Themes precisam ser agrupamentos utilizaveis para gerar conteudo.',
        'Acoes precisam ter impacto e proximo passo claro.',
        'Se a evidencia for fraca, descarte o item em vez de suavizar a conclusao.'
      ],
      transcriptCoverage: facts.transcriptCoverage,
      reelsTotal: snapshot.reelsAnalyzed,
      reelsTranscribed: facts.transcriptCount,
      candidates: {
        hooks: hookCandidates,
        ctas: ctaCandidates,
        themes: themeCandidates
      },
      output: {
        status: 'completed',
        hooks: [
          { text: '', sourceUrl: '', source: 'transcript', score: 0 }
        ],
        ctas: [
          { text: '', category: 'outro', sourceUrl: '', source: 'transcript', score: 0 }
        ],
        themes: [
          { text: '', example: '', sourceUrl: '', source: 'transcript', score: 0 }
        ],
        actions: [
          {
            title: '',
            why: '',
            impact: 'Conteudo',
            executeLabel: 'Executar',
            priority: 1,
            sourceUrls: []
          }
        ],
        notes: ['']
      }
    },
    null,
    2
  );
}

export async function reviewCompetitorSignals(input: {
  snapshot: CompetitorSourceSnapshot;
  facts: CompetitorAnalysisFacts;
}): Promise<CompetitorSignalReview> {
  const fallback = fallbackReview(input.snapshot, input.facts);

  if (!hasOpenAIKey()) {
    return fallback;
  }

  const payload = await callOpenAIJson<OpenAiSignalReview>({
    system:
      'Voce valida repertorio de concorrentes para uma plataforma de estrategia de conteudo. Responda apenas JSON valido. Nao invente, nao aumente confianca, nao transforme legenda em gancho se nao houver evidencia real.',
    prompt: buildOpenAiPrompt(input.snapshot, input.facts),
    fallback,
    model: process.env.OPENAI_ANALYSIS_MODEL ?? 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 1800
  });

  return normalizeOpenAiReview(payload, fallback);
}
