"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  Columns2,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CONTENT_FORMAT_ORDER,
  getContentFormatLabel,
  type ContentFormatKey
} from '@/lib/content-format-meta';
import { buildEditableScript, type EditableScriptDraft } from '@/lib/script-drafts';
import { buildDefaultProductRules, computeEndDateFromPreset, generateSchedulePlan, type PlannerConfig, type PlannerProductRule, type SchedulePeriodPreset } from '@/lib/post-schedule-planner';
import { cn } from '@/lib/utils';
import type { CarrosselSlide, PlannerBatchItem, PostFields, ProductItem, ScriptItem, StorySlide } from '@/types/platform';

/* ─────────────────────────── Constants ─────────────────────────── */

const PT_BR_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const PT_BR_WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PT_BR_WEEKDAYS_FULL  = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const FORMAT_COLORS: Record<ContentFormatKey, { pill: string; dot: string; block: string }> = {
  reels:      { pill: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-500', block: 'border-l-violet-400 bg-violet-50' },
  stories:    { pill: 'bg-sky-100 text-sky-800 border-sky-200',          dot: 'bg-sky-500',    block: 'border-l-sky-400 bg-sky-50' },
  video_curto:{ pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', block: 'border-l-emerald-400 bg-emerald-50' },
  carrossel:  { pill: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500', block: 'border-l-orange-400 bg-orange-50' },
  post:       { pill: 'bg-slate-100 text-slate-700 border-slate-200',    dot: 'bg-slate-400',  block: 'border-l-slate-300 bg-slate-50' }
};

const DEFAULT_SUB_OPTIONS: Record<ContentFormatKey, string> = {
  reels: '30s', stories: '3', video_curto: '60s', carrossel: '5', post: ''
};

const SUB_OPTIONS: Record<ContentFormatKey, ReadonlyArray<{ value: string; label: string }>> = {
  reels:      [{ value: '15s', label: '15s' }, { value: '30s', label: '30s' }, { value: '45s', label: '45s' }, { value: '60s', label: '1 min' }],
  stories:    [{ value: '1', label: '1 slide' }, { value: '2', label: '2 slides' }, { value: '3', label: '3 slides' }, { value: '5', label: '5 slides' }],
  video_curto:[{ value: '30s', label: '30s' }, { value: '60s', label: '1 min' }, { value: '90s', label: '1,5 min' }],
  carrossel:  [{ value: '3', label: '3 pág' }, { value: '5', label: '5 pág' }, { value: '7', label: '7 pág' }, { value: '10', label: '10 pág' }],
  post:       []
};

/* ─────────────────────────── Types ─────────────────────────── */

type ViewMode = 'monthly' | 'weekly';
type RightPanel = 'idle' | 'create-event' | 'create-schedule' | 'edit-script';

type NewEventDraft = {
  title: string;
  contentType: ContentFormatKey;
  subOption: string;
  scheduledFor: string;
  productId: string;
  productName: string;
  hook: string;
  spoken: string;
  takes: string[];
  cta: string;
  caption: string;
  storySlides: StorySlide[];
  carrosselSlides: CarrosselSlide[];
  postFields: PostFields | null;
};

/* ─────────────────────────── Helpers ─────────────────────────── */

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBR(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getBlockLabel(script: ScriptItem): string {
  const fmt = getContentFormatLabel(script.contentType);
  const sub = script.subOption
    ? script.contentType === 'stories'
      ? ` (${script.subOption} slides)`
      : script.contentType === 'carrossel'
        ? ` (${script.subOption} pág)`
        : ` (${script.subOption})`
    : '';
  return `${fmt}${sub}`;
}

function getFormatColors(contentType: string) {
  return FORMAT_COLORS[contentType as ContentFormatKey] ?? FORMAT_COLORS.post;
}

function getWeekDates(weekStartIso: string): string[] {
  const base = new Date(`${weekStartIso}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getMondayOfWeek(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function prevWeek(weekStartIso: string): string {
  const d = new Date(`${weekStartIso}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function nextWeek(weekStartIso: string): string {
  const d = new Date(`${weekStartIso}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function buildEmptyStorySlides(count: number): StorySlide[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => ({
    objetivo: i === 0 ? 'Gancho' : i === count - 1 ? 'CTA' : 'Desenvolvimento',
    textoTela: '',
    falado: '',
    visual: ''
  }));
}

function buildEmptyCarrosselSlides(count: number): CarrosselSlide[] {
  return Array.from({ length: Math.max(2, count) }, (_, i) => ({
    numero: i + 1,
    titulo: '',
    subtitulo: '',
    conteudo: '',
    visual: ''
  }));
}

function buildContentStructure(contentType: ContentFormatKey, subOption: string) {
  if (contentType === 'stories') {
    return {
      storySlides: buildEmptyStorySlides(Number.parseInt(subOption || '3', 10) || 3),
      carrosselSlides: [] as CarrosselSlide[],
      postFields: null,
      takes: [] as string[]
    };
  }
  if (contentType === 'carrossel') {
    return {
      storySlides: [] as StorySlide[],
      carrosselSlides: buildEmptyCarrosselSlides(Number.parseInt(subOption || '5', 10) || 5),
      postFields: null,
      takes: [] as string[]
    };
  }
  if (contentType === 'post') {
    return {
      storySlides: [] as StorySlide[],
      carrosselSlides: [] as CarrosselSlide[],
      postFields: { conceito: '', tituloPeca: '', textoApoio: '', direcaoVisual: '' } as PostFields,
      takes: [] as string[]
    };
  }
  return {
    storySlides: [] as StorySlide[],
    carrosselSlides: [] as CarrosselSlide[],
    postFields: null,
    takes: Array.from({ length: 5 }, () => '') as string[]
  };
}

function buildEmptyNewEvent(date: string): NewEventDraft {
  const ct: ContentFormatKey = 'reels';
  const sub = DEFAULT_SUB_OPTIONS[ct];
  const structure = buildContentStructure(ct, sub);
  return {
    title: '',
    contentType: ct,
    subOption: sub,
    scheduledFor: date,
    productId: '',
    productName: '',
    hook: '',
    spoken: '',
    cta: '',
    caption: '',
    ...structure
  };
}

/* ─────────────────────────── Inline field editors ─────────────────────────── */

function StorySlidesEditor({
  slides,
  onChange
}: {
  slides: StorySlide[];
  onChange: (next: StorySlide[]) => void;
}) {
  function update(i: number, key: keyof StorySlide, val: string) {
    onChange(slides.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  }
  return (
    <div className="space-y-4">
      {slides.map((slide, i) => (
        <div key={i} className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Slide {i + 1}</p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Objetivo</label>
            <Input className="text-sm" value={slide.objetivo} onChange={(e) => update(i, 'objetivo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Texto na tela</label>
            <Textarea className="text-sm min-h-[60px]" value={slide.textoTela} onChange={(e) => update(i, 'textoTela', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Texto falado</label>
            <Textarea className="text-sm min-h-[60px]" value={slide.falado} onChange={(e) => update(i, 'falado', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Direção visual</label>
            <Input className="text-sm" value={slide.visual} onChange={(e) => update(i, 'visual', e.target.value)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CarrosselSlidesEditor({
  slides,
  onChange
}: {
  slides: CarrosselSlide[];
  onChange: (next: CarrosselSlide[]) => void;
}) {
  function update(i: number, key: keyof CarrosselSlide, val: string) {
    onChange(slides.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  }
  return (
    <div className="space-y-4">
      {slides.map((slide, i) => (
        <div key={i} className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Página {i + 1}</p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Título</label>
            <Input className="text-sm" value={slide.titulo} onChange={(e) => update(i, 'titulo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Subtítulo</label>
            <Input className="text-sm" value={slide.subtitulo} onChange={(e) => update(i, 'subtitulo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Conteúdo</label>
            <Textarea className="text-sm min-h-[80px]" value={slide.conteudo} onChange={(e) => update(i, 'conteudo', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Direção visual</label>
            <Input className="text-sm" value={slide.visual} onChange={(e) => update(i, 'visual', e.target.value)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Month calendar ─────────────────────────── */

function MonthCalendarGrid({
  scriptsState,
  year,
  month,
  dragOverDate,
  selectedScriptId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClickScript,
  onTogglePosted,
  onClickDate
}: {
  scriptsState: ScriptItem[];
  year: number;
  month: number;
  dragOverDate: string | null;
  selectedScriptId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (date: string) => void;
  onDrop: (date: string) => void;
  onDragEnd: () => void;
  onClickScript: (script: ScriptItem) => void;
  onTogglePosted: (script: ScriptItem) => void;
  onClickDate: (date: string) => void;
}) {
  const today = isoToday();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  const scriptsByDate = useMemo(() => {
    const map: Record<string, ScriptItem[]> = {};
    scriptsState.forEach((s) => {
      if (!s.scheduledFor) return;
      if (!map[s.scheduledFor]) map[s.scheduledFor] = [];
      map[s.scheduledFor].push(s);
    });
    return map;
  }, [scriptsState]);

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {PT_BR_WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px flex-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="bg-zinc-50/50 rounded-lg" />;
          const iso = dateStr(day);
          const dayScripts = scriptsByDate[iso] ?? [];
          const isToday = iso === today;
          const isDragOver = iso === dragOverDate;

          return (
            <div
              key={iso}
              onClick={() => onClickDate(iso)}
              onDragOver={(e) => { e.preventDefault(); onDragOver(iso); }}
              onDrop={(e) => { e.preventDefault(); onDrop(iso); }}
              className={cn(
                'relative min-h-[90px] rounded-xl p-1.5 cursor-pointer transition-colors group',
                isToday ? 'bg-zinc-100' : isDragOver ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-zinc-50'
              )}
            >
              <span className={cn(
                'block text-xs font-semibold mb-1 leading-none',
                isToday
                  ? 'h-5 w-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px]'
                  : 'text-zinc-600'
              )}>
                {day}
              </span>

              <div className="space-y-0.5">
                {dayScripts.slice(0, 3).map((script) => {
                  const colors = getFormatColors(script.contentType);
                  const isPosted = script.status === 'posted';
                  return (
                    <div
                      key={script.id}
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); onDragStart(script.id); }}
                      onDragEnd={onDragEnd}
                      onClick={(e) => { e.stopPropagation(); onClickScript(script); }}
                      className={cn(
                        'group/block flex items-center gap-1 rounded-md px-1.5 py-0.5 border text-[10px] cursor-pointer transition-opacity',
                        selectedScriptId === script.id ? 'ring-1 ring-zinc-900' : '',
                        colors.pill,
                        isPosted && 'opacity-60'
                      )}
                    >
                      <span className={cn('shrink-0 block h-1.5 w-1.5 rounded-full', colors.dot)} />
                      <span className={cn('truncate flex-1 font-medium', isPosted && 'line-through')}>
                        {getBlockLabel(script)}
                        {script.productName ? ` · ${script.productName}` : ''}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTogglePosted(script); }}
                        className="ml-auto shrink-0 opacity-0 group-hover/block:opacity-100 transition-opacity"
                        title={isPosted ? 'Desmarcar como postado' : 'Marcar como postado'}
                      >
                        <Check className={cn('h-2.5 w-2.5', isPosted ? 'text-emerald-600' : 'text-zinc-400')} />
                      </button>
                    </div>
                  );
                })}
                {dayScripts.length > 3 && (
                  <p className="text-[9px] text-zinc-400 pl-1">+{dayScripts.length - 3} mais</p>
                )}
              </div>

              {/* Quick-add on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); onClickDate(iso); }}
                className="absolute right-1 top-1 h-4 w-4 items-center justify-center rounded text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 flex"
                title="Nova peça"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Week calendar ─────────────────────────── */

function WeekCalendarGrid({
  scriptsState,
  weekStartIso,
  dragOverDate,
  selectedScriptId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClickScript,
  onTogglePosted,
  onClickDate
}: {
  scriptsState: ScriptItem[];
  weekStartIso: string;
  dragOverDate: string | null;
  selectedScriptId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (date: string) => void;
  onDrop: (date: string) => void;
  onDragEnd: () => void;
  onClickScript: (script: ScriptItem) => void;
  onTogglePosted: (script: ScriptItem) => void;
  onClickDate: (date: string) => void;
}) {
  const today = isoToday();
  const weekDates = getWeekDates(weekStartIso);

  const scriptsByDate = useMemo(() => {
    const map: Record<string, ScriptItem[]> = {};
    scriptsState.forEach((s) => {
      if (!s.scheduledFor) return;
      if (!map[s.scheduledFor]) map[s.scheduledFor] = [];
      map[s.scheduledFor].push(s);
    });
    return map;
  }, [scriptsState]);

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border mb-0">
        {weekDates.map((iso, i) => {
          const [, , dd] = iso.split('-');
          const isToday = iso === today;
          return (
            <div key={iso} className={cn('py-3 text-center border-r last:border-r-0 border-border', isToday && 'bg-zinc-50')}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{PT_BR_WEEKDAYS_SHORT[i]}</p>
              <p className={cn(
                'mt-0.5 text-sm font-bold',
                isToday ? 'h-6 w-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs mx-auto' : 'text-zinc-700'
              )}>
                {Number(dd)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-border overflow-y-auto">
        {weekDates.map((iso) => {
          const dayScripts = scriptsByDate[iso] ?? [];
          const isDragOver = iso === dragOverDate;
          const isToday = iso === today;
          return (
            <div
              key={iso}
              onClick={() => onClickDate(iso)}
              onDragOver={(e) => { e.preventDefault(); onDragOver(iso); }}
              onDrop={(e) => { e.preventDefault(); onDrop(iso); }}
              className={cn(
                'min-h-[400px] p-2 space-y-2 cursor-pointer transition-colors',
                isToday ? 'bg-zinc-50/60' : isDragOver ? 'bg-blue-50' : 'hover:bg-zinc-50/40'
              )}
            >
              {dayScripts.map((script) => {
                const colors = getFormatColors(script.contentType);
                const isPosted = script.status === 'posted';
                const isSelected = selectedScriptId === script.id;
                return (
                  <div
                    key={script.id}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); onDragStart(script.id); }}
                    onDragEnd={onDragEnd}
                    onClick={(e) => { e.stopPropagation(); onClickScript(script); }}
                    className={cn(
                      'group rounded-xl border-l-4 p-2.5 cursor-pointer transition-all hover:shadow-sm',
                      colors.block,
                      isPosted && 'opacity-60',
                      isSelected && 'ring-1 ring-zinc-900 shadow-sm'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <span className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold mb-1',
                          colors.pill
                        )}>
                          {getBlockLabel(script)}
                        </span>
                        <p className={cn(
                          'text-xs font-medium text-zinc-800 leading-snug',
                          isPosted && 'line-through text-zinc-500'
                        )}>
                          {script.title || '(sem título)'}
                        </p>
                        {script.productName && (
                          <p className="text-[10px] text-zinc-500 mt-0.5">{script.productName}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTogglePosted(script); }}
                        className={cn(
                          'shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-colors',
                          isPosted
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-zinc-300 text-zinc-300 hover:border-emerald-400 hover:text-emerald-500'
                        )}
                        title={isPosted ? 'Desmarcar como postado' : 'Marcar como postado'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={(e) => { e.stopPropagation(); onClickDate(iso); }}
                className="w-full flex items-center gap-1 rounded-xl border border-dashed border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-400 hover:border-zinc-300 hover:text-zinc-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Create event panel ─────────────────────────── */

function CreateEventPanel({
  workspace,
  products,
  approvedScripts,
  initialDate,
  onCreated,
  onCancel
}: {
  workspace: string;
  products: ProductItem[];
  approvedScripts: ScriptItem[];
  initialDate: string;
  onCreated: (script: ScriptItem) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<NewEventDraft>(() => buildEmptyNewEvent(initialDate));
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importQuery, setImportQuery] = useState('');

  const subOptions = SUB_OPTIONS[draft.contentType];
  const isStories    = draft.contentType === 'stories';
  const isCarrossel  = draft.contentType === 'carrossel';
  const isPost       = draft.contentType === 'post';
  const isVideo      = !isStories && !isCarrossel && !isPost;

  function setField<K extends keyof NewEventDraft>(key: K, value: NewEventDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function changeContentType(ct: ContentFormatKey) {
    const sub = DEFAULT_SUB_OPTIONS[ct];
    const structure = buildContentStructure(ct, sub);
    setDraft((prev) => ({ ...prev, contentType: ct, subOption: sub, ...structure }));
  }

  function changeSubOption(sub: string) {
    const structure = buildContentStructure(draft.contentType, sub);
    setDraft((prev) => ({ ...prev, subOption: sub, ...structure }));
  }

  function importScript(script: ScriptItem) {
    setDraft((prev) => ({
      ...prev,
      title: script.title,
      hook: script.hook || '',
      spoken: script.spoken || '',
      takes: script.takes.length ? script.takes : Array.from({ length: 5 }, () => ''),
      cta: script.cta || '',
      caption: script.caption || '',
      storySlides: script.storySlides.length ? script.storySlides.map(s => ({ ...s })) : prev.storySlides,
      carrosselSlides: script.carrosselSlides.length ? script.carrosselSlides.map(s => ({ ...s })) : prev.carrosselSlides,
      postFields: script.postFields ? { ...script.postFields } : prev.postFields
    }));
    setShowImport(false);
    setImportQuery('');
    toast.success('Roteiro importado.');
  }

  const filteredApproved = useMemo(
    () => approvedScripts
      .filter((s) => s.contentType === draft.contentType)
      .filter((s) => !importQuery || s.title.toLowerCase().includes(importQuery.toLowerCase()))
      .slice(0, 6),
    [approvedScripts, draft.contentType, importQuery]
  );

  async function handleCreate() {
    if (!draft.title.trim()) { toast.error('Título obrigatório.'); return; }
    setSaving(true);
    try {
      const product = products.find((p) => p.id === draft.productId);
      const body = {
        title: draft.title,
        contentType: draft.contentType,
        subOption: draft.subOption,
        scheduledFor: draft.scheduledFor,
        status: 'draft',
        productId: product?.id || '',
        productName: product?.name || '',
        hook: draft.hook,
        spoken: draft.spoken,
        takes: draft.takes,
        cta: draft.cta,
        caption: draft.caption,
        storySlides: draft.storySlides,
        carrosselSlides: draft.carrosselSlides,
        postFields: draft.postFields
      };
      const res = await fetch(`/api/workspaces/${workspace}/scripts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      const { scripts } = (await res.json()) as { scripts: ScriptItem[] };
      if (scripts?.[0]) {
        onCreated(scripts[0]);
        toast.success('Evento criado no calendário.');
      }
    } catch {
      toast.error('Erro ao criar evento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Calendário</p>
          <h3 className="font-semibold text-foreground">Criar evento</h3>
        </div>
        <button onClick={onCancel} className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tipo + Sub-opção + Data */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Formato</label>
            <select
              value={draft.contentType}
              onChange={(e) => changeContentType(e.target.value as ContentFormatKey)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {CONTENT_FORMAT_ORDER.map((f) => (
                <option key={f} value={f}>{getContentFormatLabel(f)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Sub-opção</label>
            <select
              value={draft.subOption}
              onChange={(e) => changeSubOption(e.target.value)}
              disabled={!subOptions.length}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
            >
              {!subOptions.length ? (
                <option value="">—</option>
              ) : (
                subOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
              )}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Data planejada</label>
          <Input type="date" value={draft.scheduledFor} onChange={(e) => setField('scheduledFor', e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Produto (opcional)</label>
          <select
            value={draft.productId}
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              setField('productId', e.target.value);
              setField('productName', p?.name || '');
            }}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">Sem produto</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Import approved scripts */}
        <div className="rounded-2xl border border-border bg-muted/30">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              Importar roteiro aprovado
            </span>
            {showImport ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showImport && (
            <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                  placeholder="Buscar roteiro..."
                  className="pl-7 text-sm"
                />
              </div>
              {filteredApproved.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum roteiro aprovado para {getContentFormatLabel(draft.contentType)}.
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {filteredApproved.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => importScript(s)}
                      className="w-full text-left rounded-xl border border-border bg-white px-3 py-2 text-xs hover:bg-zinc-50 transition-colors"
                    >
                      <p className="font-medium text-foreground truncate">{s.title}</p>
                      {s.productName && <p className="text-muted-foreground">{s.productName}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Título</label>
          <Input
            value={draft.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Ex.: Reels de apresentação do produto"
          />
        </div>

        {/* Content fields by type */}
        {isStories && (
          <StorySlidesEditor
            slides={draft.storySlides}
            onChange={(next) => setField('storySlides', next)}
          />
        )}

        {isCarrossel && (
          <CarrosselSlidesEditor
            slides={draft.carrosselSlides}
            onChange={(next) => setField('carrosselSlides', next)}
          />
        )}

        {isPost && draft.postFields && (
          <div className="space-y-3">
            {(['conceito', 'tituloPeca', 'textoApoio', 'direcaoVisual'] as const).map((field) => {
              const labels: Record<string, string> = {
                conceito: 'Conceito', tituloPeca: 'Título da peça',
                textoApoio: 'Texto de apoio', direcaoVisual: 'Direção visual'
              };
              return (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-foreground">{labels[field]}</label>
                  <Textarea
                    className="text-sm min-h-[70px]"
                    value={draft.postFields?.[field] ?? ''}
                    onChange={(e) => setField('postFields', { ...draft.postFields!, [field]: e.target.value })}
                  />
                </div>
              );
            })}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Legenda</label>
              <Textarea className="text-sm min-h-[70px]" value={draft.caption} onChange={(e) => setField('caption', e.target.value)} />
            </div>
          </div>
        )}

        {isVideo && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Gancho</label>
              <Textarea className="text-sm min-h-[70px]" value={draft.hook} onChange={(e) => setField('hook', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Texto falado</label>
              <Textarea className="text-sm min-h-[100px]" value={draft.spoken} onChange={(e) => setField('spoken', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Takes</label>
              <div className="space-y-1">
                {draft.takes.map((take, i) => (
                  <Input
                    key={i}
                    value={take}
                    onChange={(e) => {
                      const next = [...draft.takes];
                      next[i] = e.target.value;
                      setField('takes', next);
                    }}
                    placeholder={`Take ${i + 1}`}
                    className="text-sm"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">CTA</label>
              <Textarea className="text-sm min-h-[60px]" value={draft.cta} onChange={(e) => setField('cta', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Legenda</label>
              <Textarea className="text-sm min-h-[80px]" value={draft.caption} onChange={(e) => setField('caption', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <Button
          className="w-full"
          onClick={handleCreate}
          disabled={saving || !draft.title.trim()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Criar evento
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Edit script panel ─────────────────────────── */

function EditScriptPanel({
  script,
  workspace,
  products,
  onClose,
  onUpdated,
  onTogglePosted,
  onDelete
}: {
  script: ScriptItem;
  workspace: string;
  products: ProductItem[];
  onClose: () => void;
  onUpdated: (updated: ScriptItem) => void;
  onTogglePosted: (script: ScriptItem) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<EditableScriptDraft>(() => buildEditableScript(script));
  const [scheduledFor, setScheduledFor] = useState(script.scheduledFor || '');
  const [productId, setProductId] = useState(script.productId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  const isPosted = script.status === 'posted';
  const isStories   = draft.contentType === 'stories';
  const isCarrossel = draft.contentType === 'carrossel';
  const isPost      = draft.contentType === 'post';
  const isVideo     = !isStories && !isCarrossel && !isPost;
  const colors = getFormatColors(draft.contentType ?? 'reels');

  const saveDraft = useCallback(async (
    d: EditableScriptDraft,
    sFor: string,
    pId: string
  ) => {
    setIsSaving(true);
    try {
      const product = products.find((p) => p.id === pId);
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${d.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: d.title,
          hook: d.hook,
          spoken: d.spoken,
          takes: d.takes,
          cta: d.cta,
          caption: d.caption,
          storySlides: d.storySlides,
          carrosselSlides: d.carrosselSlides,
          postFields: d.postFields,
          scheduledFor: sFor,
          productId: product?.id || '',
          productName: product?.name || ''
        })
      });
      if (!res.ok) return;
      const { script: updated } = (await res.json()) as { script: ScriptItem };
      if (updated) onUpdated(updated);
      setSavedAt(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [workspace, products, onUpdated]);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(draft, scheduledFor, productId);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, scheduledFor, productId, saveDraft]);

  async function handleDelete() {
    if (!window.confirm('Remover este evento do calendário?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${script.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onDelete(script.id);
      toast.success('Evento removido.');
    } catch {
      toast.error('Erro ao remover evento.');
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold shrink-0', colors.pill)}>
            {getBlockLabel(script)}
          </span>
          <p className="text-sm font-semibold text-foreground truncate">{draft.title || '(sem título)'}</p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors ml-2">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Meta */}
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data</label>
            <Input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Produto</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Sem produto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Toggle posted */}
        <button
          onClick={() => onTogglePosted(script)}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            isPosted
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-border bg-white text-muted-foreground hover:bg-zinc-50'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {isPosted ? 'Postado ✓ — Clique para desmarcar' : 'Marcar como postado'}
        </button>
      </div>

      {/* Content fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Título</label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="text-sm"
          />
        </div>

        {isStories && draft.storySlides && (
          <StorySlidesEditor
            slides={draft.storySlides}
            onChange={(next) => setDraft((d) => ({ ...d, storySlides: next }))}
          />
        )}

        {isCarrossel && draft.carrosselSlides && (
          <CarrosselSlidesEditor
            slides={draft.carrosselSlides}
            onChange={(next) => setDraft((d) => ({ ...d, carrosselSlides: next }))}
          />
        )}

        {isPost && (
          <div className="space-y-3">
            {(['conceito', 'tituloPeca', 'textoApoio', 'direcaoVisual'] as const).map((field) => {
              const labels: Record<string, string> = {
                conceito: 'Conceito', tituloPeca: 'Título da peça',
                textoApoio: 'Texto de apoio', direcaoVisual: 'Direção visual'
              };
              return (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-foreground">{labels[field]}</label>
                  <Textarea
                    className="text-sm min-h-[70px]"
                    value={draft.postFields?.[field] ?? ''}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      postFields: { ...(d.postFields ?? { conceito: '', tituloPeca: '', textoApoio: '', direcaoVisual: '' }), [field]: e.target.value }
                    }))}
                  />
                </div>
              );
            })}
          </div>
        )}

        {isVideo && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Gancho</label>
              <Textarea className="text-sm min-h-[70px]" value={draft.hook} onChange={(e) => setDraft((d) => ({ ...d, hook: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Texto falado</label>
              <Textarea className="text-sm min-h-[100px]" value={draft.spoken} onChange={(e) => setDraft((d) => ({ ...d, spoken: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Takes</label>
              <div className="space-y-1">
                {draft.takes.map((take, i) => (
                  <Input
                    key={i}
                    value={take}
                    onChange={(e) => {
                      const next = [...draft.takes];
                      next[i] = e.target.value;
                      setDraft((d) => ({ ...d, takes: next }));
                    }}
                    placeholder={`Take ${i + 1}`}
                    className="text-sm"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">CTA</label>
              <Textarea className="text-sm min-h-[60px]" value={draft.cta} onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Legenda</label>
              <Textarea className="text-sm min-h-[80px]" value={draft.caption} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border flex items-center justify-between">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-rose-500 hover:text-rose-700 transition-colors"
        >
          {deleting ? 'Removendo...' : 'Remover evento'}
        </button>
        <p className="text-[10px] text-muted-foreground">
          {isSaving ? 'Salvando...' : savedAt ? `Salvo às ${savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Auto-save ativo'}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Create schedule panel ─────────────────────────── */

type SchedulerProductRow = {
  productId: string;
  productName: string;
  enabled: boolean;
  feedInPeriod: number;
  storiesInPeriod: number;
  storySlides: number;
};

function CreateSchedulePanel({
  workspace,
  products,
  onCreated,
  onCancel
}: {
  workspace: string;
  products: ProductItem[];
  onCreated: (scripts: ScriptItem[]) => void;
  onCancel: () => void;
}) {
  const today = isoToday();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(computeEndDateFromPreset(today, '7'));
  const [rows, setRows] = useState<SchedulerProductRow[]>(() =>
    products.map((p) => ({
      productId: p.id,
      productName: p.name,
      enabled: true,
      feedInPeriod: 2,
      storiesInPeriod: 3,
      storySlides: 3
    }))
  );
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<null | { feed: number; stories: number }>(null);

  function setRow(id: string, patch: Partial<SchedulerProductRow>) {
    setRows((prev) => prev.map((r) => r.productId === id ? { ...r, ...patch } : r));
  }

  // Compute plan preview
  const planPreview = useMemo(() => {
    const enabledRows = rows.filter((r) => r.enabled);
    const feedTotal = enabledRows.reduce((acc, r) => acc + r.feedInPeriod, 0);
    const storyTotal = enabledRows.reduce((acc, r) => acc + r.storiesInPeriod, 0);
    return { feed: feedTotal, stories: storyTotal };
  }, [rows]);

  async function handleCreate() {
    const enabledRows = rows.filter((r) => r.enabled);
    if (!enabledRows.length) { toast.error('Selecione pelo menos um produto.'); return; }
    if (!startDate || !endDate || endDate < startDate) { toast.error('Datas inválidas.'); return; }

    setCreating(true);
    try {
      // Generate schedule slots client-side using the existing planner
      const productRules: PlannerProductRule[] = enabledRows.map((r) => ({
        productId: r.productId,
        productName: r.productName,
        enabled: true,
        paused: false,
        appearancesInPeriod: r.feedInPeriod,
        storiesInPeriod: r.storiesInPeriod,
        fixedWeekdays: [],
        consecutiveRule: 'avoid' as const,
        allDays: true,
        priority: 1
      }));

      const config: PlannerConfig = {
        mode: 'create',
        periodPreset: 'custom',
        startDate,
        endDate,
        feedPerDay: 1,
        reason: 'Cronograma criado no Calendário',
        productRules
      };

      const plan = generateSchedulePlan(config, products);

      if (plan.posts.length === 0) {
        toast.error('Nenhum slot gerado com essas configurações.');
        return;
      }

      // Build script payloads for each planned post
      const scriptPayloads = plan.posts.map((post) => {
        const row = enabledRows.find((r) => r.productId === post.productId);
        const subOpt = post.contentType === 'stories'
          ? String(row?.storySlides ?? 3)
          : DEFAULT_SUB_OPTIONS[post.contentType as ContentFormatKey] ?? '';
        const structure = buildContentStructure(post.contentType as ContentFormatKey, subOpt);
        return {
          title: `${getContentFormatLabel(post.contentType)} – ${post.productName || 'Sem produto'}`,
          contentType: post.contentType,
          subOption: subOpt,
          scheduledFor: post.scheduledFor,
          status: 'draft',
          productId: post.productId || '',
          productName: post.productName || '',
          ...structure
        };
      });

      const res = await fetch(`/api/workspaces/${workspace}/scripts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scripts: scriptPayloads })
      });
      if (!res.ok) throw new Error();
      const { scripts } = (await res.json()) as { scripts: ScriptItem[] };
      onCreated(scripts ?? []);
      toast.success(`${scripts.length} eventos criados no calendário.`);
    } catch {
      toast.error('Erro ao criar cronograma.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Calendário</p>
          <h3 className="font-semibold text-foreground">Criar cronograma</h3>
        </div>
        <button onClick={onCancel} className="rounded-xl border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Data fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 flex-wrap">
          {(['7', '15', '30'] as SchedulePeriodPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setEndDate(computeEndDateFromPreset(startDate, preset))}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-zinc-50 hover:text-foreground transition-colors"
            >
              {preset} dias
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Prévia do plano</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {planPreview.feed} feed + {planPreview.stories} stories = {planPreview.feed + planPreview.stories} peças
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatDateBR(startDate)} → {formatDateBR(endDate)}
          </p>
        </div>

        {/* Product rows */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">Produtos</p>
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.productId}
                className={cn(
                  'rounded-2xl border border-border p-3 space-y-3 transition-opacity',
                  !row.enabled && 'opacity-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => setRow(row.productId, { enabled: e.target.checked })}
                      className="rounded"
                    />
                    {row.productName}
                  </label>
                </div>

                {row.enabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Feed</label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={row.feedInPeriod}
                        onChange={(e) => setRow(row.productId, { feedInPeriod: Math.max(0, Number(e.target.value)) })}
                        className="text-sm text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Stories</label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={row.storiesInPeriod}
                        onChange={(e) => setRow(row.productId, { storiesInPeriod: Math.max(0, Number(e.target.value)) })}
                        className="text-sm text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">Slides</label>
                      <select
                        value={row.storySlides}
                        onChange={(e) => setRow(row.productId, { storySlides: Number(e.target.value) })}
                        className="w-full rounded-xl border border-border bg-white px-2 py-1.5 text-sm text-center focus:outline-none"
                      >
                        {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Button
          className="w-full"
          onClick={handleCreate}
          disabled={creating || rows.every((r) => !r.enabled)}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {creating ? 'Gerando...' : `Criar ${planPreview.feed + planPreview.stories} eventos`}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main component ─────────────────────────── */

export function CalendarioWorkspace({
  workspace,
  scripts: initialScripts,
  products,
  plannerBatches: _plannerBatches
}: {
  workspace: string;
  scripts: ScriptItem[];
  products: ProductItem[];
  plannerBatches: PlannerBatchItem[];
}) {
  const today = isoToday();
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(today));
  const [scriptsState, setScriptsState] = useState<ScriptItem[]>(initialScripts);
  const [rightPanel, setRightPanel] = useState<RightPanel>('idle');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dragScriptId, setDragScriptId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Scripts that have a scheduledFor date (visible in calendar)
  const calendarScripts = useMemo(
    () => scriptsState.filter((s) => !!s.scheduledFor),
    [scriptsState]
  );

  // Approved scripts for import feature
  const approvedScripts = useMemo(
    () => scriptsState.filter((s) => s.status === 'approved'),
    [scriptsState]
  );

  const selectedScript = useMemo(
    () => selectedScriptId ? scriptsState.find((s) => s.id === selectedScriptId) ?? null : null,
    [scriptsState, selectedScriptId]
  );

  /* ── Navigation ── */
  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonthFn() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  /* ── Drag and drop ── */
  function handleDragStart(id: string) {
    setDragScriptId(id);
  }
  function handleDragOver(date: string) {
    setDragOverDate(date);
  }
  function handleDragEnd() {
    setDragScriptId(null);
    setDragOverDate(null);
  }
  async function handleDrop(date: string) {
    if (!dragScriptId) return;
    const script = scriptsState.find((s) => s.id === dragScriptId);
    if (!script || script.scheduledFor === date) { handleDragEnd(); return; }

    // Optimistic update
    setScriptsState((prev) =>
      prev.map((s) => s.id === dragScriptId ? { ...s, scheduledFor: date } : s)
    );
    setDragScriptId(null);
    setDragOverDate(null);

    try {
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${dragScriptId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scheduledFor: date })
      });
      if (!res.ok) throw new Error();
      toast.success(`Reagendado para ${formatDateBR(date)}.`);
    } catch {
      // Revert
      setScriptsState((prev) =>
        prev.map((s) => s.id === dragScriptId ? { ...s, scheduledFor: script.scheduledFor } : s)
      );
      toast.error('Erro ao reagendar.');
    }
  }

  /* ── Toggle posted ── */
  async function handleTogglePosted(script: ScriptItem) {
    const nextStatus = script.status === 'posted' ? 'scheduled' : 'posted';
    // Optimistic update
    setScriptsState((prev) =>
      prev.map((s) => s.id === script.id ? { ...s, status: nextStatus } : s)
    );
    try {
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${script.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error();
      if (nextStatus === 'posted') toast.success('Marcado como postado ✓');
      else toast.success('Desmarcado.');
    } catch {
      // Revert
      setScriptsState((prev) =>
        prev.map((s) => s.id === script.id ? { ...s, status: script.status } : s)
      );
      toast.error('Erro ao atualizar status.');
    }
  }

  /* ── Click script ── */
  function handleClickScript(script: ScriptItem) {
    setSelectedScriptId(script.id);
    setRightPanel('edit-script');
  }

  /* ── Click date ── */
  function handleClickDate(date: string) {
    setSelectedDate(date);
    if (rightPanel === 'idle') {
      setRightPanel('create-event');
    }
  }

  /* ── Script created ── */
  function handleScriptCreated(script: ScriptItem) {
    setScriptsState((prev) => [script, ...prev]);
    setSelectedScriptId(script.id);
    setRightPanel('edit-script');
  }

  /* ── Scripts bulk created (schedule) ── */
  function handleScheduleCreated(scripts: ScriptItem[]) {
    setScriptsState((prev) => [...scripts, ...prev]);
    setRightPanel('idle');
  }

  /* ── Script updated (auto-save) ── */
  function handleScriptUpdated(updated: ScriptItem) {
    setScriptsState((prev) =>
      prev.map((s) => s.id === updated.id ? updated : s)
    );
  }

  /* ── Script deleted ── */
  function handleScriptDeleted(id: string) {
    setScriptsState((prev) => prev.filter((s) => s.id !== id));
    if (selectedScriptId === id) {
      setSelectedScriptId(null);
      setRightPanel('idle');
    }
  }

  /* ── Month label ── */
  const monthLabel = viewMode === 'monthly'
    ? `${PT_BR_MONTHS[month]} ${year}`
    : (() => {
        const dates = getWeekDates(weekStart);
        const first = dates[0];
        const last  = dates[6];
        const [fy, fm, fd] = first.split('-');
        const [ly, lm, ld] = last.split('-');
        if (fm === lm) return `${fd} – ${ld} ${PT_BR_MONTHS[Number(lm) - 1]} ${ly}`;
        return `${fd}/${fm} – ${ld}/${lm} ${ly}`;
      })();

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* ── Left: Calendar ── */}
      <div className="flex flex-1 flex-col min-w-0 border-r border-border">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-1 rounded-xl border border-border p-0.5">
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'monthly' ? 'bg-zinc-900 text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Mensal
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'weekly' ? 'bg-zinc-900 text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Columns2 className="h-3.5 w-3.5" />
              Semanal
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={viewMode === 'monthly' ? prevMonth : () => setWeekStart(prevWeek(weekStart))}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="min-w-[180px] text-center text-sm font-semibold text-foreground">
              {monthLabel}
            </h2>
            <button
              onClick={viewMode === 'monthly' ? nextMonthFn : () => setWeekStart(nextWeek(weekStart))}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => {
              const todayDate = isoToday();
              const [ty, tm] = todayDate.split('-');
              setYear(Number(ty));
              setMonth(Number(tm) - 1);
              setWeekStart(getMondayOfWeek(todayDate));
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-zinc-50 transition-colors"
          >
            Hoje
          </button>
        </div>

        {/* Calendar body */}
        <div className="flex-1 overflow-hidden p-4">
          {viewMode === 'monthly' ? (
            <MonthCalendarGrid
              scriptsState={calendarScripts}
              year={year}
              month={month}
              dragOverDate={dragOverDate}
              selectedScriptId={selectedScriptId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onClickScript={handleClickScript}
              onTogglePosted={handleTogglePosted}
              onClickDate={handleClickDate}
            />
          ) : (
            <WeekCalendarGrid
              scriptsState={calendarScripts}
              weekStartIso={weekStart}
              dragOverDate={dragOverDate}
              selectedScriptId={selectedScriptId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onClickScript={handleClickScript}
              onTogglePosted={handleTogglePosted}
              onClickDate={handleClickDate}
            />
          )}
        </div>
      </div>

      {/* ── Right: Action panel ── */}
      <div className="w-[400px] shrink-0 flex flex-col bg-white">
        {/* Always-visible action buttons */}
        <div className="flex gap-2 p-4 border-b border-border">
          <Button
            variant={rightPanel === 'create-event' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setSelectedScriptId(null);
              setRightPanel(rightPanel === 'create-event' ? 'idle' : 'create-event');
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Criar evento
          </Button>
          <Button
            variant={rightPanel === 'create-schedule' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setSelectedScriptId(null);
              setRightPanel(rightPanel === 'create-schedule' ? 'idle' : 'create-schedule');
            }}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Criar cronograma
          </Button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {rightPanel === 'idle' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <CalendarRange className="h-10 w-10 text-zinc-200" />
              <p className="text-sm text-muted-foreground">
                Clique em um dia ou em um bloco do calendário para ver detalhes e editar.
              </p>
              <p className="text-xs text-zinc-400">
                {calendarScripts.length} {calendarScripts.length === 1 ? 'evento' : 'eventos'} no calendário
              </p>
            </div>
          )}

          {rightPanel === 'create-event' && (
            <CreateEventPanel
              workspace={workspace}
              products={products}
              approvedScripts={approvedScripts}
              initialDate={selectedDate}
              onCreated={handleScriptCreated}
              onCancel={() => setRightPanel('idle')}
            />
          )}

          {rightPanel === 'create-schedule' && (
            <CreateSchedulePanel
              workspace={workspace}
              products={products}
              onCreated={handleScheduleCreated}
              onCancel={() => setRightPanel('idle')}
            />
          )}

          {rightPanel === 'edit-script' && selectedScript && (
            <EditScriptPanel
              key={selectedScript.id}
              script={selectedScript}
              workspace={workspace}
              products={products}
              onClose={() => { setSelectedScriptId(null); setRightPanel('idle'); }}
              onUpdated={handleScriptUpdated}
              onTogglePosted={handleTogglePosted}
              onDelete={handleScriptDeleted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
