import type {
  CompetitorAnalysis,
  CompetitorGeneratedContentItem,
  CompetitorGeneratedContentPack,
  CompetitorGeneratedContentSection,
  CompetitorRecord
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
    angle: extra?.angle ?? ''
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

  const hookInsight = findInsightByTitle(analysis, 'patterns', 'Tipo de abertura mais comum') ?? findInsightByTitle(analysis, 'ideas', 'Hooks');
  const ctaInsight = findInsightByTitle(analysis, 'patterns', 'CTA mais recorrente') ?? findInsightByTitle(analysis, 'ideas', 'CTAs');
  const storytellingInsight = findInsightByTitle(analysis, 'patterns', 'Estrutura narrativa frequente') ?? findInsightByTitle(analysis, 'ideas', 'Storytelling');
  const formatInsight = findInsightByTitle(analysis, 'patterns', 'Formatos mais usados') ?? findInsightByTitle(analysis, 'engineering', 'Formatos dominantes');
  const topThemeInsight = findInsightByTitle(analysis, 'patterns', 'Temas recorrentes');
  const engineeringLookup = Object.fromEntries((engineering?.items ?? []).map((item) => [normalizeText(item.title), item]));
  const topTheme = topThemeInsight?.tags[0] ?? competitor.niche ?? 'o tema central do perfil';
  const secondTheme = topThemeInsight?.tags[1] ?? 'um tema adjacente';
  const hookPattern = hookInsight?.hookType || hookInsight?.summary || 'abertura direta';
  const ctaPattern = ctaInsight?.ctaType || ctaInsight?.summary || 'comentarios';
  const dominantFormat = formatInsight?.format || 'Reels';
  const storytelling = storytellingInsight?.summary || storytellingInsight?.title || 'problema-solucao';
  const avgDuration = engineeringLookup['Duracao media dos videos']?.summary ?? 'Nao capturado publicamente';
  const cadence = engineeringLookup['Frequencia de posts por semana']?.summary ?? overview.positioning;
  const recordingStyle = engineeringLookup['Estilo de gravacao']?.summary ?? 'Video vertical com fala direta.';
  const proofSocial = engineeringLookup['Tipo de prova social']?.summary ?? 'Prova social nao evidente.';

  const sections: CompetitorGeneratedContentSection[] = [
    {
      id: 'hooks',
      title: 'Hooks',
      description: 'Aberturas prontas para chamar atencao com a mesma logica do perfil analisado.',
      items: [
        createItem(
          'hooks',
          'hook',
          'Gancho de curiosidade',
          `Se você está tentando resolver ${topTheme}, talvez o erro esteja em como você começa, não no que você entrega.`,
          `Usa o hook ${hookPattern} e transforma em uma abertura que gera identificação imediata.`,
          {
            hookType: hookPattern,
            format: dominantFormat,
            saveCategory: 'hook',
            sample: `Comeca com: "Se você está tentando ${topTheme}, talvez o problema esteja aqui..."`,
            tags: [topTheme, hookPattern, dominantFormat],
            angle: 'curiosidade + identificacao',
            structure: 'curiosidade -> problema -> promessa'
          }
        )
      ]
    },
    {
      id: 'structures',
      title: 'Estruturas de roteiro',
      description: 'Modelos de roteiro curtos e gravaveis baseados no comportamento do concorrente.',
      items: [
        createItem(
          'structures',
          'structure',
          'Roteiro em 4 blocos',
          'Problema -> prova -> solução -> CTA.',
          `O perfil usa ${storytelling} e uma cadência que suporta uma peça direta, curta e gravável.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'structure',
            sample: `1. problema\n2. prova\n3. solução\n4. CTA`,
            tags: [storytelling, ctaPattern, dominantFormat],
            angle: 'estrutura curta e objetiva',
            structure: 'problema -> prova -> solução -> CTA'
          }
        )
      ]
    },
    {
      id: 'reels',
      title: 'Ideias de Reels',
      description: 'Ideias pensadas para video vertical com retenção e CTA claro.',
      items: [
        createItem(
          'reels',
          'reels',
          'Reels sobre o tema principal',
          `Video de ${dominantFormat.toLowerCase()} sobre ${topTheme} com fala direta e fechamento em ${ctaPattern}.`,
          `Aproxima o formato dominante do perfil com a dor principal detectada.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'content_idea',
            sample: `Hook: ${hookPattern}\nCTA: ${ctaPattern}`,
            tags: [topTheme, hookPattern, ctaPattern, dominantFormat],
            angle: 'dor + prova + CTA',
            structure: 'gancho -> desenvolvimento -> prova -> CTA'
          }
        )
      ]
    },
    {
      id: 'stories',
      title: 'Ideias de Stories',
      description: 'Sequencias curtas para Stories que levam a interação ou venda.',
      items: [
        createItem(
          'stories',
          'stories',
          'Sequencia de 3 Stories',
          `1) contexto sobre ${topTheme}\n2) prova ou bastidor\n3) CTA para resposta ou direct.`,
          `Converte a narrativa do perfil em uma sequencia simples, sem depender de edição pesada.`,
          {
            format: 'Stories',
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'content_idea',
            sample: 'Slide 1: contexto\nSlide 2: prova\nSlide 3: CTA',
            tags: [topTheme, secondTheme, ctaPattern],
            angle: 'sequencia curta com retenção',
            structure: 'contexto -> prova -> CTA'
          }
        )
      ]
    },
    {
      id: 'carrossel',
      title: 'Ideias de Carrossel',
      description: 'Ideias para carrossel com leitura rapida e valor em camadas.',
      items: [
        createItem(
          'carrossel',
          'carrossel',
          'Carrossel de promessa + prova',
          `Capa forte sobre ${topTheme}, páginas internas com prova e fechamento com CTA.`,
          `Funciona bem quando o perfil usa carrossel para aprofundar contexto e reforçar autoridade.`,
          {
            format: 'Carrossel',
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'format',
            sample: 'Capa: promessa\nMeio: prova\nFinal: CTA',
            tags: [topTheme, overview.positioning, ctaPattern],
            angle: 'promessa + prova + CTA',
            structure: 'capa -> desenvolvimento -> prova -> CTA'
          }
        )
      ]
    },
    {
      id: 'ctas',
      title: 'CTAs',
      description: 'Chamadas para acao alinhadas com a forma como o perfil move a audiencia.',
      items: [
        createItem(
          'ctas',
          'cta',
          'CTA de conversa direta',
          `Pede resposta no direct ou comentário depois de entregar ${topTheme}.`,
          `O perfil já mostra sinais de CTA de ${ctaPattern}; aqui isso vira chamada pronta.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'cta',
            sample: 'Se quiser, te mando o passo a passo no direct.',
            tags: [ctaPattern, topTheme],
            angle: 'conversa direta',
            structure: 'prova -> convite -> action'
          }
        )
      ]
    },
    {
      id: 'copy-angles',
      title: 'Angulos de copy',
      description: 'Alem de formato, o que muda e o angulo da mensagem.',
      items: [
        createItem(
          'copy-angles',
          'copy_angle',
          'Angulo dor + desejo + prova',
          `Mostra a dor de ${topTheme}, a promessa desejada e uma prova curta antes do CTA.`,
          `Converte a leitura de posicionamento em um angulo de copy reutilizavel.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'copy_angle',
            sample: `Dor: ${topTheme}\nDesejo: resultado real\nProva: ${proofSocial}`,
            tags: [topTheme, proofSocial, ctaPattern],
            angle: 'dor + desejo + prova',
            structure: 'dor -> desejo -> prova -> CTA'
          }
        )
      ]
    },
    {
      id: 'storytelling',
      title: 'Storytelling',
      description: 'Arcos narrativos que ajudam a puxar o publico para a historia.',
      items: [
        createItem(
          'storytelling',
          'storytelling',
          'Mini historia pessoal',
          `Eu achei que ${topTheme} era um problema isolado, ate descobrir que o que mudava era a forma de executar.`,
          `Usa a estrutura narrativa observada para criar identificacao e retenção.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'storytelling',
            sample: `Eu achei que... / ate que... / descobri que...`,
            tags: [storytelling, topTheme, secondTheme],
            angle: 'historia pessoal com virada',
            structure: 'situação -> conflito -> descoberta -> virada'
          }
        )
      ]
    },
    {
      id: 'offers',
      title: 'Ofertas',
      description: 'Como encaixar proposta sem perder naturalidade.',
      items: [
        createItem(
          'offers',
          'offer',
          'Oferta curta com prova',
          `Oferta de ${competitor.niche || topTheme} com beneficio claro, prova social e proximo passo simples.`,
          `Faz a peça sair da inspiração e entrar no terreno de conversão.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'offer',
            sample: `Beneficio -> prova -> oferta -> CTA`,
            tags: competitor.niche ? [competitor.niche, topTheme, proofSocial] : [topTheme, proofSocial],
            angle: 'conversao leve e direta',
            structure: 'beneficio -> prova -> oferta -> CTA'
          }
        )
      ]
    },
    {
      id: 'social-proof',
      title: 'Provas sociais',
      description: 'Como o perfil transforma validacao em argumento.',
      items: [
        createItem(
          'social-proof',
          'social_proof',
          'Prova social em print / depoimento',
          `${proofSocial} como base para mostrar que a solução funciona na prática.`,
          `Conecta o repertorio visual e narrativo com um sinal de credibilidade pronto para adaptar.`,
          {
            format: dominantFormat,
            hookType: hookPattern,
            ctaType: ctaPattern,
            saveCategory: 'social_proof',
            sample: proofSocial,
            tags: [proofSocial, topTheme],
            angle: 'validacao externa',
            structure: 'prova -> contexto -> CTA'
          }
        )
      ]
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    model: 'logic-pack',
    summary: `Conteudos derivados da analise de ${competitor.name} com foco em ${topTheme} e ${dominantFormat}. Duração média: ${avgDuration}. Cadencia: ${cadence}. Gravacao: ${recordingStyle}.`,
    sections,
    sourceSnapshot: analysis.sourceSnapshot
  };
}
