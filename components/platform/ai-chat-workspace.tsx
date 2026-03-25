"use client";

import { useMemo, useState } from 'react';
import { Bot, Loader2, Mic, Plus, Send, Square, Trash2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { useSpeechCapture } from '@/hooks/use-speech-capture';
import type { AiConversation, AiMessage } from '@/types/platform';

function makeConversationTitle(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ').slice(0, 42) || 'Nova conversa';
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function sortConversations(items: AiConversation[]) {
  return [...items].sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
}

function getSuggestedActions(content: string) {
  const normalized = content.toLowerCase();

  if (normalized.includes('roteiro') || normalized.includes('gancho')) {
    return [
      { label: 'Mais ganchos', prompt: 'Me dê mais opções de ganchos atuais para esse tema.' },
      { label: 'Versão curta', prompt: 'Encurte a resposta em uma versão mais direta.' },
      { label: 'Storyboard', prompt: 'Transforme isso em um storyboard simples de gravação.' },
      { label: 'Buscar tendências', prompt: 'Pesquise referências atuais e tendências relacionadas a esse tema.' }
    ];
  }

  if (normalized.includes('produto') || normalized.includes('oferta')) {
    return [
      { label: 'Criar oferta', prompt: 'Crie uma oferta mais clara e vendável para isso.' },
      { label: 'Preço e desconto', prompt: 'Sugira faixa de preço e preço promocional.' },
      { label: 'Resumo comercial', prompt: 'Resuma em bullets o posicionamento comercial.' },
      { label: 'Importar produtos', prompt: 'Me ajude a estruturar isso como lista de produtos.' }
    ];
  }

  if (normalized.includes('trend') || normalized.includes('tend') || normalized.includes('instagram') || normalized.includes('tiktok')) {
    return [
      { label: 'Referências atuais', prompt: 'Busque referências atuais e organize os achados.' },
      { label: 'Criadores parecidos', prompt: 'Liste criadores e referências parecidas para estudar.' },
      { label: 'Mais temas em alta', prompt: 'Traga mais temas em alta que conversem com isso.' },
      { label: 'Comparar canais', prompt: 'Compare Instagram, TikTok e Reels para esse assunto.' }
    ];
  }

  return [
    { label: 'Mais opções', prompt: 'Me dê mais opções relacionadas a essa resposta.' },
    { label: 'Resumo curto', prompt: 'Resuma essa resposta em pontos objetivos.' },
    { label: 'Próximo passo', prompt: 'Qual é o próximo passo mais útil aqui?' }
  ];
}

export function AiChatWorkspace({
  workspace,
  initialConversations = [],
  initialConversationId = null,
  initialMessages = []
}: {
  workspace: string;
  initialConversations?: AiConversation[];
  initialConversationId?: string | null;
  initialMessages?: AiMessage[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const voiceCapture = useSpeechCapture({
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

        setPrompt(typeof payload?.content === 'string' ? payload.content : text);
        toast.success('Texto transcrito para o chat.');
      } catch {
        setPrompt(text);
        toast.success('Texto transcrito para o chat.');
      }
    }
  });

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  async function loadConversation(conversationId: string) {
    if (conversationId === activeConversationId) {
      return;
    }

    setLoadingConversationId(conversationId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/ai/conversations/${conversationId}`);
      const payload = (await response.json().catch(() => null)) as { messages?: AiMessage[]; error?: string } | null;

      if (!response.ok || !payload?.messages) {
        throw new Error(payload?.error ?? 'Nao foi possivel abrir a conversa.');
      }

      setActiveConversationId(conversationId);
      setMessages(payload.messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir a conversa.';
      toast.error(message);
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function createConversation() {
    setLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/ai/conversations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Nova conversa'
        })
      });

      const payload = (await response.json().catch(() => null)) as { conversation?: AiConversation; error?: string } | null;

      if (!response.ok || !payload?.conversation) {
        throw new Error(payload?.error ?? 'Nao foi possivel criar a conversa.');
      }

      setConversations((current) => sortConversations([payload.conversation!, ...current]));
      setActiveConversationId(payload.conversation.id);
      setMessages([]);
      toast.success('Conversa criada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel criar a conversa.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(conversationId: string) {
    setDeletingConversationId(conversationId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/ai/conversations/${conversationId}`, {
        method: 'DELETE'
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel remover a conversa.');
      }

      const remainingConversations = conversations.filter((conversation) => conversation.id !== conversationId);
      setConversations(remainingConversations);

      if (activeConversationId === conversationId) {
        const nextConversation = remainingConversations[0] ?? null;
        setActiveConversationId(nextConversation?.id ?? null);
        if (nextConversation) {
          await loadConversation(nextConversation.id);
        } else {
          setMessages([]);
        }
      }

      toast.success('Conversa removida.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel remover a conversa.';
      toast.error(message);
    } finally {
      setDeletingConversationId(null);
    }
  }

  async function handleSend() {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    await submitPrompt(trimmed);
  }

  async function submitPrompt(trimmed: string) {
    let conversationId = activeConversationId;

    if (!conversationId) {
      const response = await fetch(`/api/workspaces/${workspace}/ai/conversations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          title: makeConversationTitle(trimmed)
        })
      });

      const payload = (await response.json().catch(() => null)) as { conversation?: AiConversation; error?: string } | null;

      if (!response.ok || !payload?.conversation) {
        toast.error(payload?.error ?? 'Nao foi possivel criar a conversa.');
        return;
      }

      conversationId = payload.conversation.id;
      setConversations((current) => sortConversations([payload.conversation!, ...current]));
      setActiveConversationId(conversationId);
      setMessages([]);
    }

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    setPrompt('');

    try {
      const response = await fetch(`/api/workspaces/${workspace}/ai/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          prompt: trimmed
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { messages?: AiMessage[]; conversation?: AiConversation; error?: string }
        | null;

      if (!response.ok || !payload?.messages?.length || !payload?.conversation) {
        throw new Error(payload?.error ?? 'A IA nao conseguiu responder agora.');
      }

      setConversations((current) =>
        sortConversations(current.map((conversation) => (conversation.id === payload.conversation!.id ? payload.conversation! : conversation)))
      );
      setMessages(payload.messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A IA nao conseguiu responder agora.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Chat IA"
        title="Creator AI"
        actions={
          <Button variant="outline" onClick={createConversation} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Nova conversa
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
        <Card className="rounded-[26px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17171b] text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Creator AI</p>
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid gap-2">
              {[
                'Criar ideias, roteiros e legendas.',
                'Usar contexto atual quando existir.',
                'Responder com proximo passo claro.'
              ].map((item) => (
                <div key={item} className="rounded-[16px] border border-border bg-muted/30 px-3 py-2 text-[12px] leading-5 text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Conversas</p>
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                  {conversations.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {conversations.length ? (
                  conversations.map((conversation) => {
                    const active = conversation.id === activeConversationId;

                    return (
                      <div
                        key={conversation.id}
                        className={`group rounded-[18px] border px-3 py-3 transition ${
                          active ? 'border-foreground bg-[#17171b] text-white' : 'border-border bg-muted/20 hover:bg-muted/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => loadConversation(conversation.id)}
                          className="flex w-full items-start justify-between gap-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{conversation.title}</p>
                            <p className={`mt-1 text-[11px] ${active ? 'text-white/58' : 'text-muted-foreground'}`}>
                              {formatTime(conversation.lastMessageAt)}
                            </p>
                          </div>
                          {loadingConversationId === conversation.id ? (
                            <Loader2 className={`mt-0.5 h-4 w-4 animate-spin ${active ? 'text-white' : 'text-muted-foreground'}`} />
                          ) : null}
                        </button>

                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => deleteConversation(conversation.id)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                              active
                                ? 'border-white/10 bg-white/5 text-white/68 hover:bg-white/10'
                                : 'border-border bg-white text-muted-foreground hover:bg-muted'
                            }`}
                            aria-label="Apagar conversa"
                          >
                            {deletingConversationId === conversation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3 text-[12px] leading-5 text-muted-foreground">
                    Nenhuma conversa criada ainda.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-border/90 bg-white/95">
          <CardContent className="flex h-[78vh] min-h-[680px] flex-col gap-3 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{activeConversation?.title ?? 'Nova conversa'}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {activeConversation ? 'Histórico salvo no workspace' : 'Crie uma conversa para começar'}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/30 text-foreground">
                <Wand2 className="h-4 w-4" />
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto rounded-[24px] border border-border bg-muted/20 p-4">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[86%] rounded-[20px] px-4 py-3 text-[13px] leading-6 ${
                      message.role === 'assistant'
                        ? 'border border-border bg-white text-foreground'
                        : 'ml-auto bg-[#17171b] text-white'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.role === 'assistant' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getSuggestedActions(message.content).map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            onClick={() => submitPrompt(action.prompt)}
                            className="inline-flex h-8 items-center rounded-full border border-border bg-muted/30 px-3 text-[11px] font-medium text-muted-foreground transition hover:bg-muted"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[13px] leading-6 text-muted-foreground">
                  Escreva um pedido objetivo e a Creator AI responde com estrutura, contexto e proximo passo.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex.: me ajude a criar 5 ganchos para um conteudo sobre emagrecimento sem inventar dados."
                className="min-h-[116px] rounded-[22px]"
              />
              {voiceCapture.error ? (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                  {voiceCapture.error}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={voiceCapture.isRecording ? voiceCapture.stop : voiceCapture.start}
                    disabled={!voiceCapture.isSupported}
                  >
                    {voiceCapture.isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {voiceCapture.isRecording ? 'Parar' : 'Voz'}
                  </Button>
                  {voiceCapture.isRecording ? <span className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground">gravando...</span> : null}
                  {voiceCapture.isProcessing ? <span className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground">transcrevendo...</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[12px] text-muted-foreground">
                    {messages.length ? 'Historico salvo na conversa.' : 'Crie uma conversa nova ou escolha uma existente.'}
                  </div>
                  <Button onClick={handleSend} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
