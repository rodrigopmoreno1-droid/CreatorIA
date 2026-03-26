import {
  Bot,
  ChartColumn,
  LayoutDashboard,
  Package,
  PencilLine,
  TrendingUp,
  UserSquare2,
  Video
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
    key: 'contents',
    label: 'Conteúdos',
    description: 'Fluxo único de conteúdo',
    icon: Video,
    href: (workspace) => `/${workspace}/conteudos`
  },
  {
    key: 'roteiros',
    label: 'Roteiros',
    description: 'Briefing e geração',
    icon: PencilLine,
    href: (workspace) => `/${workspace}/roteiros`
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

/**
 * Columns shown in the Produção kanban.
 * Approved scripts enter here when moved from Conteúdo.
 * Cards in 'editing' can be promoted to 'edited' → they move to Postagens.
 */
export const recordingColumns: Array<{
  key: 'production' | 'recording' | 'drive' | 'editing';
  label: string;
}> = [
  { key: 'production', label: 'Em produção' },
  { key: 'recording', label: 'Gravando' },
  { key: 'drive', label: 'No Drive' },
  { key: 'editing', label: 'Em edição' },
];
