"use client";

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Film,
  Image as ImageIcon,
  Instagram,
  Layers,
  LayoutGrid,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { cn } from '@/lib/utils';
import type { ProductItem, ScriptItem } from '@/types/platform';

// ─── Types ───────────────────────────────────────────────────────────────────

type PostChannel = 'Feed' | 'Reels' | 'Stories';
type PostStatus = 'production' | 'ready' | 'scheduled' | 'posted';

type PlannedPost = {
  id: string;
  title: string;
  channel: PostChannel;
  status: PostStatus;
  scheduledFor: string; // YYYY-MM-DD, or '' for drafts
  caption: string;
  imageUrl: string;
  notes: string;
  productId?: string;
  productName?: string;
  scriptId?: string;
  createdAt: string;
};

type PostFormState = Omit<PlannedPost, 'id' | 'createdAt'>;

type WorkspaceTab = 'Tudo' | 'Feed' | 'Stories' | 'Rascunhos';

type ScheduleRules = {
  startDate: string;
  endDate: string;
  feedPerDay: number;
  storiesPerDay: number;
  selectedProductIds: string[];
  productDaysPerWeek: Record<string, number>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS: { value: PostChannel; label: string }[] = [
  { value: 'Feed', label: 'Feed' },
  { value: 'Reels', label: 'Reels' },
  { value: 'Stories', label: 'Stories' },
];

const STATUS_OPTIONS: { value: PostStatus; label: string }[] = [
  { value: 'production', label: 'Em produção' },
  { value: 'ready', label: 'Pronto' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'posted', label: 'Publicado' },
];

const STATUS_STYLES: Record<PostStatus, { dot: string; badge: string; border: string }> = {
  production: {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    border: 'border-l-amber-400',
  },
  ready: {
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border-green-200',
    border: 'border-l-green-500',
  },
  scheduled: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-l-blue-500',
  },
  posted: {
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-50 text-zinc-500 border-zinc-200',
    border: 'border-l-zinc-400',
  },
};

const STATUS_LABELS: Record<PostStatus, string> = {
  production: 'Em produção',
  ready: 'Pronto',
  scheduled: 'Agendado',
  posted: 'Publicado',
};

const CHANNEL_LABELS: Record<PostChannel, string> = {
  Feed: 'Feed',
  Reels: 'Reels',
  Stories: 'Stories',
};

const PT_BR_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PT_BR_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function storageKey(workspace: string) {
  return `creatorai:posts:${workspace}`;
}

function profileKey(workspace: string) {
  return `creatorai:instagram-profile:${workspace}`;
}

function loadPosts(workspace: string): PlannedPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(workspace));
    return raw ? (JSON.parse(raw) as PlannedPost[]) : [];
  } catch {
    return [];
  }
}

function savePosts(workspace: string, posts: PlannedPost[]) {
  try {
    localStorage.setItem(storageKey(workspace), JSON.stringify(posts));
  } catch {}
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

function emptyForm(date?: string): PostFormState {
  return {
    title: '',
    channel: 'Feed',
    status: 'production',
    scheduledFor: date ?? new Date().toISOString().slice(0, 10),
    caption: '',
    imageUrl: '',
    notes: '',
    productId: undefined,
    productName: undefined,
    scriptId: undefined,
  };
}

function emptyDraftForm(): PostFormState {
  return {
    title: '',
    channel: 'Feed',
    status: 'production',
    scheduledFor: '',
    caption: '',
    imageUrl: '',
    notes: '',
    productId: undefined,
    productName: undefined,
    scriptId: undefined,
  };
}

function newId() {
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateBR(isoDate: string) {
  if (!isoDate) return 'Rascunho';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Schedule Generation ──────────────────────────────────────────────────────

function generateSchedule(rules: ScheduleRules, products: ProductItem[]): PlannedPost[] {
  const { startDate, endDate, feedPerDay, storiesPerDay, selectedProductIds, productDaysPerWeek } = rules;

  const days: string[] = [];
  const cur = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }

  const enabledProducts = products.filter(p => selectedProductIds.includes(p.id));
  const posts: PlannedPost[] = [];

  const productWeekUsage: Record<string, number> = {};
  let weekNumber = 0;

  days.forEach((day, dayIndex) => {
    const currentWeek = Math.floor(dayIndex / 7);
    if (currentWeek !== weekNumber) {
      weekNumber = currentWeek;
      Object.keys(productWeekUsage).forEach(k => { productWeekUsage[k] = 0; });
    }

    let productForDay: ProductItem | undefined;
    if (enabledProducts.length > 0) {
      for (let attempt = 0; attempt < enabledProducts.length; attempt++) {
        const candidate = enabledProducts[(dayIndex + attempt) % enabledProducts.length];
        const maxDays = productDaysPerWeek[candidate.id] ?? 7;
        if ((productWeekUsage[candidate.id] ?? 0) < maxDays) {
          productForDay = candidate;
          productWeekUsage[candidate.id] = (productWeekUsage[candidate.id] ?? 0) + 1;
          break;
        }
      }
    }

    for (let i = 0; i < feedPerDay; i++) {
      posts.push({
        id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: productForDay ? `${i === 0 ? 'Reels' : 'Post'} — ${productForDay.name}` : `Post ${i + 1}`,
        channel: i === 0 ? 'Reels' : 'Feed',
        status: 'production',
        scheduledFor: day,
        caption: '',
        imageUrl: '',
        notes: '',
        productId: productForDay?.id,
        productName: productForDay?.name,
        createdAt: new Date().toISOString(),
      });
    }

    for (let i = 0; i < storiesPerDay; i++) {
      posts.push({
        id: `sched_story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: productForDay ? `Stories — ${productForDay.name}` : `Stories ${i + 1}`,
        channel: 'Stories',
        status: 'production',
        scheduledFor: day,
        caption: '',
        imageUrl: '',
        notes: '',
        productId: productForDay?.id,
        productName: productForDay?.name,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return posts;
}

// ─── Schedule Planner Modal ───────────────────────────────────────────────────

function SchedulePlannerModal({
  products,
  onClose,
  onGenerate,
}: {
  products: ProductItem[];
  onClose: () => void;
  onGenerate: (posts: PlannedPost[]) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [periodPreset, setPeriodPreset] = useState<'7' | '15' | '30' | 'custom'>('7');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(in7Days);
  const [feedPerDay, setFeedPerDay] = useState(1);
  const [storiesPerDay, setStoriesPerDay] = useState(3);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(products.map(p => p.id));
  const [productDaysPerWeek, setProductDaysPerWeek] = useState<Record<string, number>>(
    Object.fromEntries(products.map(p => [p.id, 7]))
  );

  function applyPreset(preset: '7' | '15' | '30') {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + parseInt(preset) - 1);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPeriodPreset(preset);
  }

  const numDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate + 'T12:00:00');
    const e = new Date(endDate + 'T12:00:00');
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    return Math.max(0, diff);
  }, [startDate, endDate]);

  const totalFeed = numDays * feedPerDay;
  const totalStories = numDays * storiesPerDay;

  function toggleProduct(id: string) {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleGenerate() {
    const rules: ScheduleRules = {
      startDate,
      endDate,
      feedPerDay,
      storiesPerDay,
      selectedProductIds,
      productDaysPerWeek,
    };
    const generated = generateSchedule(rules, products);
    onGenerate(generated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <span className="text-sm font-semibold text-zinc-700">Planejar cronograma</span>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Period */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">Período</label>
            <div className="flex gap-2 mb-3">
              {(['7', '15', '30'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    periodPreset === p
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  )}
                >
                  {p} dias
                </button>
              ))}
              <button
                onClick={() => setPeriodPreset('custom')}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                  periodPreset === 'custom'
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                )}
              >
                Personalizado
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Início</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setPeriodPreset('custom'); }}
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Fim</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setPeriodPreset('custom'); }}
                />
              </div>
            </div>
          </div>

          {/* Posts per day */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Feed/Reels por dia</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={feedPerDay}
                onChange={e => setFeedPerDay(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Stories por dia</label>
              <Input
                type="number"
                min={0}
                max={20}
                value={storiesPerDay}
                onChange={e => setStoriesPerDay(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
          </div>

          {/* Products */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">Produtos</label>
            {products.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">
                Nenhum produto cadastrado. Adicione produtos para associar ao cronograma.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`prod-${p.id}`}
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="rounded"
                    />
                    <label htmlFor={`prod-${p.id}`} className="flex-1 text-sm text-zinc-700 cursor-pointer">
                      {p.name}
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-zinc-400">dias/sem:</span>
                      <select
                        value={productDaysPerWeek[p.id] ?? 7}
                        onChange={e => setProductDaysPerWeek(prev => ({ ...prev, [p.id]: parseInt(e.target.value) }))}
                        className="text-xs border border-zinc-200 rounded px-1 py-0.5 bg-white focus:outline-none"
                        disabled={!selectedProductIds.includes(p.id)}
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
            <p className="text-xs font-medium text-zinc-500 mb-1">Resumo do cronograma</p>
            <p className="text-sm text-zinc-700">
              <span className="font-semibold">{totalFeed}</span> posts Feed/Reels +{' '}
              <span className="font-semibold">{totalStories}</span> Stories ={' '}
              <span className="font-semibold">{totalFeed + totalStories}</span> total no período de{' '}
              <span className="font-semibold">{numDays}</span> dias
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleGenerate}
              disabled={numDays === 0 || (totalFeed + totalStories === 0)}
            >
              Gerar cronograma
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Post Detail / Edit Modal ─────────────────────────────────────────────────

function PostModal({
  post,
  mode,
  products,
  scripts,
  onClose,
  onSave,
  onDelete,
  onSwitchEdit,
}: {
  post: PlannedPost | null;
  mode: 'view' | 'edit' | 'new';
  initialDate?: string;
  products: ProductItem[];
  scripts: ScriptItem[];
  onClose: () => void;
  onSave: (data: PostFormState) => void;
  onDelete?: () => void;
  onSwitchEdit?: () => void;
}) {
  const isEditing = mode === 'edit' || mode === 'new';
  const [form, setForm] = useState<PostFormState>(() =>
    post
      ? {
          title: post.title,
          channel: post.channel,
          status: post.status,
          scheduledFor: post.scheduledFor,
          caption: post.caption,
          imageUrl: post.imageUrl,
          notes: post.notes,
          productId: post.productId,
          productName: post.productName,
          scriptId: post.scriptId,
        }
      : emptyForm()
  );

  const [showScriptPicker, setShowScriptPicker] = useState(false);

  const setField = <K extends keyof PostFormState>(k: K, v: PostFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  if (!post && mode === 'view') return null;

  const styles = STATUS_STYLES[form.status];
  const captionPreview = form.caption.length > 120 ? form.caption.slice(0, 120) + '…' : form.caption;

  const availableScripts = scripts.filter(
    s => s.status === 'approved' || s.status === 'draft'
  );

  function handleScriptImport(script: ScriptItem) {
    setField('title', script.title);
    setField('caption', script.caption);
    setField('scriptId', script.id);
    if (script.productId) {
      setField('productId', script.productId);
      setField('productName', script.productName ?? '');
    }
    setShowScriptPicker(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            {mode === 'new' ? (
              <span className="text-sm font-semibold text-zinc-700">Nova postagem</span>
            ) : isEditing ? (
              <span className="text-sm font-semibold text-zinc-700">Editar postagem</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', STATUS_STYLES[post!.status].dot)} />
                <span className="text-sm font-semibold text-zinc-700">{post!.title || 'Sem título'}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isEditing && onSwitchEdit && (
              <button
                onClick={onSwitchEdit}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {!isEditing && onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Título</label>
                  <Input
                    value={form.title}
                    onChange={e => setField('title', e.target.value)}
                    placeholder="Ex: Reels do produto X — antes e depois"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Canal</label>
                  <select
                    value={form.channel}
                    onChange={e => setField('channel', e.target.value as PostChannel)}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  >
                    {CHANNEL_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setField('status', e.target.value as PostStatus)}
                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  >
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Data</label>
                  <Input
                    type="date"
                    value={form.scheduledFor}
                    onChange={e => setField('scheduledFor', e.target.value)}
                  />
                  <p className="text-[10px] text-zinc-400 mt-0.5">Deixe em branco para salvar como rascunho</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">URL da imagem (preview)</label>
                  <Input
                    value={form.imageUrl}
                    onChange={e => setField('imageUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                {/* Product selector */}
                {products.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Produto</label>
                    <select
                      value={form.productId ?? ''}
                      onChange={e => {
                        const p = products.find(prod => prod.id === e.target.value);
                        setField('productId', p?.id ?? '');
                        setField('productName', p?.name ?? '');
                      }}
                      className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    >
                      <option value="">Sem produto</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Script import (new mode only) */}
                {availableScripts.length > 0 && mode === 'new' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Importar de roteiro</label>
                    {showScriptPicker ? (
                      <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-100">
                          <span className="text-xs font-medium text-zinc-600">Selecione um roteiro</span>
                          <button
                            onClick={() => setShowScriptPicker(false)}
                            className="text-zinc-400 hover:text-zinc-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {availableScripts.map(s => (
                            <button
                              key={s.id}
                              onClick={() => handleScriptImport(s)}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
                            >
                              <p className="text-xs font-medium text-zinc-800 truncate">{s.title}</p>
                              {s.productName && (
                                <p className="text-[10px] text-zinc-400">{s.productName} · {s.status}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowScriptPicker(true)}
                        className="flex items-center gap-1.5 text-xs text-zinc-600 border border-zinc-200 rounded-lg px-3 py-2 hover:bg-zinc-50 transition-colors"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        Importar de roteiro aprovado
                        {form.scriptId && <span className="ml-1 text-green-600">(importado)</span>}
                      </button>
                    )}
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Legenda (caption)</label>
                  <Textarea
                    value={form.caption}
                    onChange={e => setField('caption', e.target.value)}
                    rows={4}
                    placeholder="Escreva a legenda do post..."
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Notas internas</label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                    rows={2}
                    placeholder="Observações de produção, referências..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button
                  onClick={() => onSave(form)}
                  disabled={!form.title.trim()}
                >
                  {mode === 'new' ? 'Criar postagem' : 'Salvar alterações'}
                </Button>
              </div>
            </>
          ) : (
            post && (
              <>
                <div className="flex gap-4">
                  <div
                    className="w-24 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 flex items-center justify-center"
                    style={{ aspectRatio: '4/5' }}
                  >
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-zinc-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', styles.badge)}>
                        {STATUS_LABELS[post.status]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-600 border-zinc-200">
                        {CHANNEL_LABELS[post.channel]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-600 border-zinc-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateBR(post.scheduledFor)}
                      </span>
                      {post.productName && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-violet-50 text-violet-600 border-violet-200">
                          {post.productName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-zinc-800">{post.title || 'Sem título'}</p>
                    {post.caption && (
                      <p className="text-xs text-zinc-500 leading-relaxed">{captionPreview}</p>
                    )}
                  </div>
                </div>

                {post.caption && post.caption.length > 120 && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500 mb-1">Legenda completa</p>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                  </div>
                )}

                {post.notes && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500 mb-1">Notas internas</p>
                    <p className="text-sm text-zinc-600 whitespace-pre-wrap">{post.notes}</p>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Instagram Preview Panel ──────────────────────────────────────────────────

function InstagramPreview({
  posts,
  profile,
  onProfileChange,
  onPostClick,
}: {
  posts: PlannedPost[];
  profile: string;
  onProfileChange: (val: string) => void;
  onPostClick: (post: PlannedPost) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  const feedPosts = useMemo(
    () =>
      [...posts]
        .filter(p => p.channel !== 'Stories' && p.scheduledFor !== '')
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [posts]
  );

  function handleSave() {
    onProfileChange(draft.startsWith('@') ? draft : `@${draft}`);
    setEditing(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-zinc-200 shadow-sm">
        {/* Profile header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 flex items-center justify-center text-white">
              <Instagram className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex gap-1">
                  <input
                    className="flex-1 text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="@seuperfil"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    className="text-xs px-2 py-1 bg-zinc-900 text-white rounded"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setDraft(profile); setEditing(true); }}
                  className="flex items-center gap-1 group"
                >
                  <span className="text-sm font-semibold text-zinc-900">
                    {profile || 'Definir @perfil'}
                  </span>
                  <Pencil className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                <span><strong className="text-zinc-900">{feedPosts.length}</strong> posts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {feedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <LayoutGrid className="w-8 h-8 text-zinc-200 mb-2" />
            <p className="text-xs text-zinc-400">Nenhuma postagem de Feed ou Reels ainda.</p>
            <p className="text-xs text-zinc-300 mt-0.5">Adicione posts no calendário para ver o preview.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-px bg-zinc-200">
            {feedPosts.map(post => (
              <button
                key={post.id}
                onClick={() => onPostClick(post)}
                className="relative bg-zinc-100 overflow-hidden group"
                style={{ aspectRatio: '1/1' }}
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = ''; }}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
                    {post.channel === 'Reels' ? (
                      <Film className="w-5 h-5 text-zinc-300" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-zinc-300" />
                    )}
                  </div>
                )}

                <div className={cn(
                  'absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-white shadow-sm',
                  STATUS_STYLES[post.status].dot
                )} />

                {post.channel === 'Reels' && (
                  <div className="absolute top-1 left-1">
                    <Film className="w-3 h-3 text-white drop-shadow" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity text-center px-1 leading-tight line-clamp-2">
                    {post.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(STATUS_STYLES).map(([status, st]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={cn('w-2 h-2 rounded-full', st.dot)} />
            <span className="text-xs text-zinc-500">{STATUS_LABELS[status as PostStatus]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function CalendarView({
  posts,
  year,
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onNewPost,
  dragOver,
  onDragOver,
  onDrop,
  onDragStart,
  onClickPost,
}: {
  posts: PlannedPost[];
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onNewPost: (date: string) => void;
  dragOver: string | null;
  onDragOver: (date: string) => void;
  onDrop: (date: string) => void;
  onDragStart: (postId: string) => void;
  onClickPost?: (post: PlannedPost) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  // Only show scheduled posts (non-drafts)
  const scheduledPosts = useMemo(() => posts.filter(p => p.scheduledFor !== ''), [posts]);

  const postsByDate = useMemo(() => {
    const map: Record<string, PlannedPost[]> = {};
    scheduledPosts.forEach(p => {
      if (!map[p.scheduledFor]) map[p.scheduledFor] = [];
      map[p.scheduledFor].push(p);
    });
    return map;
  }, [scheduledPosts]);

  const cells: (null | number)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedPosts = selectedDate ? (postsByDate[selectedDate] ?? []) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMonth} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-zinc-800">
          {PT_BR_MONTHS[month]} {year}
        </h3>
        <button onClick={onNextMonth} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {PT_BR_WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px flex-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const ds = dateStr(day);
          const dayPosts = postsByDate[ds] ?? [];
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const isDragTarget = ds === dragOver;

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(ds)}
              onDragOver={e => { e.preventDefault(); onDragOver(ds); }}
              onDrop={() => onDrop(ds)}
              className={cn(
                'min-h-[52px] rounded-lg p-1 cursor-pointer transition-colors relative',
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
                'text-xs font-medium leading-none block mb-1',
                isSelected ? 'text-white' : isToday ? 'text-zinc-900' : 'text-zinc-700'
              )}>
                {day}
              </span>

              <div className="flex flex-wrap gap-0.5">
                {dayPosts.slice(0, 5).map(p => (
                  <button
                    key={p.id}
                    draggable
                    onDragStart={e => { e.stopPropagation(); onDragStart(p.id); }}
                    onClick={e => { e.stopPropagation(); onSelectDate(ds); }}
                    title={p.title}
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0 cursor-grab',
                      STATUS_STYLES[p.status].dot
                    )}
                  />
                ))}
                {dayPosts.length > 5 && (
                  <span className={cn('text-[9px] leading-none', isSelected ? 'text-zinc-300' : 'text-zinc-400')}>
                    +{dayPosts.length - 5}
                  </span>
                )}
              </div>

              {!isSelected && (
                <button
                  onClick={e => { e.stopPropagation(); onNewPost(ds); }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 opacity-0 hover:opacity-100 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Novo post neste dia"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-4 border-t pt-4 space-y-2 max-h-52 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-zinc-700">{formatDateBR(selectedDate)}</p>
            <button
              onClick={() => onNewPost(selectedDate)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
            >
              <Plus className="w-3 h-3" /> Novo post
            </button>
          </div>

          {selectedPosts.length === 0 && (
            <p className="text-xs text-zinc-400 italic">Nenhum post neste dia.</p>
          )}

          {selectedPosts.map(p => (
            <div
              key={p.id}
              draggable
              onDragStart={() => onDragStart(p.id)}
              onClick={() => onClickPost?.(p)}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border-l-2 bg-zinc-50 cursor-grab',
                STATUS_STYLES[p.status].border
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_STYLES[p.status].dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-800 truncate">
                  {p.title || 'Sem título'}
                  {p.productName && (
                    <span className="ml-1 text-[10px] font-normal text-violet-500">({p.productName})</span>
                  )}
                </p>
                <p className="text-[10px] text-zinc-400">{CHANNEL_LABELS[p.channel]} · {STATUS_LABELS[p.status]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Post List Item ───────────────────────────────────────────────────────────

function PostListItem({
  post,
  onClick,
}: {
  post: PlannedPost;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-center gap-3 p-3 rounded-lg border-l-2 bg-white hover:bg-zinc-50 transition-colors',
        STATUS_STYLES[post.status].border
      )}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_STYLES[post.status].dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 truncate">
          {post.title || 'Sem título'}
          {post.productName && (
            <span className="ml-1.5 text-xs font-normal text-violet-500">({post.productName})</span>
          )}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {CHANNEL_LABELS[post.channel]} · {STATUS_LABELS[post.status]}
          {post.scheduledFor ? ` · ${formatDateBR(post.scheduledFor)}` : ''}
        </p>
      </div>
      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0', STATUS_STYLES[post.status].badge)}>
        {STATUS_LABELS[post.status]}
      </span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PostsWorkspace({
  workspace,
  products = [],
  scripts = [],
}: {
  workspace: string;
  products?: ProductItem[];
  scripts?: ScriptItem[];
}) {
  const now = new Date();

  const [posts, setPosts] = useState<PlannedPost[]>(() => loadPosts(workspace));
  const [profile, setProfile] = useState<string>(() => loadProfile(workspace));

  // Calendar state
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(now.toISOString().slice(0, 10));

  // View tabs
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('Tudo');
  const [filterProductId, setFilterProductId] = useState<string>('');

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  type ModalState =
    | { type: 'none' }
    | { type: 'new'; date: string }
    | { type: 'newDraft' }
    | { type: 'view'; postId: string }
    | { type: 'edit'; postId: string }
    | { type: 'planner' };

  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  // Drag state
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const modalPost = useMemo(() => {
    if (modal.type === 'view' || modal.type === 'edit') {
      return posts.find(p => p.id === modal.postId) ?? null;
    }
    return null;
  }, [modal, posts]);

  // Filtered posts for list views
  const filteredPosts = useMemo(() => {
    let base = posts;
    if (filterProductId) {
      base = base.filter(p => p.productId === filterProductId);
    }
    return base;
  }, [posts, filterProductId]);

  const feedListPosts = useMemo(
    () => filteredPosts.filter(p => (p.channel === 'Feed' || p.channel === 'Reels') && p.scheduledFor !== '')
      .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [filteredPosts]
  );

  const storiesListPosts = useMemo(
    () => filteredPosts.filter(p => p.channel === 'Stories' && p.scheduledFor !== '')
      .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [filteredPosts]
  );

  const draftPosts = useMemo(
    () => filteredPosts.filter(p => p.scheduledFor === ''),
    [filteredPosts]
  );

  // ── Stats ──
  const totalByStatus = useMemo(() => {
    const counts: Record<PostStatus, number> = { production: 0, ready: 0, scheduled: 0, posted: 0 };
    posts.forEach(p => counts[p.status]++);
    return counts;
  }, [posts]);

  const totalByChannel = useMemo(() => {
    const counts: Record<PostChannel, number> = { Feed: 0, Reels: 0, Stories: 0 };
    posts.filter(p => p.scheduledFor !== '').forEach(p => counts[p.channel]++);
    return counts;
  }, [posts]);

  // ── Handlers ──

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleProfileChange(val: string) {
    setProfile(val);
    saveProfile(workspace, val);
  }

  function handleSavePost(data: PostFormState) {
    let updated: PlannedPost[];
    if (modal.type === 'new' || modal.type === 'newDraft') {
      const newPost: PlannedPost = {
        ...data,
        id: newId(),
        createdAt: new Date().toISOString(),
      };
      updated = [...posts, newPost];
      if (data.scheduledFor) setSelectedDate(data.scheduledFor);
    } else if (modal.type === 'edit') {
      const postId = (modal as { type: 'edit'; postId: string }).postId;
      updated = posts.map(p => p.id === postId ? { ...p, ...data } : p);
    } else {
      return;
    }
    setPosts(updated);
    savePosts(workspace, updated);
    setModal({ type: 'none' });
  }

  function handleDeletePost() {
    if (modal.type !== 'view' && modal.type !== 'edit') return;
    const id = (modal as { type: 'view' | 'edit'; postId: string }).postId;
    const updated = posts.filter(p => p.id !== id);
    setPosts(updated);
    savePosts(workspace, updated);
    setModal({ type: 'none' });
  }

  function handleDrop(targetDate: string) {
    if (!draggingPostId || !targetDate) return;
    const updated = posts.map(p =>
      p.id === draggingPostId ? { ...p, scheduledFor: targetDate } : p
    );
    setPosts(updated);
    savePosts(workspace, updated);
    setDraggingPostId(null);
    setDragOverDate(null);
    setSelectedDate(targetDate);
  }

  function handleGenerateSchedule(generated: PlannedPost[]) {
    const updated = [...posts, ...generated];
    setPosts(updated);
    savePosts(workspace, updated);
    setModal({ type: 'none' });
    showToast(`${generated.length} posts criados para o cronograma.`);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const TABS: WorkspaceTab[] = ['Tudo', 'Feed', 'Stories', 'Rascunhos'];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <PageIntro
        eyebrow="Postagens"
        title="Planejamento de publicação"
        description="Organize o calendário de conteúdo e visualize o feed antes de publicar."
      />

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-6 pb-3 flex-wrap">
        {/* Channel counts */}
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3 text-zinc-400" />
          <span className="text-xs text-zinc-500">{totalByChannel.Feed} Feed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Film className="w-3 h-3 text-zinc-400" />
          <span className="text-xs text-zinc-500">{totalByChannel.Reels} Reels</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-zinc-400" />
          <span className="text-xs text-zinc-500">{totalByChannel.Stories} Stories</span>
        </div>
        <span className="text-zinc-200">|</span>
        {(Object.entries(totalByStatus) as [PostStatus, number][]).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', STATUS_STYLES[status].dot)} />
            <span className="text-xs text-zinc-500">{count} {STATUS_LABELS[status].toLowerCase()}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModal({ type: 'planner' })}
          >
            <CalendarRange className="w-3.5 h-3.5 mr-1.5" />
            Planejar cronograma
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (activeTab === 'Rascunhos') {
                setModal({ type: 'newDraft' });
              } else {
                setModal({ type: 'new', date: selectedDate ?? now.toISOString().slice(0, 10) });
              }
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova postagem
          </Button>
        </div>
      </div>

      {/* Tab bar + filter */}
      <div className="flex items-center gap-2 px-6 pb-3 border-b border-zinc-100 flex-wrap">
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                activeTab === tab
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100'
              )}
            >
              {tab}
              {tab === 'Rascunhos' && draftPosts.length > 0 && (
                <span className="ml-1 bg-zinc-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {draftPosts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {products.length > 0 && (
          <div className="ml-auto">
            <select
              value={filterProductId}
              onChange={e => setFilterProductId(e.target.value)}
              className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 text-zinc-600"
            >
              <option value="">Todos os produtos</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content area */}
      {activeTab === 'Tudo' ? (
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_320px] gap-4 px-6 pb-6 pt-4 overflow-hidden">
          <Card className="overflow-hidden">
            <CardContent className="p-5 h-full overflow-y-auto">
              <CalendarView
                posts={posts}
                year={calYear}
                month={calMonth}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onNewPost={date => setModal({ type: 'new', date })}
                dragOver={dragOverDate}
                onDragOver={setDragOverDate}
                onDrop={handleDrop}
                onDragStart={setDraggingPostId}
                onClickPost={post => setModal({ type: 'view', postId: post.id })}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col min-h-0 overflow-hidden">
            <InstagramPreview
              posts={posts}
              profile={profile}
              onProfileChange={handleProfileChange}
              onPostClick={post => setModal({ type: 'view', postId: post.id })}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-6 pb-6 pt-4 overflow-y-auto">
          <Card>
            <CardContent className="p-5">
              {activeTab === 'Feed' && (
                <>
                  <p className="text-xs font-semibold text-zinc-500 mb-3">
                    {feedListPosts.length} post{feedListPosts.length !== 1 ? 's' : ''} de Feed/Reels
                  </p>
                  {feedListPosts.length === 0 ? (
                    <p className="text-sm text-zinc-400 italic">Nenhum post de Feed ou Reels agendado.</p>
                  ) : (
                    <div className="space-y-2">
                      {feedListPosts.map(p => (
                        <PostListItem
                          key={p.id}
                          post={p}
                          onClick={() => setModal({ type: 'view', postId: p.id })}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'Stories' && (
                <>
                  <p className="text-xs font-semibold text-zinc-500 mb-3">
                    {storiesListPosts.length} post{storiesListPosts.length !== 1 ? 's' : ''} de Stories
                  </p>
                  {storiesListPosts.length === 0 ? (
                    <p className="text-sm text-zinc-400 italic">Nenhum Stories agendado.</p>
                  ) : (
                    <div className="space-y-2">
                      {storiesListPosts.map(p => (
                        <PostListItem
                          key={p.id}
                          post={p}
                          onClick={() => setModal({ type: 'view', postId: p.id })}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'Rascunhos' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-zinc-500">
                      {draftPosts.length} rascunho{draftPosts.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => setModal({ type: 'newDraft' })}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
                    >
                      <Plus className="w-3 h-3" /> Novo rascunho
                    </button>
                  </div>
                  {draftPosts.length === 0 ? (
                    <p className="text-sm text-zinc-400 italic">Nenhum rascunho ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftPosts.map(p => (
                        <PostListItem
                          key={p.id}
                          post={p}
                          onClick={() => setModal({ type: 'view', postId: p.id })}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Modals */}
      {modal.type === 'new' && (
        <PostModal
          post={null}
          mode="new"
          products={products}
          scripts={scripts}
          onClose={() => setModal({ type: 'none' })}
          onSave={handleSavePost}
        />
      )}

      {modal.type === 'newDraft' && (
        <PostModal
          post={{ ...emptyDraftForm(), id: '', createdAt: '' }}
          mode="new"
          products={products}
          scripts={scripts}
          onClose={() => setModal({ type: 'none' })}
          onSave={data => handleSavePost({ ...data, scheduledFor: data.scheduledFor })}
        />
      )}

      {modal.type === 'view' && modalPost && (
        <PostModal
          post={modalPost}
          mode="view"
          products={products}
          scripts={scripts}
          onClose={() => setModal({ type: 'none' })}
          onSave={handleSavePost}
          onDelete={handleDeletePost}
          onSwitchEdit={() => setModal({ type: 'edit', postId: modalPost.id })}
        />
      )}

      {modal.type === 'edit' && modalPost && (
        <PostModal
          post={modalPost}
          mode="edit"
          products={products}
          scripts={scripts}
          onClose={() => setModal({ type: 'none' })}
          onSave={handleSavePost}
          onDelete={handleDeletePost}
        />
      )}

      {modal.type === 'planner' && (
        <SchedulePlannerModal
          products={products}
          onClose={() => setModal({ type: 'none' })}
          onGenerate={handleGenerateSchedule}
        />
      )}
    </div>
  );
}
