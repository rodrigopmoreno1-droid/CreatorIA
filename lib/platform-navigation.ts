import {
  Bot,
  ChartColumn,
  LayoutDashboard,
  Package,
  Send,
  TrendingUp,
  UserSquare2,
  Video,
  Clapperboard
} from 'lucide-react';

import type { PlatformModuleKey } from '@/types/platform';

export const platformNavigation: Array<{
  key: PlatformModuleKey;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  href: (workspace: string) => string;
}> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral da operação',
    icon: LayoutDashboard,
    href: (workspace) => `/${workspace}/dashboard`
  },
  {
    key: 'scripts',
    label: 'Roteiros',
    description: 'Geração, edição e aprovação',
    icon: Video,
    href: (workspace) => `/${workspace}/scripts`
  },
  {
    key: 'recordings',
    label: 'Gravações',
    description: 'Kanban de produção',
    icon: Clapperboard,
    href: (workspace) => `/${workspace}/recordings`
  },
  {
    key: 'posts',
    label: 'Postagens',
    description: 'Planejamento e status',
    icon: Send,
    href: (workspace) => `/${workspace}/posts`
  },
  {
    key: 'creators',
    label: 'Blogueiras',
    description: 'Perfis e observações',
    icon: UserSquare2,
    href: (workspace) => `/${workspace}/creators`
  },
  {
    key: 'metrics',
    label: 'Métricas',
    description: 'Leitura de performance',
    icon: ChartColumn,
    href: (workspace) => `/${workspace}/metrics`
  },
  {
    key: 'products',
    label: 'Produtos',
    description: 'Base para roteiros',
    icon: Package,
    href: (workspace) => `/${workspace}/products`
  },
  {
    key: 'ai',
    label: 'CreatorAI',
    description: 'Assistente interno de conteudo',
    icon: Bot,
    href: (workspace) => `/${workspace}/ai`
  },
  {
    key: 'competitors',
    label: 'Concorrentes',
    description: 'Mapa de referência',
    icon: TrendingUp,
    href: (workspace) => `/${workspace}/competitors`
  }
];

export const recordingColumns: Array<{
  key: 'approved' | 'recording' | 'drive' | 'edited';
  label: string;
}> = [
  { key: 'approved', label: 'Aprovados' },
  { key: 'recording', label: 'Gravando' },
  { key: 'drive', label: 'No Drive' },
  { key: 'edited', label: 'Editado' }
];
