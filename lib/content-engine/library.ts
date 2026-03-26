import type {
  CommunicationStyle,
  ContentContext,
  CtaCategory,
  CtaPattern,
  FormatBlueprint,
  FormatSubtype,
  HookCategory,
  HookPattern,
  NichePattern,
  ObjectiveStrategy,
  StrategicReference,
  StorytellingModel,
  StorytellingPattern,
  TrendPattern
} from '@/lib/content-engine/types';

export const formatBlueprints: Record<FormatBlueprint['id'], FormatBlueprint> = {
  reels: {
    id: 'reels',
    label: 'Reels',
    defaultUnits: 5,
    blocks: ['hook', 'development', 'spoken', 'takes', 'cta', 'caption'],
    requiredFields: ['title', 'hook', 'spoken', 'takes', 'cta', 'caption'],
    writingRules: ['Abrir em ate 3 segundos', 'Fala oral e curta', 'Virada no meio', 'CTA simples e humano'],
    captionPolicy: 'required',
    trendFormats: ['POV', 'Erro comum', 'Antes e depois', 'Expectativa vs realidade']
  },
  stories: {
    id: 'stories',
    label: 'Stories',
    defaultUnits: 3,
    blocks: ['storySlides', 'cta'],
    requiredFields: ['title', 'storySlides', 'cta'],
    writingRules: ['Texto na tela curto', 'Uma ideia por slide', 'Progressao de curiosidade', 'CTA final fora dos slides'],
    captionPolicy: 'none',
    trendFormats: ['Bastidor', 'POV rapido', 'Pergunta + resposta', 'Texto forte + selfie']
  },
  video_curto: {
    id: 'video_curto',
    label: 'Video curto',
    defaultUnits: 5,
    blocks: ['hook', 'development', 'spoken', 'takes', 'cta', 'caption'],
    requiredFields: ['title', 'hook', 'spoken', 'takes', 'cta', 'caption'],
    writingRules: ['Promessa unica', 'Ritmo mais rapido que reels', 'Frases curtas', 'CTA em uma linha'],
    captionPolicy: 'required',
    trendFormats: ['Lista rapida', 'POV', 'Ninguem fala disso', 'Erro invisivel']
  },
  carrossel: {
    id: 'carrossel',
    label: 'Carrossel',
    defaultUnits: 5,
    blocks: ['hook', 'carrosselSlides', 'cta', 'caption'],
    requiredFields: ['title', 'hook', 'carrosselSlides', 'cta', 'caption'],
    writingRules: ['Capa que forca swipe', 'Um insight por pagina', 'Texto facil de salvar', 'Ultima pagina com CTA'],
    captionPolicy: 'required',
    trendFormats: ['Mitos e verdades', 'Passo a passo', 'Erro comum', 'Antes vs depois']
  },
  post: {
    id: 'post',
    label: 'Post estatico',
    defaultUnits: 1,
    blocks: ['hook', 'postFields', 'cta', 'caption'],
    requiredFields: ['title', 'postFields', 'cta', 'caption'],
    writingRules: ['Titulo da peca em ate 7 palavras', 'Legenda curta', 'Tom de creator', 'Visual e copy alinhados'],
    captionPolicy: 'optional',
    trendFormats: ['Frase forte', 'Crenca quebrada', 'Dado curto', 'Mini-lista visual']
  }
};

export const hookPatterns: HookPattern[] = [
  {
    id: 'erro-invisivel',
    label: 'Erro invisivel',
    formula: 'Tem um erro que esta travando [dor] e quase ninguem percebe.',
    note: 'Gera identificacao imediata e curiosidade.',
    objectives: ['alcance', 'vender'],
    formats: ['reels', 'stories', 'video_curto', 'carrossel']
  },
  {
    id: 'ninguem-fala',
    label: 'Ninguem fala disso',
    formula: 'Ninguem te fala isso sobre [tema], mas muda tudo.',
    note: 'Abre com quebra de expectativa.',
    objectives: ['alcance', 'engajar'],
    formats: ['reels', 'video_curto', 'carrossel', 'post']
  },
  {
    id: 'situacao-real',
    label: 'Situacao real',
    formula: 'Eu achei que era normal viver [dor], ate entender o que estava por tras disso.',
    note: 'Melhor para storytelling e relacionamento.',
    tones: ['storytelling', 'natural', 'emocional'],
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'pov',
    label: 'POV',
    formula: 'POV: voce esta tentando resolver [dor] do jeito que todo mundo tenta.',
    note: 'Formato nativo para trend e video curto.',
    tones: ['trend', 'genz'],
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'lista-rapida',
    label: 'Lista rapida',
    formula: '3 sinais de que voce esta fazendo errado quando tenta [beneficio].',
    note: 'Bom para alcance, salvamento e carrossel.',
    objectives: ['alcance', 'engajar'],
    formats: ['reels', 'video_curto', 'carrossel']
  },
  {
    id: 'virada-pessoal',
    label: 'Virada pessoal',
    formula: 'Isso aqui mudou completamente [beneficio] para mim e eu nao esperava.',
    note: 'Ajuda a encaixar o produto depois da virada.',
    tones: ['storytelling', 'natural'],
    objectives: ['relacionamento', 'vender'],
    formats: ['reels', 'stories', 'video_curto']
  }
];

export const ctaPatterns: CtaPattern[] = [
  {
    id: 'direct',
    label: 'Direct',
    formula: 'Me chama no direct e eu te mostro como aplicar isso no seu caso.',
    note: 'CTA curto e conversacional.',
    objectives: ['vender', 'relacionamento'],
    formats: ['reels', 'stories', 'video_curto', 'post']
  },
  {
    id: 'save-share',
    label: 'Salvar e compartilhar',
    formula: 'Salva isso agora e manda para quem esta vivendo essa fase.',
    note: 'Bom para alcance e engajamento.',
    objectives: ['alcance', 'engajar'],
    formats: ['reels', 'carrossel', 'post']
  },
  {
    id: 'comment-keyword',
    label: 'Comentar palavra-chave',
    formula: 'Comenta "[palavra]" que eu te explico o proximo passo.',
    note: 'CTA acionavel para venda e engajamento.',
    objectives: ['vender', 'engajar'],
    formats: ['reels', 'video_curto']
  },
  {
    id: 'story-reply',
    label: 'Responder story',
    formula: 'Responde "quero" aqui que eu te mando a direcao certa.',
    note: 'CTA nativo para stories.',
    objectives: ['vender', 'relacionamento'],
    formats: ['stories']
  },
  {
    id: 'soft-follow',
    label: 'Continuar acompanhando',
    formula: 'Se isso fez sentido, continua comigo que eu vou aprofundar esse tema.',
    note: 'CTA macio para relacionamento e autoridade.',
    objectives: ['relacionamento', 'autoridade'],
    formats: ['reels', 'stories', 'post']
  }
];

export const storytellingPatterns: StorytellingPattern[] = [
  {
    id: 'situacao-problema-virada-solucao',
    label: 'Situacao -> problema -> virada -> solucao',
    stages: ['situacao real', 'frustracao ou erro', 'descoberta', 'produto como apoio', 'CTA'],
    note: 'Padrao principal para creator e venda com humanidade.',
    tones: ['storytelling', 'natural', 'emocional'],
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'erro-correto-acao',
    label: 'Erro -> correcao -> acao',
    stages: ['erro comum', 'por que nao funciona', 'ajuste certo', 'CTA'],
    note: 'Bom para alcance, salvamento e educacao.',
    tones: ['educativo', 'autoridade'],
    formats: ['reels', 'video_curto', 'carrossel', 'post']
  },
  {
    id: 'pov-descoberta',
    label: 'POV -> descoberta',
    stages: ['POV de identificacao', 'tensao rapida', 'descoberta', 'saida pratica'],
    note: 'Ajuda o modo trend a parecer nativo.',
    tones: ['trend', 'genz'],
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'mito-ajuste',
    label: 'Mito -> ajuste',
    stages: ['crenca comum', 'quebra de expectativa', 'ajuste', 'CTA'],
    note: 'Funciona bem em carrossel e post.',
    formats: ['carrossel', 'post', 'reels']
  }
];

export const trendPatterns: TrendPattern[] = [
  {
    id: 'pov',
    label: 'POV',
    note: 'Abrir com situacao altamente identificavel.',
    openings: ['POV: voce esta vivendo isso agora', 'POV: voce tentou resolver isso e so piorou'],
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'expectativa-realidade',
    label: 'Expectativa vs realidade',
    note: 'Contraste rapido com humor ou choque.',
    openings: ['Expectativa: resolver isso rapido. Realidade: continuar presa no mesmo ciclo'],
    formats: ['reels', 'video_curto']
  },
  {
    id: 'antes-depois',
    label: 'Antes e depois',
    note: 'Traz prova visual e virada clara.',
    openings: ['Antes eu achava que isso era normal. Depois eu entendi o erro'],
    formats: ['reels', 'stories', 'carrossel']
  },
  {
    id: 'lista-curta',
    label: 'Lista curta',
    note: 'Formato facil de consumir e salvar.',
    openings: ['3 coisas que estao travando esse resultado', '2 sinais de que voce esta insistindo no erro'],
    formats: ['reels', 'video_curto', 'carrossel']
  },
  {
    id: 'ninguem-fala',
    label: 'Ninguem fala disso',
    note: 'Funciona como trend de curiosidade.',
    openings: ['Ninguem fala disso sobre esse problema', 'Tem uma parte que quase ninguem te conta'],
    formats: ['reels', 'stories', 'post']
  }
];

export const communicationStyles: CommunicationStyle[] = [
  {
    id: 'natural',
    label: 'Natural',
    notes: ['Fala como creator, nao como marca', 'Frases curtas', 'Tom de conversa real']
  },
  {
    id: 'autoridade',
    label: 'Autoridade',
    notes: ['Firmeza sem arrogancia', 'Explicar com clareza', 'Passar confianca logo no inicio']
  },
  {
    id: 'emocional',
    label: 'Emocional',
    notes: ['Comecar na dor sentida', 'Criar identificacao', 'Virada emocional antes da solucao']
  },
  {
    id: 'engracado',
    label: 'Engracado',
    notes: ['Leve ironia ou contraste', 'Nao virar piada forçada', 'Humor a favor da retencao']
  },
  {
    id: 'storytelling',
    label: 'Storytelling',
    notes: ['Mini-historia real', 'Antes -> problema -> descoberta -> virada', 'Produto so depois da tensao']
  },
  {
    id: 'educativo',
    label: 'Educativo',
    notes: ['Ensinar algo usavel', 'Explicar sem aula longa', 'Valor primeiro, produto depois']
  },
  {
    id: 'trend',
    label: 'Trend',
    notes: ['Formato nativo do momento', 'Mais ritmo, menos explicacao', 'Abrir com angulo que parece conteudo de feed']
  }
];

export const objectiveStrategies: ObjectiveStrategy[] = [
  {
    id: 'vender',
    label: 'Vender',
    notes: ['Produto entra como apoio concreto', 'Mostrar virada ou alivio', 'CTA mais direto no final'],
    ctaDirection: 'Levar para direct, comentario ou proximo passo'
  },
  {
    id: 'alcance',
    label: 'Alcance',
    notes: ['Hook mais amplo e identificavel', 'Mais curiosidade', 'Facil de compartilhar'],
    ctaDirection: 'Salvar, compartilhar ou marcar alguem'
  },
  {
    id: 'relacionamento',
    label: 'Relacionamento',
    notes: ['Primeira pessoa', 'Humanidade e vulnerabilidade controlada', 'Tom de conversa'],
    ctaDirection: 'Responder, acompanhar ou mandar mensagem'
  },
  {
    id: 'engajar',
    label: 'Engajar',
    notes: ['Pergunta ou provocacao no final', 'Abrir brecha para comentario', 'Construir friccao leve'],
    ctaDirection: 'Comentar ou reagir'
  },
  {
    id: 'educar',
    label: 'Educar',
    notes: ['Explicar com simplicidade', 'Entregar algo aproveitavel', 'Fechar com proximo passo claro'],
    ctaDirection: 'Salvar para rever'
  },
  {
    id: 'autoridade',
    label: 'Autoridade',
    notes: ['Tirar o superficial da frente', 'Mostrar leitura mais madura do problema', 'Passar seguranca'],
    ctaDirection: 'Continuar acompanhando ou pedir mais detalhes'
  }
];

export const strategicReferences: StrategicReference[] = [
  {
    id: 'academia-brasileira-social-media',
    label: 'Academia Brasileira de Social Media',
    focus: ['estrutura clara', 'gancho direto', 'linguagem de social media'],
    voice: ['objetivo', 'didatico sem ser academico', 'alto potencial de salvamento'],
    bestFor: ['carrossel', 'educativo', 'autoridade']
  },
  {
    id: 'plug-citarios',
    label: 'Plug Citarios',
    focus: ['copy magnetica', 'retencao', 'gancho forte'],
    voice: ['direto', 'provocativo', 'alto impacto'],
    bestFor: ['reels', 'alcance', 'vender']
  },
  {
    id: 'julia-becker',
    label: 'Julia Becker',
    focus: ['storytelling fluido', 'humanidade', 'conexao'],
    voice: ['natural', 'creator-first', 'leve e forte ao mesmo tempo'],
    bestFor: ['stories', 'storytelling', 'relacionamento']
  },
  {
    id: 'walter-azevedo-social-media-de-elite',
    label: 'Walter Azevedo / Social Media de Elite',
    focus: ['clareza estrategica', 'estrutura de performance', 'conteudo profissional'],
    voice: ['seguro', 'pratico', 'orientado a resultado'],
    bestFor: ['reels', 'carrossel', 'autoridade', 'vender']
  }
];

export const nichePatterns: NichePattern[] = [
  {
    id: 'wellness-emagrecimento',
    label: 'Bem-estar e emagrecimento',
    matchTerms: ['emagrec', 'peso', 'balanca', 'metabol', 'detox', 'tribulus', 'libido', 'energia', 'saude'],
    focus: ['quebra de crenca', 'rotina real', 'antes de falar do produto, falar do travamento'],
    contentAngles: ['erro que trava resultado', 'sinal silencioso', 'virada de rotina', 'antes vs depois percebido'],
    proofPoints: ['energia no dia a dia', 'consistencia', 'mudanca percebida', 'rotina simples']
  },
  {
    id: 'beleza-estetica',
    label: 'Beleza e estetica',
    matchTerms: ['pele', 'cabelo', 'estetica', 'beleza', 'skincare', 'rejuven', 'flacidez', 'colageno'],
    focus: ['resultado visivel', 'textura e sensacao', 'quebra de expectativa sobre milagre rapido'],
    contentAngles: ['mito vs realidade', 'antes de desistir', 'erro de rotina', 'detalhe que muda percepcao'],
    proofPoints: ['textura', 'brilho', 'consistencia de uso', 'processo visual']
  },
  {
    id: 'moda-estilo',
    label: 'Moda e estilo',
    matchTerms: ['look', 'moda', 'estilo', 'roupa', 'vestido', 'sapato', 'armario', 'acessorio'],
    focus: ['identificacao imediata', 'transformacao visual', 'composicao facil de repetir'],
    contentAngles: ['3 jeitos de usar', 'erro que envelhece o look', 'antes vs depois do styling', 'peca coringa'],
    proofPoints: ['caimento', 'combinacao', 'versatilidade', 'efeito visual']
  },
  {
    id: 'marketing-negocios',
    label: 'Marketing e negocios',
    matchTerms: ['marketing', 'conteudo', 'social media', 'lead', 'venda', 'faturamento', 'copy', 'negocio'],
    focus: ['clareza estrategica', 'erro operacional', 'insight aplicavel na hora'],
    contentAngles: ['erro que custa venda', '3 ajustes simples', 'ninguem fala disso', 'bastidor de estrategia'],
    proofPoints: ['resultado', 'processo', 'otimizacao', 'economia de tempo']
  },
  {
    id: 'educacao-conhecimento',
    label: 'Educacao e conhecimento',
    matchTerms: ['curso', 'aula', 'aprend', 'ensino', 'mentor', 'aluno', 'conhecimento', 'estudo'],
    focus: ['ensino curto', 'quebra de complexidade', 'proximo passo claro'],
    contentAngles: ['erro de iniciante', 'atalho mental', 'passo a passo enxuto', 'o que muda tudo'],
    proofPoints: ['clareza', 'aplicacao pratica', 'resultado do aluno', 'metodo']
  },
  {
    id: 'servicos-locais',
    label: 'Servicos locais e atendimento',
    matchTerms: ['clinica', 'consultorio', 'agenda', 'atendimento', 'cliente', 'servico', 'consulta', 'procedimento'],
    focus: ['confianca', 'prova de bastidor', 'duvida comum do cliente'],
    contentAngles: ['o que o cliente nao sabe', 'como funciona de verdade', 'erro antes de contratar', 'bastidor seguro'],
    proofPoints: ['processo', 'seguranca', 'resultado esperado', 'atendimento']
  },
  {
    id: 'generic-performance',
    label: 'Conteudo de performance geral',
    matchTerms: [],
    focus: ['gancho claro', 'identificacao rapida', 'CTA acionavel'],
    contentAngles: ['erro comum', 'virada percebida', 'lista curta', 'frase de identificacao'],
    proofPoints: ['resultado percebido', 'clareza', 'simplicidade', 'acao']
  }
];

export const hookCategories: HookCategory[] = [
  {
    id: 'curiosidade',
    label: 'Curiosidade',
    examples: [
      'Existe um detalhe sobre [tema] que muda tudo — e quase ninguem sabe.',
      'Voce sabe o que acontece com [resultado] quando voce faz [acao] errado?',
      'Tem uma coisa sobre [produto/tema] que eu nao vi ninguem explicar direito.',
      'Por que [resultado esperado] nao acontece mesmo quando voce [acao comum]?',
      'O que esta por tras de [tema] que a maioria ignora completamente.'
    ],
    formats: ['reels', 'stories', 'video_curto', 'carrossel', 'post'],
    objectives: ['alcance', 'engajar']
  },
  {
    id: 'erro-comum',
    label: 'Erro comum',
    examples: [
      'O erro mais comum de quem tenta [resultado]: [erro especifico].',
      'A maioria das pessoas faz isso e nao percebe que esta sabotando [resultado].',
      'Se voce esta fazendo [acao comum], pode estar piorando [resultado] sem saber.',
      'Esse erro simples esta travando tudo que voce tenta em [tema].',
      'Quase todo mundo comeca por [acao errada] — e ai o resultado nunca vem.'
    ],
    formats: ['reels', 'carrossel', 'video_curto', 'post'],
    objectives: ['alcance', 'educar']
  },
  {
    id: 'mito',
    label: 'Mito',
    examples: [
      '[Crenca popular] — isso nao funciona do jeito que voce pensa.',
      'Todo mundo diz para fazer [acao]. Eu testei e descobri algo diferente.',
      'O mito mais perigoso sobre [tema] que ainda engana muita gente.',
      'Acreditar nessa crenca sobre [tema] pode estar custando [resultado] para voce.',
      'Isso e mito. E crer nisso pode estar te travando ha mais tempo do que voce imagina.'
    ],
    formats: ['reels', 'carrossel', 'post', 'video_curto'],
    objectives: ['alcance', 'autoridade']
  },
  {
    id: 'verdade-chocante',
    label: 'Verdade chocante',
    examples: [
      '[Numero ou fato inesperado] sobre [tema] — e a maioria nao sabe.',
      'Ninguem fala disso sobre [resultado], mas muda completamente a perspectiva.',
      'A verdade sobre [tema] que as pessoas preferem nao ouvir.',
      'Descobri algo sobre [produto/tema] que nao esperava encontrar.',
      'Esse dado sobre [tema] muda tudo que voce achava que sabia.'
    ],
    formats: ['reels', 'carrossel', 'post', 'video_curto', 'stories'],
    objectives: ['alcance', 'autoridade', 'engajar']
  },
  {
    id: 'comparacao',
    label: 'Comparação',
    examples: [
      '[Opcao A] vs [Opcao B]: o que realmente funciona melhor para [resultado].',
      'Fiz os dois jeitos. A diferenca foi [resultado concreto].',
      'Testei [opcao A] por [tempo]. Depois tentei [opcao B]. O resultado foi esse.',
      'Por que [opcao A] ganha de [opcao B] quando o objetivo e [resultado].',
      'Dois caminhos para [resultado]. Um funciona. O outro nao. Olha a diferenca.'
    ],
    formats: ['reels', 'carrossel', 'video_curto', 'post'],
    objectives: ['alcance', 'educar', 'autoridade']
  },
  {
    id: 'antes-depois',
    label: 'Antes e depois',
    examples: [
      'Antes eu [situacao negativa]. Depois de [acao], [mudanca especifica].',
      'Eu era a pessoa que [situacao antiga]. Nao sou mais.',
      'O que mudou em [periodo] quando eu parei de [acao antiga] e comecei [nova acao].',
      'Ha [tempo], eu nao conseguia [resultado]. Hoje e completamente diferente.',
      'Antes: [estado antigo]. Depois: [estado novo]. O que fez essa diferenca.'
    ],
    formats: ['reels', 'stories', 'carrossel', 'video_curto'],
    objectives: ['alcance', 'relacionamento', 'vender']
  },
  {
    id: 'lista',
    label: 'Lista',
    examples: [
      '[N] coisas que estao te impedindo de [resultado].',
      '[N] erros que a maioria comete ao tentar [resultado].',
      '[N] habitos de quem realmente consegue [resultado] — e quase ninguem fala.',
      '[N] sinais de que [situacao negativa] esta acontecendo com voce.',
      '[N] passos que eu usei para [resultado] sem complicar.'
    ],
    formats: ['reels', 'carrossel', 'video_curto', 'stories'],
    objectives: ['alcance', 'engajar', 'educar']
  },
  {
    id: 'alerta',
    label: 'Alerta',
    examples: [
      'Cuidado com [acao comum]: pode estar sabotando [resultado] sem que voce perceba.',
      'Se voce continuar fazendo isso, [consequencia negativa real].',
      'Isso pode estar acontecendo com voce agora mesmo — sem que voce saiba.',
      'Para antes de [acao] sem ler isso.',
      'Existe um sinal de que [problema silencioso] que a maioria ignora.'
    ],
    formats: ['reels', 'stories', 'video_curto', 'post'],
    objectives: ['alcance', 'engajar']
  },
  {
    id: 'segredo',
    label: 'Segredo',
    examples: [
      'O que [grupo especifico] faz diferente que ninguem conta.',
      'Tem uma parte do processo que ninguem mostra nos bastidores.',
      'O segredo de quem consegue [resultado] nao e [crenca popular] — e [segredo real].',
      'Aprendi isso depois de [tempo/experiencia] e nao vi mais ninguem explicar assim.',
      'Isso aqui eu so comecei a contar porque vi que muita gente precisa saber.'
    ],
    formats: ['reels', 'stories', 'video_curto', 'post'],
    objectives: ['alcance', 'relacionamento', 'vender']
  },
  {
    id: 'historia-pessoal',
    label: 'História pessoal',
    examples: [
      'Tentei [acao] por [periodo] e nao conseguia [resultado]. Ate que [mudanca].',
      'Eu era exatamente a pessoa que [situacao]. Isso mudou quando [virada].',
      'Nao vou mentir: a primeira vez que tentei [acao], [resultado negativo].',
      'Passei por [experiencia dificil]. O que aprendi nisso mudou minha relacao com [tema].',
      'Tem uma historia que eu nunca conto sobre [tema]. E essa.'
    ],
    formats: ['reels', 'stories', 'video_curto'],
    objectives: ['relacionamento', 'vender', 'alcance']
  },
  {
    id: 'identificacao',
    label: 'Identificação',
    examples: [
      'Se voce e aquele tipo de pessoa que [comportamento identificavel], isso e pra voce.',
      'Para quem ja tentou de tudo em [tema] e esta chegando perto de desistir.',
      'Se voce acorda ja pensando em [preocupacao comum], talvez isso explique o por que.',
      'Voce conhece aquela sensacao de [situacao frustrante comum]?',
      'Isso e pra quem vive [situacao identificavel] e ja nao sabe mais o que tentar.'
    ],
    formats: ['reels', 'stories', 'video_curto', 'post'],
    objectives: ['relacionamento', 'alcance', 'vender']
  },
  {
    id: 'pov',
    label: 'POV',
    examples: [
      'POV: voce tenta [resultado] do jeito errado ha [tempo].',
      'POV: voce descobre que [crenca que tinha] era errada.',
      'POV: sua primeira semana usando [produto/metodo].',
      'POV: voce percebe que [situacao reveladora].',
      'POV: voce finalmente entende por que [resultado nao vinha].'
    ],
    formats: ['reels', 'stories', 'video_curto'],
    objectives: ['alcance', 'engajar']
  },
  {
    id: 'rotina',
    label: 'Rotina',
    examples: [
      'O que acontece na minha rotina todo dia que ajuda com [resultado].',
      'Eu mudei [parte da rotina] e isso foi o que mais impactou [resultado].',
      'A rotina que eu mantenho desde [periodo] para [resultado].',
      'Um dia na vida de quem [resultado desejado] sem esforco excessivo.',
      'Essa habito simples na minha rotina mudou completamente [resultado].'
    ],
    formats: ['reels', 'stories', 'video_curto'],
    objectives: ['relacionamento', 'alcance']
  },
  {
    id: 'experimento',
    label: 'Teste / Experimento',
    examples: [
      'Fiz [experimento] por [periodo] e esse foi o resultado.',
      'Testei [produto/metodo] por [tempo] — aqui esta a avaliacao honesta.',
      'Eu mesmo experimentei [acao] antes de indicar pra alguem.',
      'Coloquei [metodo] a prova por [periodo]. Vale a pena?',
      'Resolvi testar isso por [periodo] e documentar tudo. Resultado:'
    ],
    formats: ['reels', 'video_curto', 'carrossel'],
    objectives: ['autoridade', 'alcance', 'vender']
  },
  {
    id: 'resultado-inesperado',
    label: 'Resultado inesperado',
    examples: [
      'Eu nao esperava esse resultado quando comecei [acao].',
      'Comecei fazendo por [motivo]. O que aconteceu depois nao estava nos planos.',
      'Esperava [resultado X]. Consegui [resultado Y] — nao sabia se animava ou assustava.',
      'O lado inesperado de [produto/metodo] que so descobri depois de [periodo].',
      'Achei que ia ser [expectativa]. O que aconteceu foi outra coisa.'
    ],
    formats: ['reels', 'video_curto', 'stories'],
    objectives: ['alcance', 'relacionamento', 'engajar']
  },
  {
    id: 'pergunta-forte',
    label: 'Pergunta forte',
    examples: [
      'Quando foi a ultima vez que voce [acao desejada] sem sentir [empecilho comum]?',
      'Por que [grupo] consegue [resultado] e outros nao, mesmo fazendo as mesmas coisas?',
      'Voce ja parou para pensar por que [situacao problematica] continua acontecendo?',
      'O que seria diferente na sua vida se voce resolvesse [dor] de vez?',
      'Ha quanto tempo voce esta tentando [resultado] sem realmente conseguir?'
    ],
    formats: ['reels', 'stories', 'post', 'video_curto'],
    objectives: ['relacionamento', 'engajar', 'vender']
  },
  {
    id: 'frase-polemica',
    label: 'Frase polêmica',
    examples: [
      'Voce nao precisa de [solucao popular] para [resultado]. Precisa disso.',
      '[Afirmacao contraria ao senso comum sobre tema].',
      'Discordo de tudo que dizem sobre [tema]. E tenho motivo.',
      '[Tema] nao e sobre [crenca popular]. E sobre [verdade alternativa].',
      'O maior erro de quem busca [resultado] nao e o que voce esta pensando.'
    ],
    formats: ['reels', 'post', 'video_curto', 'carrossel'],
    objectives: ['alcance', 'autoridade', 'engajar']
  },
  {
    id: 'quebra-expectativa',
    label: 'Quebra de expectativa',
    examples: [
      'Achei que ia funcionar. Nao funcionou. Ai tentei o contrario.',
      'Todo mundo dizia que [acao A] era melhor. Eu testei [acao B] por curiosidade.',
      'Nao e o que eu esperava — e por isso valeu mais ainda.',
      'Preparei tudo para [resultado esperado]. O que aconteceu foi diferente.',
      'Comecei com a expectativa errada. O resultado foi melhor do que eu merecia.'
    ],
    formats: ['reels', 'stories', 'video_curto', 'carrossel'],
    objectives: ['alcance', 'engajar', 'relacionamento']
  }
];

export const ctaCategories: CtaCategory[] = [
  {
    id: 'vendas',
    label: 'Vendas',
    objective: 'vender',
    examples: [
      'Chama no direct e eu te mostro como aplicar isso no seu caso.',
      'Comenta [palavra-chave] que eu te mando o proximo passo.',
      'Clica no link da bio para ver as opcoes disponiveis.',
      'Me manda uma mensagem com [palavra] que te explico tudo.',
      'Acessa o link na bio — deixei tudo explicado la com preco e condicoes.'
    ]
  },
  {
    id: 'engajamento',
    label: 'Engajamento',
    objective: 'engajar',
    examples: [
      'Salva isso aqui para nao perder quando precisar.',
      'Manda para alguem que precisa ver isso agora.',
      'Comenta embaixo o que voce acha disso.',
      'Qual das opcoes faz mais sentido pra voce? Responde aqui.',
      'Comenta com um emoji se voce se identificou.'
    ]
  },
  {
    id: 'relacionamento',
    label: 'Relacionamento',
    objective: 'relacionamento',
    examples: [
      'Me conta aqui nos comentarios como voce esta vivendo isso.',
      'Responde esse story — quero saber sua experiencia.',
      'Se isso fez sentido, continua comigo que tem mais.',
      'Manda uma mensagem se quiser conversar sobre isso.',
      'Me conta: isso ja aconteceu com voce tambem?'
    ]
  },
  {
    id: 'autoridade',
    label: 'Autoridade',
    objective: 'autoridade',
    examples: [
      'Salva esse conteudo para rever quando precisar.',
      'Compartilha com quem ainda nao sabe disso.',
      'Continua me acompanhando que eu aprofundo esse tema.',
      'Se voce quer entender mais sobre isso, me pergunta nos comentarios.',
      'Ativa o sininho para nao perder o proximo conteudo sobre isso.'
    ]
  },
  {
    id: 'comunidade',
    label: 'Comunidade',
    objective: 'alcance',
    examples: [
      'Marca uma pessoa que vai se identificar com isso.',
      'Manda nos stories para quem esta passando por isso.',
      'Me conta nos comentarios se voce tambem viveu isso.',
      'Compartilha isso para quem precisa ouvir hoje.',
      'Tag alguem que esta tentando [resultado] e nao esta conseguindo.'
    ]
  },
  {
    id: 'direct',
    label: 'Direct / DM',
    objective: 'vender',
    examples: [
      'Me chama no direct com [palavra] para comecar.',
      'Envia uma mensagem que eu te respondo pessoalmente.',
      'Chama no DM — vamos conversar sobre o seu caso especifico.',
      'Me manda uma mensagem hoje e te mostro por onde comecar.',
      'Manda um direct com sua situacao que te oriento.'
    ]
  },
  {
    id: 'comentarios',
    label: 'Comentários',
    objective: 'engajar',
    examples: [
      'Comenta [palavra] aqui embaixo.',
      'Responde nos comentarios: voce ja viveu isso?',
      'Me conta aqui: qual parte se aplicou mais a voce?',
      'Comenta com [emoji] se voce se identificou.',
      'Escreve aqui embaixo a sua maior dificuldade com [tema].'
    ]
  },
  {
    id: 'salvar',
    label: 'Salvar',
    objective: 'engajar',
    examples: [
      'Salva esse video para assistir de novo quando precisar.',
      'Deixa salvo — esse conteudo vai ser util nos proximos dias.',
      'Salva aqui agora para nao perder isso.',
      'Vai no saved e guarda esse conteudo — voce vai querer rever.',
      'Salva antes de sair — esse conteudo tem muito mais do que parece na primeira vez.'
    ]
  },
  {
    id: 'compartilhar',
    label: 'Compartilhar',
    objective: 'alcance',
    examples: [
      'Manda esse video para quem precisa ouvir isso agora.',
      'Compartilha nos stories se isso fez sentido pra voce.',
      'Tag alguem que esta passando por isso.',
      'Manda para quem voce sabe que vai aproveitar.',
      'Reposte nos seus stories se isso se aplicou a voce.'
    ]
  },
  {
    id: 'seguir',
    label: 'Seguir perfil',
    objective: 'relacionamento',
    examples: [
      'Me segue aqui para mais conteudos como esse.',
      'Ativa o sininho para nao perder o proximo.',
      'Continua aqui comigo — tem muito mais vindo.',
      'Segue o perfil que eu posto isso toda semana.',
      'Me segue que eu continuo esse assunto nos proximos conteudos.'
    ]
  },
  {
    id: 'link-bio',
    label: 'Clique no link',
    objective: 'vender',
    examples: [
      'Link na bio com mais informacoes.',
      'Acessa o link para ver como funciona em detalhes.',
      'Clica no link da bio — deixei tudo explicado la.',
      'Entra no link e ve as opcoes disponiveis para voce.',
      'O link na bio tem tudo que voce precisa para comecar.'
    ]
  },
  {
    id: 'responder-story',
    label: 'Responder story',
    objective: 'relacionamento',
    examples: [
      'Responde esse story com [palavra] que eu te mando mais.',
      'Manda uma resposta aqui — quero saber o que achou.',
      'Responde esse story com sua situacao.',
      'Me fala nessa resposta o que voce esta enfrentando.',
      'Responde aqui e eu te mando o conteudo completo.'
    ],
    formats: ['stories']
  },
  {
    id: 'caixinha',
    label: 'Caixa de pergunta',
    objective: 'engajar',
    examples: [
      'Manda sua pergunta na caixinha — respondo todas.',
      'Usa a caixinha de perguntas para mandar seu caso.',
      'Manda sua duvida ali na caixinha.',
      'Quero saber o que voce quer ver mais — usa a caixinha.',
      'Pergunta na caixinha que eu respondo no proximo story.'
    ],
    formats: ['stories']
  }
];

export const storytellingModels: StorytellingModel[] = [
  {
    id: 'historia-pessoal',
    label: 'História pessoal',
    stages: ['situacao real vivida', 'problema concreto', 'tentativa que nao funcionou', 'virada especifica', 'estado atual com produto como apoio'],
    note: 'Creator conta na primeira pessoa. Produto entra como revelacao, nao como solucao magica.',
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'caso-de-cliente',
    label: 'Caso de cliente',
    stages: ['quem era o cliente (sem expor nome)', 'dor que ele trazia', 'o que tentou antes', 'o que mudou com o produto', 'resultado especifico e mensuravel'],
    note: 'Prova social real. Manter privacidade mas ser especifico nos resultados.',
    formats: ['reels', 'carrossel', 'video_curto', 'stories']
  },
  {
    id: 'antes-depois',
    label: 'Antes e depois',
    stages: ['estado anterior vivido (real e especifico)', 'ponto de virada (o que mudou)', 'estado atual (concreto)', 'o que fez diferenca'],
    note: 'Contraste visual e narrativo. Nao exagerar o antes nem o depois.',
    formats: ['reels', 'carrossel', 'stories', 'post']
  },
  {
    id: 'descoberta',
    label: 'Descoberta',
    stages: ['provocacao ou dado surpreendente', 'contexto que justifica a revelacao', 'a descoberta em si', 'impacto pratico na vida real'],
    note: 'Gera curiosidade e autoridade ao mesmo tempo. Funciona bem para alcance.',
    formats: ['reels', 'carrossel', 'video_curto', 'post']
  },
  {
    id: 'erro-aprendizado',
    label: 'Erro → Aprendizado',
    stages: ['o erro concreto cometido', 'o que aconteceu por causa dele', 'o que aprendi com isso', 'como aplicar hoje para evitar o mesmo'],
    note: 'Vulnerabilidade controlada gera identificacao. Nao expor fraqueza demais.',
    formats: ['reels', 'carrossel', 'video_curto', 'stories']
  },
  {
    id: 'rotina-mudanca-resultado',
    label: 'Rotina → Mudança → Resultado',
    stages: ['rotina antiga (especifica e identificavel)', 'o que mudou e por que', 'nova rotina (o que faz diferente hoje)', 'resultado ao longo do tempo'],
    note: 'Autentico e relatavel. Melhor para relacionamento e lifestyle.',
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'problema-tentativa-solucao',
    label: 'Problema → Tentativa → Solução',
    stages: ['descricao do problema (vivido, nao generico)', 'tentativas que nao funcionaram', 'solucao que funcionou', 'convite ao espectador para tentar'],
    note: 'Classico e eficaz. Produto entra na solucao, nao na abertura.',
    formats: ['reels', 'carrossel', 'video_curto']
  },
  {
    id: 'eu-achava-ate-descobrir',
    label: '"Eu achava que… até descobrir que…"',
    stages: ['crenca anterior vivida e identificavel', 'o que desafiou essa crenca (evento ou informacao)', 'a descoberta que mudou tudo', 'nova posicao e como aplicar'],
    note: 'Mudanca de perspectiva gera alto engajamento. Publico se ve na crenca antiga.',
    formats: ['reels', 'post', 'video_curto', 'carrossel']
  },
  {
    id: 'mini-jornada',
    label: 'Mini jornada',
    stages: ['contexto rapido que situa o espectador', 'tensao breve ou problema', 'virada ou insight', 'saida pratica ou CTA'],
    note: 'Versao comprimida de storytelling. Ideal para videos curtos e stories.',
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'duas-pessoas',
    label: 'Comparação de duas pessoas',
    stages: ['persona A (faz certo ou tem resultado)', 'persona B (faz errado ou nao tem resultado)', 'o que faz diferenca entre as duas', 'identificacao e convite'],
    note: 'Contraste cria clareza. Publico se identifica com uma das personas.',
    formats: ['reels', 'carrossel', 'video_curto']
  },
  {
    id: 'dia-a-dia',
    label: 'Dia a dia',
    stages: ['contexto de rotina (onde esta, o que esta fazendo)', 'situacao do dia relacionada ao tema', 'percepcao ou resultado natural', 'convite a aplicar'],
    note: 'Formato de vlog rapido. Autentico e sem roteiro aparente.',
    formats: ['reels', 'stories', 'video_curto']
  },
  {
    id: 'tres-atos',
    label: 'Narrativa em 3 atos',
    stages: ['ato 1: mundo comum + problema (contexto e dor)', 'ato 2: tentativa + conflito + virada (a historia em si)', 'ato 3: resolucao + CTA (novo estado e convite)'],
    note: 'Estrutura classica de storytelling adaptada para conteudo curto. Mais elaborado.',
    formats: ['reels', 'video_curto', 'carrossel']
  }
];

export const formatSubtypes: FormatSubtype[] = [
  { id: 'lista', label: 'Lista', format: 'reels', description: 'Enumera [N] itens com progressao de valor. Cada item e um corte.' },
  { id: 'storytelling', label: 'Storytelling', format: 'reels', description: 'Narrativa pessoal com tensao, virada e resultado. Produto entra no meio.' },
  { id: 'pov', label: 'POV', format: 'reels', description: 'Abre com POV especifico. Publico entra na situacao do creator.' },
  { id: 'antes-depois', label: 'Antes e depois', format: 'reels', description: 'Contraste entre estado anterior e atual. Visual forte de transformacao.' },
  { id: 'rotina', label: 'Rotina', format: 'reels', description: 'Mostra habito ou rotina real do creator relacionada ao tema.' },
  { id: 'dica-rapida', label: 'Dica rápida', format: 'reels', description: 'Uma dica acionavel entregue de forma direta e sem rodeios.' },
  { id: 'erro-comum', label: 'Erro comum', format: 'reels', description: 'Expoe um erro que a maioria comete. Gera identificacao e salvamento.' },
  { id: 'mitos-verdades', label: 'Mitos e verdades', format: 'reels', description: 'Desmonta crencas populares sobre o tema com informacao real.' },
  { id: 'transformacao', label: 'Transformacao', format: 'reels', description: 'Jornada de mudanca visivel. Foco no processo, nao so no resultado.' },
  { id: 'narracao-broll', label: 'Narração + B-roll', format: 'reels', description: 'Voz sobre imagens. Creator nao aparece na camera principal.' },
  { id: 'texto-tela', label: 'Texto na tela', format: 'reels', description: 'Conteudo em texto animado. Funciona com ou sem audio.' },
  { id: 'trend', label: 'Trend adaptada', format: 'reels', description: 'Formato viral do momento adaptado para o nicho do creator.' },
  { id: 'comparacao', label: 'Comparação', format: 'reels', description: 'Contrasta opcoes, metodos ou situacoes. Cria clareza de escolha.' },
  { id: 'tutorial', label: 'Tutorial', format: 'reels', description: 'Ensina como fazer algo passo a passo de forma visual.' },
  { id: 'bastidores', label: 'Bastidores', format: 'reels', description: 'Mostra o que acontece por tras, sem edicao elaborada.' },
  { id: 'review', label: 'Review', format: 'reels', description: 'Avaliacao honesta de produto ou metodo com pros e contras.' },
  { id: 'reacao', label: 'Reação', format: 'reels', description: 'Reage a algo (conteudo, dado, situacao) de forma autenticao.' },
  { id: 'opiniao', label: 'Opinião', format: 'reels', description: 'Posicao clara e fundamentada sobre tema do nicho.' },
  { id: 'stories-educativo', label: 'Sequência educativa', format: 'stories', description: 'Ensina algo slide a slide com progressao de conhecimento.' },
  { id: 'stories-storytelling', label: 'Storytelling em stories', format: 'stories', description: 'Historia contada em slides com tensao crescente ate o final.' },
  { id: 'stories-bastidores', label: 'Bastidores', format: 'stories', description: 'Mostra processo, preparacao ou rotina de forma espontanea.' },
  { id: 'stories-rotina', label: 'Rotina', format: 'stories', description: 'Documenta o dia ou habito relacionado ao tema.' },
  { id: 'stories-prova-social', label: 'Prova social', format: 'stories', description: 'Mostra resultados de clientes ou depoimentos em slides.' },
  { id: 'stories-conversa', label: 'Conversa direta', format: 'stories', description: 'Creator falando diretamente para o seguidor como numa conversa.' },
  { id: 'stories-caixinha', label: 'Caixinha de perguntas', format: 'stories', description: 'Responde perguntas enviadas pela audiencia.' },
  { id: 'stories-enquete', label: 'Enquete', format: 'stories', description: 'Usa enquetes para engajar e entender a audiencia.' },
  { id: 'stories-lista', label: 'Lista em stories', format: 'stories', description: 'Enumera itens em slides consecutivos com ritmo rapido.' },
  { id: 'stories-dica', label: 'Dica rápida', format: 'stories', description: 'Entrega 1 dica acionavel em 2-3 slides maximos.' },
  { id: 'stories-venda', label: 'Venda em sequência', format: 'stories', description: 'Sequencia de aquecimento, prova e CTA de venda em stories.' },
  { id: 'stories-aquecimento', label: 'Aquecimento', format: 'stories', description: 'Prepara a audiencia para um lancamento ou conteudo maior.' },
  { id: 'stories-objecao', label: 'Quebra de objeção', format: 'stories', description: 'Responde objecoes comuns de forma direta e honesta.' }
];

export const contentContexts: ContentContext[] = [
  { id: 'rotina', label: 'Rotina', visualDescription: 'Gravado no dia a dia, ambiente natural, sem producao elaborada.' },
  { id: 'bastidores', label: 'Bastidores', visualDescription: 'Mostrando o processo de trabalho ou preparacao por tras.' },
  { id: 'trabalho', label: 'Trabalho', visualDescription: 'Contexto profissional, escritorio ou home office ao fundo.' },
  { id: 'casa', label: 'Casa', visualDescription: 'Ambiente domestico — cozinha, sala ou quarto como cenario.' },
  { id: 'carro', label: 'Carro', visualDescription: 'Gravado dentro do carro, tom de reflexao ou relato rapido.' },
  { id: 'academia', label: 'Academia', visualDescription: 'Contexto de treino ou saude, roupas de atividade, ambiente de academia.' },
  { id: 'escritorio', label: 'Escritório', visualDescription: 'Ambiente formal de trabalho, mesa arrumada, fundo neutro.' },
  { id: 'rua', label: 'Rua', visualDescription: 'Gravado em ambiente externo, rua ou espaco publico ao fundo.' },
  { id: 'selfie', label: 'Selfie', visualDescription: 'Camera frontal, rosto em foco, tom direto e pessoal.' },
  { id: 'conversa', label: 'Conversando com alguém', visualDescription: 'Dinamica de conversa, entrevista ou dialogo com outra pessoa.' },
  { id: 'narracao', label: 'Narração', visualDescription: 'Voz em cima de imagens ou video, creator pode nao aparecer.' },
  { id: 'texto-tela', label: 'Texto na tela', visualDescription: 'Conteudo em formato de texto animado, sem necessitar rosto.' },
  { id: 'mostrando-produto', label: 'Mostrando produto', visualDescription: 'Produto em uso ou em destaque visual, demonstracao.' },
  { id: 'sem-produto', label: 'Sem mostrar produto', visualDescription: 'Foco na mensagem falada, produto mencionado mas nao exibido.' },
  { id: 'lifestyle', label: 'Lifestyle', visualDescription: 'Cenas de vida do creator, natural e aspiracional ao mesmo tempo.' },
  { id: 'problema-dia', label: 'Problema do dia a dia', visualDescription: 'Encenacao ou situacao real e identificavel do cotidiano.' },
  { id: 'situacao-constr', label: 'Situação constrangedora', visualDescription: 'Humor ou identificacao com situacao desconfortavel e real.' },
  { id: 'pensamento-voz-alta', label: 'Pensamento em voz alta', visualDescription: 'Reflexao informal, tom de quem esta processando algo em tempo real.' },
  { id: 'desabafo', label: 'Desabafo', visualDescription: 'Vulnerabilidade controlada, tom de conversa intima e honesta.' },
  { id: 'dica', label: 'Dica', visualDescription: 'Formato de ensinamento curto e direto, postura de quem ensina.' },
  { id: 'aula-rapida', label: 'Aula rápida', visualDescription: 'Estrutura de ensino compacta com começo, meio e fim didatico.' }
];
