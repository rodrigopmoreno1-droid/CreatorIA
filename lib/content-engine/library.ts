import type {
  CommunicationStyle,
  CtaPattern,
  FormatBlueprint,
  HookPattern,
  NichePattern,
  ObjectiveStrategy,
  StrategicReference,
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
