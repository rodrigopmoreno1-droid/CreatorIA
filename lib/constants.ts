import {
  Bot,
  CalendarDays,
  ChartColumn,
  CircleGauge,
  Grip,
  LayoutDashboard,
  Library,
  MessageSquareMore,
  Sparkles,
  SquareKanban,
  Users,
  Video,
  Workflow,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  FolderKanban
} from 'lucide-react';
import type { ModuleKey, RoleName } from '@/types';

export const DEMO_EMAIL = 'rodrigomoreno.pessoal@gmail.com';
export const DEMO_PASSWORD = 'Eccoprime2013';
export const DEMO_WORKSPACE = 'demo';
export const DEMO_COMPANY_NAME = 'Ateliê Moreno';

export const navigationItems: Array<{
  key: ModuleKey;
  label: string;
  href: (workspace: string) => string;
  icon: typeof LayoutDashboard;
  description: string;
}> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: (workspace) => `/${workspace}/dashboard`,
    icon: LayoutDashboard,
    description: 'Visão geral da operação'
  },
  {
    key: 'calendar',
    label: 'Calendário',
    href: (workspace) => `/${workspace}/calendar`,
    icon: CalendarDays,
    description: 'Planejamento editorial'
  },
  {
    key: 'ideas',
    label: 'Ideias',
    href: (workspace) => `/${workspace}/ideas`,
    icon: Sparkles,
    description: 'Trends, ganchos e backlog'
  },
  {
    key: 'scripts',
    label: 'Roteiros',
    href: (workspace) => `/${workspace}/scripts`,
    icon: Video,
    description: 'Hooks, takes e CTA'
  },
  {
    key: 'stories',
    label: 'Stories',
    href: (workspace) => `/${workspace}/stories`,
    icon: MessageSquareMore,
    description: 'Sequências e enquetes'
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    href: (workspace) => `/${workspace}/pipeline`,
    icon: SquareKanban,
    description: 'Do insight ao post'
  },
  {
    key: 'library',
    label: 'Biblioteca',
    href: (workspace) => `/${workspace}/library`,
    icon: Library,
    description: 'Arquivos, tags e assets'
  },
  {
    key: 'feed',
    label: 'Feed Preview',
    href: (workspace) => `/${workspace}/feed`,
    icon: Grip,
    description: 'Grid visual do Instagram'
  },
  {
    key: 'posts',
    label: 'Posts',
    href: (workspace) => `/${workspace}/posts`,
    icon: FolderKanban,
    description: 'Legendas e agendamentos'
  },
  {
    key: 'metrics',
    label: 'Métricas',
    href: (workspace) => `/${workspace}/metrics`,
    icon: ChartColumn,
    description: 'Performance e crescimento'
  },
  {
    key: 'competitors',
    label: 'Concorrentes',
    href: (workspace) => `/${workspace}/competitors`,
    icon: TrendingUp,
    description: 'Monitoramento e análise'
  },
  {
    key: 'products',
    label: 'Produtos',
    href: (workspace) => `/${workspace}/products`,
    icon: CircleGauge,
    description: 'Ofertas e restrições'
  },
  {
    key: 'creators',
    label: 'Criadoras',
    href: (workspace) => `/${workspace}/creators`,
    icon: Users,
    description: 'Perfis, nichos e histórico'
  },
  {
    key: 'ai',
    label: 'Chat IA',
    href: (workspace) => `/${workspace}/ai`,
    icon: Bot,
    description: 'Assistente interno'
  },
  {
    key: 'billing',
    label: 'Billing',
    href: (workspace) => `/${workspace}/billing`,
    icon: CreditCard,
    description: 'Planos e limites'
  },
  {
    key: 'admin',
    label: 'Admin',
    href: (workspace) => `/${workspace}/admin`,
    icon: ShieldCheck,
    description: 'Feature flags e SaaS'
  }
];

export const roleLabels: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  social_media: 'Social Media',
  filmmaker: 'Filmmaker',
  blogueira: 'Blogueira',
  viewer: 'Viewer'
};

export const saasPlans = [
  {
    name: 'Básico',
    price: 'R$ 79',
    featured: false,
    limits: { users: 3, ideas: 200, storageGb: 10, competitors: 3 }
  },
  {
    name: 'Pro',
    price: 'R$ 149',
    featured: true,
    limits: { users: 10, ideas: 1000, storageGb: 50, competitors: 10 }
  },
  {
    name: 'Agência',
    price: 'R$ 297',
    featured: false,
    limits: { users: 30, ideas: 5000, storageGb: 200, competitors: 30 }
  },
  {
    name: 'White Label',
    price: 'R$ 597',
    featured: false,
    limits: { users: 100, ideas: Infinity, storageGb: Infinity, competitors: Infinity }
  }
];
