"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Loader2,
  Mic,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { useSpeechCapture } from '@/hooks/use-speech-capture';
import { cn } from '@/lib/utils';
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function sortConversations(items: AiConversation[]) {
  return [...items].sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
}

function sortTrash(items: AiConversation[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.deletedAt ?? left.updatedAt;
    const rightDate = right.deletedAt ?? right.updatedAt;
    return rightDate.localeCompare(leftDate);
  });
}

type ChatAction = {
  label: string;
  prompt: string;
};

function getSuggestedActions(message: AiMessage, messages: AiMessage[]): ChatAction[] {
  const messageIndex = messages.findIndex((item) => item.id === message.id);
  const previousUserMessage =
    messageIndex >= 0 ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === 'user') : null;

  const normalized = `${message.content} ${previousUserMessage?.content ?? ''}`.toLowerCase();

  if (
    /tendenc|trend|atualiz|atual|recent|referenc|pesquis|fonte|not[ií]ci|hoje|semana passada|ultim[oa]s?\s+(?:7|15|30)\s+dias/.test(
      normalized
    )
  ) {
    return [
      {
        label: 'Mais atuais',
        prompt: 'Traga referências mais atuais, com data e janela temporal clara.'
      },
      {
        label: 'Fontes em links',
        prompt: 'Organize as referências atuais em bullets com links clicáveis.'
      },
      {
        label: 'Resumo semanal',
        prompt: 'Resuma isso em formato de semana passada, hoje e próximos passos.'
      },
      {
        label: 'Aplicar ao tema',
        prompt: 'Aplique essas referências ao tema em um plano de conteúdo prático.'
      }
    ];
  }

  if (/roteiro|gancho|script|storyboard|falado|cta/.test(normalized)) {
    return [
      {
        label: 'Mais ganchos',
        prompt: 'Me dê mais opções de ganchos com foco em retenção.'
      },
      {
        label: 'Versão curta',
        prompt: 'Encurte essa resposta em uma versão mais direta.'
      },
      {
        label: 'Storyboard',
        prompt: 'Transforme isso em um storyboard simples de gravação.'
      },
      {
        label: 'Legenda pronta',
        prompt: 'Converta isso em uma legenda pronta com CTA.'
      }
    ];
  }

  if (/story|stories|sequ[êe]ncia|enquete|pergunta|cta/.test(normalized)) {
    return [
      {
        label: 'Sequência melhor',
        prompt: 'Melhore essa sequência de stories para ficar mais persuasiva.'
      },
      {
        label: 'Trocar CTA',
        prompt: 'Crie três opções de CTA mais naturais para stories.'
      },
      {
        label: 'Versão curta',
        prompt: 'Resuma a sequência em poucas telas objetivas.'
      },
      {
        label: 'Contexto atual',
        prompt: 'Atualize essa sequência com contexto atual e linguagem mais natural.'
      }
    ];
  }

  if (/m[eé]tric|alcance|engajamento|crescimento|salvament|compartilh|coment/.test(normalized)) {
    return [
      {
        label: 'Explicar melhor',
        prompt: 'Explique essas métricas em linguagem prática e acionável.'
      },
      {
        label: 'Pontos de atenção',
        prompt: 'Liste os pontos de atenção e os riscos dessas métricas.'
      },
      {
        label: 'Próximos testes',
        prompt: 'Sugira testes rápidos para melhorar essas métricas.'
      },
      {
        label: 'Resumo executivo',
        prompt: 'Resuma isso para tomada de decisão em bullets curtos.'
      }
    ];
  }

  if (/concorr|competidor|perfil|reels/.test(normalized)) {
    return [
      {
        label: 'Mais análise',
        prompt: 'Analise isso com mais profundidade e destaque padrões.'
      },
      {
        label: 'Comparar canais',
        prompt: 'Compare Instagram, Reels e Stories para esse caso.'
      },
      {
        label: 'Sinalizar riscos',
        prompt: 'Aponte os riscos e oportunidades que eu devo observar.'
      },
      {
        label: 'Ação prática',
        prompt: 'Transforme isso em uma ação prática para o time.'
      }
    ];
  }

  if (/produto|oferta|preç|preco|benef[ií]ci|restri/.test(normalized)) {
    return [
      {
        label: 'Melhor oferta',
        prompt: 'Crie uma oferta mais clara e vendável para isso.'
      },
      {
        label: 'Preço e âncora',
        prompt: 'Sugira faixa de preço e preço âncora.'
      },
      {
        label: 'Posicionamento',
        prompt: 'Resuma o posicionamento comercial em bullets.'
      },
      {
        label: 'Transformar em pauta',
        prompt: 'Transforme esse produto em pautas de conteúdo.'
      }
    ];
  }

  return [
    {
      label: 'Mais opções',
      prompt: 'Me dê mais opções relacionadas a essa resposta.'
    },
    {
      label: 'Resumo curto',
      prompt: 'Resuma essa resposta em pontos objetivos.'
    },
    {
      label: 'Próximo passo',
      prompt: 'Qual é o próximo passo mais útil aqui?'
    }
  ];
}

function renderInlineMarkdown(text: string) {
  const tokens: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith('**')) {
      tokens.push(
        <strong key={`md-${key++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      tokens.push(
        <code
          key={`md-${key++}`}
          className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const label = token.slice(1, token.indexOf(']('));
      const url = match[2];
      tokens.push(
        <a
          key={`md-${key++}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline decoration-foreground/35 underline-offset-4 transition hover:decoration-foreground"
        >
          {label}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

function ChatMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = trimmed.match(/^#{1,3}/)?.[0].length ?? 1;
      const heading = trimmed.replace(/^#{1,3}\s+/, '');
      blocks.push(
        <div
          key={`block-${key++}`}
          className={cn(
            'font-semibold text-foreground',
            level === 1 && 'text-[17px]',
            level === 2 && 'text-[16px]',
            level === 3 && 'text-[15px]'
          )}
        >
          {renderInlineMarkdown(heading)}
        </div>
      );
      index += 1;
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      blocks.push(
        <blockquote
          key={`block-${key++}`}
          className="rounded-[16px] border border-border bg-muted/35 px-4 py-3 text-[13px] leading-6 text-muted-foreground"
        >
          {renderInlineMarkdown(trimmed.replace(/^>\s+/, ''))}
        </blockquote>
      );
      index += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*•]\s+/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^[-*•]\s+/, ''));
        index += 1;
      }

      blocks.push(
        <ul key={`block-${key++}`} className="space-y-2 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`} className="relative pl-4 text-[13px] leading-6 text-foreground">
              <span className="absolute left-0 top-[0.7rem] h-1.5 w-1.5 rounded-full bg-foreground/70" />
              <span className="whitespace-pre-wrap">{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }

      blocks.push(
        <ol key={`block-${key++}`} className="space-y-2 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`} className="list-decimal text-[13px] leading-6 text-foreground">
              <span className="whitespace-pre-wrap">{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;

    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^#{1,3}\s+/.test((lines[index] ?? '').trim()) &&
      !/^>\s+/.test((lines[index] ?? '').trim()) &&
      !/^[-*•]\s+/.test((lines[index] ?? '').trim()) &&
      !/^\d+\.\s+/.test((lines[index] ?? '').trim())
    ) {
      paragraphLines.push((lines[index] ?? '').trim());
      index += 1;
    }

    blocks.push(
      <p key={`block-${key++}`} className="whitespace-pre-wrap text-[13px] leading-6 text-foreground">
        {renderInlineMarkdown(paragraphLines.join('\n'))}
      </p>
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5" aria-label="Creator AI digitando">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 rounded-full bg-foreground/65"
          style={{
            animation: 'typing-dots 1.1s ease-in-out infinite',
            animationDelay: `${index * 0.15}s`
          }}
        />
      ))}
    </div>
  );
}

function ComposerActionButton({
  children,
  onClick,
  disabled,
  className
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border bg-white px-3 text-[12px] font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  );
}

function ConversationDeleteModal({
  target,
  onClose,
  onConfirm,
  processing
}: {
  target: { conversation: AiConversation; mode: 'trash' | 'permanent' } | null;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}) {
  if (!target) {
    return null;
  }

  const isPermanent = target.mode === 'permanent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
              isPermanent ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-border bg-muted/35 text-foreground'
            )}
          >
            {isPermanent ? <AlertTriangle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Confirmar ação</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              {isPermanent ? 'Excluir para sempre?' : 'Mover conversa para a lixeira?'}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              {isPermanent
                ? 'Esta conversa será removida definitivamente e não poderá ser recuperada.'
                : 'A conversa ficará na lixeira por 30 dias e poderá ser restaurada depois.'}
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-[18px] border border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Conversa</p>
            <p className="mt-1 text-sm font-medium text-foreground">{target.conversation.title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Última atividade: {formatDateTime(target.conversation.lastMessageAt)}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={processing}
            className={cn(isPermanent ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-[#17171b] text-white hover:bg-[#0f0f12]')}
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPermanent ? 'Excluir agora' : 'Mover para lixeira'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AiChatWorkspace({
  workspace,
  initialConversations = [],
  initialTrashedConversations = [],
  initialConversationId = null,
  initialMessages = []
}: {
  workspace: string;
  initialConversations?: AiConversation[];
  initialTrashedConversations?: AiConversation[];
  initialConversationId?: string | null;
  initialMessages?: AiMessage[];
}) {
  const [conversations, setConversations] = useState(() => sortConversations(initialConversations));
  const [trashedConversations, setTrashedConversations] = useState(() => sortTrash(initialTrashedConversations));
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [restoringConversationId, setRestoringConversationId] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ conversation: AiConversation; mode: 'trash' | 'permanent' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const isComposerLocked = voiceCapture.isRecording || voiceCapture.isProcessing;
  const hasOpenDraft = prompt.trim().length > 0 || isComposerLocked;
  const isMutationLocked =
    isCreatingConversation || isSending || loadingConversationId !== null || deletingConversationId !== null || restoringConversationId !== null;
  const canMutateConversations = !isMutationLocked && !hasOpenDraft;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending, activeConversationId]);

  async function loadConversation(conversationId: string, options?: { force?: boolean }) {
    if (!options?.force && conversationId === activeConversationId) {
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
      setTrashOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir a conversa.';
      toast.error(message);
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function createConversation() {
    if (isMutationLocked || isComposerLocked) {
      return;
    }

    setIsCreatingConversation(true);

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

      setConversations((current) => sortConversations([payload.conversation!, ...current.filter((item) => item.id !== payload.conversation!.id)]));
      setActiveConversationId(payload.conversation.id);
      setMessages([]);
      setTrashOpen(false);
      toast.success('Conversa criada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel criar a conversa.';
      toast.error(message);
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function restoreConversation(conversationId: string) {
    if (!canMutateConversations) {
      return;
    }

    setRestoringConversationId(conversationId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/ai/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          action: 'restore'
        })
      });

      const payload = (await response.json().catch(() => null)) as { conversation?: AiConversation; error?: string } | null;

      if (!response.ok || !payload?.conversation) {
        throw new Error(payload?.error ?? 'Nao foi possivel restaurar a conversa.');
      }

      setTrashedConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      setConversations((current) => sortConversations([payload.conversation!, ...current.filter((conversation) => conversation.id !== conversationId)]));
      setActiveConversationId(conversationId);
      await loadConversation(conversationId, { force: true });
      toast.success('Conversa restaurada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel restaurar a conversa.';
      toast.error(message);
    } finally {
      setRestoringConversationId(null);
    }
  }

  async function executeDeleteConversation(conversationId: string, mode: 'trash' | 'permanent') {
    if (!canMutateConversations) {
      toast.error('Feche a escrita em andamento antes de apagar uma conversa.');
      return;
    }

    setDeletingConversationId(conversationId);

    try {
      const response = await fetch(
        `/api/workspaces/${workspace}/ai/conversations/${conversationId}${mode === 'permanent' ? '?permanent=1' : ''}`,
        {
          method: 'DELETE'
        }
      );

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; conversation?: AiConversation; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel remover a conversa.');
      }

      if (mode === 'permanent') {
        setTrashedConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      } else {
        const deletedConversation =
          payload.conversation ??
          trashedConversations.find((conversation) => conversation.id === conversationId) ??
          conversations.find((conversation) => conversation.id === conversationId);

        if (deletedConversation) {
          setTrashedConversations((current) =>
            sortTrash([
              {
                ...deletedConversation,
                deletedAt: deletedConversation.deletedAt ?? new Date().toISOString(),
                deletedByUserId: deletedConversation.deletedByUserId ?? null
              },
              ...current.filter((conversation) => conversation.id !== conversationId)
            ])
          );
        }

        setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));

        if (activeConversationId === conversationId) {
          const nextConversation = conversations.find((conversation) => conversation.id !== conversationId) ?? null;

          if (nextConversation) {
            setActiveConversationId(nextConversation.id);
            await loadConversation(nextConversation.id, { force: true });
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      }

      toast.success(mode === 'permanent' ? 'Conversa excluída definitivamente.' : 'Conversa movida para a lixeira.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel remover a conversa.';
      toast.error(message);
    } finally {
      setDeletingConversationId(null);
      setPendingDelete(null);
    }
  }

  async function submitPrompt(rawPrompt: string) {
    const trimmed = rawPrompt.trim();

    if (!trimmed || isMutationLocked || isComposerLocked) {
      return;
    }

    let conversationId = activeConversationId;
    setIsSending(true);
    setPrompt('');

    try {
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
          throw new Error(payload?.error ?? 'Nao foi possivel criar a conversa.');
        }

        conversationId = payload.conversation.id;
        setConversations((current) => sortConversations([payload.conversation!, ...current.filter((conversation) => conversation.id !== payload.conversation!.id)]));
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
      setIsSending(false);
    }
  }

  const renderConversationList = conversations.length ? (
    conversations.map((conversation) => {
      const active = conversation.id === activeConversationId;
      const disabled = isMutationLocked || isSending || isComposerLocked;

      return (
        <div
          key={conversation.id}
          className={cn(
            'group rounded-[18px] border px-3 py-3 transition',
            active ? 'border-foreground bg-[#17171b] text-white' : 'border-border bg-muted/20 hover:bg-muted/40'
          )}
        >
          <button
            type="button"
            onClick={() => loadConversation(conversation.id)}
            disabled={disabled}
            className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-not-allowed"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{conversation.title}</p>
              <p className={cn('mt-1 text-[11px]', active ? 'text-white/58' : 'text-muted-foreground')}>
                {formatTime(conversation.lastMessageAt)}
              </p>
            </div>
            {loadingConversationId === conversation.id ? (
              <Loader2 className={cn('mt-0.5 h-4 w-4 animate-spin', active ? 'text-white' : 'text-muted-foreground')} />
            ) : null}
          </button>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setPendingDelete({ conversation, mode: 'trash' })}
              disabled={!canMutateConversations}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-xl border transition disabled:pointer-events-none disabled:opacity-40',
                active
                  ? 'border-white/10 bg-white/5 text-white/68 hover:bg-white/10'
                  : 'border-border bg-white text-muted-foreground hover:bg-muted'
              )}
              aria-label="Apagar conversa"
            >
              {deletingConversationId === conversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      );
    })
  ) : (
    <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-3 text-[12px] leading-5 text-muted-foreground">
      Nenhuma conversa criada ainda.
    </div>
  );

  const renderTrashList = trashOpen ? (
    <div className="space-y-3 rounded-[22px] border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Apagados</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Recuperação automática por 30 dias.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTrashOpen(false)} disabled={isMutationLocked || isComposerLocked}>
          Fechar
        </Button>
      </div>

      {trashedConversations.length ? (
        <div className="space-y-2">
          {trashedConversations.map((conversation) => (
            <div key={conversation.id} className="rounded-[18px] border border-border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{conversation.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Apagada em {conversation.deletedAt ? formatDateTime(conversation.deletedAt) : formatTime(conversation.lastMessageAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ conversation, mode: 'permanent' })}
                  disabled={!canMutateConversations}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Excluir permanentemente"
                >
                  {deletingConversationId === conversation.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                  Recuperável por 30 dias
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreConversation(conversation.id)}
                  disabled={!canMutateConversations || restoringConversationId === conversation.id}
                >
                  {restoringConversationId === conversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Restaurar
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-border bg-white px-3 py-4 text-[12px] leading-5 text-muted-foreground">
          Nenhuma conversa foi apagada.
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Chat IA"
        title="Creator AI"
        actions={
          <Button variant="outline" onClick={createConversation} disabled={isMutationLocked || isComposerLocked}>
            <Plus className="h-4 w-4" />
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
              <Wand2 className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid gap-2">
              {[
                'Criar ideias, roteiros e legendas.',
                'Usar contexto atual quando existir.',
                'Responder com próximo passo claro.'
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[16px] border border-border bg-muted/30 px-3 py-2 text-[12px] leading-5 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Conversas</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    {conversations.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTrashOpen((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagados
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {trashedConversations.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {renderConversationList}
              </div>
            </div>

            {renderTrashList}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-border/90 bg-white/95">
          <CardContent className="flex h-[78vh] min-h-[680px] flex-col gap-3 p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{activeConversation?.title ?? 'Nova conversa'}</p>
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
                messages.map((message) => {
                  const isAssistant = message.role === 'assistant';

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'max-w-[88%] rounded-[20px] px-4 py-3 text-[13px] leading-6',
                        isAssistant ? 'border border-border bg-white text-foreground' : 'ml-auto bg-[#17171b] text-white'
                      )}
                    >
                      {isAssistant ? (
                        <ChatMarkdown content={message.content} />
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}

                      {isAssistant ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getSuggestedActions(message, messages).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={() => submitPrompt(action.prompt)}
                              disabled={isMutationLocked || isComposerLocked}
                              className="inline-flex h-8 items-center rounded-full border border-border bg-muted/30 px-3 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[13px] leading-6 text-muted-foreground">
                  Escreva um pedido objetivo e a Creator AI responde com estrutura, contexto, referências atuais e próximo passo.
                </div>
              )}

              {isSending ? (
                <div className="max-w-[88%] rounded-[20px] border border-border bg-white px-4 py-3 text-[13px] leading-6 text-foreground">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                      <Bot className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Creator AI está pensando</p>
                      <TypingDots />
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <div className="space-y-3 rounded-[28px] border border-border bg-white p-3 shadow-soft">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitPrompt(prompt);
                  }
                }}
                placeholder="Ex.: me ajude a criar 5 ganchos para um conteúdo sobre emagrecimento, usando referências atuais e sem inventar dados."
                className="min-h-[128px] resize-none border-0 bg-transparent px-0 py-0 text-[14px] shadow-none focus-visible:ring-0"
              />

              {voiceCapture.error ? (
                <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                  {voiceCapture.error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ComposerActionButton
                    onClick={voiceCapture.isRecording ? voiceCapture.stop : voiceCapture.start}
                    disabled={!voiceCapture.isSupported || isMutationLocked || voiceCapture.isProcessing}
                  >
                    {voiceCapture.isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {voiceCapture.isRecording ? 'Parar' : 'Voz'}
                  </ComposerActionButton>
                  {voiceCapture.isRecording ? (
                    <span className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground">gravando...</span>
                  ) : null}
                  {voiceCapture.isProcessing ? (
                    <span className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground">transcrevendo...</span>
                  ) : null}
                  {hasOpenDraft ? (
                    <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[12px] text-muted-foreground">
                      rascunho aberto
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-[12px] text-muted-foreground">
                    {messages.length ? 'Histórico salvo na conversa.' : 'Crie uma conversa nova ou escolha uma existente.'}
                  </div>
                  <Button
                    onClick={() => void submitPrompt(prompt)}
                    disabled={isMutationLocked || isComposerLocked || !prompt.trim()}
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConversationDeleteModal
        target={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) {
            return;
          }

          void executeDeleteConversation(pendingDelete.conversation.id, pendingDelete.mode);
        }}
        processing={deletingConversationId === pendingDelete?.conversation.id}
      />
    </div>
  );
}
