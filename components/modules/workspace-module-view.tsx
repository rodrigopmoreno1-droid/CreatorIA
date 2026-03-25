"use client";

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DayPicker } from 'react-day-picker';
import { motion } from 'framer-motion';
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  Loader2,
  Move,
  Plus,
  Send,
  Sparkles,
  Wand2,
  Search,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users,
  BarChart3,
  ArrowUpRight,
  LayoutGrid,
  MessageSquareText,
  PlayCircle,
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  Pin,
  FileText,
  FolderOpen,
  LibraryBig,
  Filter,
  Settings2,
  SlidersHorizontal,
  Check,
  AlertCircle,
  BriefcaseBusiness,
  Target,
  PencilLine,
  NotebookText,
  SquareKanban,
  ChartSpline,
  Trash2
} from 'lucide-react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { saasPlans, navigationItems } from '@/lib/constants';
import { WorkspaceSnapshot } from '@/lib/demo-data';
import {
  type ApprovalStatus,
  type WorkspaceMember,
  type WorkspaceViewMode,
  useWorkspaceStore
} from '@/store/use-workspace-store';
import { cn } from '@/lib/utils';
import type { ModuleKey } from '@/types';
import { toast } from 'sonner';

type WidgetKey = 'stats' | 'agenda' | 'stories' | 'pipeline' | 'ideas';

type WorkspaceModuleProps = {
  workspace: WorkspaceSnapshot;
  module: ModuleKey;
};

type IdeaItem = WorkspaceSnapshot['ideas'][number];
type ScriptItem = WorkspaceSnapshot['scripts'][number] & {
  spoken?: string;
  caption?: string;
  storyboard?: string[];
};
type StoryItem = WorkspaceSnapshot['stories'][number] & {
  cta?: string;
};
type CalendarItem = WorkspaceSnapshot['calendarEvents'][number];
type PostItem = WorkspaceSnapshot['posts'][number] & {
  caption?: string;
  location?: string;
  mediaUrl?: string;
};

const moduleMeta: Record<ModuleKey, { title: string; description: string; cta?: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Widgets arrastáveis, métricas rápidas e visão operacional do dia.',
    cta: 'Abrir IA'
  },
  calendar: {
    title: 'Calendário',
    description: 'Mês, semana, agenda e criação editorial em uma visão só.'
  },
  ideas: {
    title: 'Ideias & Trends',
    description: 'Banco de ideias, tendências, ganchos e calendário de oportunidade.'
  },
  scripts: {
    title: 'Roteiros',
    description: 'Gancho, takes, CTA, legenda e storyboard em um fluxo único.'
  },
  stories: {
    title: 'Stories Planner',
    description: 'Sequência de stories com preview estilo Instagram e CTA.'
  },
  pipeline: {
    title: 'Pipeline',
    description: 'Do insight à postagem com uma esteira visual estilo Trello.'
  },
  library: {
    title: 'Biblioteca',
    description: 'Arquivos, previews, tags, links e ativos sincronizados.'
  },
  feed: {
    title: 'Feed Preview',
    description: 'Grid editável para planejar o visual do Instagram.'
  },
  posts: {
    title: 'Posts',
    description: 'Legendas, hashtags, horários e status com métricas.'
  },
  metrics: {
    title: 'Métricas',
    description: 'Alcance, engajamento, crescimento e leitura de performance.'
  },
  competitors: {
    title: 'Concorrentes',
    description: 'Monitoramento visual, análise de posts e sinais de mercado.'
  },
  products: {
    title: 'Produtos',
    description: 'Benefícios, público, preço, restrições e conexões com conteúdo.'
  },
  creators: {
    title: 'Criadoras / Blogueiras',
    description: 'Perfis, nicho, histórico e métricas para collabs e campanhas.'
  },
  ai: {
    title: 'Chat IA',
    description: 'O cérebro interno da operação para gerar e analisar conteúdo.',
    cta: 'Gerar ideia'
  },
  billing: {
    title: 'Billing',
    description: 'Planos, uso, limites, assinaturas, invoices e upgrades.'
  },
  admin: {
    title: 'Admin',
    description: 'Feature flags, SaaS settings, tenants e permissões globais.'
  }
};

const PRODUCTION_COLUMNS = new Set(['roteiro', 'aprovado', 'gravar', 'gravado', 'editar', 'pronto']);
const SOCIAL_COLUMNS = new Set(['aprovado', 'pronto', 'postar', 'postado']);
const PRODUCTION_EVENT_TYPES = new Set(['gravacao', 'gravação', 'producao', 'produção', 'campanha']);
const SOCIAL_EVENT_TYPES = new Set(['feed', 'stories', 'reels', 'postagem', 'publicacao', 'publicação']);
const SOCIAL_CHANNELS = new Set(['feed', 'reels', 'stories']);

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((chunk) => chunk[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getMemberShortName(member?: WorkspaceMember) {
  return normalizeText(member?.name.split(' ')[0] ?? '');
}

function memberShouldScope(member?: WorkspaceMember) {
  if (!member) return false;
  return !normalizeText(member.role).includes('coordenador');
}

function matchesMember(candidate: string | undefined, member?: WorkspaceMember) {
  if (!candidate || !member) return true;
  return normalizeText(candidate).includes(getMemberShortName(member));
}

function requestAiAction<T>(action: string, payload: Record<string, unknown>) {
  return fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  }).then(async (response) => {
    const data = (await response.json().catch(() => null)) as { content?: T; error?: string } | null;

    if (!response.ok || !data) {
      throw new Error(data?.error ?? 'Falha ao executar a IA.');
    }

    return data.content as T;
  });
}

function filterWorkspaceByContext(
  workspace: WorkspaceSnapshot,
  viewMode: WorkspaceViewMode,
  activeMember?: WorkspaceMember
) {
  const scopeToMember = memberShouldScope(activeMember);
  const onlyMember = <T,>(items: T[], accessor: (item: T) => string | undefined) =>
    scopeToMember ? items.filter((item) => matchesMember(accessor(item), activeMember)) : items;

  const agenda = onlyMember(workspace.agenda, (item) => item.owner).filter((item) => {
    if (viewMode === 'general') return true;
    return viewMode === 'production'
      ? PRODUCTION_EVENT_TYPES.has(normalizeText(item.type))
      : SOCIAL_EVENT_TYPES.has(normalizeText(item.type));
  });

  const posts = workspace.posts.filter((post) => {
    if (viewMode === 'general') return true;
    if (viewMode === 'production') return normalizeText(post.channel) === 'reels';
    return SOCIAL_CHANNELS.has(normalizeText(post.channel)) && normalizeText(post.status) !== 'publicado';
  });

  const pipelineCards = onlyMember(workspace.pipelineCards, (item) => item.assignee).filter((card) => {
    const column = normalizeText(card.column);
    if (viewMode === 'general') return true;
    return viewMode === 'production' ? PRODUCTION_COLUMNS.has(column) : SOCIAL_COLUMNS.has(column);
  });

  const calendarEvents = onlyMember(workspace.calendarEvents, (item) => item.owner).filter((item) => {
    if (viewMode === 'general') return true;
    return viewMode === 'production'
      ? PRODUCTION_EVENT_TYPES.has(normalizeText(item.type))
      : SOCIAL_EVENT_TYPES.has(normalizeText(item.type));
  });

  const ideas = workspace.ideas.filter((idea) => {
    if (viewMode === 'general') return true;
    const tags = idea.tags.map(normalizeText);
    return viewMode === 'production'
      ? tags.some((tag) => ['reels', 'bastidores', 'checklist', 'producao', 'produção'].includes(tag))
      : tags.some((tag) => ['stories', 'story', 'copy', 'educacao', 'educação', 'reels'].includes(tag));
  });

  return {
    ...workspace,
    agenda,
    posts,
    pipelineCards,
    calendarEvents,
    ideas,
    scripts: viewMode === 'social' ? workspace.scripts.slice(0, 1) : workspace.scripts,
    stories: viewMode === 'production' ? workspace.stories.slice(0, 1) : workspace.stories
  };
}

function approvalLabel(status: ApprovalStatus | undefined) {
  if (status === 'approved') return 'Aprovado';
  if (status === 'changes_requested') return 'Ajustes';
  return 'Pendente';
}

function approvalVariant(status: ApprovalStatus | undefined) {
  if (status === 'approved') return 'success' as const;
  if (status === 'changes_requested') return 'danger' as const;
  return 'warning' as const;
}

function SortableCard({
  id,
  className,
  children
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(isDragging && 'z-20 opacity-80 shadow-glow', className)}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
          Workspace
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-balance md:text-[26px]">{title}</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend?: string }) {
  return (
    <Card className="surface-card">
      <CardContent className="p-4">
        <p className="text-[11px] tracking-[0.08em] text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="font-display text-2xl font-semibold tracking-tight">{value}</p>
          {trend ? <Badge variant="success">{trend}</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function ModuleCard({
  title,
  subtitle,
  badge,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('surface-card', className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function ViewScopeBanner({
  workspace,
  viewMode,
  activeMember
}: {
  workspace: WorkspaceSnapshot;
  viewMode: WorkspaceViewMode;
  activeMember?: WorkspaceMember;
}) {
  const scopedCount = workspace.pipelineCards.length + workspace.posts.length + workspace.agenda.length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground">Visão ativa</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{viewMode === 'general' ? 'Geral' : viewMode === 'production' ? 'Gravacao' : 'Social Media'}</Badge>
          {activeMember ? <Badge variant="success">Operando como {activeMember.name}</Badge> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill>{workspace.posts.length} posts visiveis</Pill>
        <Pill>{workspace.pipelineCards.length} cards no fluxo</Pill>
        <Pill>{scopedCount} blocos no contexto atual</Pill>
      </div>
    </div>
  );
}

function ApprovalControls({
  status,
  onChange
}: {
  status?: ApprovalStatus;
  onChange: (status: ApprovalStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={approvalVariant(status)}>{approvalLabel(status)}</Badge>
      <Button variant="outline" size="sm" className="h-8 rounded-2xl px-3" onClick={() => onChange('approved')}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Aprovar
      </Button>
      <Button variant="outline" size="sm" className="h-8 rounded-2xl px-3" onClick={() => onChange('changes_requested')}>
        <AlertCircle className="h-3.5 w-3.5" />
        Ajustes
      </Button>
    </div>
  );
}

function SideBlockActions({
  onEdit,
  onDelete,
  label = 'item'
}: {
  onEdit: () => void;
  onDelete: () => void;
  label?: string;
}) {
  return (
    <div className="pointer-events-none absolute -left-3 top-5 z-10 flex -translate-x-2 flex-col gap-2 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
      <button
        type="button"
        aria-label={`Editar ${label}`}
        onClick={onEdit}
        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/80 bg-white text-foreground shadow-soft transition hover:bg-accent"
      >
        <PencilLine className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Excluir ${label}`}
        onClick={onDelete}
        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/80 bg-white text-foreground shadow-soft transition hover:bg-accent"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border/80 bg-white/65 p-6 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function HydratedChart({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="h-full w-full animate-pulse rounded-2xl bg-muted/50" />;
  }

  return <>{children}</>;
}

function formatDateLabel(date: string) {
  return date.replaceAll('-', '/');
}

function DashboardModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [widgets, setWidgets] = useState<WidgetKey[]>(['stats', 'agenda', 'stories', 'pipeline', 'ideas']);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    workspace.calendarEvents[0] ? new Date(`${workspace.calendarEvents[0].date}T12:00:00`) : new Date()
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const selectedDateLabel = selectedDate?.toISOString().slice(0, 10);
  const selectedEvents = workspace.calendarEvents.filter((event) => event.date === selectedDateLabel);
  const mainSeries = workspace.metrics.series[0]?.points ?? [];
  const weeklyLoad = workspace.posts.length + workspace.stories.length + workspace.agenda.length;
  const assignments = [
    ...workspace.agenda.map((item) => ({
      id: item.id,
      title: item.title,
      meta: `${item.type} · ${item.owner}`,
      when: item.time,
      icon: CalendarDays,
      accent: 'bg-muted text-foreground'
    })),
    ...workspace.posts.slice(0, 2).map((post) => ({
      id: post.id,
      title: post.title,
      meta: `${post.channel} · ${post.status}`,
      when: post.scheduledAt.slice(11, 16),
      icon: NotebookText,
      accent: 'bg-muted text-foreground'
    }))
  ].slice(0, 4);
  const topMovements = [
    ...workspace.pipelineCards.slice(0, 2).map((card) => ({
      id: card.id,
      title: card.title,
      meta: `${card.column} · ${card.assignee}`,
      icon: SquareKanban,
      accent: 'bg-muted text-foreground'
    })),
    ...workspace.calendarEvents.slice(0, 2).map((event) => ({
      id: event.id,
      title: event.title,
      meta: `${event.type} · ${event.owner}`,
      icon: Clock3,
      accent: 'bg-muted text-foreground'
    }))
  ].slice(0, 4);

  const widgetsByKey: Record<WidgetKey, React.ReactNode> = {
    stats: (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workspace.quickStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    ),
    agenda: (
      <ModuleCard title="Agenda do dia" subtitle="Compromissos e blocos de produção">
        <div className="space-y-3">
          {workspace.agenda.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
              <span className={cn('h-3 w-3 rounded-full', item.color)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.type} · {item.owner}
                </p>
              </div>
              <Badge variant="outline">{item.time}</Badge>
            </div>
          ))}
        </div>
      </ModuleCard>
    ),
    stories: (
      <ModuleCard title="Stories do dia" subtitle="Sequências e rascunhos">
        <div className="grid gap-3">
          {workspace.stories.map((story, index) => (
            <div key={story.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] tracking-[0.08em] text-muted-foreground">Story {index + 1}</p>
                  <p className="mt-1 text-[13px] font-semibold">{story.title}</p>
                </div>
                <Badge variant="outline">{story.time}</Badge>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">{story.hook}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{story.status}</span>
                <span>Preview Instagram</span>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>
    ),
    pipeline: (
      <ModuleCard title="Pipeline" subtitle="Esteira de produção resumida">
        <div className="grid gap-3">
          {workspace.pipelineCards.slice(0, 4).map((card) => (
            <div key={card.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{card.title}</p>
                  <p className="text-sm text-muted-foreground">{card.column} · {card.assignee}</p>
                </div>
                <Badge variant={card.priority === 'high' ? 'danger' : card.priority === 'medium' ? 'warning' : 'outline'}>
                  {card.priority}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>
    ),
    ideas: (
      <ModuleCard title="Ideias em alta" subtitle="Banco e trends priorizados">
        <div className="space-y-3">
          {workspace.ideas.map((idea) => (
            <div key={idea.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{idea.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{idea.hook}</p>
                </div>
                <Badge variant="success">{idea.score}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {idea.tags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>
    )
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgets((items) => {
      const oldIndex = items.indexOf(active.id as WidgetKey);
      const newIndex = items.indexOf(over.id as WidgetKey);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="surface-card">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] tracking-[0.08em] text-muted-foreground">{workspace.company}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                  {weeklyLoad} entregas ativas nesta semana.
                </h2>
                <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
                  Uma visão simples do que precisa gravar, publicar e acompanhar hoje.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{workspace.plan}</Badge>
                <Button variant="outline" size="sm">
                  <Bot className="h-4 w-4" />
                  IA
                </Button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[11px] text-muted-foreground">Roteiro em foco</p>
                <p className="mt-1 text-[13px] font-semibold">{workspace.scripts[0]?.title ?? 'Sem roteiro ativo'}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[11px] text-muted-foreground">Produto em foco</p>
                <p className="mt-1 text-[13px] font-semibold">{workspace.products[0]?.name ?? 'Sem produto ativo'}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[11px] text-muted-foreground">Creator em foco</p>
                <p className="mt-1 text-[13px] font-semibold">{workspace.creators[0]?.name ?? 'Sem creator ativa'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ModuleCard title="Pulso da operação" subtitle="Indicadores e capacidade do workspace">
          <div className="space-y-3">
            {workspace.metrics.summary.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.trend}</p>
                  </div>
                  <p className="font-display text-xl font-semibold">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {workspace.usage.slice(0, 3).map((item) => {
              const progress = item.limit === Infinity ? 100 : Math.min((item.used / item.limit) * 100, 100);
              return (
                <div key={item.metric}>
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>{item.metric}</span>
                    <span>
                      {item.used}
                      {item.limit === Infinity ? '' : `/${item.limit}`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-foreground/75" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ModuleCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <ModuleCard title="Indicadores" subtitle="Leitura rápida do que evoluiu desde ontem">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {workspace.quickStats.slice(0, 3).map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                  <p className="text-[12px] text-muted-foreground">{stat.label}</p>
                  <p className="mt-3 font-display text-2xl font-semibold tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{stat.trend}</p>
                </div>
              ))}
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[12px] text-muted-foreground">Alcance nesta semana</p>
                <div className="mt-4 h-[96px]">
                  <HydratedChart>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mainSeries}>
                        <defs>
                          <linearGradient id="dashboardAreaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#111827" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#111827" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <Tooltip cursor={false} />
                        <Area type="monotone" dataKey="value" stroke="#111827" strokeWidth={2} fill="url(#dashboardAreaFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </HydratedChart>
                </div>
              </div>
            </div>
          </ModuleCard>

          <ModuleCard title="Minha fila" subtitle="Entregas, publicações e pontos de atenção">
            <div className="space-y-3">
              {assignments.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', item.accent)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                      <p className="text-[12px] text-muted-foreground">{item.meta}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-foreground/80">{item.when}</span>
                  </div>
                );
              })}
            </div>
          </ModuleCard>
        </div>

        <div className="space-y-6">
          <ModuleCard title="Calendário" subtitle="Selecione o dia e acompanhe os próximos movimentos">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-xl bg-muted p-3"
            />
            <div className="mt-4 space-y-3">
              {selectedEvents.length ? (
                selectedEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
                    <div>
                      <p className="text-[13px] font-medium">{event.title}</p>
                      <p className="text-[12px] text-muted-foreground">{event.type} · {event.owner}</p>
                    </div>
                    <Badge variant="outline">{event.date}</Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background p-4 text-[12px] text-muted-foreground">
                  Sem eventos nesta data. O calendário está pronto para receber mais blocos editoriais.
                </div>
              )}
            </div>
          </ModuleCard>

          <ModuleCard title="Próximos movimentos" subtitle="O que merece atenção antes do fim do dia">
            <div className="space-y-3">
              {topMovements.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', item.accent)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{item.title}</p>
                      <p className="text-[12px] text-muted-foreground">{item.meta}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </ModuleCard>
        </div>
      </div>

      <Card className="surface-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">Widgets arrastáveis</p>
            <p className="text-[12px] text-muted-foreground">Reordene sem esticar o layout.</p>
          </div>
          <Badge variant="outline">
            <Move className="mr-1 h-3 w-3" />
            Drag and drop
          </Badge>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets} strategy={rectSortingStrategy}>
            <div className="grid gap-4 lg:grid-cols-2">
              {widgets.map((widget) => (
                <SortableCard key={widget} id={widget} className={widget === 'stats' ? 'lg:col-span-2' : ''}>
                  {widgetsByKey[widget]}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
}

function CalendarModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarItem[]>(workspace.calendarEvents);
  const [activeType, setActiveType] = useState<'todos' | 'Feed' | 'Reels' | 'Stories' | 'Campanha' | 'Gravação'>(
    'todos'
  );
  const [generatedPlan, setGeneratedPlan] = useState<Array<{ date: string; title: string; channel: string }>>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    setEvents(workspace.calendarEvents);
  }, [workspace.calendarEvents]);

  const selectedLabel = selected?.toISOString().slice(0, 10);
  const visibleEvents = events.filter((event) => {
    const sameDay = event.date === selectedLabel;
    const typeMatch = activeType === 'todos' ? true : normalizeText(event.type) === normalizeText(activeType);
    return sameDay && typeMatch;
  });

  async function handleSuggestCalendar() {
    setLoadingPlan(true);

    try {
      const content = await requestAiAction<{ month: string; items: Array<{ date: string; title: string; channel: string }> }>(
        'suggestCalendar',
        {
          month: (selectedLabel ?? workspace.calendarEvents[0]?.date ?? '2026-03').slice(0, 7),
          product: workspace.products[0]?.name
        }
      );

      setGeneratedPlan(content.items);
      toast.success('Calendário sugerido pela IA.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o calendário.');
    } finally {
      setLoadingPlan(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <ModuleCard title="Agenda editorial" subtitle="Selecione uma data para ver os eventos do dia">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={setSelected}
          className="rounded-3xl border border-border bg-background p-4"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {['todos', 'Feed', 'Reels', 'Stories', 'Campanha', 'Gravação'].map((type) => (
            <Button
              key={type}
              variant={activeType === type ? 'default' : 'outline'}
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={() => setActiveType(type as typeof activeType)}
            >
              {type}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleSuggestCalendar} disabled={loadingPlan}>
            {loadingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sugerir semana
          </Button>
          <Button variant="outline">
            <CalendarDays className="h-4 w-4" />
            Arrastar no calendário
          </Button>
        </div>
      </ModuleCard>

      <div className="space-y-6">
        <ModuleCard title="Eventos do dia" subtitle={`Itens marcados para ${selectedLabel ? formatDateLabel(selectedLabel) : 'hoje'}`}>
          <div className="space-y-3">
            {visibleEvents.length ? (
              visibleEvents.map((event) => (
                <div key={event.id} className="group relative">
                  <SideBlockActions
                    label="evento"
                    onEdit={() => toast.info(`Edicao rapida liberada para ${event.title}.`)}
                    onDelete={() => setEvents((current) => current.filter((item) => item.id !== event.id))}
                  />
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">{event.type} · {event.owner}</p>
                    </div>
                    <Badge variant="outline">{event.date}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Sem eventos nesta data"
                description="A visão está limpa para você arrastar novos conteúdos e encaixar o dia com mais precisão."
              />
            )}
          </div>
        </ModuleCard>

        <ModuleCard title="Plano sugerido pela IA" subtitle="Blocos prontos para copiar para o calendário">
          {generatedPlan.length ? (
            <div className="space-y-3">
              {generatedPlan.map((item) => (
                <div key={`${item.date}-${item.title}`} className="rounded-[1.5rem] border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.channel}</p>
                    </div>
                    <Badge variant="outline">{item.date}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Sem plano sugerido ainda"
              description="Use o botão de IA para receber uma semana pronta com feed, reels e stories."
            />
          )}
        </ModuleCard>
      </div>
    </div>
  );
}

function IdeasModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [ideas, setIdeas] = useState<IdeaItem[]>(workspace.ideas);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setIdeas(workspace.ideas);
  }, [workspace.ideas]);

  const filteredIdeas = useMemo(() => {
    const query = normalizeText(deferredSearch.trim());
    if (!query) return ideas;
    return ideas.filter((idea) => {
      return (
        normalizeText(idea.title).includes(query) ||
        normalizeText(idea.hook).includes(query) ||
        idea.tags.some((tag) => normalizeText(tag).includes(query))
      );
    });
  }, [deferredSearch, ideas]);

  async function handleGenerateIdeas() {
    setLoading(true);

    try {
      const content = await requestAiAction<Array<{ title: string; hook: string; format: string; angle: string }>>(
        'generateIdeas',
        {
          topic: workspace.products[0]?.name ?? 'Conteúdo para Instagram',
          audience: workspace.products[0]?.audience,
          product: workspace.products[0]?.name,
          count: 6
        }
      );

      const generated = content.map((item, index) => ({
        id: `idea-ai-${Date.now()}-${index}`,
        title: item.title,
        hook: item.hook,
        source: 'IA',
        score: 90 - index,
        tags: [item.format, item.angle]
      }));

      setIdeas((current) => [...generated, ...current]);
      toast.success('Ideias geradas com a IA.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar ideias.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ModuleCard title="Gerador de ideias" subtitle="IA e banco de trends trabalhando juntos" badge="IA ativa">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trend da semana</p>
              <p className="mt-2 font-medium">Conteúdo prático, direto e com bastidor vende mais.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Reforce consistência, economia de tempo e prova social em todo conteúdo da marca.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['reels', 'carrossel', 'story', 'trend', 'live', 'copy'].map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtrar por tema, hook ou tag"
                className="rounded-full border-white/80 bg-white"
              />
              <Button onClick={handleGenerateIdeas} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar 6 ideias
              </Button>
            </div>
          </div>
        </ModuleCard>
        <ModuleCard title="Calendário por produto" subtitle="Ideias organizadas por oferta">
          <div className="space-y-3">
            {workspace.products.map((product) => (
              <div key={product.id} className="rounded-2xl border border-border bg-background p-4">
                <p className="font-medium">{product.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{product.benefit}</p>
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>

      {filteredIdeas.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredIdeas.map((idea) => {
            const editing = editingId === idea.id;

            return (
              <div key={idea.id} className="group relative">
                <SideBlockActions
                  label="ideia"
                  onEdit={() => setEditingId((current) => (current === idea.id ? null : idea.id))}
                  onDelete={() => setIdeas((current) => current.filter((item) => item.id !== idea.id))}
                />
                <ModuleCard title={idea.title} subtitle={idea.hook} badge={`${idea.score}% fit`} className="h-full">
                  {editing ? (
                    <div className="space-y-3">
                      <Input
                        value={idea.title}
                        onChange={(event) =>
                          setIdeas((current) =>
                            current.map((item) => (item.id === idea.id ? { ...item, title: event.target.value } : item))
                          )
                        }
                        placeholder="Titulo"
                      />
                      <Textarea
                        value={idea.hook}
                        onChange={(event) =>
                          setIdeas((current) =>
                            current.map((item) => (item.id === idea.id ? { ...item, hook: event.target.value } : item))
                          )
                        }
                        placeholder="Gancho"
                        className="min-h-[110px]"
                      />
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {idea.tags.map((tag) => (
                          <Pill key={tag}>{tag}</Pill>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Origem: {idea.source}</span>
                        <span>Bloco editavel</span>
                      </div>
                    </div>
                  )}
                </ModuleCard>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nenhuma ideia encontrada"
          description="Ajuste o filtro ou gere uma nova leva com a IA para preencher o backlog."
        />
      )}
    </div>
  );
}

function ScriptsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [scripts, setScripts] = useState<ScriptItem[]>(workspace.scripts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const approvals = useWorkspaceStore((state) => state.approvalsByWorkspace[workspace.slug] ?? {});
  const setApprovalStatus = useWorkspaceStore((state) => state.setApprovalStatus);

  useEffect(() => {
    setScripts(workspace.scripts);
  }, [workspace.scripts]);

  async function handleGenerateScript() {
    setLoading(true);

    try {
      const [script, storyboard] = await Promise.all([
        requestAiAction<{
          title: string;
          hook: string;
          spoken: string;
          takes: string[];
          cta: string;
          caption: string;
        }>('generateScript', {
          topic: workspace.ideas[0]?.title ?? workspace.products[0]?.name ?? 'Roteiro para reels',
          goal: 'Gerar roteiro para gravacao e publicacao',
          tone: 'humano e direto'
        }),
        requestAiAction<{ frames: string[] }>('generateStoryboard', {
          topic: workspace.ideas[0]?.title ?? workspace.products[0]?.name ?? 'Roteiro para reels'
        })
      ]);

      setScripts((current) => [
        {
          id: `script-ai-${Date.now()}`,
          title: script.title,
          hook: script.hook,
          beats: script.takes,
          cta: script.cta,
          caption: script.caption,
          spoken: script.spoken,
          storyboard: storyboard.frames
        },
        ...current
      ]);
      toast.success('Roteiro e storyboard gerados.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o roteiro.');
    } finally {
      setLoading(false);
    }
  }

  const activeStoryboard = scripts[0]?.storyboard ?? ['Abertura forte', 'Prova visual', 'Demonstração', 'CTA final'];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <ModuleCard
        title="Roteiros gerados"
        subtitle="Gancho, takes, CTA e storyboard"
        badge="IA"
      >
        <div className="mb-4 flex justify-end">
          <Button onClick={handleGenerateScript} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Gerar roteiro
          </Button>
        </div>
        <div className="space-y-4">
          {scripts.map((script) => {
            const editing = editingId === script.id;

            return (
              <div key={script.id} className="group relative">
                <SideBlockActions
                  label="roteiro"
                  onEdit={() => setEditingId((current) => (current === script.id ? null : script.id))}
                  onDelete={() => setScripts((current) => current.filter((item) => item.id !== script.id))}
                />
                <div className="rounded-3xl border border-border bg-background p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      {editing ? (
                        <>
                          <Input
                            value={script.title}
                            onChange={(event) =>
                              setScripts((current) =>
                                current.map((item) => (item.id === script.id ? { ...item, title: event.target.value } : item))
                              )
                            }
                          />
                          <Textarea
                            value={script.hook}
                            onChange={(event) =>
                              setScripts((current) =>
                                current.map((item) => (item.id === script.id ? { ...item, hook: event.target.value } : item))
                              )
                            }
                            className="min-h-[96px]"
                          />
                        </>
                      ) : (
                        <>
                          <p className="font-medium">{script.title}</p>
                          <p className="text-sm text-muted-foreground">{script.hook}</p>
                        </>
                      )}
                    </div>
                    <ApprovalControls
                      status={approvals[script.id]}
                      onChange={(status) => setApprovalStatus(workspace.slug, script.id, status)}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {script.beats.map((beat) => (
                      <Pill key={beat}>{beat}</Pill>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CTA</p>
                    <p className="mt-2 font-medium">{script.cta}</p>
                    {script.caption ? <p className="mt-3 text-sm text-muted-foreground">{script.caption}</p> : null}
                  </div>
                  {script.spoken ? (
                    <div className="mt-4 rounded-2xl border border-border/80 bg-[#fbf8f4] p-4 text-sm leading-6 text-muted-foreground">
                      {script.spoken}
                    </div>
                  ) : null}
                  {editing ? (
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        Salvar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </ModuleCard>

      <ModuleCard title="Storyboard" subtitle="Preview rabisco para gravação">
        <div className="grid gap-3 sm:grid-cols-2">
          {activeStoryboard.map((frame, index) => (
            <div key={`${frame}-${index}`} className="rounded-2xl border border-border bg-background p-4">
              <div className="aspect-[4/5] rounded-xl border border-dashed border-border bg-muted p-4">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Cena {index + 1}</span>
                  <span>0{index + 1}</span>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="h-3 w-3/4 rounded-full bg-foreground/10" />
                  <div className="h-3 w-full rounded-full bg-foreground/5" />
                  <div className="h-3 w-2/3 rounded-full bg-foreground/10" />
                </div>
                <p className="mt-6 text-sm leading-6 text-muted-foreground">{frame}</p>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>
    </div>
  );
}

function StoriesModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [stories, setStories] = useState<StoryItem[]>(
    workspace.stories.map((story) => ({ ...story, cta: 'Responder DM' }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const approvals = useWorkspaceStore((state) => state.approvalsByWorkspace[workspace.slug] ?? {});
  const setApprovalStatus = useWorkspaceStore((state) => state.setApprovalStatus);

  useEffect(() => {
    setStories(workspace.stories.map((story) => ({ ...story, cta: 'Responder DM' })));
  }, [workspace.stories]);

  async function handleGenerateStories() {
    setLoading(true);

    try {
      const content = await requestAiAction<{ sequence: Array<{ title: string; hook: string; cta: string; time: string }> }>(
        'generateStories',
        {
          theme: workspace.products[0]?.name ?? 'Stories para Instagram',
          count: 5
        }
      );

      setStories(
        content.sequence.map((item, index) => ({
          id: `story-ai-${Date.now()}-${index}`,
          title: item.title,
          hook: item.hook,
          status: 'Rascunho IA',
          time: item.time,
          cta: item.cta
        }))
      );
      toast.success('Sequência de stories pronta para revisão.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar stories.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <ModuleCard title="Sequência de stories" subtitle="Preview estilo Instagram" className="overflow-hidden">
        <div className="mb-4 flex justify-end">
          <Button onClick={handleGenerateStories} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar sequência
          </Button>
        </div>
        <div className="space-y-6">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {stories.map((story) => (
              <div key={story.id} className="min-w-[92px] text-center">
                <div className="mx-auto rounded-2xl border border-border bg-background p-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-base font-semibold text-foreground">
                    {story.title.charAt(0)}
                  </div>
                </div>
                <p className="mt-2 text-[12px] font-medium text-foreground">{story.title.split(' ').slice(0, 2).join(' ')}</p>
                <p className="text-[11px] text-muted-foreground">{story.time}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {stories.map((story, index) => {
              const editing = editingId === story.id;

              return (
                <div key={story.id} className="group relative">
                  <SideBlockActions
                    label="story"
                    onEdit={() => setEditingId((current) => (current === story.id ? null : story.id))}
                    onDelete={() => setStories((current) => current.filter((item) => item.id !== story.id))}
                  />
                  <div className="overflow-hidden rounded-2xl border border-border bg-background p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                            {index + 1}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{story.title}</p>
                          <p className="text-[11px] text-muted-foreground">{story.status}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{story.time}</Badge>
                    </div>

                    <div className="mt-4 rounded-xl border border-border bg-muted/60 p-4">
                      <p className="text-[10px] tracking-[0.08em] text-muted-foreground">Mensagem principal</p>
                      {editing ? (
                        <Textarea
                          value={story.hook}
                          onChange={(event) =>
                            setStories((current) =>
                              current.map((item) => (item.id === story.id ? { ...item, hook: event.target.value } : item))
                            )
                          }
                          className="mt-2 min-h-[110px] border-border bg-white"
                        />
                      ) : (
                        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{story.hook}</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <Heart className="h-4 w-4" />
                        <MessageCircle className="h-4 w-4" />
                        <Send className="h-4 w-4" />
                      </div>
                      <ApprovalControls
                        status={approvals[story.id]}
                        onChange={(status) => setApprovalStatus(workspace.slug, story.id, status)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModuleCard>

      <ModuleCard title="Sugestão IA" subtitle="Roteiro de 5 telas para aumentar resposta" className="surface-muted">
        <div className="space-y-4">
          {stories.map((story, index) => (
            <div key={story.id} className="flex items-start gap-3 rounded-xl border border-border bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-[11px] font-semibold text-white">
                {index + 1}
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">{story.title}</p>
                <p className="mt-1 text-[12px] leading-6 text-muted-foreground">{story.cta ?? 'Responder DM'}</p>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-[10px] tracking-[0.08em] text-muted-foreground">CTA sugerido</p>
            <p className="mt-2 text-[14px] font-semibold text-foreground">Leve para DM ou link com contexto.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">A narrativa aquece antes do pedido para aumentar retenção e resposta.</p>
          </div>
        </div>
      </ModuleCard>
    </div>
  );
}

function PipelineLane({
  column,
  accent,
  count,
  children
}: {
  column: string;
  accent: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'surface-card inner-stroke w-[320px] shrink-0 p-4 transition',
        isOver && 'border-[#ff8b73] shadow-[0_20px_40px_rgba(255,123,84,0.14)]'
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('h-3 w-3 rounded-full', accent)} />
          <div>
            <p className="font-medium">{column}</p>
            <p className="text-xs text-muted-foreground">{count} cards</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 rounded-2xl px-3">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </Card>
  );
}

function PipelineModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const columns = ['Ideia', 'Roteiro', 'Aprovado', 'Gravar', 'Gravado', 'Editar', 'Pronto', 'Postar', 'Postado'];
  const [cards, setCards] = useState(workspace.pipelineCards);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const columnAccents = ['bg-amber-400', 'bg-sky-400', 'bg-violet-400', 'bg-emerald-400', 'bg-rose-400', 'bg-cyan-400', 'bg-lime-400', 'bg-fuchsia-400', 'bg-slate-400'];
  const approvals = useWorkspaceStore((state) => state.approvalsByWorkspace[workspace.slug] ?? {});
  const setApprovalStatus = useWorkspaceStore((state) => state.setApprovalStatus);

  useEffect(() => {
    setCards(workspace.pipelineCards);
  }, [workspace.pipelineCards]);

  const byColumn = useMemo(() => {
    return columns.reduce<Record<string, typeof cards>>((acc, column) => {
      acc[column] = cards.filter((card) => card.column === column);
      return acc;
    }, {});
  }, [cards]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCard = cards.find((card) => card.id === active.id);
    if (!activeCard) return;

    const overCard = cards.find((card) => card.id === over.id);
    const nextColumn = typeof over.id === 'string' && columns.includes(over.id) ? over.id : overCard?.column;
    if (!nextColumn) return;

    setCards((current) => {
      const oldIndex = current.findIndex((card) => card.id === active.id);
      const newIndex = overCard ? current.findIndex((card) => card.id === overCard.id) : oldIndex;
      const reordered = arrayMove(
        current.map((card) => (card.id === active.id ? { ...card, column: nextColumn } : card)),
        oldIndex,
        newIndex
      );

      return reordered;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Pipeline visual</h2>
          <p className="text-sm text-muted-foreground">Arraste os cards entre colunas e acompanhe o fluxo editorial.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill>Ideia</Pill>
          <Pill>Roteiro</Pill>
          <Pill>Gravar</Pill>
          <Pill>Editar</Pill>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {columns.map((column, index) => (
            <PipelineLane
              key={column}
              column={column}
              accent={columnAccents[index % columnAccents.length]}
              count={byColumn[column]?.length ?? 0}
            >
              <SortableContext items={(byColumn[column] ?? []).map((card) => card.id)} strategy={rectSortingStrategy}>
                <div className="space-y-3">
                  {(byColumn[column] ?? []).map((card) => (
                    <SortableCard key={card.id} id={card.id}>
                      <div className="group relative">
                        <SideBlockActions
                          label="card"
                          onEdit={() => toast.info(`Edicao lateral pronta para ${card.title}.`)}
                          onDelete={() => setCards((current) => current.filter((item) => item.id !== card.id))}
                        />
                        <div className="surface-muted rounded-[1.5rem] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{card.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{card.assignee}</p>
                            </div>
                          </div>
                          <Badge variant={card.priority === 'high' ? 'danger' : card.priority === 'medium' ? 'warning' : 'outline'}>
                            {card.priority}
                          </Badge>
                        </div>
                        <div className="mt-4 rounded-[1.2rem] bg-white/70 p-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Progresso</span>
                            <span>{card.column}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-foreground/8">
                            <div
                              className="h-2 rounded-full bg-foreground"
                              style={{ width: `${card.priority === 'high' ? 78 : card.priority === 'medium' ? 58 : 34}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {card.tags.map((tag) => (
                            <Pill key={tag}>{tag}</Pill>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {[card.assignee.slice(0, 2).toUpperCase(), workspace.name.slice(0, 2).toUpperCase()].map((avatar) => (
                              <span
                                key={avatar}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-[10px] font-semibold text-[#17171b]"
                              >
                                {avatar}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{card.tags.length} tags</span>
                        </div>
                          <div className="mt-4">
                            <ApprovalControls
                              status={approvals[card.id]}
                              onChange={(status) => setApprovalStatus(workspace.slug, card.id, status)}
                            />
                          </div>
                        </div>
                      </div>
                    </SortableCard>
                  ))}
                  {byColumn[column]?.length ? null : (
                    <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-white/50 p-4 text-sm text-muted-foreground">
                      Solte um card aqui.
                    </div>
                  )}
                </div>
              </SortableContext>
            </PipelineLane>
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function LibraryModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Biblioteca de arquivos</h2>
          <p className="text-sm text-muted-foreground">Tags, origem e link Drive para cada asset.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          <Button size="sm">
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workspace.assets.map((asset, index) => (
          <ModuleCard key={asset.id} title={asset.title} subtitle={`${asset.type} · ${asset.source}`} badge={asset.size}>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.08em] text-muted-foreground">Preview</p>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                  <div className="h-16 rounded-lg bg-muted" />
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{asset.source}</span>
                    <span>{asset.type}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{asset.tag}</Badge>
                <span className="text-xs text-muted-foreground">{asset.size}</span>
              </div>
            </div>
          </ModuleCard>
        ))}
      </div>
    </div>
  );
}

function FeedModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [posts, setPosts] = useState(workspace.posts);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPosts((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Feed Preview</h2>
          <p className="text-sm text-muted-foreground">Reorganize o grid do Instagram antes de publicar.</p>
        </div>
        <Badge variant="outline">
          <LayoutGrid className="mr-1 h-3 w-3" />
          3 colunas
        </Badge>
      </div>

      <div className="surface-card flex gap-4 overflow-x-auto rounded-2xl p-4">
        {posts.map((post, index) => (
          <div key={`${post.id}-story`} className="min-w-[88px] text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted text-sm font-semibold text-foreground">
                {index + 1}
            </div>
            <p className="mt-2 truncate text-[12px] font-medium text-foreground">{post.channel}</p>
          </div>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={posts.map((post) => post.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <SortableCard key={post.id} id={post.id}>
                <Card className="surface-card overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                            {index + 1}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{workspace.name}</p>
                          <p className="text-[11px] text-muted-foreground">{post.channel}</p>
                        </div>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="mt-4 aspect-[4/5] rounded-2xl border border-border bg-muted p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg border border-border bg-white px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
                          #{index + 1}
                        </span>
                        <Pin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-10 space-y-3">
                        <p className="font-display text-lg font-semibold tracking-tight text-foreground">{post.title}</p>
                        <p className="text-[12px] text-muted-foreground">{post.scheduledAt}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-foreground">
                        <Heart className="h-4 w-4" />
                        <MessageCircle className="h-4 w-4" />
                        <Send className="h-4 w-4" />
                      </div>
                      <Badge variant="outline">{post.status}</Badge>
                    </div>

                    <p className="mt-3 text-[12px] leading-6 text-muted-foreground">
                      <span className="font-semibold text-foreground">@{workspace.slug}</span> {post.title}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Pill key={tag}>{tag}</Pill>
                      ))}
                    </div>
                  </div>
                </Card>
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function PostsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [posts, setPosts] = useState<PostItem[]>(
    workspace.posts.map((post) => ({
      ...post,
      caption: `${post.title} com foco em clareza, impacto visual e CTA direto.`,
      location: 'Recife, PE',
      mediaUrl: ''
    }))
  );
  const [channelFilter, setChannelFilter] = useState<'todos' | 'Feed' | 'Reels' | 'Stories'>('todos');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const approvals = useWorkspaceStore((state) => state.approvalsByWorkspace[workspace.slug] ?? {});
  const setApprovalStatus = useWorkspaceStore((state) => state.setApprovalStatus);

  useEffect(() => {
    setPosts(
      workspace.posts.map((post) => ({
        ...post,
        caption: `${post.title} com foco em clareza, impacto visual e CTA direto.`,
        location: 'Recife, PE',
        mediaUrl: ''
      }))
    );
  }, [workspace.posts]);

  const filteredPosts = posts.filter((post) => (channelFilter === 'todos' ? true : post.channel === channelFilter));

  async function handleRewriteCaption(post: PostItem) {
    try {
      const content = await requestAiAction<string>('generateCaption', {
        topic: post.title,
        tone: 'humano e convincente'
      });
      setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, caption: content } : item)));
      toast.success('Legenda reescrita pela IA.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível reescrever a legenda.');
    }
  }

  async function handlePublish(post: PostItem) {
    setPublishingId(post.id);

    try {
      const response = await fetch('/api/integrations/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          mediaType: normalizeText(post.channel) === 'reels' ? 'REELS' : 'IMAGE'
        })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? 'Falha ao enviar para a Meta.');
      }

      setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, status: 'Publicado' } : item)));
      toast.success(payload.message ?? 'Post publicado com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao publicar no Instagram.');
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <ModuleCard title="Posts agendados" subtitle="Status, legenda e desempenho por canal">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {['todos', 'Feed', 'Reels', 'Stories'].map((channel) => (
          <Button
            key={channel}
            variant={channelFilter === channel ? 'default' : 'outline'}
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={() => setChannelFilter(channel as typeof channelFilter)}
          >
            {channel}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filteredPosts.map((post, index) => (
          <div key={post.id} className="group relative">
            <SideBlockActions
              label="post"
              onEdit={() => toast.info(`Edicao lateral pronta para ${post.title}.`)}
              onDelete={() => setPosts((current) => current.filter((item) => item.id !== post.id))}
            />
            <div className="surface-muted rounded-[1.5rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{post.title}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{post.channel}</p>
                </div>
                <Badge variant={post.status === 'Publicado' ? 'success' : post.status === 'Agendado' ? 'warning' : 'outline'}>
                  {post.status}
                </Badge>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background p-4">
                <p className="text-[10px] tracking-[0.08em] text-muted-foreground">Legenda base</p>
                <Textarea
                  value={post.caption}
                  onChange={(event) =>
                    setPosts((current) =>
                      current.map((item) => (item.id === post.id ? { ...item, caption: event.target.value } : item))
                    )
                  }
                  className="mt-2 min-h-[120px] border-border bg-white"
                />
              </div>
              <div className="mt-4 grid gap-3">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Agendamento</span>
                  <Input
                    type="datetime-local"
                    value={post.scheduledAt.replace(' ', 'T')}
                    onChange={(event) =>
                      setPosts((current) =>
                        current.map((item) =>
                          item.id === post.id ? { ...item, scheduledAt: event.target.value.replace('T', ' ') } : item
                        )
                      )
                    }
                    className="rounded-2xl border-white/80 bg-white"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Media URL publica</span>
                  <Input
                    value={post.mediaUrl}
                    onChange={(event) =>
                      setPosts((current) =>
                        current.map((item) => (item.id === post.id ? { ...item, mediaUrl: event.target.value } : item))
                      )
                    }
                    placeholder="https://..."
                    className="rounded-2xl border-white/80 bg-white"
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Engajamento</p>
                  <p className="font-medium text-foreground">{post.engagement}</p>
                </div>
                <ApprovalControls
                  status={approvals[post.id]}
                  onChange={(status) => setApprovalStatus(workspace.slug, post.id, status)}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRewriteCaption(post)}>
                  <Sparkles className="h-4 w-4" />
                  Reescrever legenda
                </Button>
                <Button size="sm" onClick={() => handlePublish(post)} disabled={publishingId === post.id}>
                  {publishingId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar para Meta
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

function MetricsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [activeSeries, setActiveSeries] = useState(workspace.metrics.series[0]?.name ?? 'Alcance');
  const [analysis, setAnalysis] = useState<{
    summary: string;
    insights: string[];
    risks: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const currentSeries = workspace.metrics.series.find((series) => series.name === activeSeries) ?? workspace.metrics.series[0];

  const chartData = currentSeries?.points.map((point) => ({
    label: point.label,
    value: point.value
  }));

  async function handleAnalyzeMetrics() {
    setLoading(true);

    try {
      const content = await requestAiAction<{
        summary: string;
        insights: string[];
        risks: string[];
      }>('analyzeMetrics', {
        summary: workspace.metrics.summary.map((item) => `${item.label}: ${item.value} (${item.trend ?? ''})`).join(' | '),
        series: workspace.metrics.series.map((series) => ({
          name: series.name,
          value: series.points.reduce((sum, point) => sum + point.value, 0)
        }))
      });

      setAnalysis(content);
      toast.success('Leitura de métricas pronta.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível analisar as métricas.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workspace.metrics.summary.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <ModuleCard title="Performance semanal" subtitle="Leitura de alcance e engajamento">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {workspace.metrics.series.map((series) => (
                <Button
                  key={series.name}
                  variant={series.name === activeSeries ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveSeries(series.name)}
                >
                  {series.name}
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={handleAnalyzeMetrics} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              IA analisa
            </Button>
          </div>
          <div className="h-[340px] rounded-3xl border border-border bg-background p-4">
            <HydratedChart>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                  <XAxis dataKey="label" stroke="rgba(100,116,139,0.8)" />
                  <YAxis stroke="rgba(100,116,139,0.8)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </HydratedChart>
          </div>
        </ModuleCard>

        <ModuleCard title="Crescimento" subtitle="Comparativo de alcance e engajamento">
          <div className="space-y-4">
            <div className="h-[180px] rounded-3xl border border-border bg-background p-3">
              <HydratedChart>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="areaContentos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="rgba(100,116,139,0.8)" />
                    <YAxis stroke="rgba(100,116,139,0.8)" />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#0f766e" fill="url(#areaContentos)" />
                  </AreaChart>
                </ResponsiveContainer>
              </HydratedChart>
            </div>
            <div className="h-[180px] rounded-3xl border border-border bg-background p-3">
              <HydratedChart>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                    <XAxis dataKey="label" stroke="rgba(100,116,139,0.8)" />
                    <YAxis stroke="rgba(100,116,139,0.8)" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#14b8a6" radius={[12, 12, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </HydratedChart>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-background p-4">
              {analysis ? (
                <div className="space-y-3">
                  <p className="font-medium text-foreground">{analysis.summary}</p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Insights</p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {analysis.insights.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Riscos</p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {analysis.risks.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Analise de IA pendente"
                  description="Rode a leitura com IA para transformar as métricas em plano de ação."
                />
              )}
            </div>
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}

function CompetitorsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [analysis, setAnalysis] = useState<{
    summary: string;
    opportunities: string[];
    watchouts: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyzeCompetitors() {
    setLoading(true);

    try {
      const content = await requestAiAction<{
        summary: string;
        opportunities: string[];
        watchouts: string[];
      }>('analyzeCompetitors', {
        competitors: workspace.competitors.map((item) => item.name),
        niche: workspace.industry
      });

      setAnalysis(content);
      toast.success('Concorrentes analisados pela IA.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível analisar os concorrentes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ModuleCard title="Monitoramento" subtitle="Sinais, posts e engajamento por concorrente">
          <div className="space-y-4">
            {workspace.competitors.map((competitor) => (
              <div key={competitor.id} className="rounded-3xl border border-border bg-background p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{competitor.name}</p>
                    <p className="text-sm text-muted-foreground">{competitor.handle}</p>
                  </div>
                  <Badge variant={competitor.sentiment === 'Positivo' ? 'success' : competitor.sentiment === 'Neutro' ? 'warning' : 'danger'}>
                    {competitor.sentiment}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Posts</p>
                    <p className="mt-2 font-semibold">{competitor.posts}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Engajamento</p>
                    <p className="mt-2 font-semibold">{competitor.engagement}</p>
                  </div>
                  <div className="rounded-2xl border border-border p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Insight</p>
                    <p className="mt-2 font-semibold">{competitor.insight.slice(0, 32)}...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ModuleCard>

        <ModuleCard title="IA analisa concorrentes" subtitle="Resumo pronto para tomada de decisão">
          <div className="mb-4 flex justify-end">
            <Button size="sm" onClick={handleAnalyzeCompetitors} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Rodar analise
            </Button>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-[10px] tracking-[0.08em] text-muted-foreground">Resumo IA</p>
              <p className="mt-2 text-[13px] font-medium leading-6 text-foreground">
                {analysis?.summary ??
                  'Conteúdo com bastidores, prova social e CTA para DM está gerando mais tração que posts puramente educativos.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="text-[13px] font-medium">Ações recomendadas</p>
              <ul className="mt-3 space-y-2 text-[12px] text-muted-foreground">
                {(analysis?.opportunities ?? [
                  'Aumentar volume de reels com demonstração real',
                  'Replicar stories com enquete e sequência curta',
                  'Criar comparação direta entre produto e alternativa'
                ]).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            {analysis?.watchouts?.length ? (
              <div className="rounded-2xl border border-border bg-background p-5">
                <p className="text-[13px] font-medium">Pontos de atenção</p>
                <ul className="mt-3 space-y-2 text-[12px] text-muted-foreground">
                  {analysis.watchouts.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}

function ProductsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {workspace.products.map((product) => (
        <ModuleCard key={product.id} title={product.name} subtitle={product.audience} badge={product.price}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{product.benefit}</p>
            <p className="text-sm text-muted-foreground">{product.restrictions}</p>
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          </div>
        </ModuleCard>
      ))}
    </div>
  );
}

function CreatorsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {workspace.creators.map((creator) => (
        <ModuleCard key={creator.id} title={creator.name} subtitle={creator.handle} badge={creator.niche}>
          <div className="space-y-3">
            <div className="h-24 rounded-2xl border border-border bg-muted" />
            <p className="text-[13px] text-muted-foreground">{creator.history}</p>
            <Badge variant="outline">{creator.metrics}</Badge>
          </div>
        </ModuleCard>
      ))}
    </div>
  );
}

function AiChatModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [messages, setMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([
    {
      role: 'assistant',
      content: `Olá, sou a IA do ${workspace.name}. Posso gerar ideias, roteiros, stories, captions e análises.`
    }
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          prompt: trimmed,
          workspace: workspace.name
        })
      });

      const payload = await response.json();
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: payload?.content ?? 'Não consegui responder agora, mas o fluxo está pronto.' }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            'Não consegui falar com a IA agora. Tente novamente em alguns segundos.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.75fr]">
      <ModuleCard title="Chat IA" subtitle="Interface no estilo ChatGPT para a operação" badge="online">
        <div className="space-y-4">
          <div className="surface-muted max-h-[480px] space-y-3 overflow-y-auto rounded-2xl p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  'max-w-[85%] rounded-xl px-4 py-3 text-[13px] leading-6 shadow-sm',
                  message.role === 'assistant'
                    ? 'bg-white text-foreground'
                    : 'ml-auto bg-[#17171b] text-white'
                )}
              >
                {message.content}
              </div>
            ))}
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </div>
            ) : null}
          </div>
          <div className="surface-muted rounded-2xl p-4">
            <div className="flex gap-3">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Peça uma ideia, roteiro, story sequence ou análise..."
                className="min-h-[110px] flex-1 border-border bg-white"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {['Ideias', 'Roteiros', 'Stories'].map((tag) => (
                  <Pill key={tag}>{tag}</Pill>
                ))}
              </div>
              <Button onClick={sendPrompt} disabled={loading || !prompt.trim()}>
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Gere 5 ideias para reels',
              'Escreva um roteiro com CTA',
              'Analise meus concorrentes',
              'Planeje o calendário da semana'
            ].map((preset) => (
              <Button key={preset} variant="outline" size="sm" onClick={() => setPrompt(preset)}>
                {preset}
              </Button>
            ))}
          </div>
        </div>
      </ModuleCard>

      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[10px] tracking-[0.08em] text-muted-foreground">Persona ativa</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">{workspace.name}</p>
          <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
            A IA assume o contexto do workspace para gerar respostas acionáveis, curtas e prontas para operar.
          </p>
        </div>

        <ModuleCard title="Ferramentas IA" subtitle="Ações rápidas que o chat oferece" className="surface-muted">
          <div className="space-y-3">
            {[
              ['generateIdeas', 'Ideias de conteúdo'],
              ['generateScript', 'Roteiros completos'],
              ['generateStories', 'Sequências de stories'],
              ['analyzeMetrics', 'Leitura de métricas'],
              ['analyzeCompetitors', 'Benchmark de concorrência'],
              ['suggestCalendar', 'Calendário sugerido']
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-[1.35rem] border border-white/70 bg-white/88 p-4">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{key}</p>
                </div>
                <Badge variant="success">pronto</Badge>
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}

function BillingModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        {saasPlans.map((plan) => (
          <Card key={plan.name} className={cn('glass', plan.featured && 'border-foreground bg-[#17171b] text-background')}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className={plan.featured ? 'text-background' : ''}>{plan.name}</CardTitle>
                  <CardDescription className={plan.featured ? 'text-white/70' : ''}>{plan.price}/mês</CardDescription>
                </div>
                {plan.featured ? <Badge variant="success">Popular</Badge> : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>Usuários: {plan.limits.users === Infinity ? 'Ilimitado' : plan.limits.users}</p>
                <p>Ideias: {plan.limits.ideas === Infinity ? 'Ilimitado' : plan.limits.ideas}</p>
                <p>Storage: {plan.limits.storageGb === Infinity ? 'Ilimitado' : `${plan.limits.storageGb} GB`}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <ModuleCard title="Uso atual" subtitle="Limites e consumo por plano">
          <div className="space-y-4">
            {workspace.usage.map((usage) => {
              const percent = Math.min(100, Math.round((usage.used / usage.limit) * 100));
              return (
                <div key={usage.metric} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium">{usage.metric}</p>
                    <p className="text-muted-foreground">
                      {usage.used} / {usage.limit}
                    </p>
                  </div>
                  <div className="h-3 rounded-full bg-muted">
                    <div className="h-3 rounded-full bg-foreground" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ModuleCard>
        <ModuleCard title="Invoices" subtitle="Faturamento mensal e histórico">
          <div className="space-y-3">
            {workspace.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                <div>
                  <p className="font-medium">{invoice.number}</p>
                  <p className="text-sm text-muted-foreground">{invoice.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{invoice.amount}</p>
                  <Badge variant={invoice.status === 'Pago' ? 'success' : 'warning'}>{invoice.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}

function AdminModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [flags, setFlags] = useState(workspace.featureFlags);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('Social Media');
  const [memberFocus, setMemberFocus] = useState<WorkspaceViewMode>('social');
  const members = useWorkspaceStore((state) => state.membersByWorkspace[workspace.slug] ?? workspace.teamMembers);
  const addMember = useWorkspaceStore((state) => state.addMember);
  const removeMember = useWorkspaceStore((state) => state.removeMember);
  const updateMemberRole = useWorkspaceStore((state) => state.updateMemberRole);

  function handleAddMember() {
    const trimmed = memberName.trim();
    if (!trimmed) {
      toast.error('Digite o nome do membro.');
      return;
    }

    const result = addMember(workspace.slug, {
      id: `member-${Date.now()}`,
      name: trimmed,
      role: memberRole,
      focus: memberFocus,
      online: true,
      color: ['#2e2b54', '#ff5d83', '#5b66d6', '#ff9f5a', '#1d9f84'][members.length % 5] ?? '#2e2b54'
    });

    if (!result.ok) {
      toast.error(result.message ?? 'Não foi possível adicionar o membro.');
      return;
    }

    setMemberName('');
    toast.success('Membro adicionado ao workspace.');
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <ModuleCard title="Feature flags" subtitle="Ative e desative por empresa">
          <div className="space-y-3">
            {flags.map((flag) => (
              <button
                key={flag.id}
                type="button"
                onClick={() =>
                  setFlags((current) =>
                    current.map((item) => (item.id === flag.id ? { ...item, enabled: !item.enabled } : item))
                  )
                }
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-background p-4 text-left transition hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{flag.name}</p>
                  <p className="text-sm text-muted-foreground">{flag.description}</p>
                </div>
                <Badge variant={flag.enabled ? 'success' : 'outline'}>{flag.enabled ? 'on' : 'off'}</Badge>
              </button>
            ))}
          </div>
        </ModuleCard>

        <ModuleCard title="SaaS settings" subtitle="Multiempresa e permissões">
          <div className="space-y-3">
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
              <p className="mt-2 font-medium">{workspace.name}</p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Plano atual</p>
              <p className="mt-2 font-medium">{workspace.plan}</p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Permissões</p>
              <p className="mt-2 text-sm text-muted-foreground">Super Admin · Admin · Social Media · Filmmaker · Blogueira · Viewer</p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Membros online</p>
              <p className="mt-2 font-medium">{members.length} / 5 membros ativos nesta versão</p>
            </div>
          </div>
        </ModuleCard>
      </div>

      <ModuleCard title="Equipe do workspace" subtitle="Crie ate 5 membros e marque a hierarquia operacional">
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3 rounded-[1.75rem] border border-border bg-background p-4">
            <Input
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              placeholder="Nome do membro"
              className="rounded-2xl border-white/80 bg-white"
            />
            <label className="grid gap-2 text-sm text-muted-foreground">
              <span>Função</span>
              <select
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value)}
                className="h-11 rounded-2xl border border-white/80 bg-white px-4 text-foreground outline-none"
              >
                {['Coordenador', 'Social Media', 'Roteirista', 'Filmmaker', 'Viewer'].map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-muted-foreground">
              <span>Foco operacional</span>
              <select
                value={memberFocus}
                onChange={(event) => setMemberFocus(event.target.value as WorkspaceViewMode)}
                className="h-11 rounded-2xl border border-white/80 bg-white px-4 text-foreground outline-none"
              >
                <option value="general">Geral</option>
                <option value="production">Gravação</option>
                <option value="social">Social Media</option>
              </select>
            </label>
            <Button onClick={handleAddMember} className="w-full">
              <Plus className="h-4 w-4" />
              Adicionar membro
            </Button>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="rounded-[1.75rem] border border-border bg-background p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {getInitials(member.name)}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.role} · {member.focus === 'general' ? 'geral' : member.focus === 'production' ? 'gravacao' : 'social'}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:flex lg:items-center">
                    <select
                      value={member.role}
                      onChange={(event) => updateMemberRole(workspace.slug, member.id, event.target.value, member.focus)}
                      className="h-10 rounded-2xl border border-white/80 bg-white px-4 text-sm text-foreground outline-none"
                    >
                      {['Coordenador', 'Social Media', 'Roteirista', 'Filmmaker', 'Viewer'].map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={member.focus}
                      onChange={(event) =>
                        updateMemberRole(workspace.slug, member.id, member.role, event.target.value as WorkspaceViewMode)
                      }
                      className="h-10 rounded-2xl border border-white/80 bg-white px-4 text-sm text-foreground outline-none"
                    >
                      <option value="general">Geral</option>
                      <option value="production">Gravação</option>
                      <option value="social">Social Media</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => removeMember(workspace.slug, member.id)}>
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ModuleCard>

      <ModuleCard title="Notas internas" subtitle="Backoffice e decisões do time">
        <div className="grid gap-3 md:grid-cols-2">
          {workspace.notes.map((note) => (
            <div key={note.id} className="rounded-3xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{note.title}</p>
                <Badge variant="outline">{note.author}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{note.body}</p>
            </div>
          ))}
        </div>
      </ModuleCard>
    </div>
  );
}

export function WorkspaceModuleView({ workspace, module }: WorkspaceModuleProps) {
  const meta = moduleMeta[module];
  const ensureWorkspace = useWorkspaceStore((state) => state.ensureWorkspace);
  const viewMode = useWorkspaceStore((state) => state.viewModeByWorkspace[workspace.slug] ?? 'general');
  const members = useWorkspaceStore((state) => state.membersByWorkspace[workspace.slug] ?? workspace.teamMembers);
  const actingAs = useWorkspaceStore((state) => state.actingAsByWorkspace[workspace.slug] ?? workspace.teamMembers[0]?.id ?? '');
  const activeMember = members.find((member) => member.id === actingAs) ?? members[0];

  useEffect(() => {
    ensureWorkspace(workspace);
  }, [ensureWorkspace, workspace]);

  const scopedWorkspace = useMemo(
    () => filterWorkspaceByContext(workspace, viewMode, activeMember),
    [activeMember, viewMode, workspace]
  );

  const headerAction =
    module === 'dashboard' ? (
      <Button variant="outline">
        <Bot className="h-4 w-4" />
        Chat IA
      </Button>
    ) : module === 'ai' ? (
      <Button>
        <Sparkles className="h-4 w-4" />
        Novo prompt
      </Button>
    ) : module === 'pipeline' ? (
      <Button>
        <SquareKanban className="h-4 w-4" />
        Adicionar card
      </Button>
    ) : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={meta.title}
        description={meta.description}
        action={headerAction}
      />

      <ViewScopeBanner workspace={scopedWorkspace} viewMode={viewMode} activeMember={activeMember} />

      {module === 'dashboard' ? <DashboardModule workspace={scopedWorkspace} /> : null}
      {module === 'calendar' ? <CalendarModule workspace={scopedWorkspace} /> : null}
      {module === 'ideas' ? <IdeasModule workspace={scopedWorkspace} /> : null}
      {module === 'scripts' ? <ScriptsModule workspace={scopedWorkspace} /> : null}
      {module === 'stories' ? <StoriesModule workspace={scopedWorkspace} /> : null}
      {module === 'pipeline' ? <PipelineModule workspace={scopedWorkspace} /> : null}
      {module === 'library' ? <LibraryModule workspace={scopedWorkspace} /> : null}
      {module === 'feed' ? <FeedModule workspace={scopedWorkspace} /> : null}
      {module === 'posts' ? <PostsModule workspace={scopedWorkspace} /> : null}
      {module === 'metrics' ? <MetricsModule workspace={scopedWorkspace} /> : null}
      {module === 'competitors' ? <CompetitorsModule workspace={scopedWorkspace} /> : null}
      {module === 'products' ? <ProductsModule workspace={scopedWorkspace} /> : null}
      {module === 'creators' ? <CreatorsModule workspace={scopedWorkspace} /> : null}
      {module === 'ai' ? <AiChatModule workspace={scopedWorkspace} /> : null}
      {module === 'billing' ? <BillingModule workspace={scopedWorkspace} /> : null}
      {module === 'admin' ? <AdminModule workspace={scopedWorkspace} /> : null}

      <div className="rounded-3xl border border-border bg-white/70 p-4 text-sm text-muted-foreground shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>Workspace atual: {workspace.name}</p>
          <div className="flex flex-wrap gap-2">
            {navigationItems.slice(0, 5).map((item) => (
              <Link
                key={item.key}
                href={item.href(workspace.slug) as any}
                className="rounded-full border border-border bg-background px-3 py-1.5"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
