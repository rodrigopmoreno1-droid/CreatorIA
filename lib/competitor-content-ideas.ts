import type {
  CompetitorAnalysis,
  CompetitorCapturedPost,
  CompetitorReferenceCategory,
  CompetitorGeneratedContentItem,
  CompetitorGeneratedContentPack,
  CompetitorGeneratedContentSection,
  CompetitorRecord,
  CompetitorConfidenceLevel
} from '@/types/competitor-intelligence';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function firstTranscriptLine(value: string) {
  return normalizeText(
    value
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  ).slice(0, 240);
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function extractOpeningPhrases(posts: CompetitorCapturedPost[]) {
  const phrases: Array<{ text: string; sourceUrl: string; postId: string }> = [];
  for (const post of posts) {
    const source = post.transcriptText || post.screenTextLead || '';
    if (!source || source.length < 20) continue;
    const sentences = splitSentences(source);
    const opening = sentences.slice(0, 2).join(' ').slice(0, 200);
    if (opening.length >= 15) {
      phrases.push({ text: opening, sourceUrl: post.sourceUrl, postId: post.id });
    }
  }
  return phrases;
}

function extractClosingPhrases(posts: CompetitorCapturedPost[]) {
  const phrases: Array<{ text: string; sourceUrl: string; postId: string }> = [];
  for (const post of posts) {
    const source = post.transcriptText || post.caption || '';
    if (!source || source.length < 30) continue;
    const sentences = splitSentences(source);
    const closing = sentences.slice(-2).join(' ').slice(0, 200);
    if (closing.length >= 15) {
      phrases.push({ text: closing, sourceUrl: post.sourceUrl, postId: post.id });
    }
  }
  return phrases;
}

function createItem(
  section: string,
  kind: CompetitorGeneratedContentItem['kind'],
  title: string,
  summary: string,
  rationale: string,
  extra?: Partial<Omit<CompetitorGeneratedContentItem, 'id' | 'kind' | 'title' | 'summary' | 'rationale'>>
): CompetitorGeneratedContentItem {
  return {
    id: `generated_${slugify(section)}_${slugify(title)}`,
    kind,
    title,
    summary,
    rationale,
    tags: extra?.tags ?? [],
    hookType: extra?.hookType ?? '',
    ctaType: extra?.ctaType ?? '',
    format: extra?.format ?? '',
    sample: extra?.sample ?? '',
    sourceUrl: extra?.sourceUrl ?? '',
    saveCategory: extra?.saveCategory ?? 'content_idea',
    structure: extra?.structure ?? '',
    angle: extra?.angle ?? '',
    confidenceLevel: extra?.confidenceLevel ?? 'medium'
  };
}

function findSection(analysis: CompetitorAnalysis, sectionId: string) {
  return analysis.sections.find((section) => section.id === sectionId);
}

function findInsightByTitle(analysis: CompetitorAnalysis, sectionId: string, title: string) {
  const section = findSection(analysis, sectionId);
  return section?.items.find((item) => normalizeText(item.title) === normalizeText(title)) ?? null;
}

function dedup(items: string[]) {
  return [...new Set(items)];
}

export function buildCompetitorContentIdeas(
  analysis: CompetitorAnalysis,
  competitor: Pick<CompetitorRecord, 'name' | 'niche' | 'type'>
): CompetitorGeneratedContentPack {
  const overview = analysis.overview;
  const engineering = findSection(analysis, 'engineering');
  const sourcePosts = Array.isArray(analysis.sourceSnapshot.topPosts) ? analysis.sourceSnapshot.topPosts : [];
  const topPost = sourcePosts[0];
  const signalReview = analysis.signalReview ?? null;
  const validatedHooks = signalReview?.hooks ?? [];
  const validatedCtas = signalReview?.ctas ?? [];
  const validatedThemes = signalReview?.themes ?? [];
  const validatedActions = signalReview?.actions ?? [];
  const engineeringLookup = Object.fromEntries((engineering?.items ?? []).map((item) => [normalizeText(item.title), item]));
  const topThemeInsight = findInsightByTitle(analysis, 'patterns', 'Temas recorrentes') ?? findInsightByTitle(analysis, 'ideas', 'Hooks');
  const hookInsight = findInsightByTitle(analysis, 'patterns', 'Tipo de abertura mais comum') ?? findInsightByTitle(analysis, 'ideas', 'Hooks');
  const ctaInsight = findInsightByTitle(analysis, 'patterns', 'CTA mais recorrente') ?? findInsightByTitle(analysis, 'ideas', 'CTAs');
  const storytellingInsight = findInsightByTitle(analysis, 'patterns', 'Estrutura narrativa frequente') ?? findInsightByTitle(analysis, 'ideas', 'Storytelling');
  const formatInsight = findInsightByTitle(analysis, 'patterns', 'Formatos mais usados') ?? findInsightByTitle(analysis, 'engineering', 'Formatos dominantes');

  const transcribedPosts = sourcePosts.filter((p) => p.transcriptStatus === 'success' && normalizeText(p.transcriptText).length > 30);
  const hasTranscripts = transcribedPosts.length > 0 || (signalReview?.status === 'completed' && signalReview.transcriptCoverage >= 0.7);

  const transcriptSnippets = [...new Set(
    sourcePosts
      .map((post) => firstTranscriptLine(post.transcriptText || post.screenTextLead || post.caption || post.captionLead || ''))
      .filter(Boolean)
  )].slice(0, 10);

  const realOpenings = validatedHooks.length
    ? validatedHooks.slice(0, 10).map((item) => ({ text: item.text, sourceUrl: item.sourceUrl, postId: slugify(item.sourceUrl || item.text) }))
    : extractOpeningPhrases(transcribedPosts);
  const realClosings = validatedCtas.length
    ? validatedCtas.slice(0, 10).map((item) => ({ text: item.text, sourceUrl: item.sourceUrl, postId: slugify(item.sourceUrl || item.text) }))
    : extractClosingPhrases(transcribedPosts);

  const topTheme = validatedThemes[0]?.text ?? topThemeInsight?.tags[0] ?? competitor.niche ?? 'o tema central do perfil';
  const secondTheme = validatedThemes[1]?.text ?? topThemeInsight?.tags[1] ?? transcriptSnippets[1] ?? 'um tema adjacente';
  const hookPattern = validatedHooks[0]?.text || hookInsight?.hookType || hookInsight?.summary || 'abertura direta';
  const ctaPattern = validatedCtas[0]?.category || ctaInsight?.ctaType || ctaInsight?.summary || 'comentarios';
  const dominantFormat = formatInsight?.format || 'Reels';
  const storytelling = storytellingInsight?.summary || storytellingInsight?.title || 'problema-solucao';
  const avgDuration = engineeringLookup['Duracao media dos videos']?.summary ?? 'Nao capturado publicamente';
  const cadence = engineeringLookup['Frequencia de posts por semana']?.summary ?? overview.positioning;
  const recordingStyle = engineeringLookup['Estilo de gravacao']?.summary ?? 'Video vertical com fala direta.';
  const proofSocial = engineeringLookup['Tipo de prova social']?.summary ?? 'Prova social nao evidente.';
  const transcriptSeed = transcriptSnippets[0] ?? topTheme;
  const transcriptSeed2 = transcriptSnippets[1] ?? secondTheme;
  const transcriptSeed3 = transcriptSnippets[2] ?? 'a virada';
  const packConfidenceLevel: CompetitorConfidenceLevel =
    signalReview?.status === 'completed' && signalReview.transcriptCoverage >= 0.7
      ? 'high'
      : hasTranscripts
        ? 'low'
        : 'low';
  const confidenceLabel = packConfidenceLevel === 'high' ? 'alta' : 'baixa';
  const sourceUrl = topPost?.sourceUrl ?? '';

  type BuildSeriesOptions = {
    saveCategory: CompetitorReferenceCategory;
    hookType?: string;
    ctaType?: string;
    format?: string;
    tags?: string[];
    rationale?: (summary: string, index: number) => string;
    sample?: (summary: string, index: number) => string;
    angle?: (summary: string, index: number) => string;
    structure?: (summary: string, index: number) => string;
    confidenceLevel?: CompetitorConfidenceLevel;
    sourceUrl?: string;
  };

  function buildSeriesItems(
    sectionId: string,
    kind: CompetitorGeneratedContentItem['kind'],
    titlePrefix: string,
    summaries: Array<string | { text: string; sourceUrl: string }>,
    options: BuildSeriesOptions
  ) {
    return summaries.map((entry, index) => {
      const summary = typeof entry === 'string' ? entry : entry.text;
      const itemSourceUrl = typeof entry === 'object' ? entry.sourceUrl : (options.sourceUrl ?? sourceUrl);
      return createItem(sectionId, kind, `${titlePrefix} ${String(index + 1).padStart(2, '0')}`, summary, options.rationale?.(summary, index) ?? `Repertorio derivado da analise de ${competitor.name}.`, {
        saveCategory: options.saveCategory,
        hookType: options.hookType ?? hookPattern,
        ctaType: options.ctaType ?? ctaPattern,
        format: options.format ?? dominantFormat,
        sample: options.sample?.(summary, index) ?? summary,
        tags: options.tags ?? [topTheme, secondTheme, transcriptSeed],
        angle: options.angle?.(summary, index) ?? '',
        structure: options.structure?.(summary, index) ?? '',
        confidenceLevel: options.confidenceLevel ?? packConfidenceLevel,
        sourceUrl: itemSourceUrl
      });
    });
  }

  // --- HOOKS: real transcript openings first, then adapted templates ---
  const realHookEntries: Array<{ text: string; sourceUrl: string }> = realOpenings.map((o) => ({
    text: `"${o.text}"`,
    sourceUrl: o.sourceUrl
  }));

  const templateHooks = [
    `Se você ainda tenta ${topTheme} do jeito antigo, o problema pode estar no começo da conversa.`,
    `Ninguém te conta isso sobre ${topTheme}, a atenção já foi embora antes da explicação terminar.`,
    `O erro mais comum em ${topTheme} é a estrutura precisa fazer o trabalho duro.`,
    `Antes de começar qualquer conteúdo sobre ${topTheme}, o gancho precisa prometer algo concreto logo de cara.`,
    `Quando o assunto é ${topTheme}, o problema pode estar no começo da conversa.`,
    `Se você ainda tenta ${topTheme} do jeito antigo, a atenção já foi embora antes da explicação terminar.`,
    `Ninguém te conta isso sobre ${topTheme}, a estrutura precisa fazer o trabalho duro.`,
    `O erro mais comum em ${topTheme} é o gancho precisa prometer algo concreto logo de cara.`,
    `Antes de começar qualquer conteúdo sobre ${topTheme}, o problema pode estar no começo da conversa.`,
    `Quando o assunto é ${topTheme}, a atenção já foi embora antes da explicação terminar.`,
    `Se você ainda tenta ${topTheme} do jeito antigo, a estrutura precisa fazer o trabalho duro.`,
    `Ninguém te conta isso sobre ${topTheme}, o gancho precisa prometer algo concreto logo de cara.`,
    `O erro mais comum em ${topTheme} é o problema pode estar no começo da conversa.`,
    `Antes de começar qualquer conteúdo sobre ${topTheme}, a atenção já foi embora antes da explicação terminar.`,
    `Quando o assunto é ${topTheme}, a estrutura precisa fazer o trabalho duro.`,
    `Se você ainda tenta ${topTheme} do jeito antigo, o gancho precisa prometer algo concreto logo de cara.`,
    `Ninguém te conta isso sobre ${topTheme}, o problema pode estar no começo da conversa.`,
    `O erro mais comum em ${topTheme} é a atenção já foi embora antes da explicação terminar.`,
    `Antes de começar qualquer conteúdo sobre ${topTheme}, a estrutura precisa fazer o trabalho duro.`,
    `Quando o assunto é ${topTheme}, o gancho precisa prometer algo concreto logo de cara.`
  ];

  const hookSummaries: Array<string | { text: string; sourceUrl: string }> = [
    ...realHookEntries,
    ...templateHooks
  ].slice(0, 20);

  const hookItems = buildSeriesItems('hooks', 'hook', 'Hook', hookSummaries, {
    saveCategory: 'hook',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [topTheme, secondTheme, hookPattern, transcriptSeed],
    rationale: (_summary, index) =>
      index < realHookEntries.length
        ? `Abertura validada a partir da análise real do perfil ${competitor.name}.`
        : `Hook adaptado do padrão de abertura ${hookPattern.toLowerCase()} observado no perfil.`,
    sample: (summary) => summary,
    angle: (_summary, index) => (index % 2 === 0 ? 'curiosidade + identificação' : 'problema + promessa'),
    structure: () => 'gancho -> contexto -> promessa'
  });

  // --- CTAs: real transcript closings first, then templates ---
  const realCtaEntries: Array<{ text: string; sourceUrl: string }> = realClosings.slice(0, 5).map((c) => ({
    text: `"${c.text}"`,
    sourceUrl: c.sourceUrl
  }));

  const templateCtas = [
    `Se quiser, eu te mando a versão adaptada no direct, sem perder tempo com teoria.`,
    `Comenta "quero" que eu te mando a estrutura, e eu já te deixo o próximo passo pronto.`,
    `Salva este post para usar na próxima gravação, sem perder tempo com teoria.`,
    `Se fizer sentido, compartilha com alguém que precisa ver isso, e eu já te deixo o próximo passo pronto.`,
    `Quer que eu transforme isso em roteiro? sem perder tempo com teoria.`,
    `Se quiser, eu te mando a versão adaptada no direct, e eu já te deixo o próximo passo pronto.`,
    `Comenta "quero" que eu te mando a estrutura, sem perder tempo com teoria.`,
    `Salva este post para usar na próxima gravação, e eu já te deixo o próximo passo pronto.`,
    `Se fizer sentido, compartilha com alguém que precisa ver isso, sem perder tempo com teoria.`,
    `Quer que eu transforme isso em roteiro? e eu já te deixo o próximo passo pronto.`
  ];

  const ctaSummaries: Array<string | { text: string; sourceUrl: string }> = [
    ...realCtaEntries,
    ...templateCtas
  ].slice(0, 10);

  const ctaItems = buildSeriesItems('ctas', 'cta', 'CTA', ctaSummaries, {
    saveCategory: 'cta',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [ctaPattern, topTheme, transcriptSeed2],
    rationale: (_summary, index) =>
      index < realCtaEntries.length
        ? `CTA validado a partir da análise real do perfil ${competitor.name}.`
        : `CTA adaptado ao comportamento de conversão observado no perfil.`,
    sample: (summary) => summary,
    angle: () => 'conversão leve e natural',
    structure: () => 'valor -> convite -> ação'
  });

  // --- STRUCTURES ---
  const structureSummaries = [
    '1. Gancho forte\n2. Dor concreta\n3. Prova ou exemplo\n4. Solução prática\n5. CTA curto',
    '1. Situação real\n2. Erro comum\n3. Descoberta que muda tudo\n4. Exemplo aplicado\n5. CTA de conversa',
    '1. Abertura com pergunta\n2. Contexto\n3. Resposta curta\n4. Solução prática\n5. CTA curto',
    '1. Promessa\n2. Bastidor ou prova\n3. Solução\n4. Exemplo aplicado\n5. CTA de conversa',
    '1. Mito ou crença\n2. Quebra de expectativa\n3. Passo prático\n4. Solução prática\n5. CTA curto',
    '1. Situação real\n2. Erro comum\n3. Descoberta que muda tudo\n4. Solução prática\n5. CTA curto',
    '1. Abertura com pergunta\n2. Contexto\n3. Resposta curta\n4. Exemplo aplicado\n5. CTA de conversa',
    '1. Promessa\n2. Bastidor ou prova\n3. Solução\n4. Solução prática\n5. CTA curto',
    '1. Mito ou crença\n2. Quebra de expectativa\n3. Passo prático\n4. Exemplo aplicado\n5. CTA de conversa',
    '1. Gancho forte\n2. Dor concreta\n3. Prova ou exemplo\n4. Exemplo aplicado\n5. CTA de conversa'
  ];
  const structureItems = buildSeriesItems('structures', 'structure', 'Estrutura', structureSummaries, {
    saveCategory: 'structure',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [storytelling, topTheme, ctaPattern],
    rationale: () => 'Estrutura de roteiro curta e gravável, montada para virar conteúdo com retenção.',
    sample: (summary) => summary,
    angle: (_summary, index) => (index % 2 === 0 ? 'retencao + clareza' : 'prova + CTA'),
    structure: (summary) => summary.replace(/\n/g, ' -> ')
  });

  // --- REELS: use real transcripts to build reel ideas ---
  const reelSummaries: Array<string | { text: string; sourceUrl: string }> = [];

  for (const post of transcribedPosts.slice(0, 5)) {
    const sentences = splitSentences(post.transcriptText);
    const opening = sentences[0] ?? '';
    const middle = sentences.slice(1, 3).join(' ') || 'desenvolvimento do tema';
    const closing = sentences.slice(-1)[0] ?? 'CTA de fechamento';
    reelSummaries.push({
      text: `Gancho: "${opening}"\nFala: "${middle}"\nCTA: "${closing}"`,
      sourceUrl: post.sourceUrl
    });
  }

  const templateReels = [
    `Gancho: "Se você ainda faz ${topTheme} assim..."\nFala: "O detalhe que muda tudo é o começo."\nTakes: gancho + exemplo + prova`,
    `Gancho: "Ninguém te fala isso sobre ${topTheme}..."\nFala: "Quando você simplifica, o vídeo prende."\nTakes: contexto + virada + CTA`,
    `Gancho: "O erro que mais trava ${topTheme} é..."\nFala: "O detalhe que muda tudo é o começo."\nTakes: gancho + exemplo + prova`,
    `Gancho: "Eu percebi isso quando vi ${transcriptSeed}..."\nFala: "Quando você simplifica, o vídeo prende."\nTakes: contexto + virada + CTA`,
    `Gancho: "Se você quer ${topTheme} de verdade, olha isso..."\nFala: "O detalhe que muda tudo é o começo."\nTakes: gancho + exemplo + prova`
  ];

  while (reelSummaries.length < 10) {
    const template = templateReels[reelSummaries.length - transcribedPosts.slice(0, 5).length] ?? templateReels[reelSummaries.length % templateReels.length];
    reelSummaries.push(template);
  }

  const reelItems = buildSeriesItems('reels', 'reels', 'Reel', reelSummaries.slice(0, 10), {
    saveCategory: 'content_idea',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: 'Reels',
    tags: [topTheme, hookPattern, ctaPattern, transcriptSeed],
    rationale: (_summary, index) =>
      index < transcribedPosts.slice(0, 5).length
        ? `Roteiro extraído da transcrição real do perfil ${competitor.name}.`
        : `Reel adaptado ao ritmo de ${dominantFormat.toLowerCase()} que o perfil usa.`,
    sample: (summary) => summary,
    angle: () => 'dor + prova + CTA',
    structure: () => 'gancho -> desenvolvimento -> prova -> CTA'
  });

  // --- STORIES ---
  const storySummaries: Array<string | { text: string; sourceUrl: string }> = [];

  for (const post of transcribedPosts.slice(0, 4)) {
    const sentences = splitSentences(post.transcriptText);
    const s1 = sentences[0] ?? topTheme;
    const s2 = sentences.slice(1, 3).join(' ') || 'desenvolvimento';
    const screenText = post.screenTextLead || topTheme;
    storySummaries.push({
      text: `Slide 1: "${s1}"\nFala: "${s2}"\nTexto na tela: ${screenText}\n\nSlide 2: prova ou bastidor\n\nSlide 3: CTA para direct ou comentário`,
      sourceUrl: post.sourceUrl
    });
  }

  const templateStories = [
    `Slide 1: "Você também sente isso sobre ${topTheme}?"\nFala: "Olha isso antes de gravar."\nTexto na tela: o erro invisível\n\nSlide 2: prova ou bastidor\n\nSlide 3: CTA para direct ou comentário`,
    `Slide 1: "Eu achei que isso era normal."\nFala: "Até perceber que não era."\nTexto na tela: antes da virada\n\nSlide 2: exemplo rápido\n\nSlide 3: CTA para salvar`,
    `Slide 1: "Se você faz ${topTheme}, presta atenção."\nFala: "Tem um detalhe que muda tudo."\nTexto na tela: um ajuste simples\n\nSlide 2: prova ou bastidor\n\nSlide 3: CTA para direct ou comentário`,
    `Slide 1: "Isso aqui parece pequeno."\nFala: "Mas é o tipo de coisa que segura atenção."\nTexto na tela: o ponto de virada\n\nSlide 2: exemplo rápido\n\nSlide 3: CTA para salvar`,
    `Slide 1: "A maioria faz desse jeito."\nFala: "E é por isso que trava."\nTexto na tela: o padrão errado\n\nSlide 2: prova ou bastidor\n\nSlide 3: CTA para direct ou comentário`,
    `Slide 1: "Você também sente isso sobre ${topTheme}?"\nFala: "Olha isso antes de gravar."\nTexto na tela: o erro invisível\n\nSlide 2: exemplo rápido\n\nSlide 3: CTA para salvar`
  ];

  while (storySummaries.length < 10) {
    storySummaries.push(templateStories[storySummaries.length % templateStories.length]);
  }

  const storyItems = buildSeriesItems('stories', 'stories', 'Story', storySummaries.slice(0, 10), {
    saveCategory: 'content_idea',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: 'Stories',
    tags: [topTheme, secondTheme, ctaPattern, transcriptSeed2],
    rationale: (_summary, index) =>
      index < transcribedPosts.slice(0, 4).length
        ? `Sequência de stories baseada na transcrição real do perfil.`
        : 'Sequencia de stories falada e visual, pronta para virar roteiro curto e gravavel.',
    sample: (summary) => summary,
    angle: () => 'sequencia curta com retenção',
    structure: () => 'contexto -> prova -> CTA'
  });

  // --- CARROSSEL ---
  const carouselSummaries: Array<string | { text: string; sourceUrl: string }> = [];

  for (const post of sourcePosts.filter((p) => p.format === 'carrossel' || (p.caption && p.caption.length > 100)).slice(0, 4)) {
    const sentences = splitSentences(post.caption || post.transcriptText || '');
    const cover = sentences[0] ?? topTheme;
    const pages = sentences.slice(1, 4).map((s, i) => `Página ${i + 2}: ${s}`).join('\n');
    carouselSummaries.push({
      text: `Capa: "${cover}"\n${pages || 'Página 2: desenvolvimento\nPágina 3: prova'}\nPágina final: CTA para salvar`,
      sourceUrl: post.sourceUrl
    });
  }

  const templateCarousels = [
    `Capa: "O erro que trava ${topTheme}"\nPágina 2: contexto do problema\nPágina 3: por que isso acontece\nPágina 4: passo a passo\nPágina 5: CTA final`,
    `Capa: "Como ${topTheme} fica mais claro"\nPágina 2: promessa\nPágina 3: prova\nPágina 4: exemplo real\nPágina 5: CTA para salvar`,
    `Capa: "O que ninguém te explica sobre ${topTheme}"\nPágina 2: mito\nPágina 3: realidade\nPágina 4: passo a passo\nPágina 5: CTA final`,
    `Capa: "Isso muda a forma de criar sobre ${topTheme}"\nPágina 2: detalhamento\nPágina 3: exemplo\nPágina 4: exemplo real\nPágina 5: CTA para salvar`,
    `Capa: "Antes de postar sobre ${topTheme}, leia isso"\nPágina 2: erro\nPágina 3: ajuste\nPágina 4: passo a passo\nPágina 5: CTA final`,
    `Capa: "O erro que trava ${topTheme}"\nPágina 2: contexto do problema\nPágina 3: por que isso acontece\nPágina 4: exemplo real\nPágina 5: CTA para salvar`
  ];

  while (carouselSummaries.length < 10) {
    carouselSummaries.push(templateCarousels[carouselSummaries.length % templateCarousels.length]);
  }

  const carouselItems = buildSeriesItems('carrossel', 'carrossel', 'Carrossel', carouselSummaries.slice(0, 10), {
    saveCategory: 'format',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: 'Carrossel',
    tags: [topTheme, overview.positioning, ctaPattern, transcriptSeed3],
    rationale: (_summary, index) =>
      index < sourcePosts.filter((p) => p.format === 'carrossel' || (p.caption && p.caption.length > 100)).slice(0, 4).length
        ? `Carrossel baseado em conteúdo real capturado do perfil.`
        : 'Carrossel com leitura rápida, capa forte e páginas internas que entregam valor em camadas.',
    sample: (summary) => summary,
    angle: () => 'promessa + prova + CTA',
    structure: () => 'capa -> desenvolvimento -> prova -> CTA'
  });

  // --- COPY ANGLES ---
  const copyAngleItems = buildSeriesItems('copy-angles', 'copy_angle', 'Ângulo', [
    `Dor + desejo + prova: mostra a dor de ${topTheme}, o desejo de ${secondTheme} e uma prova curta antes do CTA.`,
    `Quebra de objeção: começa com a dúvida do público e entrega a resposta em seguida.`,
    `Antes -> depois: compara o cenário atual com o resultado possível de forma simples.`,
    `Autoridade prática: explica com linguagem de creator e mostra o passo que realmente importa.`,
    `Comparação clara: coloca duas formas de fazer ${topTheme} lado a lado para facilitar a decisão.`
  ], {
    saveCategory: 'copy_angle',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [topTheme, secondTheme, proofSocial],
    rationale: () => 'Ângulo de copy pronto para adaptar em legenda, roteiro ou abertura de conteúdo.',
    sample: (summary) => summary,
    angle: () => 'mensagem de conversão',
    structure: () => 'dor -> desejo -> prova -> CTA'
  });

  // --- STORYTELLING ---
  const storytellingEntries: Array<string | { text: string; sourceUrl: string }> = [];

  for (const post of transcribedPosts.slice(0, 3)) {
    const text = post.transcriptText.slice(0, 300);
    storytellingEntries.push({
      text: `História real capturada: "${text}${text.length >= 300 ? '...' : ''}"`,
      sourceUrl: post.sourceUrl
    });
  }

  const templateStorytelling = [
    `Virada de chave: "Quando eu troquei ${transcriptSeed} por uma estratégia mais simples, tudo ficou mais claro."`,
    `Prova narrativa: "O perfil mostra que a sequência certa prende mais do que a informação solta."`,
    `Bastidor: "Por trás de um post bom existe uma abertura bem pensada e um CTA sem fricção."`,
    `Transformação: "De conteúdo confuso para conteúdo que prende: o ajuste foi começar com a dor certa."`,
    `História pessoal: "Eu achei que ${topTheme} era um problema isolado, até descobrir que o que mudava era a execução."`
  ];

  while (storytellingEntries.length < 5) {
    storytellingEntries.push(templateStorytelling[storytellingEntries.length % templateStorytelling.length]);
  }

  const storytellingItems = buildSeriesItems('storytelling', 'storytelling', 'Story', storytellingEntries.slice(0, 5), {
    saveCategory: 'storytelling',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [topTheme, storytelling, proofSocial, transcriptSeed],
    rationale: (_summary, index) =>
      index < transcribedPosts.slice(0, 3).length
        ? `Mini história real extraída da transcrição do perfil ${competitor.name}.`
        : 'Mini histórias e viradas narrativas para usar em reels, stories e legenda.',
    sample: (summary) => summary,
    angle: () => 'historia com virada',
    structure: () => 'situacao -> conflito -> descoberta -> virada'
  });

  // --- OFFERS ---
  const offerItems = buildSeriesItems('offers', 'offer', 'Oferta', [
    `Oferta curta com benefício claro para ${competitor.niche || topTheme}, prova social e próximo passo simples.`,
    `Oferta de entrada com promessa objetiva e uma prova rápida antes do CTA.`,
    `Convite leve: "Se quiser, eu adapto isso para o seu perfil."`,
    `Proposta clara: mostra o que a pessoa ganha sem enrolar.`,
    `Oferta com urgência suave e linguagem de creator, sem parecer propaganda antiga.`
  ], {
    saveCategory: 'offer',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: competitor.niche ? [competitor.niche, topTheme, proofSocial] : [topTheme, proofSocial],
    rationale: () => 'Oferta compacta e adaptável para fechamento sem quebrar o tom do conteúdo.',
    sample: (summary) => summary,
    angle: () => 'conversao leve e direta',
    structure: () => 'beneficio -> prova -> oferta -> CTA'
  });

  // --- SOCIAL PROOF ---
  const proofItems = buildSeriesItems('social-proof', 'social_proof', 'Prova', [
    `Depoimento curto: mostra que ${proofSocial.toLowerCase()} funciona na prática.`,
    `Print ou resultado: prova rápida antes da solução.`,
    `Antes e depois: compara o cenário antigo com o resultado atual.`,
    `Case rápido: conta o que mudou e por que funcionou.`,
    `Bastidor validado: mostra o processo para reforçar credibilidade.`
  ], {
    saveCategory: 'social_proof',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [proofSocial, topTheme, transcriptSeed2],
    rationale: () => 'Provas sociais para usar sem copiar o concorrente, apenas adaptando o tipo de validação.',
    sample: (summary) => summary,
    angle: () => 'validacao externa',
    structure: () => 'prova -> contexto -> CTA'
  });

  const sections: CompetitorGeneratedContentSection[] = [
    {
      id: 'hooks',
      title: 'Hooks',
      description: hasTranscripts
        ? `20 ganchos prontos — ${realHookEntries.length} validados das transcrições reais, o restante adaptado dos padrões detectados.`
        : '20 ganchos prontos, em linguagem de creator, inspirados nos padrões e legendas capturados.',
      items: hookItems
    },
    {
      id: 'ctas',
      title: 'CTAs',
      description: hasTranscripts
        ? `10 CTAs — ${realCtaEntries.length} validados das transcrições reais, o restante adaptado.`
        : '10 chamadas para ação curtas, naturais e prontas para comentário, direct ou salvamento.',
      items: ctaItems
    },
    {
      id: 'structures',
      title: 'Estruturas de roteiro',
      description: '10 modelos de roteiro curtos, graváveis e fáceis de adaptar para conteúdo real.',
      items: structureItems
    },
    {
      id: 'reels',
      title: 'Ideias de Reels',
      description: hasTranscripts
        ? `10 roteiros — ${Math.min(transcribedPosts.length, 5)} baseados em transcrições reais do perfil.`
        : '10 roteiros verticais que usam o padrão de abertura, a prova e o CTA detectados.',
      items: reelItems
    },
    {
      id: 'stories',
      title: 'Ideias de Stories',
      description: hasTranscripts
        ? `10 sequências — ${Math.min(transcribedPosts.length, 4)} baseadas em transcrições reais.`
        : '10 sequências com texto na tela, fala e CTA final para rodar em sequência.',
      items: storyItems
    },
    {
      id: 'carrossel',
      title: 'Ideias de Carrossel',
      description: '10 carrosséis com capa forte, desenvolvimento e CTA final claro.',
      items: carouselItems
    },
    {
      id: 'copy-angles',
      title: 'Ângulos de copy',
      description: 'Ângulos de mensagem que ajudam a transformar a leitura do perfil em legenda e roteiro.',
      items: copyAngleItems
    },
    {
      id: 'storytelling',
      title: 'Storytelling',
      description: hasTranscripts
        ? `${Math.min(transcribedPosts.length, 3)} histórias reais extraídas + viradas narrativas adaptáveis.`
        : 'Mini histórias e viradas narrativas para usar em conteúdo falado ou legendado.',
      items: storytellingItems
    },
    {
      id: 'offers',
      title: 'Ofertas',
      description: 'Propostas curtas e claras para fechar sem perder a naturalidade do conteúdo.',
      items: offerItems
    },
    {
      id: 'social-proof',
      title: 'Provas sociais',
      description: 'Formas simples de encaixar validação real sem copiar o material original.',
      items: proofItems
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    model: 'logic-pack',
    summary: `Repertório pronto baseado em ${competitor.name}, com ${hasTranscripts ? `${transcribedPosts.length} reels transcritos` : 'legendas e sinais públicos'} como base. Duração média: ${avgDuration}. Cadência: ${cadence}. Gravação: ${recordingStyle}. Confiança geral: ${confidenceLabel}.`,
    sections,
    sourceSnapshot: analysis.sourceSnapshot
  };
}
