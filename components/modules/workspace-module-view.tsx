"use client";

import { useMemo, useState } from 'react';
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
  ChartSpline
} from 'lucide-react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
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
import { cn } from '@/lib/utils';
import type { ModuleKey } from '@/types';
import { toast } from 'sonner';

type WidgetKey = 'stats' | 'agenda' | 'stories' | 'pipeline' | 'ideas';

type WorkspaceModuleProps = {
  workspace: WorkspaceSnapshot;
  module: ModuleKey;
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
    <div className="flex flex-col gap-4 border-b border-border/80 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground shadow-sm">
          ContentOS
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend?: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
          {trend ? <Badge variant="success">{trend}</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
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
    <Card className={cn('glass', className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function formatDateLabel(date: string) {
  return date.replaceAll('-', '/');
}

function DashboardModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [widgets, setWidgets] = useState<WidgetKey[]>(['stats', 'agenda', 'stories', 'pipeline', 'ideas']);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
            <div key={story.id} className="rounded-[1.5rem] border border-border bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Story {index + 1}</p>
                  <p className="mt-2 font-display text-lg font-semibold">{story.title}</p>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-white">
                  {story.time}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-white/70">{story.hook}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-white/50">
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
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <ModuleCard
          title={`Olá, ${workspace.name}`}
          subtitle="Seu centro de comando para planejar, produzir e publicar conteúdo com IA."
          badge={workspace.plan}
          className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,118,110,0.88))] text-white"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Hoje</p>
              <p className="mt-3 font-display text-3xl font-semibold">{workspace.agenda.length}</p>
              <p className="mt-1 text-sm text-white/70">Eventos agendados</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Conteúdo</p>
              <p className="mt-3 font-display text-3xl font-semibold">{workspace.posts.length}</p>
              <p className="mt-1 text-sm text-white/70">Posts nesta semana</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Ideias</p>
              <p className="mt-3 font-display text-3xl font-semibold">{workspace.ideas.length}</p>
              <p className="mt-1 text-sm text-white/70">Ganchos aprovados</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button className="bg-white text-slate-900 hover:bg-white/90">
              <Bot className="h-4 w-4" />
              Abrir IA
            </Button>
            <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              <Plus className="h-4 w-4" />
              Criar post
            </Button>
          </div>
        </ModuleCard>

        <ModuleCard title="Métricas rápidas" subtitle="Resumo da operação">
          <div className="grid gap-3">
            {workspace.metrics.summary.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.trend}</p>
                </div>
                <p className="font-display text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>

      <Card className="glass p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Widgets arrastáveis</p>
            <p className="text-sm text-muted-foreground">Reordene os blocos do dashboard como no Notion e Linear.</p>
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

  const selectedLabel = selected?.toISOString().slice(0, 10);
  const events = workspace.calendarEvents.filter((event) => event.date === selectedLabel);

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
          <Badge variant="outline">Feed</Badge>
          <Badge variant="outline">Reels</Badge>
          <Badge variant="outline">Stories</Badge>
          <Badge variant="outline">Campanhas</Badge>
        </div>
      </ModuleCard>

      <ModuleCard title="Eventos do dia" subtitle={`Itens marcados para ${selectedLabel ? formatDateLabel(selectedLabel) : 'hoje'}`}>
        <div className="space-y-3">
          {events.length ? (
            events.map((event) => (
              <div key={event.id} className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">{event.type} · {event.owner}</p>
                </div>
                <Badge variant="outline">{event.date}</Badge>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              Sem eventos nesta data. Arraste conteúdos para este dia no calendário.
            </div>
          )}
        </div>
      </ModuleCard>
    </div>
  );
}

function IdeasModule({ workspace }: { workspace: WorkspaceSnapshot }) {
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
            <div className="flex gap-3">
              <Button>
                <Sparkles className="h-4 w-4" />
                Gerar 10 ideias
              </Button>
              <Button variant="outline">
                <Filter className="h-4 w-4" />
                Filtrar
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

      <div className="grid gap-4 md:grid-cols-3">
        {workspace.ideas.map((idea) => (
          <ModuleCard key={idea.id} title={idea.title} subtitle={idea.hook} badge={`${idea.score}% fit`}>
            <div className="flex flex-wrap gap-2">
              {idea.tags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          </ModuleCard>
        ))}
      </div>
    </div>
  );
}

function ScriptsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <ModuleCard title="Roteiros gerados" subtitle="Gancho, takes, CTA e storyboard" badge="IA">
        <div className="space-y-4">
          {workspace.scripts.map((script) => (
            <div key={script.id} className="rounded-3xl border border-border bg-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{script.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{script.hook}</p>
                </div>
                <Badge variant="success">Pronto</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {script.beats.map((beat) => (
                  <Pill key={beat}>{beat}</Pill>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CTA</p>
                <p className="mt-2 font-medium">{script.cta}</p>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>

      <ModuleCard title="Storyboard" subtitle="Preview rabisco para gravação">
        <div className="grid gap-3 sm:grid-cols-2">
          {['Cena 1', 'Cena 2', 'Cena 3', 'CTA final'].map((frame, index) => (
            <div key={frame} className="rounded-3xl border border-border bg-background p-4">
              <div className="aspect-[4/5] rounded-[1.5rem] border border-dashed border-border bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(20,184,166,0.06))] p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{frame}</span>
                  <span>0{index + 1}</span>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="h-3 w-3/4 rounded-full bg-foreground/10" />
                  <div className="h-3 w-full rounded-full bg-foreground/5" />
                  <div className="h-3 w-2/3 rounded-full bg-foreground/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>
    </div>
  );
}

function StoriesModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <ModuleCard title="Sequência de stories" subtitle="Preview estilo Instagram">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspace.stories.map((story, index) => (
            <div key={story.id} className="rounded-[1.75rem] border border-border bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Story {index + 1}</span>
                <span>{story.status}</span>
              </div>
              <p className="mt-4 font-display text-lg font-semibold">{story.title}</p>
              <p className="mt-3 text-sm text-white/70">{story.hook}</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Horário</p>
                <p className="mt-1 font-medium">{story.time}</p>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>

      <ModuleCard title="Sugestão IA" subtitle="Roteiro de 5 telas para aumentar resposta">
        <div className="space-y-3">
          {[
            'Tela 1: gancho rápido com dor principal',
            'Tela 2: prova visual com bastidor',
            'Tela 3: enquete para segmentar',
            'Tela 4: resultado ou transformação',
            'Tela 5: CTA para link ou DM'
          ].map((item, index) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
              <Badge variant="outline">{index + 1}</Badge>
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </ModuleCard>
    </div>
  );
}

function useSortableOrder<T extends { id: string }>(items: T[]) {
  const [orderedItems, setOrderedItems] = useState(items);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  return { orderedItems, sensors, onDragEnd };
}

function PipelineModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const columns = ['Ideia', 'Roteiro', 'Aprovado', 'Gravar', 'Gravado', 'Editar', 'Pronto', 'Postar', 'Postado'];
  const [cards, setCards] = useState(workspace.pipelineCards);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
    const overCard = cards.find((card) => card.id === over.id);
    if (!activeCard || !overCard) return;

    setCards((current) =>
      current.map((card) => (card.id === active.id ? { ...card, column: overCard.column } : card))
    );
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
        <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {columns.map((column) => (
            <Card key={column} className="glass p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{column}</p>
                  <p className="text-xs text-muted-foreground">{byColumn[column]?.length ?? 0} cards</p>
                </div>
                <Badge variant="outline">
                  <Plus className="mr-1 h-3 w-3" />
                  Novo
                </Badge>
              </div>
              <SortableContext items={(byColumn[column] ?? []).map((card) => card.id)} strategy={rectSortingStrategy}>
                <div className="space-y-3">
                  {(byColumn[column] ?? []).map((card) => (
                    <SortableCard key={card.id} id={card.id}>
                      <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
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
                        <div className="mt-3 flex flex-wrap gap-2">
                          {card.tags.map((tag) => (
                            <Pill key={tag}>{tag}</Pill>
                          ))}
                        </div>
                      </div>
                    </SortableCard>
                  ))}
                </div>
              </SortableContext>
            </Card>
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
        {workspace.assets.map((asset) => (
          <ModuleCard key={asset.id} title={asset.title} subtitle={`${asset.type} · ${asset.source}`} badge={asset.size}>
            <div className="space-y-3">
              <div className="rounded-3xl border border-border bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/50">Preview</p>
                <div className="mt-10 h-20 rounded-2xl border border-white/10 bg-white/5" />
              </div>
              <Badge variant="outline">{asset.tag}</Badge>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={posts.map((post) => post.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <SortableCard key={post.id} id={post.id}>
                <Card className="glass overflow-hidden">
                  <div className="aspect-square bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,118,110,0.85))] p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.22em] text-white/50">#{index + 1}</span>
                      <GripVertical className="h-4 w-4 text-white/50" />
                    </div>
                    <div className="mt-10 space-y-3">
                      <p className="font-display text-2xl font-semibold tracking-tight">{post.title}</p>
                      <p className="text-sm text-white/70">{post.channel}</p>
                    </div>
                    <div className="mt-10 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                          {tag}
                        </span>
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
  return (
    <ModuleCard title="Posts agendados" subtitle="Status, legenda e desempenho por canal">
      <div className="overflow-hidden rounded-3xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Conteúdo</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Agenda</th>
              <th className="px-4 py-3">Engajamento</th>
            </tr>
          </thead>
          <tbody>
            {workspace.posts.map((post) => (
              <tr key={post.id} className="border-t border-border">
                <td className="px-4 py-4">
                  <p className="font-medium">{post.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Pill key={tag}>{tag}</Pill>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">{post.channel}</td>
                <td className="px-4 py-4">
                  <Badge variant={post.status === 'Publicado' ? 'success' : post.status === 'Agendado' ? 'warning' : 'outline'}>
                    {post.status}
                  </Badge>
                </td>
                <td className="px-4 py-4">{post.scheduledAt}</td>
                <td className="px-4 py-4">{post.engagement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModuleCard>
  );
}

function MetricsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  const [activeSeries, setActiveSeries] = useState(workspace.metrics.series[0]?.name ?? 'Alcance');
  const currentSeries = workspace.metrics.series.find((series) => series.name === activeSeries) ?? workspace.metrics.series[0];

  const chartData = currentSeries?.points.map((point) => ({
    label: point.label,
    value: point.value
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workspace.metrics.summary.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <ModuleCard title="Performance semanal" subtitle="Leitura de alcance e engajamento">
          <div className="mb-4 flex flex-wrap gap-2">
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
          <div className="h-[340px] rounded-3xl border border-border bg-background p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="label" stroke="rgba(100,116,139,0.8)" />
                <YAxis stroke="rgba(100,116,139,0.8)" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ModuleCard>

        <ModuleCard title="Crescimento" subtitle="Comparativo de alcance e engajamento">
          <div className="space-y-4">
            <div className="h-[180px] rounded-3xl border border-border bg-background p-3">
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
            </div>
            <div className="h-[180px] rounded-3xl border border-border bg-background p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                  <XAxis dataKey="label" stroke="rgba(100,116,139,0.8)" />
                  <YAxis stroke="rgba(100,116,139,0.8)" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#14b8a6" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}

function CompetitorsModule({ workspace }: { workspace: WorkspaceSnapshot }) {
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
          <div className="space-y-3">
            <div className="rounded-3xl border border-border bg-foreground p-5 text-background">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Resumo IA</p>
              <p className="mt-3 font-medium leading-7">
                Conteúdo com bastidores, prova social e CTA para DM está gerando mais tração que posts puramente
                educativos.
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-5">
              <p className="text-sm font-medium">Ações recomendadas</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>• Aumentar volume de reels com demonstração real</li>
                <li>• Replicar stories com enquete e sequência curta</li>
                <li>• Criar comparação direta entre produto e alternativa</li>
              </ul>
            </div>
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
            <div className={cn('h-24 rounded-3xl bg-gradient-to-br', creator.accent)} />
            <p className="text-sm text-muted-foreground">{creator.history}</p>
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
            'Fallback local: posso gerar ideias, roteiros, histórias e análises. Conecte sua API de IA para respostas reais.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
      <ModuleCard title="Chat IA" subtitle="Interface no estilo ChatGPT para a operação" badge="online">
        <div className="space-y-4">
          <div className="max-h-[480px] space-y-3 overflow-y-auto rounded-3xl border border-border bg-background p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  'max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6',
                  message.role === 'assistant'
                    ? 'bg-muted text-foreground'
                    : 'ml-auto bg-foreground text-background'
                )}
              >
                {message.content}
              </div>
            ))}
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-3xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </div>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Peça uma ideia, roteiro, story sequence ou análise..."
              className="min-h-[110px] flex-1"
            />
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

      <ModuleCard title="Ferramentas IA" subtitle="Ações rápidas que o chat oferece">
        <div className="space-y-3">
          {[
            ['generateIdeas', 'Ideias de conteúdo'],
            ['generateScript', 'Roteiros completos'],
            ['generateStories', 'Sequências de stories'],
            ['analyzeMetrics', 'Leitura de métricas'],
            ['analyzeCompetitors', 'Benchmark de concorrência'],
            ['suggestCalendar', 'Calendário sugerido']
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
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
  );
}

function BillingModule({ workspace }: { workspace: WorkspaceSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        {saasPlans.map((plan) => (
          <Card key={plan.name} className={cn('glass', plan.featured && 'border-foreground bg-foreground text-background')}>
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
          </div>
        </ModuleCard>
      </div>

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

      {module === 'dashboard' ? <DashboardModule workspace={workspace} /> : null}
      {module === 'calendar' ? <CalendarModule workspace={workspace} /> : null}
      {module === 'ideas' ? <IdeasModule workspace={workspace} /> : null}
      {module === 'scripts' ? <ScriptsModule workspace={workspace} /> : null}
      {module === 'stories' ? <StoriesModule workspace={workspace} /> : null}
      {module === 'pipeline' ? <PipelineModule workspace={workspace} /> : null}
      {module === 'library' ? <LibraryModule workspace={workspace} /> : null}
      {module === 'feed' ? <FeedModule workspace={workspace} /> : null}
      {module === 'posts' ? <PostsModule workspace={workspace} /> : null}
      {module === 'metrics' ? <MetricsModule workspace={workspace} /> : null}
      {module === 'competitors' ? <CompetitorsModule workspace={workspace} /> : null}
      {module === 'products' ? <ProductsModule workspace={workspace} /> : null}
      {module === 'creators' ? <CreatorsModule workspace={workspace} /> : null}
      {module === 'ai' ? <AiChatModule workspace={workspace} /> : null}
      {module === 'billing' ? <BillingModule workspace={workspace} /> : null}
      {module === 'admin' ? <AdminModule workspace={workspace} /> : null}

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
