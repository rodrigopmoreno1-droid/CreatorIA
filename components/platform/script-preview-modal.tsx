"use client";

import { CheckCircle2, Loader2, PencilLine, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ScriptItem } from '@/types/platform';

function formatContentTypeLabel(contentType?: string) {
  switch (contentType) {
    case 'stories':
      return 'Stories';
    case 'carrossel':
      return 'Carrossel';
    case 'video_curto':
      return 'Video curto';
    case 'post':
      return 'Post estatico';
    default:
      return 'Reels';
  }
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function ScriptPreviewModal({
  script,
  busy,
  onClose,
  onEdit,
  onApprove,
  onDiscard
}: {
  script: ScriptItem;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onApprove?: () => void;
  onDiscard?: () => void;
}) {
  const isStories = script.contentType === 'stories';
  const isCarrossel = script.contentType === 'carrossel';
  const isPost = script.contentType === 'post';
  const isVideo = !isStories && !isCarrossel && !isPost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.4)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {formatContentTypeLabel(script.contentType)}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{script.title}</h3>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {script.productName || 'Sem produto'} · {formatDateLabel(script.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[0.95fr_1.05fr] lg:p-6">
          <div className="space-y-4 rounded-[26px] border border-border bg-muted/20 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Gancho</p>
              <p className="mt-3 text-lg font-medium leading-8 text-foreground">{script.hook || 'Sem gancho informado.'}</p>
            </div>

            {isVideo ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Texto falado</p>
                <p className="mt-3 text-[15px] leading-7 text-foreground">{script.spoken || 'Sem texto falado informado.'}</p>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">CTA</p>
              <p className="mt-3 text-[15px] leading-7 text-foreground">{script.cta || 'Sem CTA informado.'}</p>
            </div>

            {script.caption ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Legenda</p>
                <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-foreground">{script.caption}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {isStories && script.storySlides.length ? (
              <div className="space-y-3">
                {script.storySlides.map((slide, index) => (
                  <div key={`${script.id}-story-${index}`} className="rounded-[24px] border border-border bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Slide {index + 1} · {slide.objetivo}
                    </p>
                    <p className="mt-3 text-base font-semibold leading-7 text-foreground">{slide.textoTela}</p>
                    <p className="mt-3 text-[14px] leading-7 text-foreground">{slide.falado}</p>
                    <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{slide.visual}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {isCarrossel && script.carrosselSlides.length ? (
              <div className="space-y-3">
                {script.carrosselSlides.map((slide) => (
                  <div key={`${script.id}-carousel-${slide.numero}`} className="rounded-[24px] border border-border bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Pagina {slide.numero}
                    </p>
                    <p className="mt-3 text-base font-semibold leading-7 text-foreground">{slide.titulo}</p>
                    <p className="mt-2 text-[14px] font-medium leading-6 text-foreground/80">{slide.subtitulo}</p>
                    <p className="mt-3 text-[14px] leading-7 text-foreground">{slide.conteudo}</p>
                    <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{slide.visual}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {isPost && script.postFields ? (
              <div className="space-y-3">
                <div className="rounded-[24px] border border-border bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Conceito</p>
                  <p className="mt-3 text-[15px] leading-7 text-foreground">{script.postFields.conceito}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Peca</p>
                  <p className="mt-3 text-base font-semibold leading-7 text-foreground">{script.postFields.tituloPeca}</p>
                  <p className="mt-2 text-[14px] leading-7 text-foreground">{script.postFields.textoApoio}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Direcao visual</p>
                  <p className="mt-3 text-[14px] leading-7 text-foreground">{script.postFields.direcaoVisual}</p>
                </div>
              </div>
            ) : null}

            {isVideo ? (
              <div className="space-y-3">
                {script.takes.length ? (
                  script.takes.map((take, index) => (
                    <div key={`${script.id}-take-${index}`} className="rounded-[24px] border border-border bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Take {index + 1}</p>
                      <p className="mt-3 text-[14px] leading-7 text-foreground">{take}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border bg-white p-4 text-[13px] leading-6 text-muted-foreground">
                    Nenhum take informado ainda.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          {onDiscard ? (
            <Button
              variant="outline"
              onClick={onDiscard}
              disabled={busy}
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Descartar
            </Button>
          ) : null}
          <Button variant="outline" onClick={onEdit} disabled={busy}>
            <PencilLine className="h-4 w-4" />
            Editar
          </Button>
          {onApprove ? (
            <Button onClick={onApprove} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aprovar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
