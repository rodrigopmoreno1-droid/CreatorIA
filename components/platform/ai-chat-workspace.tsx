"use client";

import { useState } from 'react';
import { Bot, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import type { AiMessage } from '@/types/platform';

export function AiChatWorkspace({
  workspace,
  initialMessages = []
}: {
  workspace: string;
  initialMessages?: AiMessage[];
}) {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!prompt.trim()) {
      return;
    }

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          action: 'chat',
          workspace,
          prompt: userMessage.content
        })
      });

      const payload = (await response.json().catch(() => null)) as { content?: string; error?: string } | null;

      if (!response.ok || !payload?.content) {
        throw new Error(payload?.error ?? 'A IA nao conseguiu responder agora.');
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: payload.content ?? '',
          createdAt: new Date().toISOString()
        }
      ]);
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
        title="Assistente da operacao"
      />

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="rounded-[28px] border-border/90 bg-[#17171b] text-white">
          <CardContent className="space-y-4 p-5 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#17171b]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Pontos fortes do chat</p>
                <p className="text-[13px] leading-6 text-white/62">
                  Respostas curtas, objetivas e com foco em conteudo e performance.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                'Pedir variações de ganchos ou CTA',
                'Resumir um briefing antes da gravação',
                'Converter um insight em pauta acionável',
                'Organizar próximos passos da equipe'
              ].map((item) => (
                <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-[13px] leading-6 text-white/84">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/90 bg-white/95">
          <CardContent className="flex h-[720px] flex-col gap-4 p-5 lg:p-6">
            <div className="flex-1 space-y-3 overflow-y-auto rounded-[24px] border border-border bg-muted/20 p-4">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[84%] rounded-[20px] px-4 py-3 text-[13px] leading-6 ${
                      message.role === 'assistant'
                        ? 'border border-border bg-white text-foreground'
                        : 'ml-auto bg-[#17171b] text-white'
                    }`}
                  >
                    {message.content}
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[13px] leading-6 text-muted-foreground">
                  Sua conversa com a IA aparece aqui. Comece com um contexto rapido ou uma tarefa objetiva.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex.: me ajude a transformar um tema quente em três ganchos mais humanos para gravar hoje."
                className="min-h-[120px]"
              />
              <div className="flex justify-end">
                <Button onClick={handleSend} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar para IA
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
