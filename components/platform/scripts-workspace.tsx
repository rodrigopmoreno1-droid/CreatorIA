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

function buildEditableScript(script: ScriptItem): EditableScriptDraft {
  return {
    id: script.id,
    title: script.title,
    hook: script.hook,
    spoken: script.spoken,
    takes: script.takes.length ? script.takes : ['', '', '', '', ''],
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
        takes: Array.isArray(raw.takes) ? raw.takes.filter((take): take is string => typeof take === 'string') : [],
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
  const [prompt, setPrompt] = useState('');
  const [referenceContext, setReferenceContext] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(initialProducts[0]?.id ?? '');
  const [loadingGeneration, setLoadingGeneration] = useState(false);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [busyScriptId, setBusyScriptId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<GeneratedScript | null>(null);
  const [editingSaved, setEditingSaved] = useState<EditableScriptDraft | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const draftScripts = useMemo(() => scripts.filter((script) => script.status === 'draft'), [scripts]);
  const approvedScripts = useMemo(() => scripts.filter((script) => script.status === 'approved'), [scripts]);

  const promptVoiceCapture = useSpeechCapture({
    onTranscript: async (text) => {
      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            action: 'rewriteHumanTone',
            payload: {
              text
            }
          })
        });

        const payload = (await response.json().catch(() => null)) as { content?: unknown; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Nao foi possivel refinar a transcricao.');
        }

        const nextText = typeof payload?.content === 'string' ? payload.content : text;
        setPrompt(nextText);
        toast.success('Transcricao aplicada ao briefing.');
      } catch {
        setPrompt(text);
        toast.success('Transcricao aplicada ao briefing.');
      }
    }
  });

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error('Descreva o que voce quer criar antes de chamar a IA.');
      return;
    }

    setLoadingGeneration(true);

    try {
      const productContext = selectedProduct
        ? [selectedProduct.benefits, selectedProduct.audience, selectedProduct.restrictions].filter(Boolean).join(' | ')
        : '';

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generateScriptVariants',
          payload: {
            prompt,
            productName: selectedProduct?.name,
            productContext,
            referenceContext
          }
        })
      });

      const payload = (await response.json().catch(() => null)) as { content?: unknown; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'A IA nao conseguiu gerar os roteiros.');
      }

      const nextScripts = normalizeGeneratedScripts(payload?.content, {
        prompt,
        referenceContext,
        product: selectedProduct
      });

      if (!nextScripts.length) {
        throw new Error('A IA retornou um formato invalido para os roteiros.');
      }

      setGeneratedScripts(nextScripts);
      toast.success('Tres roteiros gerados para revisao.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel gerar os roteiros.';
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
        headers: {
          'content-type': 'application/json'
        },
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
        throw new Error(payload?.error ?? 'Nao foi possivel salvar o roteiro.');
      }

      setScripts((current) => [...payload.scripts!, ...current]);
      setGeneratedScripts((current) => current.filter((item) => item.id !== script.id));
      setEditingDraft(null);
      toast.success('Roteiro salvo na sua base.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o roteiro.';
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
        headers: {
          'content-type': 'application/json'
        },
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
        throw new Error(payload?.error ?? 'Nao foi possivel atualizar o roteiro.');
      }

      setScripts((current) => current.map((item) => (item.id === payload.script!.id ? payload.script! : item)));
      setEditingSaved(null);
      toast.success(status === 'approved' ? 'Roteiro aprovado e enviado para gravacoes.' : 'Roteiro atualizado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel atualizar o roteiro.';
      toast.error(message);
    } finally {
      setBusyScriptId(null);
    }
  }

  async function deleteScript(scriptId: string) {
    setBusyScriptId(scriptId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${scriptId}`, {
        method: 'DELETE'
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel remover o roteiro.');
      }

      setScripts((current) => current.filter((item) => item.id !== scriptId));
      toast.success('Roteiro removido.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel remover o roteiro.';
      toast.error(message);
    } finally {
      setBusyScriptId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Roteiros"
        title="Geracao, edicao e aprovacao"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setPrompt('');
              promptVoiceCapture.reset();
            }}
          >
            Limpar briefing
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Briefing</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/30 text-foreground" aria-label="IA aplicada">
                  <Bot className="h-4 w-4" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={promptVoiceCapture.isRecording ? promptVoiceCapture.stop : promptVoiceCapture.start}
                  disabled={!promptVoiceCapture.isSupported}
                >
                  {promptVoiceCapture.isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {promptVoiceCapture.isRecording ? 'Parar' : 'Voz'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">O que voce quer comunicar?</label>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex.: quero um roteiro para vender consultoria contabil usando um gancho atual sobre risco fiscal e uma linguagem humana."
                className="min-h-[138px]"
              />
              {promptVoiceCapture.error ? (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                  {promptVoiceCapture.error}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                {promptVoiceCapture.isRecording ? <span className="rounded-full border border-border px-2.5 py-1">gravando...</span> : null}
                {promptVoiceCapture.isProcessing ? <span className="rounded-full border border-border px-2.5 py-1">transcrevendo...</span> : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Produto vinculado</label>
                <div className="rounded-2xl border border-border bg-background px-3">
                  <select
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="h-10 w-full bg-transparent text-sm outline-none"
                  >
                    <option value="">Sem produto por enquanto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Referencias e temas em alta</label>
                <Textarea
                  value={referenceContext}
                  onChange={(event) => setReferenceContext(event.target.value)}
                  placeholder="Ex.: buscar noticias recentes sobre tributacao, fraude fiscal, polemicas de mercado ou tendencias que conversem com o produto."
                  className="min-h-[104px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleGenerate} disabled={loadingGeneration}>
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

        <Card className="rounded-[24px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="space-y-3.5 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">Contexto</p>
              </div>
              <Sparkles className="h-4 w-4 text-white/58" />
            </div>

            <div className="space-y-2.5">
              <div className="rounded-[18px] border border-white/10 bg-white/6 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">Produto</p>
                <p className="mt-1.5 text-sm text-white">{selectedProduct?.name ?? 'Sem produto vinculado'}</p>
                <p className="mt-1.5 text-[13px] leading-5 text-white/62">
                  {selectedProduct
                    ? [selectedProduct.benefits, selectedProduct.audience].filter(Boolean).join(' · ') || 'Use o produto para direcionar beneficio e publico.'
                    : 'Pode ficar livre ou amarrado a um produto cadastrado.'}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/6 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">Briefing</p>
                <p className="mt-1.5 text-[13px] leading-5 text-white/78">
                  {prompt.trim() || 'Escreva o objetivo do conteudo para a IA sugerir angulos melhores.'}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/6 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">Referencias</p>
                <p className="mt-1.5 text-[13px] leading-5 text-white/78">
                  {referenceContext.trim() || 'Adicione noticias, tendencias e ganchos para dar repertorio real.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="rounded-[24px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Gerados agora</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Revise e salve o que realmente valer seguir.</p>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {generatedScripts.length} variacoes
              </Badge>
            </div>

            <div className="space-y-2.5">
              {generatedScripts.length ? (
                generatedScripts.map((script) => (
                  <div key={script.id} className="rounded-[20px] border border-border bg-muted/20 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{script.title}</p>
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{script.hook}</p>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-foreground">
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
                  Assim que voce gerar, os tres roteiros aparecem aqui para revisao rapida e edicao completa.
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
                <p className="mt-1 text-[13px] text-muted-foreground">Rascunhos e aprovados em uma leitura rapida.</p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {scripts.length} no total
              </Badge>
            </div>

            <div className="space-y-4">
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
                          <p className="mt-2.5 text-[12px] text-muted-foreground">
                            {script.productName || 'Sem produto'} · atualizado em {formatDateLabel(script.updatedAt)}
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
                      <div className="mt-4 flex flex-wrap gap-2">
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
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3.5 text-[13px] leading-6 text-muted-foreground">
                    Nenhum rascunho salvo ainda.
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Aprovados</p>
                  <span className="text-[12px] text-muted-foreground">{approvedScripts.length}</span>
                </div>
                {approvedScripts.length ? (
                  approvedScripts.map((script) => (
                    <div key={script.id} className="rounded-[20px] border border-border bg-white p-3.5">
                      <p className="text-sm font-semibold text-foreground">{script.title}</p>
                      <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
                        {script.productName || 'Sem produto'} · pronto para aparecer em Gravações
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3.5 text-[13px] leading-6 text-muted-foreground">
                    Os roteiros aprovados aparecem aqui e seguem para a pagina de gravacoes.
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
