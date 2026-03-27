import type {
  CompetitorAnalysis,
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

export function buildCompetitorContentIdeas(
  analysis: CompetitorAnalysis,
  competitor: Pick<CompetitorRecord, 'name' | 'niche' | 'type'>
): CompetitorGeneratedContentPack {
  const overview = analysis.overview;
  const engineering = findSection(analysis, 'engineering');
  const patterns = findSection(analysis, 'patterns');
  const actions = findSection(analysis, 'actions');
  const ideas = findSection(analysis, 'ideas');
  const sourcePosts = Array.isArray(analysis.sourceSnapshot.topPosts) ? analysis.sourceSnapshot.topPosts : [];
  const topPost = sourcePosts[0];
  const engineeringLookup = Object.fromEntries((engineering?.items ?? []).map((item) => [normalizeText(item.title), item]));
  const topThemeInsight = findInsightByTitle(analysis, 'patterns', 'Temas recorrentes') ?? findInsightByTitle(analysis, 'ideas', 'Hooks');
  const hookInsight = findInsightByTitle(analysis, 'patterns', 'Tipo de abertura mais comum') ?? findInsightByTitle(analysis, 'ideas', 'Hooks');
  const ctaInsight = findInsightByTitle(analysis, 'patterns', 'CTA mais recorrente') ?? findInsightByTitle(analysis, 'ideas', 'CTAs');
  const storytellingInsight = findInsightByTitle(analysis, 'patterns', 'Estrutura narrativa frequente') ?? findInsightByTitle(analysis, 'ideas', 'Storytelling');
  const formatInsight = findInsightByTitle(analysis, 'patterns', 'Formatos mais usados') ?? findInsightByTitle(analysis, 'engineering', 'Formatos dominantes');

  const transcriptSnippets = [...new Set(
    sourcePosts
      .map((post) => firstTranscriptLine(post.transcriptText || post.screenTextLead || post.caption || post.captionLead || ''))
      .filter(Boolean)
  )].slice(0, 6);

  const topTheme = topThemeInsight?.tags[0] ?? competitor.niche ?? 'o tema central do perfil';
  const secondTheme = topThemeInsight?.tags[1] ?? transcriptSnippets[1] ?? 'um tema adjacente';
  const hookPattern = hookInsight?.hookType || hookInsight?.summary || 'abertura direta';
  const ctaPattern = ctaInsight?.ctaType || ctaInsight?.summary || 'comentarios';
  const dominantFormat = formatInsight?.format || 'Reels';
  const storytelling = storytellingInsight?.summary || storytellingInsight?.title || 'problema-solucao';
  const avgDuration = engineeringLookup['Duracao media dos videos']?.summary ?? 'Nao capturado publicamente';
  const cadence = engineeringLookup['Frequencia de posts por semana']?.summary ?? overview.positioning;
  const recordingStyle = engineeringLookup['Estilo de gravacao']?.summary ?? 'Video vertical com fala direta.';
  const proofSocial = engineeringLookup['Tipo de prova social']?.summary ?? 'Prova social nao evidente.';
  const transcriptSeed = transcriptSnippets[0] ?? topTheme;
  const transcriptSeed2 = transcriptSnippets[1] ?? secondTheme;
  const transcriptSeed3 = transcriptSnippets[2] ?? 'a virada';
  const packConfidenceLevel: CompetitorConfidenceLevel = sourcePosts.some((post) => post.transcriptStatus === 'success' && normalizeText(post.transcriptText))
    ? 'high'
    : sourcePosts.some((post) => normalizeText(post.caption || post.captionLead))
      ? 'medium'
      : 'low';
  const confidenceLabel = packConfidenceLevel === 'high' ? 'alta' : packConfidenceLevel === 'medium' ? 'media' : 'baixa';
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
    summaries: string[],
    options: BuildSeriesOptions
  ) {
    return summaries.map((summary, index) =>
      createItem(sectionId, kind, `${titlePrefix} ${String(index + 1).padStart(2, '0')}`, summary, options.rationale?.(summary, index) ?? `Repertorio derivado da analise de ${competitor.name}.`, {
        saveCategory: options.saveCategory,
        hookType: options.hookType ?? hookPattern,
        ctaType: options.ctaType ?? ctaPattern,
        format: options.format ?? dominantFormat,
        sample: options.sample?.(summary, index) ?? summary,
        tags: options.tags ?? [topTheme, secondTheme, transcriptSeed],
        angle: options.angle?.(summary, index) ?? '',
        structure: options.structure?.(summary, index) ?? '',
        confidenceLevel: options.confidenceLevel ?? packConfidenceLevel,
        sourceUrl: options.sourceUrl ?? sourceUrl
      })
    );
  }

  const hookLeadTemplates = [
    `Se você ainda tenta ${topTheme} do jeito antigo,`,
    `Ninguém te conta isso sobre ${topTheme},`,
    `O erro mais comum em ${topTheme} é`,
    `Antes de começar qualquer conteúdo sobre ${topTheme},`,
    `Quando o assunto é ${topTheme},`
  ];
  const hookTailTemplates = [
    'o problema pode estar no começo da conversa.',
    'a atenção já foi embora antes da explicação terminar.',
    'a estrutura precisa fazer o trabalho duro.',
    'o gancho precisa prometer algo concreto logo de cara.'
  ];
  const hookSummaries = hookLeadTemplates.flatMap((lead) => hookTailTemplates.map((tail) => `${lead} ${tail}`)).slice(0, 20);
  const hookItems = buildSeriesItems('hooks', 'hook', 'Hook', hookSummaries, {
    saveCategory: 'hook',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [topTheme, secondTheme, hookPattern, transcriptSeed],
    rationale: (summary) => `Hook concreto inspirado no padrão de abertura ${hookPattern.toLowerCase()} e na fala transcrita/captions da amostra.`,
    sample: (summary, index) => (index % 2 === 0 ? `Use como abertura falada: "${summary}"` : `Variante adaptável para gravar em ${dominantFormat.toLowerCase()}.`),
    angle: (_summary, index) => (index % 2 === 0 ? 'curiosidade + identificação' : 'problema + promessa'),
    structure: () => 'gancho -> contexto -> promessa'
  });

  const ctaLeadTemplates = [
    'Se quiser, eu te mando a versão adaptada no direct',
    'Comenta "quero" que eu te mando a estrutura',
    'Salva este post para usar na próxima gravação',
    'Se fizer sentido, compartilha com alguém que precisa ver isso',
    'Quer que eu transforme isso em roteiro?'
  ];
  const ctaTailTemplates = [
    'sem perder tempo com teoria.',
    'e eu já te deixo o próximo passo pronto.'
  ];
  const ctaSummaries = ctaLeadTemplates.flatMap((lead) => ctaTailTemplates.map((tail) => `${lead}, ${tail}`)).slice(0, 10);
  const ctaItems = buildSeriesItems('ctas', 'cta', 'CTA', ctaSummaries, {
    saveCategory: 'cta',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [ctaPattern, topTheme, transcriptSeed2],
    rationale: (summary) => `CTA direto, falado e adaptável ao comportamento de conversão observado no perfil.`,
    sample: (summary) => summary,
    angle: () => 'conversão leve e natural',
    structure: () => 'valor -> convite -> ação'
  });

  const structureLeadTemplates = [
    '1. Gancho forte\n2. Dor concreta\n3. Prova ou exemplo',
    '1. Situação real\n2. Erro comum\n3. Descoberta que muda tudo',
    '1. Abertura com pergunta\n2. Contexto\n3. Resposta curta',
    '1. Promessa\n2. Bastidor ou prova\n3. Solução',
    '1. Mito ou crença\n2. Quebra de expectativa\n3. Passo prático'
  ];
  const structureTailTemplates = [
    '\n4. Solução prática\n5. CTA curto',
    '\n4. Exemplo aplicado\n5. CTA de conversa'
  ];
  const structureSummaries = structureLeadTemplates.flatMap((lead) => structureTailTemplates.map((tail) => `${lead}${tail}`)).slice(0, 10);
  const structureItems = buildSeriesItems('structures', 'structure', 'Estrutura', structureSummaries, {
    saveCategory: 'structure',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [storytelling, topTheme, ctaPattern],
    rationale: (summary) => `Estrutura de roteiro curta e gravável, montada para virar conteúdo com retenção.`,
    sample: (summary) => summary,
    angle: (_summary, index) => (index % 2 === 0 ? 'retencao + clareza' : 'prova + CTA'),
    structure: (summary) => summary.replace(/\n/g, ' -> ')
  });

  const reelLeadTemplates = [
    `Gancho: "Se você ainda faz ${topTheme} assim..."`,
    `Gancho: "Ninguém te fala isso sobre ${topTheme}..."`,
    `Gancho: "O erro que mais trava ${topTheme} é..."`,
    `Gancho: "Eu percebi isso quando vi ${transcriptSeed}..."`,
    `Gancho: "Se você quer ${topTheme} de verdade, olha isso..." `
  ];
  const reelTailTemplates = [
    `\nFala: "O detalhe que muda tudo é o começo."\nTakes: gancho + exemplo + prova`,
    `\nFala: "Quando você simplifica, o vídeo prende."\nTakes: contexto + virada + CTA`
  ];
  const reelSummaries = reelLeadTemplates.flatMap((lead) => reelTailTemplates.map((tail) => `${lead}${tail}`)).slice(0, 10);
  const reelItems = buildSeriesItems('reels', 'reels', 'Reel', reelSummaries, {
    saveCategory: 'content_idea',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: 'Reels',
    tags: [topTheme, hookPattern, ctaPattern, transcriptSeed],
    rationale: (summary) => `Reel direto, falado e ajustado ao ritmo de ${dominantFormat.toLowerCase()} que o perfil usa.`,
    sample: (summary) => summary,
    angle: () => 'dor + prova + CTA',
    structure: () => 'gancho -> desenvolvimento -> prova -> CTA'
  });

  const storyLeadTemplates = [
    `Slide 1: "Você também sente isso sobre ${topTheme}?"\nFala: "Olha isso antes de gravar."\nTexto na tela: o erro invisível`,
    `Slide 1: "Eu achei que isso era normal."\nFala: "Até perceber que não era."\nTexto na tela: antes da virada`,
    `Slide 1: "Se você faz ${topTheme}, presta atenção."\nFala: "Tem um detalhe que muda tudo."\nTexto na tela: um ajuste simples`,
    `Slide 1: "Isso aqui parece pequeno."\nFala: "Mas é o tipo de coisa que segura atenção."\nTexto na tela: o ponto de virada`,
    `Slide 1: "A maioria faz desse jeito."\nFala: "E é por isso que trava."\nTexto na tela: o padrão errado`
  ];
  const storyTailTemplates = [
    `\nSlide 2: prova ou bastidor\nFala: "O que mudou foi o jeito de começar."\nTexto na tela: a virada\n\nSlide 3: CTA para direct ou comentário`,
    `\nSlide 2: exemplo rápido\nFala: "Quando você simplifica, o público fica."\nTexto na tela: como usar hoje\n\nSlide 3: CTA para salvar`
  ];
  const storySummaries = storyLeadTemplates.flatMap((lead) => storyTailTemplates.map((tail) => `${lead}${tail}`)).slice(0, 10);
  const storyItems = buildSeriesItems('stories', 'stories', 'Story', storySummaries, {
    saveCategory: 'content_idea',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: 'Stories',
    tags: [topTheme, secondTheme, ctaPattern, transcriptSeed2],
    rationale: () => 'Sequencia de stories falada e visual, pronta para virar roteiro curto e gravavel.',
    sample: (summary) => summary,
    angle: () => 'sequencia curta com retenção',
    structure: () => 'contexto -> prova -> CTA'
  });

  const carouselLeadTemplates = [
    `Capa: "O erro que trava ${topTheme}"\nPágina 2: contexto do problema\nPágina 3: por que isso acontece`,
    `Capa: "Como ${topTheme} fica mais claro"\nPágina 2: promessa\nPágina 3: prova`,
    `Capa: "O que ninguém te explica sobre ${topTheme}"\nPágina 2: mito\nPágina 3: realidade`,
    `Capa: "Isso muda a forma de criar sobre ${topTheme}"\nPágina 2: detalhamento\nPágina 3: exemplo`,
    `Capa: "Antes de postar sobre ${topTheme}, leia isso"\nPágina 2: erro\nPágina 3: ajuste`
  ];
  const carouselTailTemplates = [
    `\nPágina 4: passo a passo\nPágina 5: CTA final`,
    `\nPágina 4: exemplo real\nPágina 5: CTA para salvar`
  ];
  const carouselSummaries = carouselLeadTemplates.flatMap((lead) => carouselTailTemplates.map((tail) => `${lead}${tail}`)).slice(0, 10);
  const carouselItems = buildSeriesItems('carrossel', 'carrossel', 'Carrossel', carouselSummaries, {
    saveCategory: 'format',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: 'Carrossel',
    tags: [topTheme, overview.positioning, ctaPattern, transcriptSeed3],
    rationale: () => 'Carrossel com leitura rápida, capa forte e páginas internas que entregam valor em camadas.',
    sample: (summary) => summary,
    angle: () => 'promessa + prova + CTA',
    structure: () => 'capa -> desenvolvimento -> prova -> CTA'
  });

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

  const storytellingItems = buildSeriesItems('storytelling', 'storytelling', 'Story', [
    `História pessoal: "Eu achei que ${topTheme} era um problema isolado, até descobrir que o que mudava era a execução."`,
    `Virada de chave: "Quando eu troquei ${transcriptSeed} por uma estratégia mais simples, tudo ficou mais claro."`,
    `Prova narrativa: "O perfil mostra que a sequência certa prende mais do que a informação solta."`,
    `Bastidor: "Por trás de um post bom existe uma abertura bem pensada e um CTA sem fricção."`,
    `Transformação: "De conteúdo confuso para conteúdo que prende: o ajuste foi começar com a dor certa."`
  ], {
    saveCategory: 'storytelling',
    hookType: hookPattern,
    ctaType: ctaPattern,
    format: dominantFormat,
    tags: [topTheme, storytelling, proofSocial, transcriptSeed],
    rationale: () => 'Mini histórias e viradas narrativas para usar em reels, stories e legenda.',
    sample: (summary) => summary,
    angle: () => 'historia com virada',
    structure: () => 'situacao -> conflito -> descoberta -> virada'
  });

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
      description: '20 ganchos prontos, em linguagem de creator, inspirados nos padrões e transcrições capturados.',
      items: hookItems
    },
    {
      id: 'ctas',
      title: 'CTAs',
      description: '10 chamadas para ação curtas, naturais e prontas para comentário, direct ou salvamento.',
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
      description: '10 roteiros verticais que usam o padrão de abertura, a prova e o CTA detectados.',
      items: reelItems
    },
    {
      id: 'stories',
      title: 'Ideias de Stories',
      description: '10 sequências com texto na tela, fala e CTA final para rodar em sequência.',
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
      description: 'Mini histórias e viradas narrativas para usar em conteúdo falado ou legendado.',
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
    summary: `Repertório pronto baseado em ${competitor.name}, com ${transcriptSnippets.length ? `${transcriptSnippets.length} trechos de fala/transcrição` : 'legendas e sinais públicos'} como base. Duração média: ${avgDuration}. Cadência: ${cadence}. Gravação: ${recordingStyle}. Confiança geral: ${confidenceLabel}.`,
    sections,
    sourceSnapshot: analysis.sourceSnapshot
  };
}
