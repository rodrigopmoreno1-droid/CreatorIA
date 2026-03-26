"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Instagram,
  Layers,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCcw,
  Sparkles,
  Tag,
  X
} from 'lucide-react';
import { toast } from 'sonner';

import { PageIntro } from '@/components/platform/page-intro';
import { ScriptEditorModal } from '@/components/platform/script-editor-modal';
import { ScriptPreviewModal } from '@/components/platform/script-preview-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CONTENT_FORMAT_ORDER, getContentFormatBadgeClass, getContentFormatLabel, type ContentFormatKey } from '@/lib/content-format-meta';
import { buildEditableScript, type EditableScriptDraft } from '@/lib/script-drafts';
import {
  buildDefaultProductRules,
  computeEndDateFromPreset,
  daySpanFromRange,
  generateSchedulePlan,
  getDatesInRange,
  mergeTemplateProductRules,
  type PlannerConfig,
  type PlannerMode,
  type PlannerProductRule,
  type ScheduleGenerationResult,
  type SchedulePeriodPreset,
  type ScheduleTemplate
} from '@/lib/post-schedule-planner';
import { cn } from '@/lib/utils';
import type { PlannerBatchItem, ProductItem, ScriptItem, ScriptStatus } from '@/types/platform';

type WorkspaceTab = 'Calendário' | 'Feed' | 'Stories' | 'Rascunhos';
type StatusFilter = 'all' | ScriptStatus;
type ManualModalMode = 'new' | 'none';

type ManualDraftState = {
  title: string;
  contentType: ContentFormatKey;
  subOption: string;
  scheduledFor: string;
  productId: string;
  caption: string;
  notes: string;
};

const PT_BR_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PT_BR_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const SCRIPT_STATUS_LABELS: Record<ScriptStatus, string> = {
  draft: 'Rascunho',
  approved: 'Aprovado',
  production: 'Em produção',
  recording: 'Gravando',
  drive: 'No Drive',
  editing: 'Em edição',
  edited: 'Editado',
  scheduled: 'Agendado',
  posted: 'Postado'
};

const SCRIPT_STATUS_STYLES: Record<ScriptStatus, { dot: string; badge: string; border: string }> = {
  draft: {
    dot: 'bg-zinc-400',
    badge: 'border-zinc-200 bg-zinc-50 text-zinc-600',
    border: 'border-l-zinc-300'
  },
  approved: {
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    border: 'border-l-emerald-500'
  },
  production: {
    dot: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    border: 'border-l-amber-500'
  },
  recording: {
    dot: 'bg-rose-500',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    border: 'border-l-rose-500'
  },
  drive: {
    dot: 'bg-sky-500',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    border: 'border-l-sky-500'
  },
  editing: {
    dot: 'bg-purple-500',
    badge: 'border-purple-200 bg-purple-50 text-purple-700',
    border: 'border-l-purple-500'
  },
  edited: {
    dot: 'bg-indigo-500',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    border: 'border-l-indigo-500'
  },
  scheduled: {
    dot: 'bg-blue-500',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    border: 'border-l-blue-500'
  },
  posted: {
    dot: 'bg-slate-500',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    border: 'border-l-slate-500'
  }
};

const DEFAULT_SUB_OPTIONS: Record<ContentFormatKey, string> = {
  reels: '30s',
  stories: '3',
  video_curto: '60s',
  carrossel: '5',
  post: ''
};

const SUB_OPTIONS: Record<ContentFormatKey, ReadonlyArray<{ value: string; label: string }>> = {
  reels: [
    { value: '15s', label: '15s' },
    { value: '30s', label: '30s' },
    { value: '45s', label: '45s' },
    { value: '60s', label: '1 min' }
  ],
  stories: [
    { value: '1', label: '1 slide' },
    { value: '2', label: '2 slides' },
    { value: '3', label: '3 slides' },
    { value: '5', label: '5 slides' }
  ],
  video_curto: [
    { value: '30s', label: '30s' },
    { value: '60s', label: '1 min' },
    { value: '90s', label: '1,5 min' }
  ],
  carrossel: [
    { value: '3', label: '3 páginas' },
    { value: '5', label: '5 páginas' },
    { value: '7', label: '7 páginas' },
    { value: '10', label: '10 páginas' }
  ],
  post: []
};

function profileKey(workspace: string) {
  return `creatorai:instagram-profile:${workspace}`;
}

function templateKey(workspace: string) {
  return `creatorai:post-schedule-templates:${workspace}`;
}

function loadProfile(workspace: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(profileKey(workspace)) ?? '';
  } catch {
    return '';
  }
}

function saveProfile(workspace: string, handle: string) {
  try {
    localStorage.setItem(profileKey(workspace), handle);
  } catch {}
}

function loadTemplates(workspace: string): ScheduleTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(templateKey(workspace));
    if (!raw) return [];

    type LegacyPlannerProductRule = Omit<PlannerProductRule, 'storiesInPeriod'> & {
      storiesInPeriod?: number;
      storiesPerAppearance?: number;
    };
    type LegacyScheduleTemplate = Omit<ScheduleTemplate, 'productRules'> & {
      productRules?: LegacyPlannerProductRule[];
    };

    return (JSON.parse(raw) as LegacyScheduleTemplate[]).map((template) => ({
      ...template,
      productRules: (template.productRules ?? []).map((rule) => ({
        ...rule,
        storiesInPeriod:
          typeof rule.storiesInPeriod === 'number'
            ? rule.storiesInPeriod
            : Math.max(0, Number.parseInt(String(rule.storiesPerAppearance ?? 3), 10) || 0)
      }))
    }));
  } catch {
    return [];
  }
}

function saveTemplates(workspace: string, templates: ScheduleTemplate[]) {
  try {
    localStorage.setItem(templateKey(workspace), JSON.stringify(templates));
  } catch {}
}

function cloneProductRules(rules: PlannerProductRule[]) {
  return rules.map((rule) => ({
    ...rule,
    fixedWeekdays: [...rule.fixedWeekdays]
  }));
}

function shiftDateByDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateBR(isoDate: string) {
  if (!isoDate) return 'Sem data';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(isoDate: string) {
  if (!isoDate) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

function getScriptChannel(script: ScriptItem) {
  if (script.contentType === 'stories') return 'Stories';
  if (script.contentType === 'reels' || script.contentType === 'video_curto') return 'Reels';
  return 'Feed';
}

function getScriptPreviewIcon(script: ScriptItem) {
  if (script.contentType === 'stories') return Layers;
  if (script.contentType === 'reels' || script.contentType === 'video_curto') return Film;
  return ImageIcon;
}

function buildEmptyManualDraft(date: string): ManualDraftState {
  return {
    title: '',
    contentType: 'reels',
    subOption: DEFAULT_SUB_OPTIONS.reels,
    scheduledFor: date,
    productId: '',
    caption: '',
    notes: ''
  };
}

function buildEmptyStorySlides(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    objetivo: index === 0 ? 'Gancho' : index === count - 1 ? 'CTA' : 'Desenvolvimento',
    textoTela: '',
    falado: '',
    visual: ''
  }));
}

function buildEmptyCarrosselSlides(count: number) {
  return Array.from({ length: Math.max(2, count) }, (_, index) => ({
    numero: index + 1,
    titulo: '',
    subtitulo: '',
    conteudo: '',
    visual: ''
  }));
}

function buildEmptyScriptStructure(contentType: ContentFormatKey, subOption: string) {
  if (contentType === 'stories') {
    return {
      takes: [],
      storySlides: buildEmptyStorySlides(Number.parseInt(subOption || '3', 10) || 3),
      carrosselSlides: [],
      postFields: null
    };
  }

  if (contentType === 'carrossel') {
    return {
      takes: [],
      storySlides: [],
      carrosselSlides: buildEmptyCarrosselSlides(Number.parseInt(subOption || '5', 10) || 5),
      postFields: null
    };
  }

  if (contentType === 'post') {
    return {
      takes: [],
      storySlides: [],
      carrosselSlides: [],
      postFields: {
        conceito: '',
        tituloPeca: '',
        textoApoio: '',
        direcaoVisual: ''
      }
    };
  }

  return {
    takes: Array.from({ length: 5 }, () => ''),
    storySlides: [],
    carrosselSlides: [],
    postFields: null
  };
}

function formatBatchHeadline(batch: PlannerBatchItem) {
  return batch.mode === 'replan'
    ? `Replanejamento ${formatDateBR(batch.rangeStart)} → ${formatDateBR(batch.rangeEnd)}`
    : `Cronograma ${formatDateBR(batch.rangeStart)} → ${formatDateBR(batch.rangeEnd)}`;
}

function getBatchTone(status: PlannerBatchItem['status']) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'error') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'running') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-zinc-200 bg-zinc-50 text-zinc-600';
}

function ManualContentModal({
  products,
  initialDate,
  loading,
  onClose,
  onSave
}: {
  products: ProductItem[];
  initialDate: string;
  loading: boolean;
  onClose: () => void;
  onSave: (draft: ManualDraftState) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ManualDraftState>(() => buildEmptyManualDraft(initialDate));

  function setField<K extends keyof ManualDraftState>(key: K, value: ManualDraftState[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const subOptions = SUB_OPTIONS[draft.contentType];

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      subOption: DEFAULT_SUB_OPTIONS[draft.contentType]
    }));
  }, [draft.contentType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Nova peça</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">Criar rascunho manual</h3>
          </div>
          <button onClick={onClose} className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Título</label>
            <Input
              value={draft.title}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="Ex.: Reels de produto com virada de percepção"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Formato</label>
              <select
                value={draft.contentType}
                onChange={(event) => setField('contentType', event.target.value as ContentFormatKey)}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {CONTENT_FORMAT_ORDER.map((format) => (
                  <option key={format} value={format}>
                    {getContentFormatLabel(format)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Subopção</label>
              <select
                value={draft.subOption}
                onChange={(event) => setField('subOption', event.target.value)}
                disabled={!subOptions.length}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
              >
                {!subOptions.length ? (
                  <option value="">Sem subopção</option>
                ) : (
                  subOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Data planejada</label>
              <Input
                type="date"
                value={draft.scheduledFor}
                onChange={(event) => setField('scheduledFor', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Produto</label>
            <select
              value={draft.productId}
              onChange={(event) => setField('productId', event.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Sem produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Legenda inicial</label>
            <Textarea
              value={draft.caption}
              onChange={(event) => setField('caption', event.target.value)}
              rows={4}
              placeholder="Opcional. Você pode deixar uma observação inicial para esse rascunho."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Notas internas</label>
            <Textarea
              value={draft.notes}
              onChange={(event) => setField('notes', event.target.value)}
              rows={3}
              placeholder="Contexto, campanha, direção criativa..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)} disabled={loading || !draft.title.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar rascunho
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlannerBatchesPanel({
  batches,
  onRefresh,
  refreshing
}: {
  batches: PlannerBatchItem[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (!batches.length) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Geração em background</p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">Cronogramas recentes</h3>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>

        <div className="space-y-2">
          {batches.slice(0, 4).map((batch) => {
            const progress = batch.progressTotal > 0
              ? Math.min(100, Math.round((batch.progressCompleted / batch.progressTotal) * 100))
              : 0;

            return (
              <div key={batch.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{formatBatchHeadline(batch)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {batch.reason || 'Sem contexto adicional informado.'}
                    </p>
                  </div>
                  <span className={cn('rounded-full border px-3 py-1 text-[11px] font-medium', getBatchTone(batch.status))}>
                    {batch.status === 'queued'
                      ? 'Na fila'
                      : batch.status === 'running'
                        ? 'Processando'
                        : batch.status === 'completed'
                          ? 'Concluído'
                          : 'Com erro'}
                  </span>
                </div>

                <div className="mt-3 h-2 rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      batch.status === 'error' ? 'bg-rose-500' : batch.status === 'completed' ? 'bg-emerald-500' : 'bg-zinc-900'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{batch.progressCompleted}/{batch.progressTotal} peças</span>
                  {batch.summary?.generatedScripts !== undefined ? (
                    <span>{batch.summary.generatedScripts} geradas</span>
                  ) : null}
                  {batch.summary?.failedScripts ? (
                    <span>{batch.summary.failedScripts} com falha</span>
                  ) : null}
                  <span>Atualizado {formatDateTimeBR(batch.updatedAt)}</span>
                </div>

                {batch.errorMessage ? (
                  <p className="mt-2 text-xs text-rose-600">{batch.errorMessage}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SchedulePlannerModal({
  workspace,
  products,
  selectedDate,
  loading,
  onClose,
  onGenerate,
}: {
  workspace: string;
  products: ProductItem[];
  selectedDate: string | null;
  loading: boolean;
  onClose: () => void;
  onGenerate: (config: PlannerConfig, preview: ScheduleGenerationResult) => Promise<void> | void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initialStartDate = selectedDate && selectedDate >= today ? selectedDate : today;
  const [mode, setMode] = useState<PlannerMode>('create');
  const [periodPreset, setPeriodPreset] = useState<SchedulePeriodPreset>('7');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(computeEndDateFromPreset(initialStartDate, '7'));
  const [feedPerDay, setFeedPerDay] = useState(1);
  const [reason, setReason] = useState('');
  const [productRules, setProductRules] = useState<PlannerProductRule[]>(() => buildDefaultProductRules(products));
  const [templates, setTemplates] = useState<ScheduleTemplate[]>(() => loadTemplates(workspace));
  const [templatePickerId, setTemplatePickerId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);

  function persistTemplates(nextTemplates: ScheduleTemplate[]) {
    setTemplates(nextTemplates);
    saveTemplates(workspace, nextTemplates);
  }

  function applyPreset(nextPreset: Exclude<SchedulePeriodPreset, 'custom'>) {
    setPeriodPreset(nextPreset);
    setEndDate(computeEndDateFromPreset(startDate, nextPreset));
  }

  function setRule(productId: string, updater: Partial<PlannerProductRule> | ((current: PlannerProductRule) => PlannerProductRule)) {
    setProductRules((current) =>
      current.map((rule) => {
        if (rule.productId !== productId) {
          return rule;
        }

        return typeof updater === 'function' ? updater(rule) : { ...rule, ...updater };
      })
    );
  }

  function toggleWeekday(productId: string, weekday: number) {
    setRule(productId, (current) => ({
      ...current,
      fixedWeekdays: current.fixedWeekdays.includes(weekday)
        ? current.fixedWeekdays.filter((item) => item !== weekday)
        : [...current.fixedWeekdays, weekday].sort((left, right) => left - right)
    }));
  }

  function selectAllProducts() {
    setProductRules((current) => current.map((rule) => ({ ...rule, enabled: true, paused: false })));
  }

  function deselectAllProducts() {
    setProductRules((current) => current.map((rule) => ({ ...rule, enabled: false })));
  }

  function applyTemplate(template: ScheduleTemplate) {
    setTemplatePickerId(template.id);
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setFeedPerDay(template.feedPerDay);
    setPeriodPreset(template.periodPreset);
    setProductRules(mergeTemplateProductRules(template.productRules, products));
    const nextEndDate =
      template.periodPreset === 'custom'
        ? shiftDateByDays(startDate, Math.max(0, template.daySpan - 1))
        : computeEndDateFromPreset(startDate, template.periodPreset);
    setEndDate(nextEndDate);
    setTemplateFeedback(`Template "${template.name}" carregado.`);
  }

  function saveCurrentTemplate(duplicate = false) {
    const name = templateName.trim();
    if (!name) {
      setTemplateFeedback('Dê um nome ao template antes de salvar.');
      return;
    }

    const nowIso = new Date().toISOString();
    const existingTemplate = templates.find((template) => template.id === selectedTemplateId);
    const nextTemplate: ScheduleTemplate = {
      id: duplicate || !selectedTemplateId ? `template_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : selectedTemplateId,
      name: duplicate ? `${name} (cópia)` : name,
      periodPreset,
      daySpan: Math.max(1, daySpanFromRange(startDate, endDate)),
      feedPerDay,
      productRules: cloneProductRules(productRules),
      createdAt: duplicate || !existingTemplate ? nowIso : existingTemplate.createdAt,
      updatedAt: nowIso
    };

    const nextTemplates = [
      nextTemplate,
      ...templates.filter((template) => template.id !== nextTemplate.id)
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    persistTemplates(nextTemplates);
    setTemplatePickerId(nextTemplate.id);
    setSelectedTemplateId(nextTemplate.id);
    setTemplateName(nextTemplate.name);
    setTemplateFeedback(duplicate ? 'Template duplicado com sucesso.' : 'Template salvo com sucesso.');
  }

  const enabledRules = useMemo(
    () => productRules.filter((rule) => rule.enabled && !rule.paused),
    [productRules]
  );

  const plannerConfig = useMemo<PlannerConfig>(() => ({
    mode,
    periodPreset,
    startDate,
    endDate,
    feedPerDay,
    reason,
    templateId: selectedTemplateId || undefined,
    productRules
  }), [mode, periodPreset, startDate, endDate, feedPerDay, reason, selectedTemplateId, productRules]);

  const preview = useMemo(
    () => generateSchedulePlan(plannerConfig, products),
    [plannerConfig, products]
  );

  const fixedWeekdayLabels = useMemo(
    () => PT_BR_WEEKDAYS.map((label, index) => ({ label, index })),
    []
  );

  const numDays = useMemo(
    () => getDatesInRange(startDate, endDate).length,
    [startDate, endDate]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <span className="text-sm font-semibold text-zinc-700">Planejar cronograma</span>
            <p className="mt-1 text-xs text-zinc-400">
              Gere peças reais em rascunho usando o mesmo motor de Conteúdo e acompanhe o processamento em background.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Templates</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Salve um modelo recorrente e preserve os dias fixos quando reutilizar o cronograma.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!templates.length || !templatePickerId}
                    onClick={() => {
                      const template = templates.find((item) => item.id === templatePickerId);
                      if (template) {
                        applyTemplate(template);
                      }
                    }}
                  >
                    Carregar template
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => saveCurrentTemplate(false)}>
                    {selectedTemplateId ? 'Atualizar template' : 'Salvar template'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => saveCurrentTemplate(true)}>
                    Duplicar
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Templates salvos</label>
                  <select
                    value={templatePickerId}
                    onChange={(event) => setTemplatePickerId(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  >
                    <option value="">Selecione um template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-zinc-500">Nome do template</label>
                  <Input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Ex.: Semana padrão"
                  />
                </div>
              </div>

              {templateFeedback ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {templateFeedback}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'create', label: 'Novo cronograma' },
                  { key: 'replan', label: 'Replanejar intervalo' }
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setMode(option.key);
                      if (option.key === 'replan' && startDate < today) {
                        setStartDate(today);
                        if (periodPreset !== 'custom') {
                          setEndDate(computeEndDateFromPreset(today, periodPreset));
                        }
                      }
                    }}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                      mode === option.key
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-zinc-500">Período</label>
                <div className="flex flex-wrap gap-2">
                  {(['1', '7', '15', '30'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        periodPreset === preset
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      )}
                    >
                      {preset} dia{preset === '1' ? '' : 's'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPeriodPreset('custom')}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      periodPreset === 'custom'
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    )}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_180px]">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Início</label>
                  <Input
                    type="date"
                    value={startDate}
                    min={mode === 'replan' ? today : undefined}
                    onChange={(event) => {
                      const nextStartDate = event.target.value;
                      setStartDate(nextStartDate);
                      if (periodPreset !== 'custom') {
                        setEndDate(computeEndDateFromPreset(nextStartDate, periodPreset));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Fim</label>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setPeriodPreset('custom');
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-400">Peças de feed por dia</label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={feedPerDay}
                    onChange={(event) => setFeedPerDay(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-zinc-500">Motivo / contexto do planejamento</label>
                <Textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder={
                    mode === 'replan'
                      ? 'Ex.: produto esgotado, nova campanha, ajuste de prioridade...'
                      : 'Ex.: semana padrão, lançamento, campanha de emagrecimento...'
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500">Produtos e regras operacionais</label>
                  <p className="mt-1 text-sm text-zinc-600">
                    Defina aparições, stories por produto, repetição e dias fixos. O cronograma vira rascunho rico, não placeholder.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllProducts}>
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllProducts}>
                    Deselecionar todos
                  </Button>
                </div>
              </div>

              {products.length === 0 ? (
                <p className="mt-4 text-sm italic text-zinc-400">Nenhum produto cadastrado ainda.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {productRules.map((rule) => {
                    const disabled = !rule.enabled;

                    return (
                      <div
                        key={rule.productId}
                        className={cn(
                          'rounded-2xl border p-4 transition-colors',
                          disabled ? 'border-zinc-200 bg-zinc-50/60' : 'border-zinc-200 bg-white'
                        )}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start">
                          <div className="flex items-center gap-3 md:w-[240px]">
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={() => setRule(rule.productId, { enabled: !rule.enabled, paused: false })}
                              className="rounded"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-800">{rule.productName}</p>
                              <p className="text-[11px] text-zinc-400">
                                {rule.fixedWeekdays.length
                                  ? `Dias fixos: ${rule.fixedWeekdays.map((weekday) => PT_BR_WEEKDAYS[weekday]).join(', ')}`
                                  : 'Sem dias fixos: o restante será distribuído automaticamente.'}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setRule(rule.productId, (current) => ({ ...current, allDays: !current.allDays, enabled: true, paused: false }))}
                                className={cn(
                                  'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                                  rule.allDays
                                    ? 'border-zinc-900 bg-zinc-900 text-white'
                                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                )}
                              >
                                Todos os dias
                              </button>
                              <button
                                type="button"
                                onClick={() => setRule(rule.productId, (current) => ({ ...current, paused: !current.paused, enabled: current.paused ? current.enabled : true }))}
                                className={cn(
                                  'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                                  rule.paused
                                    ? 'border-amber-500 bg-amber-500 text-white'
                                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                )}
                              >
                                {rule.paused ? 'Pausado' : 'Ativo'}
                              </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                              <div>
                                <label className="mb-1 block text-[11px] text-zinc-400">Aparições no período</label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={rule.allDays ? numDays : rule.appearancesInPeriod}
                                  disabled={disabled || rule.paused || rule.allDays}
                                  onChange={(event) =>
                                    setRule(rule.productId, {
                                      appearancesInPeriod: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                                      enabled: true
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[11px] text-zinc-400">Stories por produto no período</label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={12}
                                  value={rule.storiesInPeriod}
                                  disabled={disabled || rule.paused}
                                  onChange={(event) =>
                                    setRule(rule.productId, {
                                      storiesInPeriod: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                                      enabled: true
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[11px] text-zinc-400">Repetição seguida</label>
                                <select
                                  value={rule.consecutiveRule}
                                  disabled={disabled || rule.paused}
                                  onChange={(event) =>
                                    setRule(rule.productId, {
                                      consecutiveRule: event.target.value as PlannerProductRule['consecutiveRule'],
                                      enabled: true
                                    })
                                  }
                                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                >
                                  <option value="avoid">Evitar dias seguidos</option>
                                  <option value="allow">Pode repetir</option>
                                  <option value="force">Priorizar repetição</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="mb-1 block text-[11px] text-zinc-400">Dias fixos por semana (opcional)</label>
                              <div className="flex flex-wrap gap-1.5">
                                {fixedWeekdayLabels.map((weekday) => (
                                  <button
                                    key={`${rule.productId}-${weekday.index}`}
                                    type="button"
                                    disabled={disabled || rule.paused || rule.allDays}
                                    onClick={() => toggleWeekday(rule.productId, weekday.index)}
                                    className={cn(
                                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                                      rule.fixedWeekdays.includes(weekday.index)
                                        ? 'border-zinc-900 bg-zinc-900 text-white'
                                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                                      (disabled || rule.paused || rule.allDays) && 'cursor-not-allowed opacity-40'
                                    )}
                                  >
                                    {weekday.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Resumo do cronograma</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] text-zinc-400">Período</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">{numDays} dia{numDays === 1 ? '' : 's'}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDateBR(startDate)} até {formatDateBR(endDate)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] text-zinc-400">Produtos ativos</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">{enabledRules.length}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {productRules.filter((rule) => rule.enabled).length} selecionados · {productRules.filter((rule) => rule.paused).length} pausados
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] text-zinc-400">Peças de feed</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">{preview.summary.totalFeedPosts}</p>
                  <p className="mt-1 text-xs text-zinc-500">Reels, carrossel, post estático e vídeo curto entram como rascunho.</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] text-zinc-400">Sequências de stories</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-800">{preview.summary.totalStoryPosts}</p>
                  <p className="mt-1 text-xs text-zinc-500">Cada item já vira sequência editável com slides reais.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Distribuição por produto</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    O cronograma respeita dias fixos e redistribui apenas o que continuar flexível.
                  </p>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-500">
                  {preview.summary.totalPosts} peças previstas
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {preview.summary.products.length ? (
                  preview.summary.products.map((productSummary) => (
                    <div key={productSummary.productId} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-800">{productSummary.productName}</p>
                        <span className="text-xs text-zinc-500">
                          {productSummary.scheduledDates.length} dia{productSummary.scheduledDates.length === 1 ? '' : 's'} · {productSummary.storiesTotal} story{productSummary.storiesTotal === 1 ? '' : 's'} no período
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        {productSummary.fixedDates.length
                          ? `Fixos: ${productSummary.fixedDates.map((date) => formatDateBR(date)).join(', ')}.`
                          : 'Sem dias fixos.'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Dias no período: {productSummary.scheduledDates.map((date) => formatDateBR(date)).join(', ')}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400">
                    Ative pelo menos um produto para visualizar a distribuição.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button
                onClick={() => onGenerate(plannerConfig, preview)}
                disabled={loading || numDays === 0 || preview.summary.totalPosts === 0}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {mode === 'replan' ? 'Recriar intervalo' : 'Gerar cronograma'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramPreview({
  scripts,
  profile,
  onProfileChange,
  onScriptClick,
}: {
  scripts: ScriptItem[];
  profile: string;
  onProfileChange: (val: string) => void;
  onScriptClick: (script: ScriptItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  const feedScripts = useMemo(
    () =>
      [...scripts]
        .filter((script) => script.scheduledFor && script.contentType !== 'stories')
        .sort((left, right) => right.scheduledFor.localeCompare(left.scheduledFor)),
    [scripts]
  );

  function handleSave() {
    onProfileChange(draft.startsWith('@') ? draft : `@${draft}`);
    setEditing(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-orange-400 text-white">
              <Instagram className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex gap-1">
                  <input
                    className="flex-1 rounded px-2 py-1 text-sm ring-1 ring-zinc-300 focus:outline-none focus:ring-zinc-500"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="@seuperfil"
                    autoFocus
                  />
                  <button onClick={handleSave} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white">
                    OK
                  </button>
                </div>
              ) : (
                <button onClick={() => { setDraft(profile); setEditing(true); }} className="group flex items-center gap-1">
                  <span className="text-sm font-semibold text-zinc-900">{profile || 'Definir @perfil'}</span>
                </button>
              )}
              <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                <span><strong className="text-zinc-900">{feedScripts.length}</strong> peças no feed</span>
              </div>
            </div>
          </div>
        </div>

        {feedScripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <LayoutGrid className="mb-2 h-8 w-8 text-zinc-200" />
            <p className="text-xs text-zinc-400">Nenhuma peça de feed agendada ainda.</p>
            <p className="mt-0.5 text-xs text-zinc-300">Quando o cronograma gerar rascunhos com data, o preview aparece aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-px bg-zinc-200">
            {feedScripts.map((script) => {
              const Icon = getScriptPreviewIcon(script);
              return (
                <button
                  key={script.id}
                  onClick={() => onScriptClick(script)}
                  className="group relative overflow-hidden bg-zinc-100"
                  style={{ aspectRatio: '1/1' }}
                >
                  <div className="flex h-full w-full items-center justify-center bg-zinc-100">
                    <Icon className="h-5 w-5 text-zinc-300" />
                  </div>

                  <div className={cn('absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-white shadow-sm', SCRIPT_STATUS_STYLES[script.status].dot)} />

                  <div className="absolute left-1 top-1">
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-medium', getContentFormatBadgeClass(script.contentType))}>
                      {getContentFormatLabel(script.contentType)}
                    </span>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                    <span className="line-clamp-2 px-1 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {script.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({
  scripts,
  year,
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onNewDraft,
  dragOver,
  onDragOver,
  onDrop,
  onDragStart,
  onClickScript,
}: {
  scripts: ScriptItem[];
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onNewDraft: (date: string) => void;
  dragOver: string | null;
  onDragOver: (date: string) => void;
  onDrop: (date: string) => void;
  onDragStart: (scriptId: string) => void;
  onClickScript: (script: ScriptItem) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const scriptsByDate = useMemo(() => {
    const map: Record<string, ScriptItem[]> = {};
    scripts.forEach((script) => {
      if (!script.scheduledFor) return;
      if (!map[script.scheduledFor]) map[script.scheduledFor] = [];
      map[script.scheduledFor].push(script);
    });
    return map;
  }, [scripts]);

  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedScripts = selectedDate ? (scriptsByDate[selectedDate] ?? []) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onPrevMonth} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold text-zinc-800">
          {PT_BR_MONTHS[month]} {year}
        </h3>
        <button onClick={onNextMonth} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {PT_BR_WEEKDAYS.map((day) => (
          <div key={day} className="py-1 text-center text-[10px] font-medium text-zinc-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 gap-px">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const isoDate = dateStr(day);
          const dayScripts = scriptsByDate[isoDate] ?? [];
          const isToday = isoDate === today;
          const isSelected = isoDate === selectedDate;
          const isDragTarget = isoDate === dragOver;

          return (
            <div
              key={isoDate}
              onClick={() => onSelectDate(isoDate)}
              onDragOver={(event) => { event.preventDefault(); onDragOver(isoDate); }}
              onDrop={() => onDrop(isoDate)}
              className={cn(
                'relative min-h-[58px] cursor-pointer rounded-lg p-1 transition-colors',
                isSelected
                  ? 'bg-zinc-900 text-white'
                  : isToday
                    ? 'bg-zinc-100'
                    : isDragTarget
                      ? 'bg-blue-50 ring-1 ring-blue-300'
                      : 'hover:bg-zinc-50'
              )}
            >
              <span className={cn(
                'mb-1 block text-xs font-medium leading-none',
                isSelected ? 'text-white' : isToday ? 'text-zinc-900' : 'text-zinc-700'
              )}>
                {day}
              </span>

              <div className="flex flex-wrap gap-0.5">
                {dayScripts.slice(0, 5).map((script) => (
                  <button
                    key={script.id}
                    draggable
                    onDragStart={(event) => { event.stopPropagation(); onDragStart(script.id); }}
                    onClick={(event) => { event.stopPropagation(); onClickScript(script); }}
                    title={script.title}
                    className={cn('h-2 w-2 rounded-full', SCRIPT_STATUS_STYLES[script.status].dot)}
                  />
                ))}
                {dayScripts.length > 5 ? (
                  <span className={cn('text-[9px] leading-none', isSelected ? 'text-zinc-300' : 'text-zinc-400')}>
                    +{dayScripts.length - 5}
                  </span>
                ) : null}
              </div>

              {!isSelected ? (
                <button
                  onClick={(event) => { event.stopPropagation(); onNewDraft(isoDate); }}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600"
                  title="Nova peça neste dia"
                >
                  <Plus className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {selectedDate ? (
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-700">{formatDateBR(selectedDate)}</p>
            <button onClick={() => onNewDraft(selectedDate)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
              <Plus className="h-3 w-3" />
              Nova peça
            </button>
          </div>

          {selectedScripts.length === 0 ? (
            <p className="text-xs italic text-zinc-400">Nenhuma peça neste dia.</p>
          ) : (
            selectedScripts.map((script) => (
              <button
                key={script.id}
                draggable
                onDragStart={() => onDragStart(script.id)}
                onClick={() => onClickScript(script)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border-l-2 bg-zinc-50 p-2 text-left transition hover:bg-zinc-100',
                  SCRIPT_STATUS_STYLES[script.status].border
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', SCRIPT_STATUS_STYLES[script.status].dot)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-800">{script.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(script.contentType))}>
                      {getContentFormatLabel(script.contentType)}
                    </span>
                    {script.productName ? (
                      <span className="text-[10px] text-violet-600">{script.productName}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function ContentListItem({
  script,
  onClick
}: {
  script: ScriptItem;
  onClick: () => void;
}) {
  const Icon = getScriptPreviewIcon(script);

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-l-2 bg-white p-3 text-left transition hover:bg-zinc-50',
        SCRIPT_STATUS_STYLES[script.status].border
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50">
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{script.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(script.contentType))}>
            {getContentFormatLabel(script.contentType)}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', SCRIPT_STATUS_STYLES[script.status].badge)}>
            {SCRIPT_STATUS_LABELS[script.status]}
          </span>
          {script.scheduledFor ? (
            <span className="text-[10px] text-zinc-500">{formatDateBR(script.scheduledFor)}</span>
          ) : null}
          {script.productName ? (
            <span className="text-[10px] text-violet-600">{script.productName}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function PostsWorkspace({
  workspace,
  products = [],
  scripts = [],
  plannerBatches = [],
}: {
  workspace: string;
  products?: ProductItem[];
  scripts?: ScriptItem[];
  plannerBatches?: PlannerBatchItem[];
}) {
  const now = new Date();

  const [profile, setProfile] = useState<string>(() => loadProfile(workspace));
  const [scriptsState, setScriptsState] = useState<ScriptItem[]>(scripts);
  const [batchesState, setBatchesState] = useState<PlannerBatchItem[]>(plannerBatches);
  const [refreshingWorkspace, setRefreshingWorkspace] = useState(false);
  const [plannerSubmitting, setPlannerSubmitting] = useState(false);
  const [manualModal, setManualModal] = useState<ManualModalMode>('none');
  const [manualModalDate, setManualModalDate] = useState(now.toISOString().slice(0, 10));
  const [creatingManual, setCreatingManual] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Calendário');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | ContentFormatKey>('all');
  const [filterProductId, setFilterProductId] = useState('');
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(now.toISOString().slice(0, 10));
  const [viewingScript, setViewingScript] = useState<ScriptItem | null>(null);
  const [editingScript, setEditingScript] = useState<EditableScriptDraft | null>(null);
  const [busyScriptId, setBusyScriptId] = useState<string | null>(null);
  const [draggingScriptId, setDraggingScriptId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [schedulingDates, setSchedulingDates] = useState<Record<string, string>>({});
  const batchStatusRef = useRef<Map<string, PlannerBatchItem['status']>>(new Map(plannerBatches.map((batch) => [batch.id, batch.status])));

  const activeBatches = useMemo(
    () => batchesState.filter((batch) => batch.status === 'queued' || batch.status === 'running'),
    [batchesState]
  );

  async function refreshWorkspaceData(silent = false) {
    if (!silent) {
      setRefreshingWorkspace(true);
    }

    try {
      const [scriptsResponse, batchesResponse] = await Promise.all([
        fetch(`/api/workspaces/${workspace}/scripts`, { cache: 'no-store' }),
        fetch(`/api/workspaces/${workspace}/planner-batches`, { cache: 'no-store' })
      ]);

      const scriptsPayload = (await scriptsResponse.json().catch(() => null)) as { scripts?: ScriptItem[]; error?: string } | null;
      const batchesPayload = (await batchesResponse.json().catch(() => null)) as { batches?: PlannerBatchItem[]; error?: string } | null;

      if (!scriptsResponse.ok) {
        throw new Error(scriptsPayload?.error ?? 'Não foi possível atualizar os conteúdos.');
      }

      if (!batchesResponse.ok) {
        throw new Error(batchesPayload?.error ?? 'Não foi possível atualizar os lotes do cronograma.');
      }

      setScriptsState(scriptsPayload?.scripts ?? []);
      setBatchesState(batchesPayload?.batches ?? []);
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a página.');
      }
    } finally {
      if (!silent) {
        setRefreshingWorkspace(false);
      }
    }
  }

  useEffect(() => {
    if (!activeBatches.length) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshWorkspaceData(true);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [workspace, activeBatches.length]);

  useEffect(() => {
    const previous = batchStatusRef.current;

    batchesState.forEach((batch) => {
      const previousStatus = previous.get(batch.id);
      if (!previousStatus) {
        previous.set(batch.id, batch.status);
        return;
      }

      if ((previousStatus === 'queued' || previousStatus === 'running') && batch.status === 'completed') {
        toast.success(
          batch.summary?.generatedScripts
            ? `${batch.summary.generatedScripts} rascunho(s) do cronograma já estão disponíveis.`
            : 'Cronograma processado com sucesso.'
        );
      }

      if ((previousStatus === 'queued' || previousStatus === 'running') && batch.status === 'error') {
        toast.error(batch.errorMessage || 'O cronograma terminou com erro.');
      }

      previous.set(batch.id, batch.status);
    });
  }, [batchesState]);

  function handleProfileChange(value: string) {
    setProfile(value);
    saveProfile(workspace, value);
  }

  async function handleCreateManualDraft(draft: ManualDraftState) {
    setCreatingManual(true);

    try {
      const product = products.find((item) => item.id === draft.productId);
      const emptyStructure = buildEmptyScriptStructure(draft.contentType, draft.subOption);
      const response = await fetch(`/api/workspaces/${workspace}/scripts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          status: 'draft',
          productId: product?.id,
          productName: product?.name,
          contentType: draft.contentType,
          subOption: draft.subOption,
          caption: draft.caption,
          notes: draft.notes,
          scheduledFor: draft.scheduledFor,
          dueDate: draft.scheduledFor,
          category: 'Manual',
          blockType: draft.contentType,
          takes: emptyStructure.takes,
          storySlides: emptyStructure.storySlides,
          carrosselSlides: emptyStructure.carrosselSlides,
          postFields: emptyStructure.postFields
        })
      });

      const payload = (await response.json().catch(() => null)) as { scripts?: ScriptItem[]; error?: string } | null;

      if (!response.ok || !payload?.scripts?.length) {
        throw new Error(payload?.error ?? 'Não foi possível criar o rascunho.');
      }

      const createdScript = payload.scripts[0];
      setScriptsState((current) => [createdScript, ...current]);
      setManualModal('none');
      setViewingScript(createdScript);
      toast.success('Rascunho criado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o rascunho.');
    } finally {
      setCreatingManual(false);
    }
  }

  async function handlePlannerGenerate(config: PlannerConfig, preview: ScheduleGenerationResult) {
    setPlannerSubmitting(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/planner-batches`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const payload = (await response.json().catch(() => null)) as {
        batch?: PlannerBatchItem;
        preview?: { totalItems?: number };
        error?: string;
      } | null;

      if (!response.ok || !payload?.batch) {
        throw new Error(payload?.error ?? 'Não foi possível iniciar a geração do cronograma.');
      }

      setBatchesState((current) => [payload.batch!, ...current.filter((batch) => batch.id !== payload.batch!.id)]);
      setPlannerOpen(false);
      setSelectedDate(config.startDate);
      toast.success(
        preview.posts.length === 1
          ? '1 peça foi colocada na fila de geração.'
          : `${preview.posts.length} peças foram colocadas na fila de geração.`
      );
      void refreshWorkspaceData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar o cronograma.');
    } finally {
      setPlannerSubmitting(false);
    }
  }

  async function handleScheduleScript(scriptId: string, scheduledFor: string) {
    try {
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'scheduled', scheduledFor })
      });
      if (!res.ok) throw new Error();
      setScriptsState(current =>
        current.map(s => s.id === scriptId ? { ...s, status: 'scheduled', scheduledFor } : s)
      );
      toast.success('Conteúdo agendado!');
    } catch {
      toast.error('Erro ao agendar.');
    }
  }

  async function handleApprove(scriptId: string) {
    setBusyScriptId(scriptId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      const payload = (await response.json().catch(() => null)) as { script?: ScriptItem; error?: string } | null;

      if (!response.ok || !payload?.script) {
        throw new Error(payload?.error ?? 'Erro ao aprovar.');
      }

      setScriptsState((current) => current.map((script) => (script.id === payload.script!.id ? payload.script! : script)));
      setViewingScript((current) => (current?.id === payload.script!.id ? payload.script! : current));
      toast.success('Conteúdo aprovado e enviado para Produção.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível aprovar.');
    } finally {
      setBusyScriptId(null);
    }
  }

  async function handleDelete(scriptId: string) {
    setBusyScriptId(scriptId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, {
        method: 'DELETE'
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Erro ao descartar.');
      }

      setScriptsState((current) => current.filter((script) => script.id !== scriptId));
      setViewingScript((current) => (current?.id === scriptId ? null : current));
      setEditingScript((current) => (current?.id === scriptId ? null : current));
      toast.success('Conteúdo descartado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível descartar.');
    } finally {
      setBusyScriptId(null);
    }
  }

  async function handleUpdateScript(script: EditableScriptDraft) {
    setBusyScriptId(script.id);

    try {
      const existing = scriptsState.find((item) => item.id === script.id);
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${script.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: script.title,
          hook: script.hook,
          spoken: script.spoken,
          takes: script.takes,
          cta: script.cta,
          caption: script.caption,
          prompt: script.prompt,
          referenceContext: script.referenceContext,
          productId: script.productId,
          productName: script.productName,
          contentType: script.contentType,
          subOption: script.subOption,
          storySlides: script.storySlides,
          carrosselSlides: script.carrosselSlides,
          postFields: script.postFields,
          scheduledFor: existing?.scheduledFor,
          plannerMeta: existing?.plannerMeta
        })
      });

      const payload = (await response.json().catch(() => null)) as { script?: ScriptItem; error?: string } | null;

      if (!response.ok || !payload?.script) {
        throw new Error(payload?.error ?? 'Erro ao atualizar.');
      }

      setScriptsState((current) => current.map((item) => (item.id === payload.script!.id ? payload.script! : item)));
      setViewingScript((current) => (current?.id === payload.script!.id ? payload.script! : current));
      setEditingScript(null);
      toast.success('Conteúdo atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar.');
    } finally {
      setBusyScriptId(null);
    }
  }

  async function handleMoveScriptToDate(scriptId: string, scheduledFor: string) {
    setBusyScriptId(scriptId);

    try {
      const script = scriptsState.find((item) => item.id === scriptId);
      if (!script) {
        return;
      }

      const response = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scheduledFor,
          plannerMeta: script.plannerMeta,
          status: script.status
        })
      });

      const payload = (await response.json().catch(() => null)) as { script?: ScriptItem; error?: string } | null;

      if (!response.ok || !payload?.script) {
        throw new Error(payload?.error ?? 'Não foi possível mover a peça.');
      }

      setScriptsState((current) => current.map((item) => (item.id === payload.script!.id ? payload.script! : item)));
      setSelectedDate(scheduledFor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível mover a peça.');
    } finally {
      setBusyScriptId(null);
      setDraggingScriptId(null);
      setDragOverDate(null);
    }
  }

  function openNewManualModal(date?: string) {
    setManualModalDate(date ?? selectedDate ?? now.toISOString().slice(0, 10));
    setManualModal('new');
  }

  const filteredScripts = useMemo(() => {
    return scriptsState.filter((script) => {
      if (filterProductId && script.productId !== filterProductId) {
        return false;
      }

      if (statusFilter !== 'all' && script.status !== statusFilter) {
        return false;
      }

      if (formatFilter !== 'all' && script.contentType !== formatFilter) {
        return false;
      }

      return true;
    });
  }, [scriptsState, filterProductId, statusFilter, formatFilter]);

  const scheduledScripts = useMemo(
    () =>
      filteredScripts
        .filter((script) => script.scheduledFor)
        .sort((left, right) => {
          if (left.scheduledFor === right.scheduledFor) {
            return right.updatedAt.localeCompare(left.updatedAt);
          }
          return left.scheduledFor.localeCompare(right.scheduledFor);
        }),
    [filteredScripts]
  );

  const feedScripts = useMemo(
    () => [...scheduledScripts].filter((script) => script.contentType !== 'stories').sort((left, right) => right.scheduledFor.localeCompare(left.scheduledFor)),
    [scheduledScripts]
  );

  const storiesScripts = useMemo(
    () => [...scheduledScripts].filter((script) => script.contentType === 'stories').sort((left, right) => right.scheduledFor.localeCompare(left.scheduledFor)),
    [scheduledScripts]
  );

  const draftScripts = useMemo(
    () => filteredScripts.filter((script) => script.status === 'draft').sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [filteredScripts]
  );

  const editedScripts = useMemo(
    () => scriptsState.filter((script) => script.status === 'edited').sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [scriptsState]
  );

  const statusCounts = useMemo(() => {
    return scriptsState.reduce<Record<ScriptStatus, number>>((accumulator, script) => {
      accumulator[script.status] += 1;
      return accumulator;
    }, {
      draft: 0,
      approved: 0,
      production: 0,
      recording: 0,
      drive: 0,
      editing: 0,
      edited: 0,
      scheduled: 0,
      posted: 0
    });
  }, [scriptsState]);

  const formatCounts = useMemo(() => {
    return scriptsState.reduce<Record<ContentFormatKey, number>>((accumulator, script) => {
      if ((CONTENT_FORMAT_ORDER as readonly string[]).includes(script.contentType)) {
        accumulator[script.contentType as ContentFormatKey] += 1;
      }
      return accumulator;
    }, {
      reels: 0,
      stories: 0,
      video_curto: 0,
      carrossel: 0,
      post: 0
    });
  }, [scriptsState]);

  function prevMonth() {
    if (calMonth === 0) {
      setCalYear((year) => year - 1);
      setCalMonth(11);
      return;
    }
    setCalMonth((month) => month - 1);
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalYear((year) => year + 1);
      setCalMonth(0);
      return;
    }
    setCalMonth((month) => month + 1);
  }

  const tabs: WorkspaceTab[] = ['Calendário', 'Feed', 'Stories', 'Rascunhos'];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageIntro
        eyebrow="Postagens"
        title="Planejamento, aprovação e publicação"
        description="O cronograma agora usa o mesmo motor de Conteúdo, gera rascunhos reais e já conversa com Produção."
      />

      <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
        {CONTENT_FORMAT_ORDER.map((format) => (
          <div key={format} className="flex items-center gap-1.5">
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(format))}>
              {getContentFormatLabel(format)}
            </span>
            <span className="text-xs text-zinc-500">{formatCounts[format]}</span>
          </div>
        ))}

        <span className="text-zinc-200">|</span>

        {(Object.entries(statusCounts) as Array<[ScriptStatus, number]>).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', SCRIPT_STATUS_STYLES[status].dot)} />
            <span className="text-xs text-zinc-500">{count} {SCRIPT_STATUS_LABELS[status].toLowerCase()}</span>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPlannerOpen(true)}>
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
            Planejar cronograma
          </Button>
          <Button size="sm" onClick={() => openNewManualModal()}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova peça
          </Button>
        </div>
      </div>

      <div className="px-6 pb-4">
        <PlannerBatchesPanel
          batches={batchesState}
          onRefresh={() => { void refreshWorkspaceData(); }}
          refreshing={refreshingWorkspace}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-6 pb-3">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100'
              )}
            >
              {tab}
              {tab === 'Rascunhos' && draftScripts.length > 0 ? (
                <span className="ml-1 rounded-full bg-zinc-600 px-1.5 py-0.5 text-[10px] text-white">
                  {draftScripts.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="all">Todos os status</option>
            {(Object.keys(SCRIPT_STATUS_LABELS) as ScriptStatus[]).map((status) => (
              <option key={status} value={status}>
                {SCRIPT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value as 'all' | ContentFormatKey)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="all">Todos os formatos</option>
            {CONTENT_FORMAT_ORDER.map((format) => (
              <option key={format} value={format}>
                {getContentFormatLabel(format)}
              </option>
            ))}
          </select>

          <select
            value={filterProductId}
            onChange={(event) => setFilterProductId(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="">Todos os produtos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === 'Calendário' ? (
        <div className="grid flex-1 min-h-0 grid-cols-[1fr_320px] gap-4 overflow-hidden px-6 pb-6 pt-4">
          <Card className="overflow-hidden">
            <CardContent className="h-full overflow-y-auto p-5">
              <CalendarView
                scripts={scheduledScripts}
                year={calYear}
                month={calMonth}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onNewDraft={openNewManualModal}
                dragOver={dragOverDate}
                onDragOver={setDragOverDate}
                onDrop={(date) => { if (draggingScriptId) void handleMoveScriptToDate(draggingScriptId, date); }}
                onDragStart={setDraggingScriptId}
                onClickScript={setViewingScript}
              />
            </CardContent>
          </Card>

          <div className="min-h-0 overflow-hidden">
            <InstagramPreview
              scripts={feedScripts}
              profile={profile}
              onProfileChange={handleProfileChange}
              onScriptClick={setViewingScript}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-4">
          <Card>
            <CardContent className="p-5">
              {activeTab === 'Feed' ? (
                <>
                  <p className="mb-3 text-xs font-semibold text-zinc-500">
                    {feedScripts.length} peça{feedScripts.length !== 1 ? 's' : ''} de feed
                  </p>
                  {feedScripts.length === 0 ? (
                    <p className="text-sm italic text-zinc-400">Nenhuma peça de feed para este filtro.</p>
                  ) : (
                    <div className="space-y-2">
                      {feedScripts.map((script) => (
                        <ContentListItem key={script.id} script={script} onClick={() => setViewingScript(script)} />
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {activeTab === 'Stories' ? (
                <>
                  <p className="mb-3 text-xs font-semibold text-zinc-500">
                    {storiesScripts.length} sequência{storiesScripts.length !== 1 ? 's' : ''} de stories
                  </p>
                  {storiesScripts.length === 0 ? (
                    <p className="text-sm italic text-zinc-400">Nenhuma sequência de stories para este filtro.</p>
                  ) : (
                    <div className="space-y-2">
                      {storiesScripts.map((script) => (
                        <ContentListItem key={script.id} script={script} onClick={() => setViewingScript(script)} />
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {activeTab === 'Rascunhos' ? (
                <>
                  {editedScripts.length > 0 && (
                    <div className="mb-5">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        <p className="text-xs font-semibold text-zinc-700">
                          Prontos para agendar
                        </p>
                        <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                          {editedScripts.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {editedScripts.map((script) => (
                          <div
                            key={script.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-800">{script.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(script.contentType))}>
                                  {getContentFormatLabel(script.contentType)}
                                </span>
                                {script.productName ? (
                                  <span className="text-[10px] text-violet-600">{script.productName}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <input
                                type="date"
                                value={schedulingDates[script.id] ?? ''}
                                onChange={(e) => setSchedulingDates((current) => ({ ...current, [script.id]: e.target.value }))}
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                              <button
                                type="button"
                                disabled={!schedulingDates[script.id]}
                                onClick={() => {
                                  const date = schedulingDates[script.id];
                                  if (date) void handleScheduleScript(script.id, date);
                                }}
                                className="rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-zinc-100" />
                    </div>
                  )}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-zinc-500">
                      {draftScripts.length} rascunho{draftScripts.length !== 1 ? 's' : ''}
                    </p>
                    <button onClick={() => openNewManualModal()} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
                      <Plus className="h-3 w-3" />
                      Novo rascunho
                    </button>
                  </div>
                  {draftScripts.length === 0 ? (
                    <p className="text-sm italic text-zinc-400">Nenhum rascunho para este filtro.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftScripts.map((script) => (
                        <ContentListItem key={script.id} script={script} onClick={() => setViewingScript(script)} />
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {manualModal === 'new' ? (
        <ManualContentModal
          products={products}
          initialDate={manualModalDate}
          loading={creatingManual}
          onClose={() => setManualModal('none')}
          onSave={handleCreateManualDraft}
        />
      ) : null}

      {plannerOpen ? (
        <SchedulePlannerModal
          workspace={workspace}
          products={products}
          selectedDate={selectedDate}
          loading={plannerSubmitting}
          onClose={() => setPlannerOpen(false)}
          onGenerate={handlePlannerGenerate}
        />
      ) : null}

      {viewingScript ? (
        <ScriptPreviewModal
          script={viewingScript}
          busy={busyScriptId === viewingScript.id}
          onClose={() => setViewingScript(null)}
          onEdit={() => setEditingScript(buildEditableScript(viewingScript))}
          onApprove={viewingScript.status === 'draft' ? () => void handleApprove(viewingScript.id) : undefined}
          onDiscard={() => void handleDelete(viewingScript.id)}
        />
      ) : null}

      {editingScript ? (
        <ScriptEditorModal
          title="Editar conteúdo"
          script={editingScript}
          onChange={setEditingScript}
          onClose={() => setEditingScript(null)}
          onSave={() => void handleUpdateScript(editingScript)}
          savingLabel={busyScriptId === editingScript.id ? 'Salvando...' : 'Salvar alterações'}
        />
      ) : null}
    </div>
  );
}
