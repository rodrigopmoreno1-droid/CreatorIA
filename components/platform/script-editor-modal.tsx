"use client";

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CarrosselSlide, PostFields, StorySlide } from '@/types/platform';

export type EditableScriptDraft = {
  id: string;
  title: string;
  hook: string;
  spoken: string;
  takes: string[];
  cta: string;
  caption: string;
  prompt: string;
  referenceContext: string;
  productId?: string;
  productName?: string;
  contentType?: string;
  subOption?: string;
  storySlides?: StorySlide[];
  carrosselSlides?: CarrosselSlide[];
  postFields?: PostFields | null;
};

function StorySlidesEditor({
  slides,
  onChange
}: {
  slides: StorySlide[];
  onChange: (next: StorySlide[]) => void;
}) {
  function updateSlide(index: number, field: keyof StorySlide, value: string) {
    const next = slides.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {slides.map((slide, i) => (
        <div key={i} className="rounded-[18px] border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Slide {i + 1}</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Objetivo</label>
            <Input value={slide.objetivo} onChange={(e) => updateSlide(i, 'objetivo', e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Texto na tela</label>
            <Textarea value={slide.textoTela} onChange={(e) => updateSlide(i, 'textoTela', e.target.value)} className="min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Texto falado</label>
            <Textarea value={slide.falado} onChange={(e) => updateSlide(i, 'falado', e.target.value)} className="min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Direção visual</label>
            <Input value={slide.visual} onChange={(e) => updateSlide(i, 'visual', e.target.value)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CarrosselSlidesEditor({
  slides,
  onChange
}: {
  slides: CarrosselSlide[];
  onChange: (next: CarrosselSlide[]) => void;
}) {
  function updateSlide(index: number, field: keyof CarrosselSlide, value: string | number) {
    const next = slides.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {slides.map((slide, i) => (
        <div key={i} className="rounded-[18px] border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Página {i + 1}</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input value={slide.titulo} onChange={(e) => updateSlide(i, 'titulo', e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Subtítulo</label>
            <Input value={slide.subtitulo} onChange={(e) => updateSlide(i, 'subtitulo', e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Conteúdo</label>
            <Textarea value={slide.conteudo} onChange={(e) => updateSlide(i, 'conteudo', e.target.value)} className="min-h-[100px]" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Direção visual</label>
            <Input value={slide.visual} onChange={(e) => updateSlide(i, 'visual', e.target.value)} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScriptEditorModal({
  title,
  script,
  onChange,
  onClose,
  onSave,
  savingLabel
}: {
  title: string;
  script: EditableScriptDraft;
  onChange: (nextValue: EditableScriptDraft) => void;
  onClose: () => void;
  onSave: () => void;
  savingLabel: string;
}) {
  const ct = script.contentType ?? 'reels';
  const isStories = ct === 'stories';
  const isCarrossel = ct === 'carrossel';
  const isPost = ct === 'post';
  const isVideo = !isStories && !isCarrossel && !isPost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {isStories ? 'Stories' : isCarrossel ? 'Carrossel' : isPost ? 'Post estático' : 'Roteiro'}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3>
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

        <div className="p-5 lg:p-6 space-y-4">
          {/* Title — always shown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input value={script.title} onChange={(e) => onChange({ ...script, title: e.target.value })} />
          </div>

          {/* Stories format */}
          {isStories && script.storySlides && script.storySlides.length > 0 && (
            <StorySlidesEditor
              slides={script.storySlides}
              onChange={(next) => onChange({ ...script, storySlides: next })}
            />
          )}

          {/* Carrossel format */}
          {isCarrossel && script.carrosselSlides && script.carrosselSlides.length > 0 && (
            <CarrosselSlidesEditor
              slides={script.carrosselSlides}
              onChange={(next) => onChange({ ...script, carrosselSlides: next })}
            />
          )}

          {/* Post format */}
          {isPost && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conceito</label>
                  <Textarea
                    value={script.postFields?.conceito ?? ''}
                    onChange={(e) => onChange({ ...script, postFields: { ...(script.postFields ?? { conceito: '', tituloPeca: '', textoApoio: '', direcaoVisual: '' }), conceito: e.target.value } })}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título da peça</label>
                  <Input
                    value={script.postFields?.tituloPeca ?? ''}
                    onChange={(e) => onChange({ ...script, postFields: { ...(script.postFields ?? { conceito: '', tituloPeca: '', textoApoio: '', direcaoVisual: '' }), tituloPeca: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Texto de apoio</label>
                  <Textarea
                    value={script.postFields?.textoApoio ?? ''}
                    onChange={(e) => onChange({ ...script, postFields: { ...(script.postFields ?? { conceito: '', tituloPeca: '', textoApoio: '', direcaoVisual: '' }), textoApoio: e.target.value } })}
                    className="min-h-[120px]"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Direção visual</label>
                  <Textarea
                    value={script.postFields?.direcaoVisual ?? ''}
                    onChange={(e) => onChange({ ...script, postFields: { ...(script.postFields ?? { conceito: '', tituloPeca: '', textoApoio: '', direcaoVisual: '' }), direcaoVisual: e.target.value } })}
                    className="min-h-[120px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CTA</label>
                  <Textarea
                    value={script.cta}
                    onChange={(e) => onChange({ ...script, cta: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Legenda</label>
                  <Textarea
                    value={script.caption}
                    onChange={(e) => onChange({ ...script, caption: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Reels / Video curto format */}
          {isVideo && (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4 rounded-[26px] border border-border bg-muted/20 p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gancho</label>
                  <Textarea
                    value={script.hook}
                    onChange={(e) => onChange({ ...script, hook: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Texto falado</label>
                  <Textarea
                    value={script.spoken}
                    onChange={(e) => onChange({ ...script, spoken: e.target.value })}
                    className="min-h-[180px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Takes</label>
                  <div className="space-y-2">
                    {script.takes.map((take, index) => (
                      <Input
                        key={`${script.id}-${index}`}
                        value={take}
                        onChange={(e) => {
                          const nextTakes = [...script.takes];
                          nextTakes[index] = e.target.value;
                          onChange({ ...script, takes: nextTakes });
                        }}
                        placeholder={`Take ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CTA</label>
                  <Textarea
                    value={script.cta}
                    onChange={(e) => onChange({ ...script, cta: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Legenda</label>
                  <Textarea
                    value={script.caption}
                    onChange={(e) => onChange({ ...script, caption: e.target.value })}
                    className="min-h-[130px]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onSave}>{savingLabel}</Button>
        </div>
      </div>
    </div>
  );
}
