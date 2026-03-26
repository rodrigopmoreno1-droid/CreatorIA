"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, CheckCircle2, Eye, Loader2, Mic, PencilLine, Plus, Sparkles, Square, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScriptPreviewModal } from '@/components/platform/script-preview-modal';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { ScriptEditorModal } from '@/components/platform/script-editor-modal';
import { useSpeechCapture } from '@/hooks/use-speech-capture';
import { CONTENT_FORMAT_ORDER, getContentFormatBadgeClass, getContentFormatLabel } from '@/lib/content-format-meta';
import { buildEditableScript, buildScriptSavePayloads, type EditableScriptDraft } from '@/lib/script-drafts';
import type { ProductItem, ScriptItem } from '@/types/platform';

type ScriptStatusFilter = 'all' | 'draft' | 'approved';
type ScriptFormatFilter = 'all' | (typeof CONTENT_FORMAT_ORDER)[number];

const CONTENT_TYPES = [
  { value: 'reels', label: getContentFormatLabel('reels') },
  { value: 'stories', label: getContentFormatLabel('stories') },
  { value: 'video_curto', label: getContentFormatLabel('video_curto') },
  { value: 'carrossel', label: getContentFormatLabel('carrossel') },
  { value: 'post', label: getContentFormatLabel('post') }
] as const;

const SUB_OPTIONS: Record<string, ReadonlyArray<{ value: string; label: string }>> = {
  reels: [
    { value: '15s', label: '15s' },
    { value: '30s', label: '30s' },
    { value: '45s', label: '45s' },
    { value: '60s', label: '1 min' },
    { value: '90s', label: '1,5 min' },
    { value: '3min', label: '3 min' }
  ],
  video_curto: [
    { value: '30s', label: '30s' },
    { value: '60s', label: '1 min' },
    { value: '90s', label: '1,5 min' },
    { value: '3min', label: '3 min' }
  ],
  stories: [
    { value: '1', label: '1 slide' },
    { value: '2', label: '2 slides' },
    { value: '3', label: '3 slides' },
    { value: '5', label: '5 slides' }
  ],
  carrossel: [
    { value: '3', label: '3 páginas' },
    { value: '5', label: '5 páginas' },
    { value: '7', label: '7 páginas' },
    { value: '10', label: '10 páginas' }
  ]
};

const DEFAULT_SUB_OPTIONS: Record<string, string> = {
  reels: '30s',
  video_curto: '60s',
  stories: '3',
  carrossel: '5',
  post: ''
};

const TONES = [
  { value: 'natural', label: 'Natural' },
  { value: 'autoridade', label: 'Autoridade' },
  { value: 'emocional', label: 'Emocional' },
  { value: 'engracado', label: 'Engraçado' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'genz', label: 'Gen Z' },
  { value: 'educativo', label: 'Educativo' },
  { value: 'trend', label: '🔥 Trend' }
] as const;

const OBJECTIVES = [
  { value: 'vender', label: 'Vender' },
  { value: 'engajar', label: 'Engajar' },
  { value: 'educar', label: 'Educar' },
  { value: 'autoridade', label: 'Autoridade' },
  { value: 'prova_social', label: 'Prova social' },
  { value: 'alcance', label: 'Alcance' },
  { value: 'relacionamento', label: 'Relacionamento' }
] as const;

const AUDIENCE_TEMPLATES_KEY = 'ca_audience_templates';

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
              value === opt.value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChipGroup({
  label,
  options,
  values,
  onChange
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(value: string) {
    if (values.includes(value)) {
      const next = values.filter((v) => v !== value);
      onChange(next.length ? next : [value]);
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
              values.includes(opt.value)
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
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

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function ScriptsWorkspace({
  workspace,
  products: initialProducts,
  scripts: initialScripts
}: {
  workspace: string;
  products: ProductItem[];
  scripts: ScriptItem[];
}) {
  const [products] = useState(initialProducts);
  const [scripts, setScripts] = useState(initialScripts);

  // Structured briefing state
  const [contentType, setContentType] = useState<string>('reels');
  const [subOption, setSubOption] = useState<string>('30s');
  const [tones, setTones] = useState<string[]>(['natural']);
  const [objectives, setObjectives] = useState<string[]>(['vender']);
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0]?.id ?? '');
  const [pain, setPain] = useState('');
  const [benefit, setBenefit] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [extraContext, setExtraContext] = useState('');
  const [audienceTemplates, setAudienceTemplates] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(AUDIENCE_TEMPLATES_KEY) : null;
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [loadingGeneration, setLoadingGeneration] = useState(false);
  const [busyScriptId, setBusyScriptId] = useState<string | null>(null);
  const [viewingScript, setViewingScript] = useState<ScriptItem | null>(null);
  const [editingScript, setEditingScript] = useState<EditableScriptDraft | null>(null);
  const [statusFilter, setStatusFilter] = useState<ScriptStatusFilter>('all');
  const [formatFilter, setFormatFilter] = useState<ScriptFormatFilter>('all');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const filteredScripts = useMemo(() => {
    return scripts.filter((script) => {
      // Conteúdo page only shows pre-production content
      if (script.status !== 'draft' && script.status !== 'approved') return false;
      if (statusFilter !== 'all' && script.status !== statusFilter) return false;
      if (formatFilter !== 'all' && script.contentType !== formatFilter) return false;
      return true;
    });
  }, [scripts, statusFilter, formatFilter]);

  const draftCount = useMemo(() => scripts.filter((s) => s.status === 'draft').length, [scripts]);
  const approvedCount = useMemo(() => scripts.filter((s) => s.status === 'approved').length, [scripts]);

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      if (product.audience && !targetAudience) setTargetAudience(product.audience);
      if (product.pain && !pain) setPain(product.pain);
      if (product.benefit && !benefit) setBenefit(product.benefit);
    }
  }

  function handleContentTypeChange(nextType: string) {
    setContentType(nextType);
    setSubOption(DEFAULT_SUB_OPTIONS[nextType] ?? '');
  }

  function saveAudienceTemplate() {
    const trimmed = targetAudience.trim();
    if (!trimmed || audienceTemplates.includes(trimmed)) return;
    const next = [trimmed, ...audienceTemplates].slice(0, 8);
    setAudienceTemplates(next);
    try { localStorage.setItem(AUDIENCE_TEMPLATES_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }

  function removeAudienceTemplate(template: string) {
    const next = audienceTemplates.filter((t) => t !== template);
    setAudienceTemplates(next);
    try { localStorage.setItem(AUDIENCE_TEMPLATES_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }

  const voiceCapture = useSpeechCapture({
    onTranscript: async (text) => {
      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'rewriteHumanTone', payload: { text } })
        });
        const payload = (await response.json().catch(() => null)) as { content?: unknown } | null;
        const nextText = typeof payload?.content === 'string' ? payload.content.trim() : text;
        setExtraContext(nextText);
        toast.success('Transcrição aplicada ao contexto.');
      } catch {
        setExtraContext(text);
        toast.success('Transcrição aplicada ao contexto.');
      }
    }
  });

  // Live context summary for the preview panel
  const contextSummary = useMemo(() => {
    const parts: string[] = [];
    const ctLabel = CONTENT_TYPES.find((c) => c.value === contentType)?.label ?? contentType;
    const subOpts = SUB_OPTIONS[contentType];
    const subLabel = subOpts ? (subOpts.find((o) => o.value === subOption)?.label ?? subOption) : null;
    const tonesLabel = tones.map((t) => TONES.find((o) => o.value === t)?.label ?? t).join(', ');
    const objsLabel = objectives.map((o) => OBJECTIVES.find((x) => x.value === o)?.label ?? o).join(', ');
    parts.push(`${ctLabel}${subLabel ? ` · ${subLabel}` : ''} · ${tonesLabel} · ${objsLabel}`);
    if (selectedProduct) parts.push(`Produto: ${selectedProduct.name}`);
    if (pain) parts.push(`Dor: ${pain}`);
    if (benefit) parts.push(`Benefício: ${benefit}`);
    if (targetAudience) parts.push(`Público: ${targetAudience}`);
    if (extraContext.trim()) parts.push(`Extra: ${extraContext.trim().slice(0, 80)}`);
    return parts;
  }, [contentType, subOption, tones, objectives, selectedProduct, pain, benefit, targetAudience, extraContext]);

  const canGenerate = pain.trim() || benefit.trim() || extraContext.trim();

  async function handleGenerate() {
    if (voiceCapture.isRecording || voiceCapture.isProcessing) {
      toast.error('Aguarde a transcrição terminar antes de gerar.');
      return;
    }

    if (!canGenerate) {
      toast.error('Preencha pelo menos a dor ou o benefício principal antes de gerar.');
      return;
    }

    setLoadingGeneration(true);

    try {
      const productContext = selectedProduct
        ? [selectedProduct.benefits, selectedProduct.audience, selectedProduct.restrictions].filter(Boolean).join(' | ')
        : '';

      const combinedPrompt = extraContext.trim() || `${pain || benefit}`;

      // Step 1 — call AI
      const aiResponse = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'generateScriptVariants',
          payload: {
            prompt: combinedPrompt,
            productName: selectedProduct?.name,
            productContext,
            referenceContext: '',
            contentType,
            subOption: subOption || undefined,
            tones,
            objectives,
            pain,
            benefit,
            targetAudience
          }
        })
      });

      const aiPayload = (await aiResponse.json().catch(() => null)) as { content?: unknown; error?: string } | null;

      if (!aiResponse.ok) {
        throw new Error(aiPayload?.error ?? 'A IA não conseguiu gerar os roteiros.');
      }

      const toSave = buildScriptSavePayloads(aiPayload?.content, {
        prompt: combinedPrompt,
        product: selectedProduct,
        contentType,
        subOption
      });

      if (!toSave.length) {
        throw new Error('A IA retornou um formato inválido. Tente novamente.');
      }

      // Step 2 — auto-save to DB as drafts (persist on navigation)
      const saveResponse = await fetch(`/api/workspaces/${workspace}/scripts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scripts: toSave })
      });

      const savePayload = (await saveResponse.json().catch(() => null)) as { scripts?: ScriptItem[]; error?: string } | null;

      if (!saveResponse.ok || !savePayload?.scripts?.length) {
        throw new Error(savePayload?.error ?? 'Não foi possível salvar os roteiros gerados.');
      }

      setScripts((current) => [...savePayload.scripts!, ...current]);
      setStatusFilter('draft');
      toast.success('Roteiro salvo como rascunho.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível gerar os roteiros.';
      toast.error(message);
    } finally {
      setLoadingGeneration(false);
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
      if (!response.ok || !payload?.script) throw new Error(payload?.error ?? 'Erro ao aprovar.');
      setScripts((current) => current.map((s) => (s.id === payload.script!.id ? payload.script! : s)));
      setViewingScript((current) => (current?.id === payload.script!.id ? payload.script! : current));
      toast.success('Roteiro aprovado e enviado para Produção.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível aprovar o roteiro.');
    } finally {
      setBusyScriptId(null);
    }
  }

  async function handleDiscard(scriptId: string) {
    setBusyScriptId(scriptId);
    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? 'Erro ao descartar.');
      setScripts((current) => current.filter((s) => s.id !== scriptId));
      setViewingScript((current) => (current?.id === scriptId ? null : current));
      toast.success('Roteiro descartado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível descartar o roteiro.');
    } finally {
      setBusyScriptId(null);
    }
  }

  async function handleQuickAdvance(scriptId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Falha ao atualizar status');
      setScripts(current =>
        current.map(s => s.id === scriptId ? { ...s, status: newStatus as any } : s)
      );
      toast.success(newStatus === 'approved' ? 'Roteiro aprovado!' : 'Enviado para produção!');
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  }

  async function updateScript(script: EditableScriptDraft) {
    setBusyScriptId(script.id);
    try {
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
          postFields: script.postFields
        })
      });
      const payload = (await response.json().catch(() => null)) as { script?: ScriptItem; error?: string } | null;
      if (!response.ok || !payload?.script) throw new Error(payload?.error ?? 'Erro ao atualizar.');
      setScripts((current) => current.map((s) => (s.id === payload.script!.id ? payload.script! : s)));
      setViewingScript((current) => (current?.id === payload.script!.id ? payload.script! : current));
      setEditingScript(null);
      toast.success('Roteiro atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o roteiro.');
    } finally {
      setBusyScriptId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Conteúdo"
        title="Briefing, geração e aprovação"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setPain('');
              setBenefit('');
              setTargetAudience('');
              setExtraContext('');
              voiceCapture.reset();
            }}
            size="sm"
          >
            Limpar briefing
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* ── Briefing estruturado ── */}
        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-5 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Briefing</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/30">
                <Bot className="h-4 w-4 text-foreground" />
              </div>
            </div>

            {/* Chips */}
            <div className="space-y-3.5 rounded-[18px] border border-border bg-muted/20 p-3.5">
              <ChipGroup
                label="Tipo de conteúdo"
                options={CONTENT_TYPES}
                value={contentType}
                onChange={handleContentTypeChange}
              />
              {SUB_OPTIONS[contentType] ? (
                <ChipGroup
                  label={contentType === 'stories' ? 'Quantidade de slides' : contentType === 'carrossel' ? 'Quantidade de páginas' : 'Duração'}
                  options={SUB_OPTIONS[contentType] as ReadonlyArray<{ value: string; label: string }>}
                  value={subOption}
                  onChange={setSubOption}
                />
              ) : null}
              <MultiChipGroup
                label="Tom de comunicação"
                options={TONES}
                values={tones}
                onChange={setTones}
              />
              <MultiChipGroup
                label="Objetivo"
                options={OBJECTIVES}
                values={objectives}
                onChange={setObjectives}
              />
            </div>

            {/* Produto + campos principais */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Produto vinculado
                </label>
                <div className="rounded-2xl border border-border bg-background px-3">
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="h-9 w-full bg-transparent text-sm outline-none"
                  >
                    <option value="">Sem produto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Dor principal
                  </label>
                  <Input
                    value={pain}
                    onChange={(e) => setPain(e.target.value)}
                    placeholder="Ex.: não consegue emagrecer, cansaço, ansiedade..."
                    className="h-9 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Benefício principal
                  </label>
                  <Input
                    value={benefit}
                    onChange={(e) => setBenefit(e.target.value)}
                    placeholder="Ex.: perder peso, ter energia, dormir melhor..."
                    className="h-9 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Público-alvo
                  </label>
                  {targetAudience.trim() ? (
                    <button
                      type="button"
                      onClick={saveAudienceTemplate}
                      className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Salvar como template
                    </button>
                  ) : null}
                </div>
                <Input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Ex.: mulheres 30-45 anos, mães, quem quer emagrecer..."
                  className="h-9 rounded-xl text-sm"
                />
                {audienceTemplates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {audienceTemplates.map((template) => (
                      <div key={template} className="group flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => setTargetAudience(template)}
                          className="max-w-[180px] truncate text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {template}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAudienceTemplate(template)}
                          className="text-muted-foreground/40 hover:text-rose-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Contexto extra (opcional)
                  </label>
                  <button
                    type="button"
                    onClick={voiceCapture.isRecording ? voiceCapture.stop : voiceCapture.start}
                    disabled={!voiceCapture.isSupported || loadingGeneration || voiceCapture.isProcessing}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
                  >
                    {voiceCapture.isRecording ? (
                      <><Square className="h-3 w-3" /> Parar</>
                    ) : (
                      <><Mic className="h-3 w-3" /> Voz</>
                    )}
                  </button>
                </div>
                <Textarea
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  placeholder="Referências, tendências, temas em alta, instruções específicas... A IA já busca trends automaticamente, mas você pode complementar."
                  className="min-h-[80px] text-sm"
                />
                {voiceCapture.error ? (
                  <p className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    {voiceCapture.error}
                  </p>
                ) : null}
                <div className="flex gap-2 text-[11px] text-muted-foreground">
                  {voiceCapture.isRecording && <span className="rounded-full border border-border px-2 py-0.5">gravando...</span>}
                  {voiceCapture.isProcessing && <span className="rounded-full border border-border px-2 py-0.5">transcrevendo...</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleGenerate}
                disabled={loadingGeneration || voiceCapture.isRecording || voiceCapture.isProcessing || !canGenerate}
              >
                {loadingGeneration ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar roteiro
              </Button>
              <Link
                href={`/${workspace}/products`}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-4 text-[13px] font-medium text-foreground transition hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
                Cadastrar produto
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── Painel de contexto ── */}
        <Card className="rounded-[24px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="space-y-3.5 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">Contexto</p>
              <Sparkles className="h-4 w-4 text-white/40" />
            </div>

            <div className="space-y-2.5">
              {contextSummary.length ? (
                contextSummary.map((line, i) => (
                  <div key={i} className="rounded-[14px] border border-white/10 bg-white/6 px-3.5 py-2.5">
                    <p className="text-[13px] leading-5 text-white/80">{line}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-white/10 bg-white/6 p-3.5">
                  <p className="text-[13px] leading-5 text-white/45">
                    Selecione o tipo de conteúdo, tom e objetivo. Depois preencha a dor ou benefício principal para a IA gerar roteiros conectados ao produto.
                  </p>
                </div>
              )}
            </div>

            {selectedProduct?.benefits ? (
              <div className="rounded-[14px] border border-white/8 bg-white/4 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Produto</p>
                <p className="mt-1 text-[12px] leading-4 text-white/60 line-clamp-4">
                  {selectedProduct.benefits}
                </p>
              </div>
            ) : null}

            {tones.includes('trend') ? (
              <div className="rounded-[14px] border border-amber-400/20 bg-amber-400/8 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/70">Modo Trend ativo</p>
                <p className="mt-1 text-[12px] leading-4 text-white/55">
                  A IA identifica formatos virais do momento (POV, antes/depois, expectativa vs realidade...) e adapta o produto a cada um. Cada variação usará um formato trend diferente.
                </p>
              </div>
            ) : (
              <div className="rounded-[14px] border border-white/8 bg-white/4 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Tendências</p>
                <p className="mt-1 text-[12px] leading-4 text-white/55">
                  A IA busca automaticamente reels, TikToks e carrosséis virais relacionados ao tema do produto ao gerar os roteiros.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pipeline de roteiros ── */}
      <Card className="rounded-[24px] border-border/90 bg-white/95">
        <CardContent className="space-y-4 p-4 lg:p-5">
          {/* Header + filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Roteiros</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {scripts.length} no total · {draftCount} rascunho{draftCount !== 1 ? 's' : ''} · {approvedCount} aprovado{approvedCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'draft', 'approved'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                      statusFilter === f
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                    }`}
                  >
                    {f === 'all' ? 'Todos' : f === 'draft' ? 'Rascunho' : 'Aprovado'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['all', ...CONTENT_FORMAT_ORDER] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setFormatFilter(format)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                      formatFilter === format
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                    }`}
                  >
                    {format === 'all' ? 'Todos formatos' : getContentFormatLabel(format)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Script cards */}
          <div className="space-y-2.5">
            {filteredScripts.length ? (
              filteredScripts.map((script) => {
                const isDraft = script.status === 'draft';
                const isBusy = busyScriptId === script.id;
                return (
                  <div
                    key={script.id}
                    className={`rounded-[20px] border p-3.5 transition ${isDraft ? 'border-border bg-muted/20' : 'border-border bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{script.title}</p>
                          {script.contentType && (
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getContentFormatBadgeClass(script.contentType)}`}>
                              {getContentFormatLabel(script.contentType)}
                            </span>
                          )}
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            script.status === 'draft'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : script.status === 'approved'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-blue-200 bg-blue-50 text-blue-700'
                          }`}>
                            {STATUS_LABELS[script.status] ?? script.status}
                          </span>
                        </div>
                        {script.contentType === 'stories' && script.storySlides && script.storySlides.length > 0 ? (
                          <>
                            <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground/80 line-clamp-2">
                              {script.storySlides[0].textoTela || script.hook}
                            </p>
                            <p className="mt-1 text-[12px] text-muted-foreground">{script.storySlides.length} slides</p>
                          </>
                        ) : script.contentType === 'carrossel' && script.carrosselSlides && script.carrosselSlides.length > 0 ? (
                          <>
                            <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground/80 line-clamp-2">
                              {script.carrosselSlides[0].titulo}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                              {script.carrosselSlides[0].subtitulo}
                            </p>
                            <p className="mt-1 text-[12px] text-muted-foreground">{script.carrosselSlides.length} páginas</p>
                          </>
                        ) : script.contentType === 'post' && script.postFields ? (
                          <>
                            <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground/80 line-clamp-2">
                              {script.postFields.tituloPeca}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                              {script.postFields.conceito}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground/80 line-clamp-2">
                              {script.hook}
                            </p>
                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                              {script.spoken}
                            </p>
                          </>
                        )}
                        <p className="mt-2 text-[12px] text-muted-foreground">
                          {script.productName || 'Sem produto'} · {formatDateLabel(script.updatedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isDraft ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingScript(script)}
                            disabled={isBusy}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualizar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingScript(buildEditableScript(script))}
                            disabled={isBusy}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(script.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Aprovar
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDiscard(script.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            Descartar
                          </button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingScript(script)}
                            disabled={isBusy}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualizar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingScript(buildEditableScript(script))}
                            disabled={isBusy}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {script.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleQuickAdvance(script.id, 'production')}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-40"
                            >
                              → Produção
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-5 text-center text-[13px] leading-6 text-muted-foreground">
                {statusFilter === 'all'
                  ? 'Configure o briefing e clique em Gerar roteiro. Cada clique gera 1 roteiro e salva automaticamente — gere quantos quiser.'
                  : statusFilter === 'draft'
                    ? 'Nenhum rascunho ainda. Gere roteiros no briefing acima.'
                    : statusFilter === 'approved'
                      ? 'Nenhum roteiro aprovado ainda.'
                      : 'Nenhum roteiro em produção ainda.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {editingScript ? (
        <ScriptEditorModal
          title="Editar roteiro"
          script={editingScript}
          onChange={setEditingScript}
          onClose={() => setEditingScript(null)}
          onSave={() => updateScript(editingScript)}
          savingLabel={busyScriptId === editingScript.id ? 'Atualizando...' : 'Atualizar roteiro'}
        />
      ) : null}

      {viewingScript ? (
        <ScriptPreviewModal
          script={viewingScript}
          busy={busyScriptId === viewingScript.id}
          onClose={() => setViewingScript(null)}
          onEdit={() => {
            setViewingScript(null);
            setEditingScript(buildEditableScript(viewingScript));
          }}
          onApprove={viewingScript.status === 'draft' ? () => handleApprove(viewingScript.id) : undefined}
          onDiscard={viewingScript.status === 'draft' ? () => handleDiscard(viewingScript.id) : undefined}
        />
      ) : null}
    </div>
  );
}
