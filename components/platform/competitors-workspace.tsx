"use client";

import { useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  ExternalLink,
  Globe,
  Heart,
  Instagram,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type CompetitorType = 'competitor' | 'reference' | 'inspiration';

type Competitor = {
  id: string;
  name: string;
  handle: string;
  website: string;
  type: CompetitorType;
  logoUrl: string;
  niche: string;
  notes: string;
  aiAnalysis: string;
  tags: string[];
  createdAt: string;
};

type ContentReference = {
  id: string;
  competitorId: string;
  competitorName: string;
  title: string;
  content: string;
  hookType: string;
  ctaType: string;
  format: string;
  imageUrl: string;
  notes: string;
  liked: boolean;
  savedAt: string;
};

type CompetitorFormState = Omit<Competitor, 'id' | 'createdAt' | 'aiAnalysis'>;
type ReferenceFormState = Omit<ContentReference, 'id' | 'competitorId' | 'competitorName' | 'savedAt'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CompetitorType, string> = {
  competitor: 'Concorrente',
  reference: 'Referência',
  inspiration: 'Inspiração',
};

const TYPE_BADGE: Record<CompetitorType, string> = {
  competitor: 'bg-red-50 text-red-700 border border-red-200',
  reference: 'bg-blue-50 text-blue-700 border border-blue-200',
  inspiration: 'bg-purple-50 text-purple-700 border border-purple-200',
};

const HOOK_TYPES = [
  'Curiosidade',
  'Erro comum',
  'Mito',
  'Verdade chocante',
  'Comparação',
  'Antes e depois',
  'Lista',
  'Alerta',
  'Segredo',
  'História pessoal',
  'POV',
  'Pergunta forte',
  'Frase polêmica',
  'Outro',
];

const CTA_TYPES = ['Vendas', 'Engajamento', 'Comentários', 'Salvar', 'Compartilhar', 'Seguir', 'Direct', 'Outro'];
const FORMAT_TYPES = ['Reels', 'Stories', 'Carrossel', 'Post', 'Outro'];
const COMPETITOR_TYPES: { value: CompetitorType; label: string }[] = [
  { value: 'competitor', label: 'Concorrente' },
  { value: 'reference', label: 'Referência' },
  { value: 'inspiration', label: 'Inspiração' },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function competitorsKey(workspace: string) {
  return `creatorai:competitors:${workspace}`;
}

function referencesKey(workspace: string) {
  return `creatorai:references:${workspace}`;
}

function loadCompetitors(workspace: string): Competitor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(competitorsKey(workspace));
    return raw ? (JSON.parse(raw) as Competitor[]) : [];
  } catch {
    return [];
  }
}

function saveCompetitors(workspace: string, items: Competitor[]) {
  try {
    localStorage.setItem(competitorsKey(workspace), JSON.stringify(items));
  } catch {}
}

function loadReferences(workspace: string): ContentReference[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(referencesKey(workspace));
    return raw ? (JSON.parse(raw) as ContentReference[]) : [];
  } catch {
    return [];
  }
}

function saveReferences(workspace: string, items: ContentReference[]) {
  try {
    localStorage.setItem(referencesKey(workspace), JSON.stringify(items));
  } catch {}
}

function emptyCompetitorForm(): CompetitorFormState {
  return {
    name: '',
    handle: '',
    website: '',
    type: 'competitor',
    logoUrl: '',
    niche: '',
    notes: '',
    tags: [],
  };
}

function emptyReferenceForm(): ReferenceFormState {
  return {
    title: '',
    content: '',
    hookType: 'Curiosidade',
    ctaType: 'Engajamento',
    format: 'Reels',
    imageUrl: '',
    notes: '',
    liked: false,
  };
}

// ─── CompetitorCard ───────────────────────────────────────────────────────────

function CompetitorCard({
  competitor,
  onClick,
}: {
  competitor: Competitor;
  onClick: () => void;
}) {
  const initial = competitor.name.charAt(0).toUpperCase();
  return (
    <Card
      className="cursor-pointer rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {competitor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={competitor.logoUrl}
              alt={competitor.name}
              className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-500">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-zinc-900">{competitor.name}</p>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', TYPE_BADGE[competitor.type])}>
                {TYPE_LABELS[competitor.type]}
              </span>
            </div>
            {competitor.handle && (
              <p className="mt-0.5 text-xs text-zinc-400">@{competitor.handle}</p>
            )}
            {competitor.niche && (
              <p className="mt-1 text-xs text-zinc-500">{competitor.niche}</p>
            )}
          </div>
        </div>
        {competitor.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {competitor.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                {tag}
              </span>
            ))}
            {competitor.tags.length > 4 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-400">
                +{competitor.tags.length - 4}
              </span>
            )}
          </div>
        )}
        {competitor.notes && (
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
            {competitor.notes.length > 80 ? competitor.notes.slice(0, 80) + '…' : competitor.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CompetitorFormModal ──────────────────────────────────────────────────────

function CompetitorFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Competitor;
  onSave: (data: CompetitorFormState) => void;
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
          tags: initial.tags,
        }
      : emptyCompetitorForm()
  );
  const [tagsInput, setTagsInput] = useState(initial?.tags.join(', ') ?? '');

  function field<K extends keyof CompetitorFormState>(key: K, value: CompetitorFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({ ...form, tags });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {initial ? 'Editar perfil' : 'Adicionar perfil'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nome *</label>
            <Input
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              placeholder="Nome do perfil"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">@Instagram</label>
            <Input
              value={form.handle}
              onChange={(e) => field('handle', e.target.value.replace(/^@/, ''))}
              placeholder="handle (sem @)"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Tipo</label>
            <div className="flex gap-2">
              {COMPETITOR_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => field('type', opt.value)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                    form.type === opt.value
                      ? TYPE_BADGE[opt.value] + ' border-current'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Website</label>
            <Input
              value={form.website}
              onChange={(e) => field('website', e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Nicho</label>
            <Input
              value={form.niche}
              onChange={(e) => field('niche', e.target.value)}
              placeholder="Ex: Finanças pessoais, Moda, Fitness..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">URL do logo</label>
            <Input
              value={form.logoUrl}
              onChange={(e) => field('logoUrl', e.target.value)}
              placeholder="https://..."
            />
            {form.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoUrl}
                alt="preview"
                className="mt-2 h-12 w-12 rounded-xl object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Tags (separadas por vírgula)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ex: educação, reels, viral"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Notas</label>
            <Textarea
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="Estratégia deles, o que fazem bem, estilo de comunicação..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── AddReferenceModal ────────────────────────────────────────────────────────

function AddReferenceModal({
  competitorId,
  competitorName,
  onSave,
  onClose,
}: {
  competitorId: string;
  competitorName: string;
  onSave: (data: ReferenceFormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ReferenceFormState>(emptyReferenceForm);

  function field<K extends keyof ReferenceFormState>(key: K, value: ReferenceFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.content.trim()) {
      toast.error('Conteúdo é obrigatório.');
      return;
    }
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Adicionar referência</h2>
            <p className="text-xs text-zinc-400 mt-0.5">de {competitorName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Título</label>
            <Input
              value={form.title}
              onChange={(e) => field('title', e.target.value)}
              placeholder="Descrição breve da referência"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Conteúdo *</label>
            <Textarea
              value={form.content}
              onChange={(e) => field('content', e.target.value)}
              placeholder="O gancho, legenda ou texto que te inspirou..."
              rows={5}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Tipo de gancho</label>
              <select
                value={form.hookType}
                onChange={(e) => field('hookType', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                {HOOK_TYPES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">CTA</label>
              <select
                value={form.ctaType}
                onChange={(e) => field('ctaType', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                {CTA_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Formato</label>
              <select
                value={form.format}
                onChange={(e) => field('format', e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                {FORMAT_TYPES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">URL da imagem (opcional)</label>
            <Input
              value={form.imageUrl}
              onChange={(e) => field('imageUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-700">Notas internas</label>
            <Textarea
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="O que te inspirou, como adaptar..."
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="liked-toggle"
              type="checkbox"
              checked={form.liked}
              onChange={(e) => field('liked', e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-pink-500"
            />
            <label htmlFor="liked-toggle" className="text-sm text-zinc-700 cursor-pointer flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-pink-500" /> Adicionar ao banco de referências (curtidas)
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar referência</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ReferenceCard ────────────────────────────────────────────────────────────

function ReferenceCard({
  ref: reference,
  onToggleLike,
  onDelete,
  showCompetitor,
}: {
  ref: ContentReference;
  onToggleLike: () => void;
  onDelete?: () => void;
  showCompetitor?: boolean;
}) {
  return (
    <Card className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {showCompetitor && (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                <Instagram className="h-2.5 w-2.5" />
                {reference.competitorName}
              </span>
            )}
            {reference.title && (
              <p className="text-sm font-semibold text-zinc-900 mb-1">{reference.title}</p>
            )}
            <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3">
              {reference.content}
            </p>
          </div>
          {reference.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reference.imageUrl}
              alt=""
              className="ml-2 h-14 w-14 flex-shrink-0 rounded-xl object-cover"
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-medium text-orange-700">
            {reference.hookType}
          </span>
          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {reference.ctaType}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
            {reference.format}
          </span>
        </div>
        {reference.notes && (
          <p className="mt-2 text-[11px] text-zinc-400 italic line-clamp-1">{reference.notes}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onToggleLike}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              reference.liked
                ? 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
            )}
          >
            <Heart className={cn('h-3 w-3', reference.liked && 'fill-current')} />
            {reference.liked ? 'Curtida' : 'Curtir'}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-full p-1.5 text-zinc-300 hover:bg-zinc-50 hover:text-zinc-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CompetitorDetailModal ────────────────────────────────────────────────────

function CompetitorDetailModal({
  competitor,
  references,
  workspace,
  onUpdateCompetitor,
  onAddReference,
  onToggleReferenceLike,
  onDeleteReference,
  onClose,
}: {
  competitor: Competitor;
  references: ContentReference[];
  workspace: string;
  onUpdateCompetitor: (updated: Competitor) => void;
  onAddReference: (data: ReferenceFormState) => void;
  onToggleReferenceLike: (refId: string) => void;
  onDeleteReference: (refId: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'perfil' | 'analysis' | 'references'>('perfil');
  const [editingProfile, setEditingProfile] = useState(false);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [addingReference, setAddingReference] = useState(false);
  const [refFilter, setRefFilter] = useState<'all' | 'liked'>('all');

  const competitorRefs = references.filter((r) => r.competitorId === competitor.id);
  const filteredRefs = refFilter === 'liked' ? competitorRefs.filter((r) => r.liked) : competitorRefs;

  async function generateAiAnalysis() {
    setGeneratingAnalysis(true);
    try {
      const convRes = await fetch(`/api/workspaces/${workspace}/ai/conversations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: `Análise: ${competitor.name}` }),
      });
      const convData = await convRes.json();
      const convId = convData.conversation?.id;
      if (!convId) throw new Error('Não foi possível criar conversa');

      const msgRes = await fetch(`/api/workspaces/${workspace}/ai/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: `Faça uma análise estratégica detalhada do perfil @${competitor.handle} (${competitor.name}). Tipo: ${TYPE_LABELS[competitor.type]}. Nicho: ${competitor.niche}. Minhas observações sobre eles: ${competitor.notes || 'sem observações ainda'}. Analise: tom de voz provável, tipos de conteúdo que devem performar bem, ganchos provavelmente usados, CTAs, pontos fortes, pontos fracos, e 3 ações práticas que posso implementar baseado nessa análise.`,
        }),
      });
      const msgData = await msgRes.json();
      const analysis =
        msgData.messages?.find((m: { role: string }) => m.role === 'assistant')?.content ?? '';

      onUpdateCompetitor({ ...competitor, aiAnalysis: analysis });
      toast.success('Análise gerada com sucesso!');
    } catch {
      toast.error('Erro ao gerar análise. Tente novamente.');
    } finally {
      setGeneratingAnalysis(false);
    }
  }

  const tabs = [
    { key: 'perfil' as const, label: 'Perfil' },
    { key: 'analysis' as const, label: 'Análise IA' },
    { key: 'references' as const, label: `Referências (${competitorRefs.length})` },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-3">
              {competitor.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={competitor.logoUrl}
                  alt={competitor.name}
                  className="h-10 w-10 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-500">
                  {competitor.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{competitor.name}</h2>
                <div className="mt-0.5 flex items-center gap-2">
                  {competitor.handle && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Instagram className="h-3 w-3" /> @{competitor.handle}
                    </span>
                  )}
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TYPE_BADGE[competitor.type])}>
                    {TYPE_LABELS[competitor.type]}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-zinc-100 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'pb-3 pt-4 text-xs font-medium transition-colors mr-6',
                  activeTab === tab.key
                    ? 'border-b-2 border-zinc-900 text-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-600'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'perfil' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProfile(true)}
                    className="flex items-center gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {competitor.niche && (
                    <div>
                      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1">Nicho</p>
                      <p className="text-zinc-900">{competitor.niche}</p>
                    </div>
                  )}
                  {competitor.website && (
                    <div>
                      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1">Website</p>
                      <a
                        href={competitor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {competitor.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                {competitor.tags.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {competitor.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {competitor.notes && (
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-2">Notas</p>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">{competitor.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="space-y-4">
                {competitor.aiAnalysis ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" /> Análise gerada por IA
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateAiAnalysis}
                        disabled={generatingAnalysis}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {generatingAnalysis ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Brain className="h-3.5 w-3.5" />
                        )}
                        Regenerar
                      </Button>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                      {competitor.aiAnalysis}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Brain className="h-10 w-10 text-zinc-300 mb-3" />
                    <p className="text-sm font-medium text-zinc-600 mb-1">Nenhuma análise ainda</p>
                    <p className="text-xs text-zinc-400 mb-6 max-w-xs">
                      Gere uma análise estratégica com IA baseada no perfil e nas suas notas.
                    </p>
                    <Button
                      onClick={generateAiAnalysis}
                      disabled={generatingAnalysis}
                      className="flex items-center gap-2"
                    >
                      {generatingAnalysis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                      {generatingAnalysis ? 'Gerando análise...' : 'Gerar análise'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'references' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setRefFilter('all')}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        refFilter === 'all'
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-500 hover:bg-zinc-100'
                      )}
                    >
                      Todas ({competitorRefs.length})
                    </button>
                    <button
                      onClick={() => setRefFilter('liked')}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1',
                        refFilter === 'liked'
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-500 hover:bg-zinc-100'
                      )}
                    >
                      <Heart className="h-3 w-3" /> Curtidas ({competitorRefs.filter((r) => r.liked).length})
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setAddingReference(true)}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>

                {filteredRefs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <BookOpen className="h-8 w-8 text-zinc-300 mb-2" />
                    <p className="text-sm text-zinc-500">
                      {refFilter === 'liked' ? 'Nenhuma referência curtida ainda.' : 'Nenhuma referência salva ainda.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRefs.map((ref) => (
                      <ReferenceCard
                        key={ref.id}
                        ref={ref}
                        onToggleLike={() => onToggleReferenceLike(ref.id)}
                        onDelete={() => onDeleteReference(ref.id)}
                        showCompetitor={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingProfile && (
        <CompetitorFormModal
          initial={competitor}
          onSave={(data) => {
            onUpdateCompetitor({
              ...competitor,
              ...data,
            });
            setEditingProfile(false);
          }}
          onClose={() => setEditingProfile(false)}
        />
      )}

      {addingReference && (
        <AddReferenceModal
          competitorId={competitorId}
          competitorName={competitor.name}
          onSave={(data) => {
            onAddReference(data);
            setAddingReference(false);
          }}
          onClose={() => setAddingReference(false)}
        />
      )}
    </>
  );
}

// helper to avoid referencing competitor in JSX outside the modal
const competitorId = '';

// ─── ReferencesBank ───────────────────────────────────────────────────────────

function ReferencesBank({
  references,
  onToggleLike,
}: {
  references: ContentReference[];
  onToggleLike: (refId: string) => void;
}) {
  const liked = useMemo(
    () => [...references.filter((r) => r.liked)].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [references]
  );

  if (liked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Heart className="h-12 w-12 text-zinc-200 mb-4" />
        <p className="text-sm font-medium text-zinc-500 mb-1">Banco de referências vazio</p>
        <p className="text-xs text-zinc-400 max-w-xs">
          Curta referências nos perfis dos concorrentes para salvá-las aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-4 w-4 text-pink-500 fill-current" />
        <span className="text-sm font-medium text-zinc-700">{liked.length} referência{liked.length !== 1 ? 's' : ''} curtida{liked.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {liked.map((ref) => (
          <ReferenceCard
            key={ref.id}
            ref={ref}
            onToggleLike={() => onToggleLike(ref.id)}
            showCompetitor={true}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main CompetitorsWorkspace ────────────────────────────────────────────────

export function CompetitorsWorkspace({ workspace }: { workspace: string }) {
  const [competitors, setCompetitors] = useState<Competitor[]>(() => loadCompetitors(workspace));
  const [references, setReferences] = useState<ContentReference[]>(() => loadReferences(workspace));
  const [activeTab, setActiveTab] = useState<'profiles' | 'bank'>('profiles');
  const [search, setSearch] = useState('');
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);

  // persist helpers
  function persistCompetitors(updated: Competitor[]) {
    setCompetitors(updated);
    saveCompetitors(workspace, updated);
  }

  function persistReferences(updated: ContentReference[]) {
    setReferences(updated);
    saveReferences(workspace, updated);
  }

  function addCompetitor(data: CompetitorFormState) {
    const newItem: Competitor = {
      ...data,
      id: crypto.randomUUID(),
      aiAnalysis: '',
      createdAt: new Date().toISOString(),
    };
    persistCompetitors([...competitors, newItem]);
    setAddingCompetitor(false);
    toast.success('Perfil adicionado!');
  }

  function updateCompetitor(updated: Competitor) {
    const next = competitors.map((c) => (c.id === updated.id ? updated : c));
    persistCompetitors(next);
    // also update selected if open
    setSelectedCompetitor((prev) => (prev?.id === updated.id ? updated : prev));
    toast.success('Perfil atualizado!');
  }

  function addReference(competitorId: string, competitorName: string, data: ReferenceFormState) {
    const newRef: ContentReference = {
      ...data,
      id: crypto.randomUUID(),
      competitorId,
      competitorName,
      savedAt: new Date().toISOString(),
    };
    persistReferences([...references, newRef]);
    toast.success('Referência salva!');
  }

  function toggleReferenceLike(refId: string) {
    const next = references.map((r) => (r.id === refId ? { ...r, liked: !r.liked } : r));
    persistReferences(next);
  }

  function deleteReference(refId: string) {
    const next = references.filter((r) => r.id !== refId);
    persistReferences(next);
    toast.success('Referência removida.');
  }

  const filteredCompetitors = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return competitors;
    return competitors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.niche.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [competitors, search]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <PageIntro
        eyebrow="Concorrentes"
        title="Mapa de Referências"
        description="Analise concorrentes, inspire-se em referências e construa seu banco de ideias."
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab('profiles')}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-medium transition-colors',
            activeTab === 'profiles' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          Perfis ({competitors.length})
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5',
            activeTab === 'bank' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', activeTab === 'bank' && 'text-pink-500')} />
          Banco de Referências ({references.filter((r) => r.liked).length})
        </button>
      </div>

      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar perfis..."
                className="pl-9"
              />
            </div>
            <Button onClick={() => setAddingCompetitor(true)} className="flex items-center gap-2 ml-auto">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {filteredCompetitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Instagram className="h-12 w-12 text-zinc-200 mb-4" />
              {competitors.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-zinc-600 mb-1">Nenhum perfil ainda</p>
                  <p className="text-xs text-zinc-400 mb-6 max-w-xs">
                    Adicione concorrentes, referências e inspirações para mapear o seu mercado.
                  </p>
                  <Button onClick={() => setAddingCompetitor(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar primeiro perfil
                  </Button>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Nenhum resultado para "{search}"</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCompetitors.map((c) => (
                <CompetitorCard key={c.id} competitor={c} onClick={() => setSelectedCompetitor(c)} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bank' && (
        <ReferencesBank references={references} onToggleLike={toggleReferenceLike} />
      )}

      {addingCompetitor && (
        <CompetitorFormModal onSave={addCompetitor} onClose={() => setAddingCompetitor(false)} />
      )}

      {selectedCompetitor && (
        <CompetitorDetailModal
          competitor={selectedCompetitor}
          references={references}
          workspace={workspace}
          onUpdateCompetitor={updateCompetitor}
          onAddReference={(data) => addReference(selectedCompetitor.id, selectedCompetitor.name, data)}
          onToggleReferenceLike={toggleReferenceLike}
          onDeleteReference={deleteReference}
          onClose={() => setSelectedCompetitor(null)}
        />
      )}
    </div>
  );
}
