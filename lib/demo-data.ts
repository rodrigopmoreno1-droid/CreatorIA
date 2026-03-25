import type { ModuleKey } from '@/types';

type CountBadge = {
  label: string;
  value: string;
  trend?: string;
};

export type WorkspaceSnapshot = {
  slug: string;
  name: string;
  company: string;
  industry: string;
  plan: string;
  theme: string;
  members: number;
  quickStats: CountBadge[];
  agenda: Array<{
    id: string;
    title: string;
    type: string;
    time: string;
    owner: string;
    color: string;
  }>;
  stories: Array<{
    id: string;
    title: string;
    hook: string;
    status: string;
    time: string;
  }>;
  posts: Array<{
    id: string;
    title: string;
    channel: string;
    status: string;
    scheduledAt: string;
    engagement: string;
    tags: string[];
  }>;
  pipelineCards: Array<{
    id: string;
    title: string;
    column: string;
    assignee: string;
    tags: string[];
    priority: 'low' | 'medium' | 'high';
  }>;
  assets: Array<{
    id: string;
    title: string;
    type: string;
    tag: string;
    source: string;
    size: string;
  }>;
  ideas: Array<{
    id: string;
    title: string;
    hook: string;
    source: string;
    score: number;
    tags: string[];
  }>;
  scripts: Array<{
    id: string;
    title: string;
    hook: string;
    beats: string[];
    cta: string;
  }>;
  calendarEvents: Array<{
    id: string;
    title: string;
    date: string;
    type: string;
    owner: string;
  }>;
  metrics: {
    series: Array<{
      name: string;
      points: Array<{ label: string; value: number }>;
    }>;
    summary: CountBadge[];
  };
  competitors: Array<{
    id: string;
    name: string;
    handle: string;
    posts: number;
    engagement: string;
    insight: string;
    sentiment: string;
    topPosts: Array<{
      title: string;
      format: string;
      metric: string;
    }>;
  }>;
  products: Array<{
    id: string;
    name: string;
    benefit: string;
    audience: string;
    price: string;
    restrictions: string;
    tags: string[];
  }>;
  creators: Array<{
    id: string;
    name: string;
    handle: string;
    niche: string;
    history: string;
    metrics: string;
    accent: string;
  }>;
  featureFlags: Array<{
    id: string;
    name: string;
    enabled: boolean;
    description: string;
    scope: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    date: string;
    amount: string;
    status: string;
  }>;
  usage: Array<{
    metric: string;
    used: number;
    limit: number;
  }>;
  notes: Array<{
    id: string;
    title: string;
    body: string;
    author: string;
  }>;
};

const sharedMetrics = {
  series: [
    {
      name: 'Alcance',
      points: [
        { label: 'Seg', value: 420 },
        { label: 'Ter', value: 650 },
        { label: 'Qua', value: 910 },
        { label: 'Qui', value: 760 },
        { label: 'Sex', value: 1120 },
        { label: 'Sáb', value: 940 },
        { label: 'Dom', value: 1280 }
      ]
    },
    {
      name: 'Engajamento',
      points: [
        { label: 'Seg', value: 120 },
        { label: 'Ter', value: 180 },
        { label: 'Qua', value: 220 },
        { label: 'Qui', value: 210 },
        { label: 'Sex', value: 260 },
        { label: 'Sáb', value: 240 },
        { label: 'Dom', value: 300 }
      ]
    }
  ],
  summary: [
    { label: 'Alcance', value: '48,2k', trend: '+18%' },
    { label: 'Curtidas', value: '4,8k', trend: '+12%' },
    { label: 'Comentários', value: '612', trend: '+9%' },
    { label: 'Crescimento', value: '+24%', trend: '7 dias' }
  ]
};

const sharedAssets = [
  {
    id: 'asset-1',
    title: 'Campanha Verão 01',
    type: 'Video',
    tag: 'Campanha',
    source: 'Google Drive',
    size: '1.2 GB'
  },
  {
    id: 'asset-2',
    title: 'Pack de ganchos',
    type: 'Docs',
    tag: 'Ideias',
    source: 'Drive',
    size: '82 MB'
  },
  {
    id: 'asset-3',
    title: 'Storyframes IG',
    type: 'PNG',
    tag: 'Stories',
    source: 'Upload',
    size: '18 MB'
  },
  {
    id: 'asset-4',
    title: 'Miniaturas Reels',
    type: 'JPG',
    tag: 'Reels',
    source: 'Drive',
    size: '240 MB'
  }
];

const sharedCompetitors = [
  {
    id: 'comp-1',
    name: 'Studio Glow',
    handle: '@studioglow',
    posts: 28,
    engagement: '7,8%',
    insight: 'Reels com bastidores performam melhor do que posts estáticos.',
    sentiment: 'Positivo',
    topPosts: [
      { title: 'Antes e depois do set', format: 'Reel', metric: '124k views' },
      { title: 'Checklist de gravação', format: 'Carousel', metric: '8,2k saves' }
    ]
  },
  {
    id: 'comp-2',
    name: 'Brand Lab',
    handle: '@brandlab',
    posts: 19,
    engagement: '5,1%',
    insight: 'Stories com CTA direto para DM geram mais leads qualificados.',
    sentiment: 'Neutro',
    topPosts: [
      { title: '3 erros em lançamentos', format: 'Reel', metric: '96k views' },
      { title: 'Template de briefing', format: 'Story', metric: '2,1k respostas' }
    ]
  }
];

const sharedCreators = [
  {
    id: 'creator-1',
    name: 'Marina Souza',
    handle: '@marinasouza',
    niche: 'Lifestyle',
    history: 'Criadora parceira desde 2023, foco em lançamentos e moda.',
    metrics: '1,4M seguidores · 6,8% engajamento',
    accent: 'from-pink-500 to-rose-400'
  },
  {
    id: 'creator-2',
    name: 'Rafa Lima',
    handle: '@rafalima',
    niche: 'Educação',
    history: 'Vídeos curtos sobre produtividade e IA aplicada.',
    metrics: '840k seguidores · 5,4% engajamento',
    accent: 'from-sky-500 to-cyan-400'
  },
  {
    id: 'creator-3',
    name: 'Bia Castro',
    handle: '@biacastro',
    niche: 'Beleza',
    history: 'Historicamente forte em stories e UGC.',
    metrics: '2,1M seguidores · 7,1% engajamento',
    accent: 'from-emerald-500 to-teal-400'
  }
];

const sharedFeatureFlags = [
  { id: 'ff-1', name: 'AI Composer', enabled: true, description: 'Geração de conteúdo por IA', scope: 'workspace' },
  { id: 'ff-2', name: 'Instagram Publish', enabled: false, description: 'Postar diretamente no Instagram', scope: 'workspace' },
  { id: 'ff-3', name: 'Google Drive Sync', enabled: true, description: 'Sincronização com Drive', scope: 'workspace' },
  { id: 'ff-4', name: 'White Label', enabled: false, description: 'Marca própria para clientes', scope: 'plan' }
];

const sharedInvoices = [
  { id: 'inv-1', number: 'INV-2026-001', date: '2026-03-01', amount: 'R$ 149,00', status: 'Pago' },
  { id: 'inv-2', number: 'INV-2026-002', date: '2026-04-01', amount: 'R$ 149,00', status: 'Aberto' }
];

const sharedUsage = [
  { metric: 'Membros', used: 5, limit: 10 },
  { metric: 'Ideias geradas', used: 284, limit: 1000 },
  { metric: 'Arquivos', used: 18, limit: 50 },
  { metric: 'Concorrentes monitorados', used: 4, limit: 10 }
];

const sharedNotes = [
  {
    id: 'note-1',
    title: 'Ajustar CTA do carrossel',
    body: 'Testar CTA mais direta para agendamento de gravação.',
    author: 'Rodrigo'
  },
  {
    id: 'note-2',
    title: 'Nova linha de produto',
    body: 'Lançar variação premium no próximo trimestre.',
    author: 'Camila'
  }
];

const sharedProducts = [
  {
    id: 'prod-1',
    name: 'Kit Conteúdo Acelerado',
    benefit: 'Organiza calendário, pauta e roteiro num único fluxo.',
    audience: 'Criadoras e equipes enxutas',
    price: 'R$ 497',
    restrictions: 'Licença individual',
    tags: ['mais-vendido', 'playbook']
  },
  {
    id: 'prod-2',
    name: 'Mentoria Growth Creators',
    benefit: 'Rotina de publicação e análise de crescimento',
    audience: 'Influenciadoras e social medias',
    price: 'R$ 1.200',
    restrictions: 'Vagas limitadas',
    tags: ['mentoria', 'premium']
  }
];

const sharedIdeas = [
  {
    id: 'idea-1',
    title: 'Como gravar 10 posts em 1 manhã',
    hook: 'O problema não é falta de tempo, é falta de sistema.',
    source: 'Trend',
    score: 94,
    tags: ['reels', 'bastidores']
  },
  {
    id: 'idea-2',
    title: '3 erros que matam seus stories',
    hook: 'Stories bons falam, histórias fracas desaparecem.',
    source: 'IA',
    score: 88,
    tags: ['stories', 'educação']
  },
  {
    id: 'idea-3',
    title: 'Checklist de pré-gravação',
    hook: 'Sem checklist você grava a mesma cena três vezes.',
    source: 'Banco',
    score: 91,
    tags: ['checklist', 'produtividade']
  }
];

const sharedScripts = [
  {
    id: 'script-1',
    title: 'Gancho: produtividade sem caos',
    hook: 'Como postar mais sem virar refém do celular.',
    beats: ['problema', 'virada', 'passo 1', 'passo 2', 'CTA'],
    cta: 'Baixe o template'
  },
  {
    id: 'script-2',
    title: 'Storyboard: lançamento express',
    hook: 'Ritmo de energia crescente para campanha curta.',
    beats: ['abertura', 'prova', 'benefícios', 'urgência'],
    cta: 'Entre na lista'
  }
];

const sharedStories = [
  {
    id: 'story-1',
    title: 'Sequência teaser',
    hook: 'Abrir curiosidade em 3 telas',
    status: 'Agendado',
    time: '08:00'
  },
  {
    id: 'story-2',
    title: 'Sequência prova social',
    hook: 'Depoimento + print + CTA',
    status: 'Rascunho',
    time: '12:00'
  }
];

const sharedPosts = [
  {
    id: 'post-1',
    title: 'Carrossel: 7 passos do briefing',
    channel: 'Feed',
    status: 'Pronto',
    scheduledAt: '2026-03-24 14:30',
    engagement: '7,2%',
    tags: ['carrossel', 'b2b']
  },
  {
    id: 'post-2',
    title: 'Reel: bastidores da gravação',
    channel: 'Reels',
    status: 'Agendado',
    scheduledAt: '2026-03-24 18:00',
    engagement: '9,1%',
    tags: ['reels', 'bastidores']
  },
  {
    id: 'post-3',
    title: 'Story: enquete de produto',
    channel: 'Stories',
    status: 'Publicado',
    scheduledAt: '2026-03-24 09:00',
    engagement: '4,4%',
    tags: ['stories', 'interação']
  }
];

const sharedPipeline = [
  { id: 'card-1', title: 'Ideia: teaser de lançamento', column: 'Ideia', assignee: 'Lia', tags: ['trend'], priority: 'high' as const },
  { id: 'card-2', title: 'Roteiro: reels tutorial', column: 'Roteiro', assignee: 'Rodrigo', tags: ['reels', 'how-to'], priority: 'medium' as const },
  { id: 'card-3', title: 'Gravar: kit conteúdo', column: 'Gravar', assignee: 'Camila', tags: ['produção'], priority: 'high' as const },
  { id: 'card-4', title: 'Editar: depoimentos', column: 'Editar', assignee: 'João', tags: ['ugc'], priority: 'medium' as const },
  { id: 'card-5', title: 'Postar: campanha verão', column: 'Postar', assignee: 'Lia', tags: ['campaign'], priority: 'low' as const }
];

const sharedCalendarEvents = [
  { id: 'event-1', title: 'Gravação reels produto', date: '2026-03-24', type: 'Gravação', owner: 'Camila' },
  { id: 'event-2', title: 'Publicação carrossel', date: '2026-03-24', type: 'Feed', owner: 'Rodrigo' },
  { id: 'event-3', title: 'Story prova social', date: '2026-03-25', type: 'Stories', owner: 'Lia' },
  { id: 'event-4', title: 'Reunião com criadora', date: '2026-03-26', type: 'Campanha', owner: 'Camila' }
];

function createWorkspace(overrides: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    slug: 'demo',
    name: 'Ateliê Moreno',
    company: 'Ateliê Moreno',
    industry: 'Conteúdo e educação',
    plan: 'Agência',
    theme: 'glass-teal',
    members: 5,
    quickStats: [
      { label: 'Ideias na fila', value: '18', trend: '+6 hoje' },
      { label: 'Posts prontos', value: '12', trend: '+3 hoje' },
      { label: 'Stories hoje', value: '5', trend: '+2' },
      { label: 'Crescimento', value: '+24%', trend: '7 dias' }
    ],
    agenda: [
      { id: 'agenda-1', title: 'Gravação reels', type: 'Produção', time: '09:00', owner: 'Camila', color: 'bg-sky-500' },
      { id: 'agenda-2', title: 'Publicar carrossel', type: 'Feed', time: '14:30', owner: 'Rodrigo', color: 'bg-emerald-500' },
      { id: 'agenda-3', title: 'Story enquete', type: 'Stories', time: '18:00', owner: 'Lia', color: 'bg-amber-500' }
    ],
    stories: sharedStories,
    posts: sharedPosts,
    pipelineCards: sharedPipeline,
    assets: sharedAssets,
    ideas: sharedIdeas,
    scripts: sharedScripts,
    calendarEvents: sharedCalendarEvents,
    metrics: sharedMetrics,
    competitors: sharedCompetitors,
    products: sharedProducts,
    creators: sharedCreators,
    featureFlags: sharedFeatureFlags,
    invoices: sharedInvoices,
    usage: sharedUsage,
    notes: sharedNotes,
    ...overrides
  };
}

const agencyWorkspace = createWorkspace({
  slug: 'studio-alpha',
  name: 'Studio Alpha',
  company: 'Studio Alpha',
  industry: 'Agência de creators',
  plan: 'Pro',
  members: 12,
  quickStats: [
    { label: 'Clientes ativos', value: '9', trend: '+2 este mês' },
    { label: 'Assets', value: '126', trend: '+18 novos' },
    { label: 'Publis', value: '42', trend: '+11' },
    { label: 'Retenção', value: '92%', trend: 'agosto' }
  ],
  theme: 'ink-violet'
});

const workspaces = [createWorkspace({}), agencyWorkspace];

export function listWorkspaceSnapshots() {
  return workspaces;
}

export function getWorkspaceSnapshot(slug: string): WorkspaceSnapshot {
  return workspaces.find((workspace) => workspace.slug === slug) ?? workspaces[0];
}

export function listModuleKeys(): ModuleKey[] {
  return [
    'dashboard',
    'calendar',
    'ideas',
    'scripts',
    'stories',
    'pipeline',
    'library',
    'feed',
    'posts',
    'metrics',
    'competitors',
    'products',
    'creators',
    'ai',
    'billing',
    'admin'
  ];
}
