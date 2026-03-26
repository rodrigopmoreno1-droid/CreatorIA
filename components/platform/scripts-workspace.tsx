"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, Loader2, Mic, PencilLine, Plus, Sparkles, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { ScriptEditorModal, type EditableScriptDraft } from '@/components/platform/script-editor-modal';
import { useSpeechCapture } from '@/hooks/use-speech-capture';
import type { ProductItem, ScriptItem } from '@/types/platform';

type GeneratedScript = EditableScriptDraft;

const CONTENT_TYPES = [
  { value: 'reels', label: 'Reels' },
  { value: 'stories', label: 'Stories' },
  { value: 'video_curto', label: 'Vídeo curto' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'post', label: 'Post estático' }
] as const;

const DURATIONS = [
  { value: '15s', label: '15s' },
  { value: '30s', label: '30s' },
  { value: '45s', label: '45s' },
  { value: '60s', label: '60s' }
] as const;

const TONES = [
  { value: 'natural', label: 'Natural' },
  { value: 'autoridade', label: 'Autoridade' },
  { value: 'emocional', label: 'Emocional' },
  { value: 'engracado', label: 'Engraçado' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'genz', label: 'Gen Z' },
  { value: 'educativo', label: 'Educativo' }
] as const;

const OBJECTIVES = [
  { value: 'vender', label: 'Vender' },
  { value: 'engajar', label: 'Engajar' },
  { value: 'educar', label: 'Educar' },
  { value: 'autoridade', label: 'Autoridade' },
  { value: 'prova_social', label: 'Prova social' }
] as const;

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

function padTakeList(takes: string[], minimum = 5) {
  const nextTakes = [...takes];
  while (nextTakes.length < minimum) {
    nextTakes.push('');
  }
  return nextTakes;
}

function buildEditableScript(script: ScriptItem): EditableScriptDraft {
  return {
    id: script.id,
    title: script.title,
    hook: script.hook,
    spoken: script.spoken,
    takes: padTakeList(script.takes.length ? script.takes : []),
    cta: script.cta,
    caption: script.caption,
    prompt: script.prompt,
    referenceContext: script.referenceContext,
    productId: script.productId,
    productName: script.productName
  };
}

function normalizeGeneratedScripts(
  payload: unknown,
  context: { prompt: string; referenceContext: string; product?: ProductItem }
) {
  if (!Array.isArray(payload)) {
    return [] as GeneratedScript[];
  }

  const drafts: GeneratedScript[] = [];

  payload.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as Record<string, unknown>;

    drafts.push({
      id: `generated-${Date.now()}-${index}`,
      title: typeof raw.title === 'string' ? raw.title : `Roteiro ${index + 1}`,
      hook: typeof raw.hook === 'string' ? raw.hook : '',
      spoken: typeof raw.spoken === 'string' ? raw.spoken : '',
      takes: padTakeList(Array.isArray(raw.takes) ? raw.takes.filter((t): t is string => typeof t === 'string') : []),
      cta: typeof raw.cta === 'string' ? raw.cta : '',
      caption: typeof raw.caption === 'string' ? raw.caption : '',
      prompt: context.prompt,
      referenceContext: context.referenceContext,
      productId: context.product?.id,
      productName: context.product?.name
    });
  });

  return drafts;
}

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
  const [generatedScripts, setGeneratedScripts] = useState<GeneratedScript[]>([]);

  // Structured briefing state
  const [contentType, setContentType] = useState<string>('reels');
  const [duration, setDuration] = useState<string>('30s');
  const [tone, setTone] = useState<string>('natural');
  const [objective, setObjective] = useState<string>('vender');
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0]?.id ?? '');
  const [pain, setPain] = useState('');
  const [benefit, setBenefit] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [extraContext, setExtraContext] = useState('');

  const [loadingGeneration, setLoadingGeneration] = useState(false);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [busyScriptId, setBusyScriptId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<GeneratedScript | null>(null);
  const [editingSaved, setEditingSaved] = useState<EditableScriptDraft | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const draftScripts = useMemo(() => scripts.filter((s) => s.status === 'draft'), [scripts]);
  const approvedScripts = useMemo(() => scripts.filter((s) => s.status === 'approved'), [scripts]);

  // When product changes, auto-fill audience if empty
  function handleProductChange(productId: string) {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    if (product?.audience && !targetAudience) {
      setTargetAudience(product.audience);
    }
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
    const durLabel = DURATIONS.find((d) => d.value === duration)?.label ?? duration;
    const toneLabel = TONES.find((t) => t.value === tone)?.label ?? tone;
    const objLabel = OBJECTIVES.find((o) => o.value === objective)?.label ?? objective;
    parts.push(`${ctLabel} · ${durLabel} · ${toneLabel} · ${objLabel}`);
    if (selectedProduct) parts.push(`Produto: ${selectedProduct.name}`);
    if (pain) parts.push(`Dor: ${pain}`);
    if (benefit) parts.push(`Benefício: ${benefit}`);
    if (targetAudience) parts.push(`Público: ${targetAudience}`);
    if (extraContext.trim()) parts.push(`Extra: ${extraContext.trim().slice(0, 80)}`);
    return parts;
  }, [contentType, duration, tone, objective, selectedProduct, pain, benefit, targetAudience, extraContext]);

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

      const combinedPrompt = [extraContext.trim()].filter(Boolean).join(' ');

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'generateScriptVariants',
          payload: {
            prompt: combinedPrompt || `${pain || benefit}`,
            productName: selectedProduct?.name,
            productContext,
            referenceContext: '',
            contentType,
            duration,
            tone,
            objective,
            pain,
            benefit,
            targetAudience
          }
        })
      });

      const payload = (await response.json().catch(() => null)) as { content?: unknown; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'A IA não conseguiu gerar os roteiros.');
      }

      const nextScripts = normalizeGeneratedScripts(payload?.content, {
        prompt: combinedPrompt,
        referenceContext: '',
        product: selectedProduct
      });

      if (!nextScripts.length) {
        throw new Error('A IA retornou um formato inválido. Tente novamente.');
      }

      setGeneratedScripts(nextScripts);
      toast.success('3 roteiros gerados para revisão.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível gerar os roteiros.';
      toast.error(message);
    } finally {
      setLoadingGeneration(false);
    }
  }

  async function saveGeneratedScript(script: GeneratedScript) {
    setSavingDraftId(script.id);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts`, {
        method: 'POST',
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
          status: 'draft'
        })
      });

      const payload = (await response.json().catch(() => null)) as { scripts?: ScriptItem[]; error?: string } | null;

      if (!response.ok || !payload?.scripts?.length) {
        throw new Error(payload?.error ?? 'Não foi possível salvar o roteiro.');
      }

      setScripts((current) => [...payload.scripts!, ...current]);
      setGeneratedScripts((current) => current.filter((item) => item.id !== script.id));
      setEditingDraft(null);
      toast.success('Roteiro salvo na sua base.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o roteiro.';
      toast.error(message);
    } finally {
      setSavingDraftId(null);
    }
  }

  async function updateSavedScript(script: EditableScriptDraft, status?: 'draft' | 'approved') {
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
          status: status ?? undefined
        })
      });

      const payload = (await response.json().catch(() => null)) as { script?: ScriptItem; error?: string } | null;

      if (!response.ok || !payload?.script) {
        throw new Error(payload?.error ?? 'Não foi possível atualizar o roteiro.');
      }

      setScripts((current) => current.map((item) => (item.id === payload.script!.id ? payload.script! : item)));
      setEditingSaved(null);
      toast.success(status === 'approved' ? 'Roteiro aprovado.' : 'Roteiro atualizado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar o roteiro.';
      toast.error(message);
    } finally {
      setBusyScriptId(null);
    }
  }

  async function deleteScript(scriptId: string) {
    setBusyScriptId(scriptId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Não foi possível remover o roteiro.');
      }

      setScripts((current) => current.filter((item) => item.id !== scriptId));
      toast.success('Roteiro removido.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível remover o roteiro.';
      toast.error(message);
    } finally {
      setBusyScriptId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Roteiros"
        title="Geração, edição e aprovação"
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
                onChange={setContentType}
              />
              <ChipGroup
                label="Duração"
                options={DURATIONS}
                value={duration}
                onChange={setDuration}
              />
              <ChipGroup
                label="Tom de comunicação"
                options={TONES}
                value={tone}
                onChange={setTone}
              />
              <ChipGroup
                label="Objetivo"
                options={OBJECTIVES}
                value={objective}
                onChange={setObjective}
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
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Público-alvo
                </label>
                <Input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Ex.: mulheres 30-45 anos, mães, quem quer emagrecer..."
                  className="h-9 rounded-xl text-sm"
                />
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
                Gerar 3 roteiros
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

            <div className="rounded-[14px] border border-white/8 bg-white/4 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Tendências</p>
              <p className="mt-1 text-[12px] leading-4 text-white/55">
                A IA busca automaticamente reels, TikToks e carrosséis virais relacionados ao tema do produto ao gerar os roteiros.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Roteiros gerados + base ── */}
      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Gerados agora</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Revise e salve o que realmente valer seguir.</p>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {generatedScripts.length} variações
              </Badge>
            </div>

            <div className="space-y-2.5">
              {generatedScripts.length ? (
                generatedScripts.map((script) => (
                  <div key={script.id} className="rounded-[20px] border border-border bg-muted/20 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{script.title}</p>
                        <p className="mt-1.5 text-[13px] font-medium leading-5 text-foreground/80 line-clamp-2">
                          {script.hook}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                          {script.spoken}
                        </p>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingDraft(script)}>
                        <PencilLine className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button size="sm" onClick={() => saveGeneratedScript(script)} disabled={savingDraftId === script.id}>
                        {savingDraftId === script.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
                  Configure o briefing ao lado e clique em <strong>Gerar 3 roteiros</strong>. Cada variação terá um ângulo diferente: dor, prova e curiosidade.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Base de roteiros</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Rascunhos e aprovados.</p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {scripts.length} no total
              </Badge>
            </div>

            <div className="space-y-4">
              {/* Rascunhos */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rascunhos</p>
                  <span className="text-[12px] text-muted-foreground">{draftScripts.length}</span>
                </div>
                {draftScripts.length ? (
                  draftScripts.map((script) => (
                    <div key={script.id} className="rounded-[20px] border border-border bg-muted/20 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{script.title}</p>
                          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{script.hook}</p>
                          <p className="mt-2 text-[12px] text-muted-foreground">
                            {script.productName || 'Sem produto'} · {formatDateLabel(script.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingSaved(buildEditableScript(script))}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
                            aria-label="Editar roteiro"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteScript(script.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-rose-600 transition hover:bg-rose-50"
                            aria-label="Remover roteiro"
                          >
                            {busyScriptId === script.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateSavedScript(buildEditableScript(script), 'approved')}
                          disabled={busyScriptId === script.id}
                        >
                          {busyScriptId === script.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3.5 text-[13px] text-muted-foreground">
                    Nenhum rascunho salvo ainda.
                  </div>
                )}
              </div>

              {/* Aprovados */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Aprovados</p>
                  <span className="text-[12px] text-muted-foreground">{approvedScripts.length}</span>
                </div>
                {approvedScripts.length ? (
                  approvedScripts.map((script) => (
                    <div key={script.id} className="rounded-[20px] border border-border bg-white p-3.5">
                      <p className="text-sm font-semibold text-foreground">{script.title}</p>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{script.hook}</p>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        {script.productName || 'Sem produto'} · pronto para gravação
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3.5 text-[13px] text-muted-foreground">
                    Roteiros aprovados aparecem aqui e seguem para Gravações.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {editingDraft ? (
        <ScriptEditorModal
          title="Editar roteiro gerado"
          script={editingDraft}
          onChange={setEditingDraft}
          onClose={() => setEditingDraft(null)}
          onSave={() => saveGeneratedScript(editingDraft)}
          savingLabel={savingDraftId === editingDraft.id ? 'Salvando...' : 'Salvar roteiro'}
        />
      ) : null}

      {editingSaved ? (
        <ScriptEditorModal
          title="Editar roteiro salvo"
          script={editingSaved}
          onChange={setEditingSaved}
          onClose={() => setEditingSaved(null)}
          onSave={() => updateSavedScript(editingSaved)}
          savingLabel={busyScriptId === editingSaved.id ? 'Atualizando...' : 'Atualizar roteiro'}
        />
      ) : null}
    </div>
  );
}
