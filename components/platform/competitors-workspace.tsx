"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Brain,
  ExternalLink,
  Globe,
  Heart,
  Instagram,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'sonner';

import { PageIntro } from '@/components/platform/page-intro';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildReferencePayloadFromInsight, buildReferencePayloadFromGeneratedContent } from '@/lib/competitor-reference-payload';
import { buildCompetitorContentIdeas } from '@/lib/competitor-content-ideas';
import { cn } from '@/lib/utils';
import type {
  CompetitorAnalysis,
  CompetitorAnalysisStatus,
  CompetitorGeneratedContentItem,
  CompetitorGeneratedContentPack,
  CompetitorInsight,
  CompetitorReferenceCategory,
  CompetitorRecord,
  CompetitorType,
  ContentReferenceRecord
} from '@/types/competitor-intelligence';

type CompetitorFormState = {
  name: string;
  handle: string;
  website: string;
  type: CompetitorType;
  logoUrl: string;
  niche: string;
  notes: string;
  tags: string[];
};

type ReferenceFormState = {
  title: string;
  content: string;
  category: CompetitorReferenceCategory;
  hookType: string;
  ctaType: string;
  format: string;
  imageUrl: string;
  notes: string;
  liked: boolean;
};

const TYPE_LABELS: Record<CompetitorType, string> = {
  competitor: 'Concorrente',
  reference: 'Referencia',
  inspiration: 'Inspiracao'
};

const TYPE_BADGE: Record<CompetitorType, string> = {
  competitor: 'border-red-200 bg-red-50 text-red-700',
  reference: 'border-blue-200 bg-blue-50 text-blue-700',
  inspiration: 'border-violet-200 bg-violet-50 text-violet-700'
};

const ANALYSIS_LABELS: Record<CompetitorAnalysisStatus, string> = {
  idle: 'Sem analise',
  capturing: 'Capturando',
  processing: 'Processando',
  running: 'Analisando',
  insufficient_data: 'Dados insuficientes',
  completed: 'Analise pronta',
  error: 'Erro'
};

const ANALYSIS_BADGES: Record<CompetitorAnalysisStatus, string> = {
  idle: 'border-zinc-200 bg-zinc-50 text-zinc-500',
  capturing: 'border-sky-200 bg-sky-50 text-sky-700',
  processing: 'border-amber-200 bg-amber-50 text-amber-700',
  running: 'border-amber-200 bg-amber-50 text-amber-700',
  insufficient_data: 'border-orange-200 bg-orange-50 text-orange-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700'
};

const HOOK_TYPES = [
  'Curiosidade',
  'Erro comum',
  'Mito',
  'Verdade chocante',
  'Comparacao',
  'Antes e depois',
  'Lista',
  'Alerta',
  'Segredo',
  'Historia pessoal',
  'POV',
  'Pergunta forte',
  'Frase polemica',
  'Outro'
];

const CTA_TYPES = ['Vendas', 'Engajamento', 'Comentarios', 'Salvar', 'Compartilhar', 'Seguir', 'Direct', 'Outro'];
const FORMAT_TYPES = ['Reels', 'Stories', 'Carrossel', 'Post', 'Video curto', 'Outro'];
const REFERENCE_CATEGORY_LABELS: Record<CompetitorReferenceCategory, string> = {
  hook: 'Hook',
  cta: 'CTA',
  structure: 'Estrutura',
  content_idea: 'Ideia de conteúdo',
  storytelling: 'Storytelling',
  copy_angle: 'Ângulo de copy',
  offer: 'Oferta',
  social_proof: 'Prova social',
  format: 'Formato',
  other: 'Outro'
};

const REFERENCE_CATEGORY_OPTIONS: Array<{ value: CompetitorReferenceCategory; label: string }> = [
  { value: 'hook', label: 'Hook' },
  { value: 'cta', label: 'CTA' },
  { value: 'structure', label: 'Estrutura' },
  { value: 'content_idea', label: 'Ideia de conteúdo' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'copy_angle', label: 'Ângulo de copy' },
  { value: 'offer', label: 'Oferta' },
  { value: 'social_proof', label: 'Prova social' },
  { value: 'format', label: 'Formato' },
  { value: 'other', label: 'Outro' }
];

function emptyCompetitorForm(): CompetitorFormState {
  return {
    name: '',
    handle: '',
    website: '',
    type: 'competitor',
    logoUrl: '',
    niche: '',
    notes: '',
    tags: []
  };
}

function emptyReferenceForm(): ReferenceFormState {
  return {
    title: '',
    content: '',
    category: 'content_idea',
    hookType: 'Curiosidade',
    ctaType: 'Engajamento',
    format: 'Reels',
    imageUrl: '',
    notes: '',
    liked: true
  };
}

function formatDateLabel(value: string) {
  if (!value) {
    return 'Agora';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Data indisponivel';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed);
}

function formatReferenceCategoryLabel(value: string) {
  if (!value) {
    return 'Sem categoria';
  }

  const key = value as CompetitorReferenceCategory;
  return REFERENCE_CATEGORY_LABELS[key] ?? (
    {
      manual: 'Outro',
      idea: 'Ideia de conteúdo',
      action: 'Ideia de conteúdo',
      overview: 'Ângulo de copy',
      theme: 'Ângulo de copy',
      visual: 'Formato',
      adaptation: 'Estrutura'
    } as Record<string, string>
  )[value] ?? value;
}

function AnalysisStatusBadge({ status }: { status: CompetitorAnalysisStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', ANALYSIS_BADGES[status])}>
      {status === 'running' || status === 'capturing' || status === 'processing' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
      {ANALYSIS_LABELS[status]}
    </span>
  );
}

function CompetitorCard({
  competitor,
  referenceCount,
  onClick
}: {
  competitor: CompetitorRecord;
  referenceCount: number;
  onClick: () => void;
}) {
  const initial = competitor.name.charAt(0).toUpperCase();

  return (
    <Card className="cursor-pointer rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={onClick}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {competitor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={competitor.logoUrl} alt={competitor.name} className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-500">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-zinc-900">{competitor.name}</p>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', TYPE_BADGE[competitor.type])}>
                {TYPE_LABELS[competitor.type]}
              </span>
            </div>
            {competitor.handle ? (
              <p className="mt-0.5 text-xs text-zinc-400">@{competitor.handle}</p>
            ) : null}
            {competitor.niche ? <p className="mt-1 text-xs text-zinc-500">{competitor.niche}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnalysisStatusBadge status={competitor.analysisStatus} />
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
            {referenceCount} referencia{referenceCount === 1 ? '' : 's'}
          </span>
        </div>

        {competitor.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {competitor.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {competitor.analysis?.overview ? (
          <p className="text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
            {competitor.analysis.overview.positioning}
          </p>
        ) : competitor.analysisStatus === 'insufficient_data' && competitor.analysisError ? (
          <p className="text-[11px] leading-relaxed text-orange-600 line-clamp-2">{competitor.analysisError}</p>
        ) : competitor.notes ? (
          <p className="text-[11px] leading-relaxed text-zinc-400 line-clamp-2">{competitor.notes}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReferenceCard({
  reference,
  showCompetitor,
  onToggleLike,
  onDelete
}: {
  reference: ContentReferenceRecord;
  showCompetitor: boolean;
  onToggleLike: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">{reference.title || 'Referencia salva'}</p>
            {reference.category ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                {formatReferenceCategoryLabel(reference.category)}
              </span>
            ) : null}
            {reference.format ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {reference.format}
              </span>
            ) : null}
          </div>

          {showCompetitor && reference.competitorName ? (
            <p className="text-[11px] text-zinc-400">de {reference.competitorName}</p>
          ) : null}

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{reference.content}</p>

          {reference.notes ? <p className="text-xs leading-relaxed text-zinc-500">{reference.notes}</p> : null}

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            {reference.hookType ? <span>Gancho: {reference.hookType}</span> : null}
            {reference.ctaType ? <span>CTA: {reference.ctaType}</span> : null}
            <span>Salva em {formatDateLabel(reference.savedAt)}</span>
            {reference.sourceUrl ? (
              <a href={reference.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-800">
                Ver origem <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onToggleLike}
            className={cn(
              'rounded-full border p-2 transition',
              reference.liked
                ? 'border-pink-200 bg-pink-50 text-pink-600'
                : 'border-zinc-200 bg-white text-zinc-400 hover:text-pink-500'
            )}
            title={reference.liked ? 'Remover do banco' : 'Salvar no banco'}
          >
            <Heart className={cn('h-4 w-4', reference.liked && 'fill-current')} />
          </button>
          {onDelete ? (
            <button type="button" onClick={onDelete} className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-400 transition hover:text-rose-500">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompetitorFormModal({
  workspace,
  initial,
  onSave,
  onClose
}: {
  workspace: string;
  initial?: CompetitorRecord;
  onSave: (data: CompetitorFormState) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CompetitorFormState>(() =>
    initial
      ? {
          name: initial.name,
          handle: initial.handle,
          website: initial.website,
          type: initial.type,
          logoUrl: initial.logoUrl,
          niche: initial.niche,
          notes: initial.notes,
          tags: initial.tags
        }
      : emptyCompetitorForm()
  );
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [autofillingLogo, setAutofillingLogo] = useState(false);
  const [logoTouched, setLogoTouched] = useState(Boolean(initial?.logoUrl));

  function field<K extends keyof CompetitorFormState>(key: K, value: CompetitorFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    if (logoTouched) {
      return;
    }

    if (!form.website.trim() && !form.handle.trim()) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAutofillingLogo(true);
      try {
        const params = new URLSearchParams({
          website: form.website,
          handle: form.handle,
          name: form.name,
          niche: form.niche
        });
        const response = await fetch(`/api/workspaces/${workspace}/competitors/logo?${params.toString()}`, {
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as { logoUrl?: string } | null;

        if (response.ok && payload?.logoUrl && !logoTouched) {
          setForm((current) => ({ ...current, logoUrl: payload.logoUrl ?? current.logoUrl }));
        }
      } catch {
        // noop
      } finally {
        setAutofillingLogo(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [form.website, form.handle, form.name, form.niche, logoTouched, workspace]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nome do perfil e obrigatorio.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        tags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{initial ? 'Editar perfil' : 'Adicionar perfil'}</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Cadastro com logo automatico via site ou Instagram quando possivel.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 transition hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nome *</label>
            <Input value={form.name} onChange={(event) => field('name', event.target.value)} placeholder="Nome do perfil" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">@Instagram</label>
              <Input value={form.handle} onChange={(event) => field('handle', event.target.value.replace(/^@/, ''))} placeholder="handle sem @" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Website</label>
              <Input value={form.website} onChange={(event) => field('website', event.target.value)} placeholder="https://..." type="url" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Tipo</label>
            <div className="flex gap-2">
              {(['competitor', 'reference', 'inspiration'] as CompetitorType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => field('type', value)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition',
                    form.type === value ? TYPE_BADGE[value] : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                  )}
                >
                  {TYPE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                URL do logo {autofillingLogo ? <Loader2 className="ml-1 inline h-3 w-3 animate-spin" /> : null}
              </label>
              <Input
                value={form.logoUrl}
                onChange={(event) => {
                  setLogoTouched(true);
                  field('logoUrl', event.target.value);
                }}
                placeholder="Preenchido automaticamente quando possivel"
              />
            </div>
            <div className="flex items-end justify-center">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Preview do logo" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-zinc-200" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-xs font-semibold text-zinc-400">
                  Logo
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nicho</label>
            <Input value={form.niche} onChange={(event) => field('niche', event.target.value)} placeholder="Ex.: emagrecimento, moda, marketing..." />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Tags</label>
            <Input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="Ex.: reels, storytelling, humor, conversao" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Notas</label>
            <Textarea
              value={form.notes}
              onChange={(event) => field('notes', event.target.value)}
              placeholder="Contexto, percepcoes, o que esse perfil representa para a estrategia..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initial ? 'Salvar alteracoes' : 'Salvar perfil'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddReferenceModal({
  competitorName,
  onSave,
  onClose
}: {
  competitorName: string;
  onSave: (data: ReferenceFormState) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ReferenceFormState>(emptyReferenceForm);
  const [saving, setSaving] = useState(false);

  function field<K extends keyof ReferenceFormState>(key: K, value: ReferenceFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.content.trim()) {
      toast.error('Conteudo da referencia e obrigatorio.');
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Adicionar referencia</h2>
            <p className="mt-0.5 text-xs text-zinc-400">de {competitorName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 transition hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Titulo</label>
            <Input value={form.title} onChange={(event) => field('title', event.target.value)} placeholder="Descricao curta da referencia" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Conteudo *</label>
            <Textarea value={form.content} onChange={(event) => field('content', event.target.value)} rows={5} placeholder="Gancho, estrutura, insight ou CTA que merece ir para o banco..." required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-1">
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Categoria</label>
              <select value={form.category} onChange={(event) => field('category', event.target.value as CompetitorReferenceCategory)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                {REFERENCE_CATEGORY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Tipo de gancho</label>
              <select value={form.hookType} onChange={(event) => field('hookType', event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                {HOOK_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">CTA</label>
              <select value={form.ctaType} onChange={(event) => field('ctaType', event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                {CTA_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Formato</label>
              <select value={form.format} onChange={(event) => field('format', event.target.value)} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900">
                {FORMAT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">URL da imagem</label>
            <Input value={form.imageUrl} onChange={(event) => field('imageUrl', event.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Notas internas</label>
            <Textarea value={form.notes} onChange={(event) => field('notes', event.target.value)} rows={3} placeholder="Como adaptar, por que isso funciona, quando usar..." />
          </div>

          <div className="flex items-center gap-2">
            <input id="reference-liked" type="checkbox" checked={form.liked} onChange={(event) => field('liked', event.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-pink-500" />
            <label htmlFor="reference-liked" className="text-sm text-zinc-700">
              Salvar direto no Banco de Referencias
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar referencia
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManualCaptureModal({
  mode,
  competitorName,
  onSubmit,
  onClose
}: {
  mode: 'captions' | 'script';
  competitorName: string;
  onSubmit: (payload: { mode: 'captions' | 'script'; content: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      toast.error(mode === 'script' ? 'Cole ao menos dois roteiros curtos.' : 'Cole ao menos duas legendas ou aberturas.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ mode, content });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {mode === 'script' ? 'Colar roteiro manualmente' : 'Colar legendas manualmente'}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">de {competitorName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 transition hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
            Separe cada {mode === 'script' ? 'roteiro' : 'legenda'} com uma linha em branco. O sistema vai transformar esse material em captura, padroes e analise utilizavel.
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Material colado</label>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={12}
              placeholder={
                mode === 'script'
                  ? 'Roteiro 1...\n\nRoteiro 2...\n\nRoteiro 3...'
                  : 'Legenda 1...\n\nLegenda 2...\n\nLegenda 3...'
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Processar material
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  saved,
  onToggleSave
}: {
  insight: CompetitorInsight;
  saved: boolean;
  onToggleSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">{insight.title}</p>
            {insight.format ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                {insight.format}
              </span>
            ) : null}
            {insight.hookType ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                {insight.hookType}
              </span>
            ) : null}
            {insight.ctaType ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {insight.ctaType}
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-zinc-700">{insight.summary}</p>
          <p className="text-xs leading-relaxed text-zinc-500">{insight.rationale}</p>
          {insight.sample ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              {insight.sample}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            {insight.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                {tag}
              </span>
            ))}
            {insight.sourceUrl ? (
              <a href={insight.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-800">
                Ver origem <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleSave}
          className={cn(
            'rounded-full border p-2 transition',
            saved
              ? 'border-pink-200 bg-pink-50 text-pink-600'
              : 'border-zinc-200 bg-white text-zinc-400 hover:text-pink-500'
          )}
          title={saved ? 'Remover do banco de referencias' : 'Salvar no banco de referencias'}
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-current')} />
        </button>
      </div>
    </div>
  );
}

function GeneratedContentCard({
  item,
  saved,
  onToggleSave
}: {
  item: CompetitorGeneratedContentItem;
  saved: boolean;
  onToggleSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
              {formatReferenceCategoryLabel(item.saveCategory)}
            </span>
            {item.format ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {item.format}
              </span>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed text-zinc-700">{item.summary}</p>
          <p className="text-xs leading-relaxed text-zinc-500">{item.rationale}</p>

          {item.structure ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-700">Estrutura:</span> {item.structure}
            </div>
          ) : null}

          {item.angle ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-700">
              <span className="font-medium">Angulo:</span> {item.angle}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            {item.hookType ? <span>Gancho: {item.hookType}</span> : null}
            {item.ctaType ? <span>CTA: {item.ctaType}</span> : null}
            {item.sample ? <span className="text-zinc-500">Exemplo: {item.sample}</span> : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleSave}
          className={cn(
            'rounded-full border p-2 transition',
            saved
              ? 'border-pink-200 bg-pink-50 text-pink-600'
              : 'border-zinc-200 bg-white text-zinc-400 hover:text-pink-500'
          )}
          title={saved ? 'Remover do banco de referencias' : 'Salvar no banco de referencias'}
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-current')} />
        </button>
      </div>
    </div>
  );
}

function CompetitorDetailModal({
  workspace,
  competitor,
  references,
  onUpdateCompetitor,
  onDeleteCompetitor,
  onSaveReference,
  onToggleReferenceLike,
  onDeleteReference,
  onClose
}: {
  workspace: string;
  competitor: CompetitorRecord;
  references: ContentReferenceRecord[];
  onUpdateCompetitor: (competitor: CompetitorRecord) => void;
  onDeleteCompetitor: (competitorId: string) => Promise<void>;
  onSaveReference: (payload: Omit<ContentReferenceRecord, 'id' | 'savedAt'>) => Promise<void>;
  onToggleReferenceLike: (reference: ContentReferenceRecord) => Promise<void>;
  onDeleteReference: (referenceId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'analysis' | 'references'>('analysis');
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingReference, setAddingReference] = useState(false);
  const [manualCaptureMode, setManualCaptureMode] = useState<'captions' | 'script' | null>(null);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<CompetitorGeneratedContentPack | null>(null);
  const [referenceFilter, setReferenceFilter] = useState<'all' | 'liked'>('all');

  const competitorReferences = useMemo(
    () => references.filter((reference) => reference.competitorId === competitor.id),
    [references, competitor.id]
  );
  const filteredReferences = useMemo(
    () => (referenceFilter === 'liked' ? competitorReferences.filter((reference) => reference.liked) : competitorReferences),
    [competitorReferences, referenceFilter]
  );
  const savedInsightIds = useMemo(
    () => new Set(references.filter((reference) => reference.liked).map((reference) => reference.sourceInsightId).filter(Boolean)),
    [references]
  );
  const savedGeneratedContentIds = useMemo(
    () =>
      new Set(
        references
          .map((reference) => reference.sourceInsightId)
          .filter((value): value is string => typeof value === 'string' && value.startsWith('generated_'))
      ),
    [references]
  );

  async function handleGenerateAnalysis() {
    setGeneratingAnalysis(true);
    setGeneratedContent(null);
    try {
      const response = await fetch(`/api/workspaces/${workspace}/competitors/${competitor.id}/analyze`, {
        method: 'POST'
      });
      const payload = (await response.json().catch(() => null)) as { competitor?: CompetitorRecord; error?: string } | null;

      if (!response.ok || !payload?.competitor) {
        throw new Error(payload?.error ?? 'Nao foi possivel gerar a analise agora.');
      }

      onUpdateCompetitor(payload.competitor);
      if (payload.competitor.analysisStatus === 'insufficient_data') {
        toast.warning('Captura concluida, mas ainda faltam dados publicos suficientes para uma analise completa.');
      } else {
        toast.success('Analise concluida com dados reais do perfil.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel gerar a analise.';
      toast.error(message);
    } finally {
      setGeneratingAnalysis(false);
    }
  }

  function handleGenerateContentIdeas() {
    if (!analysis) {
      toast.error('Gere ou carregue uma analise completa antes de montar conteudos baseados nela.');
      return;
    }

    setGeneratingContent(true);
    try {
      const pack = buildCompetitorContentIdeas(analysis, competitor);
      setGeneratedContent(pack);
      toast.success('Pacote de conteudos baseado na analise pronto.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel gerar os conteudos.';
      toast.error(message);
    } finally {
      setGeneratingContent(false);
    }
  }

  async function handleManualCapture(mode: 'captions' | 'script', content: string) {
    setGeneratingAnalysis(true);
    setGeneratedContent(null);
    try {
      const response = await fetch(`/api/workspaces/${workspace}/competitors/${competitor.id}/capture-manual`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, content })
      });
      const payload = (await response.json().catch(() => null)) as { competitor?: CompetitorRecord; error?: string } | null;

      if (!response.ok || !payload?.competitor) {
        throw new Error(payload?.error ?? 'Nao foi possivel processar o material manual.');
      }

      onUpdateCompetitor(payload.competitor);
      toast.success('Material manual processado e incorporado na analise.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel processar o material manual.';
      toast.error(message);
    } finally {
      setGeneratingAnalysis(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Apagar ${competitor.name} e todas as referencias ligadas a esse perfil?`);
    if (!confirmed) {
      return;
    }

    await onDeleteCompetitor(competitor.id);
    onClose();
  }

  async function handleInsightToggle(insight: CompetitorInsight, sectionId?: string) {
    const existing = references.find((reference) => reference.sourceInsightId === insight.id);

    if (existing) {
      await onToggleReferenceLike(existing);
      return;
    }

    await onSaveReference(buildReferencePayloadFromInsight(competitor, insight, sectionId));
  }

  async function handleGeneratedContentToggle(item: CompetitorGeneratedContentItem) {
    const existing = references.find((reference) => reference.sourceInsightId === item.id);

    if (existing) {
      await onToggleReferenceLike(existing);
      return;
    }

    await onSaveReference(buildReferencePayloadFromGeneratedContent(competitor, item));
  }

  const tabs = [
    { key: 'profile' as const, label: 'Perfil' },
    { key: 'analysis' as const, label: 'Analise IA' },
    { key: 'references' as const, label: `Referencias (${competitorReferences.length})` }
  ];

  const analysis = competitor.analysis && Array.isArray(competitor.analysis.sections) && competitor.analysis.sourceSnapshot ? competitor.analysis : null;
  const sourceSnapshot = analysis?.sourceSnapshot ?? competitor.sourceSnapshot;
  const insufficientData = competitor.analysisStatus === 'insufficient_data';
  const isAnalyzing =
    generatingAnalysis ||
    competitor.analysisStatus === 'running' ||
    competitor.analysisStatus === 'capturing' ||
    competitor.analysisStatus === 'processing';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-5xl rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
            <div className="flex items-center gap-4">
              {competitor.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={competitor.logoUrl} alt={competitor.name} className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-lg font-bold text-zinc-500">
                  {competitor.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">{competitor.name}</h2>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', TYPE_BADGE[competitor.type])}>
                    {TYPE_LABELS[competitor.type]}
                  </span>
                  <AnalysisStatusBadge status={competitor.analysisStatus} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  {competitor.handle ? (
                    <span className="inline-flex items-center gap-1">
                      <Instagram className="h-3 w-3" /> @{competitor.handle}
                    </span>
                  ) : null}
                  {competitor.website ? (
                    <a href={competitor.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-700">
                      <Globe className="h-3 w-3" /> {competitor.website.replace(/^https?:\/\//, '')}
                    </a>
                  ) : null}
                  {competitor.lastAnalyzedAt ? <span>Ultima analise em {formatDateLabel(competitor.lastAnalyzedAt)}</span> : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete} className="text-rose-600 hover:text-rose-700">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Apagar
              </Button>
              <button onClick={onClose} className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-zinc-100 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'mr-6 border-b-2 pb-3 pt-4 text-xs font-medium transition',
                  activeTab === tab.key ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'profile' ? (
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <Card className="rounded-2xl border-zinc-200">
                  <CardContent className="space-y-4 p-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Contexto</p>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] text-zinc-400">Nicho</p>
                          <p className="mt-1 text-sm text-zinc-900">{competitor.niche || 'Nao informado'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-zinc-400">Tipo</p>
                          <p className="mt-1 text-sm text-zinc-900">{TYPE_LABELS[competitor.type]}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Notas</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{competitor.notes || 'Sem notas registradas ainda.'}</p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Tags</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {competitor.tags.length ? (
                          competitor.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-zinc-400">Sem tags ainda.</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-zinc-200">
                  <CardContent className="space-y-4 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Fontes disponiveis</p>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <Instagram className="h-4 w-4 text-zinc-500" />
                          Instagram
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{competitor.handle ? `@${competitor.handle}` : 'Nao informado'}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <Globe className="h-4 w-4 text-zinc-500" />
                          Website
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{competitor.website || 'Nao informado'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === 'analysis' ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Análise de mercado e referências</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Coleta perfil, bio, feed, legendas, formatos e traduz os sinais em engenharia de conteúdo, ideias e ação.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleGenerateAnalysis} disabled={generatingAnalysis} className="min-w-[180px]">
                      {generatingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                      {analysis ? 'Regenerar analise' : 'Gerar analise'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateContentIdeas}
                      disabled={!analysis || generatingAnalysis || generatingContent}
                      className="min-w-[240px] border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                    >
                      {generatingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Gerar conteúdos baseados nessa análise
                    </Button>
                  </div>
                </div>

                {competitor.analysisStatus === 'error' ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Falha ao analisar este perfil.</p>
                        <p className="mt-1">{competitor.analysisError || 'Nao foi possivel concluir a analise.'}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 py-16 text-center">
                    <Loader2 className="mb-4 h-10 w-10 animate-spin text-zinc-400" />
                    <p className="text-sm font-medium text-zinc-700">Capturando fontes, processando padroes e organizando os insights...</p>
                    <p className="mt-2 max-w-md text-xs text-zinc-500">
                      O sistema esta separando captura, leitura logica e analise final para evitar respostas genricas sem base real.
                    </p>
                  </div>
                ) : null}

                {insufficientData && !isAnalyzing ? (
                  <div className="space-y-4 rounded-3xl border border-orange-200 bg-orange-50 p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                      <div>
                        <p className="text-sm font-semibold text-orange-900">Dados insuficientes para analise completa</p>
                        <p className="mt-1 text-sm leading-relaxed text-orange-800">
                          {competitor.analysisError || 'O sistema conseguiu capturar pouco material publico. Tente nova captura ou complemente com legendas/roteiros manuais.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={handleGenerateAnalysis} className="border-orange-200 bg-white text-orange-800 hover:bg-orange-100">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Tentar nova captura
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setManualCaptureMode('captions')}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Colar legendas manualmente
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setManualCaptureMode('script')}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Colar roteiro manualmente
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActiveTab('references');
                          setAddingReference(true);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar referencia manual
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!analysis && !insufficientData && !isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
                    <Sparkles className="mb-4 h-10 w-10 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-700">Nenhuma analise ainda</p>
                    <p className="mt-2 max-w-md text-xs text-zinc-500">
                      Gere a analise para mapear tom de voz, formatos, ganchos, CTA, storytelling e ideias que podem virar repertorio.
                    </p>
                  </div>
                ) : null}

                {sourceSnapshot && !isAnalyzing ? (
                  <>
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      {analysis ? (
                        <Card className="rounded-2xl border-zinc-200">
                          <CardContent className="space-y-4 p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Visao geral</p>
                              <span className="text-[11px] text-zinc-400">Atualizada em {formatDateLabel(analysis.generatedAt)}</span>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-[11px] text-zinc-400">Tom de voz</p>
                                <p className="mt-1 text-sm text-zinc-900">{analysis.overview.toneOfVoice}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-zinc-400">Publico aparente</p>
                                <p className="mt-1 text-sm text-zinc-900">{analysis.overview.apparentAudience}</p>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-[11px] text-zinc-400">Posicionamento</p>
                                <p className="mt-1 text-sm text-zinc-900">{analysis.overview.positioning}</p>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-[11px] text-zinc-400">Estilo visual</p>
                                <p className="mt-1 text-sm text-zinc-900">{analysis.overview.visualStyle}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="rounded-2xl border-zinc-200">
                          <CardContent className="space-y-4 p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Leitura parcial</p>
                            <p className="text-sm leading-relaxed text-zinc-700">
                              A captura ja foi persistida e os sinais basicos foram processados, mas a analise final por IA ficou bloqueada porque o volume de posts/legendas ainda nao sustenta uma leitura confiavel.
                            </p>
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
                              Use os botoes acima para tentar nova captura ou complementar com legendas e roteiros reais desse perfil. Assim o sistema passa a trabalhar com base concreta em vez de inventar conclusoes.
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card className="rounded-2xl border-zinc-200">
                        <CardContent className="space-y-4 p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Fontes capturadas</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                              <p className="text-[11px] text-zinc-400">Posts analisados</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-900">{sourceSnapshot.postsAnalyzed}</p>
                            </div>
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                              <p className="text-[11px] text-zinc-400">Reels / videos</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-900">{sourceSnapshot.reelsAnalyzed}</p>
                            </div>
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                              <p className="text-[11px] text-zinc-400">Feed</p>
                              <p className="mt-1 text-lg font-semibold text-zinc-900">{sourceSnapshot.feedAnalyzed}</p>
                            </div>
                          </div>
                          {sourceSnapshot.captureNotes.length ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                              {sourceSnapshot.captureNotes.join(' ')}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>

                    {analysis && (analysis.practicalSuggestions.toContent.length || analysis.practicalSuggestions.toCreatorAi.length || analysis.practicalSuggestions.toReferenceBank.length) ? (
                      <Card className="rounded-2xl border-zinc-200">
                        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Para Conteudo</p>
                            {analysis.practicalSuggestions.toContent.map((item) => (
                              <p key={item} className="mt-2 text-sm leading-relaxed text-zinc-700">
                                {item}
                              </p>
                            ))}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Para Creator AI</p>
                            {analysis.practicalSuggestions.toCreatorAi.map((item) => (
                              <p key={item} className="mt-2 text-sm leading-relaxed text-zinc-700">
                                {item}
                              </p>
                            ))}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Para o Banco</p>
                            {analysis.practicalSuggestions.toReferenceBank.map((item) => (
                              <p key={item} className="mt-2 text-sm leading-relaxed text-zinc-700">
                                {item}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {generatedContent ? (
                      <Card className="rounded-2xl border-zinc-200">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Conteúdos baseados nessa análise</p>
                              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">{generatedContent.summary}</p>
                            </div>
                            <span className="text-[11px] text-zinc-400">Gerado em {formatDateLabel(generatedContent.generatedAt)}</span>
                          </div>

                          <div className="space-y-3">
                            {generatedContent.sections.map((section) => (
                              <div key={section.id} className="space-y-2">
                                <div>
                                  <p className="text-sm font-semibold text-zinc-900">{section.title}</p>
                                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{section.description}</p>
                                </div>
                                <div className="space-y-3">
                                  {section.items.map((item) => (
                                    <GeneratedContentCard
                                      key={item.id}
                                      item={item}
                                      saved={savedGeneratedContentIds.has(item.id)}
                                      onToggleSave={() => handleGeneratedContentToggle(item)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {analysis ? (
                      <div className="space-y-4">
                        {analysis.sections.map((section) => (
                          <Card key={section.id} className="rounded-2xl border-zinc-200">
                            <CardContent className="space-y-4 p-5">
                              <div>
                                <p className="text-sm font-semibold text-zinc-900">{section.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{section.description}</p>
                              </div>
                              <div className={cn('grid gap-3', section.id === 'engineering' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'xl:grid-cols-2')}>
                                {section.items.map((insight) => (
                                  <InsightCard
                                    key={insight.id}
                                    insight={insight}
                                    saved={savedInsightIds.has(insight.id)}
                                    onToggleSave={() => handleInsightToggle(insight, section.id)}
                                  />
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'references' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
                    <button
                      type="button"
                      onClick={() => setReferenceFilter('all')}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                        referenceFilter === 'all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      )}
                    >
                      Todas ({competitorReferences.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferenceFilter('liked')}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                        referenceFilter === 'liked' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      )}
                    >
                      Curtidas ({competitorReferences.filter((reference) => reference.liked).length})
                    </button>
                  </div>

                  <Button size="sm" onClick={() => setAddingReference(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>

                {filteredReferences.length ? (
                  <div className="space-y-3">
                    {filteredReferences.map((reference) => (
                      <ReferenceCard
                        key={reference.id}
                        reference={reference}
                        showCompetitor={false}
                        onToggleLike={() => onToggleReferenceLike(reference)}
                        onDelete={() => onDeleteReference(reference.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center">
                    <BookOpen className="mb-4 h-10 w-10 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-600">Nenhuma referencia salva ainda</p>
                    <p className="mt-2 max-w-sm text-xs text-zinc-500">
                      Curta insights da analise ou adicione referencias manuais para alimentar o banco desse perfil.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editingProfile ? (
        <CompetitorFormModal
          workspace={workspace}
          initial={competitor}
          onSave={async (data) => {
            const response = await fetch(`/api/workspaces/${workspace}/competitors/${competitor.id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(data)
            });
            const payload = (await response.json().catch(() => null)) as { competitor?: CompetitorRecord; error?: string } | null;

            if (!response.ok || !payload?.competitor) {
              throw new Error(payload?.error ?? 'Nao foi possivel atualizar o perfil.');
            }

            onUpdateCompetitor(payload.competitor);
            toast.success('Perfil atualizado.');
          }}
          onClose={() => setEditingProfile(false)}
        />
      ) : null}

      {addingReference ? (
        <AddReferenceModal
          competitorName={competitor.name}
          onSave={async (data) => {
            await onSaveReference({
              competitorId: competitor.id,
              competitorName: competitor.name,
              title: data.title,
              content: data.content,
              category: data.category,
              hookType: data.hookType,
              ctaType: data.ctaType,
              format: data.format,
              imageUrl: data.imageUrl,
              notes: data.notes,
              liked: data.liked,
              source: 'manual',
              sourceInsightId: '',
              sourceUrl: '',
              metadata: {
                origin: 'manual-reference',
                competitorType: competitor.type,
                niche: competitor.niche,
                category: data.category
              }
            });
          }}
          onClose={() => setAddingReference(false)}
        />
      ) : null}

      {manualCaptureMode ? (
        <ManualCaptureModal
          mode={manualCaptureMode}
          competitorName={competitor.name}
          onSubmit={({ mode, content }) => handleManualCapture(mode, content)}
          onClose={() => setManualCaptureMode(null)}
        />
      ) : null}
    </>
  );
}

function ReferencesBank({
  references,
  onToggleLike
}: {
  references: ContentReferenceRecord[];
  onToggleLike: (reference: ContentReferenceRecord) => Promise<void>;
}) {
  const liked = useMemo(
    () => [...references.filter((reference) => reference.liked)].sort((left, right) => right.savedAt.localeCompare(left.savedAt)),
    [references]
  );

  if (!liked.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Heart className="mb-4 h-12 w-12 text-zinc-200" />
        <p className="text-sm font-medium text-zinc-600">Banco de Referencias vazio</p>
        <p className="mt-2 max-w-xs text-xs text-zinc-400">Curta insights das analises ou salve referencias manuais para construir repertorio reutilizavel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 fill-current text-pink-500" />
        <span className="text-sm font-medium text-zinc-700">{liked.length} referencia{liked.length === 1 ? '' : 's'} curtida{liked.length === 1 ? '' : 's'}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {liked.map((reference) => (
          <ReferenceCard key={reference.id} reference={reference} showCompetitor={true} onToggleLike={() => onToggleLike(reference)} />
        ))}
      </div>
    </div>
  );
}

export function CompetitorsWorkspace({
  workspace,
  initialCompetitors,
  initialReferences
}: {
  workspace: string;
  initialCompetitors: CompetitorRecord[];
  initialReferences: ContentReferenceRecord[];
}) {
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>(initialCompetitors);
  const [references, setReferences] = useState<ContentReferenceRecord[]>(initialReferences);
  const [activeTab, setActiveTab] = useState<'profiles' | 'bank'>('profiles');
  const [search, setSearch] = useState('');
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  const selectedCompetitor = useMemo(
    () => competitors.find((competitor) => competitor.id === selectedCompetitorId) ?? null,
    [competitors, selectedCompetitorId]
  );

  const filteredCompetitors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return competitors;
    }

    return competitors.filter((competitor) =>
      [competitor.name, competitor.handle, competitor.niche, competitor.notes, competitor.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [competitors, search]);

  function upsertCompetitor(nextCompetitor: CompetitorRecord) {
    setCompetitors((current) => {
      const existing = current.some((competitor) => competitor.id === nextCompetitor.id);
      const next = existing
        ? current.map((competitor) => (competitor.id === nextCompetitor.id ? nextCompetitor : competitor))
        : [nextCompetitor, ...current];

      return [...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }

  function upsertReference(nextReference: ContentReferenceRecord) {
    setReferences((current) => {
      const existing = current.some((reference) => reference.id === nextReference.id);
      const next = existing
        ? current.map((reference) => (reference.id === nextReference.id ? nextReference : reference))
        : [nextReference, ...current];

      return [...next].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    });
  }

  async function handleCreateCompetitor(data: CompetitorFormState) {
    const response = await fetch(`/api/workspaces/${workspace}/competitors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    });
    const payload = (await response.json().catch(() => null)) as { competitor?: CompetitorRecord; error?: string } | null;

    if (!response.ok || !payload?.competitor) {
      throw new Error(payload?.error ?? 'Nao foi possivel criar o perfil.');
    }

    upsertCompetitor(payload.competitor);
    setSelectedCompetitorId(payload.competitor.id);
    toast.success('Perfil salvo com persistencia real.');
  }

  async function handleUpdateCompetitor(nextCompetitor: CompetitorRecord) {
    upsertCompetitor(nextCompetitor);
  }

  async function handleDeleteCompetitor(competitorId: string) {
    const response = await fetch(`/api/workspaces/${workspace}/competitors/${competitorId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Nao foi possivel apagar o perfil.');
    }

    setCompetitors((current) => current.filter((competitor) => competitor.id !== competitorId));
    setReferences((current) => current.filter((reference) => reference.competitorId !== competitorId));
    toast.success('Perfil removido.');
  }

  async function handleSaveReference(payload: Omit<ContentReferenceRecord, 'id' | 'savedAt'>) {
    const response = await fetch(`/api/workspaces/${workspace}/competitors/references`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { reference?: ContentReferenceRecord; error?: string } | null;

    if (!response.ok || !result?.reference) {
      throw new Error(result?.error ?? 'Nao foi possivel salvar a referencia.');
    }

    upsertReference(result.reference);
    toast.success('Insight salvo no Banco de Referencias.');
  }

  async function handleToggleReferenceLike(reference: ContentReferenceRecord) {
    const response = await fetch(`/api/workspaces/${workspace}/competitors/references/${reference.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: !reference.liked })
    });
    const payload = (await response.json().catch(() => null)) as { reference?: ContentReferenceRecord; error?: string } | null;

    if (!response.ok || !payload?.reference) {
      throw new Error(payload?.error ?? 'Nao foi possivel atualizar a referencia.');
    }

    upsertReference(payload.reference);
  }

  async function handleDeleteReference(referenceId: string) {
    const response = await fetch(`/api/workspaces/${workspace}/competitors/references/${referenceId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? 'Nao foi possivel apagar a referencia.');
    }

    setReferences((current) => current.filter((reference) => reference.id !== referenceId));
    toast.success('Referencia removida.');
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <PageIntro
        eyebrow="Concorrentes"
        title="Mapa de Referencias"
        description="Capture sinais reais de perfis, transforme em insights acionaveis e alimente o banco interno de repertorio."
      />

      <div className="flex w-fit gap-1 rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-medium transition',
            activeTab === 'profiles' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          Perfis ({competitors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bank')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition',
            activeTab === 'bank' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', activeTab === 'bank' && 'fill-current text-pink-500')} />
          Banco de Referencias ({references.filter((reference) => reference.liked).length})
        </button>
      </div>

      {activeTab === 'profiles' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar perfil, nicho, tag..." className="pl-9" />
            </div>
            <Button onClick={() => setAddingCompetitor(true)} className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar perfil
            </Button>
          </div>

          {filteredCompetitors.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCompetitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.id}
                  competitor={competitor}
                  referenceCount={references.filter((reference) => reference.competitorId === competitor.id && reference.liked).length}
                  onClick={() => setSelectedCompetitorId(competitor.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 py-20 text-center">
              <Instagram className="mb-4 h-12 w-12 text-zinc-200" />
              {competitors.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-zinc-600">Nenhum perfil ainda</p>
                  <p className="mt-2 max-w-sm text-xs text-zinc-400">
                    Cadastre concorrentes, referencias e inspiracoes para transformar essa area em uma central real de inteligencia.
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Nenhum resultado para "{search}".</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <ReferencesBank references={references} onToggleLike={handleToggleReferenceLike} />
      )}

      {addingCompetitor ? (
        <CompetitorFormModal workspace={workspace} onSave={handleCreateCompetitor} onClose={() => setAddingCompetitor(false)} />
      ) : null}

      {selectedCompetitor ? (
        <CompetitorDetailModal
          workspace={workspace}
          competitor={selectedCompetitor}
          references={references}
          onUpdateCompetitor={handleUpdateCompetitor}
          onDeleteCompetitor={handleDeleteCompetitor}
          onSaveReference={handleSaveReference}
          onToggleReferenceLike={handleToggleReferenceLike}
          onDeleteReference={handleDeleteReference}
          onClose={() => setSelectedCompetitorId(null)}
        />
      ) : null}
    </div>
  );
}
