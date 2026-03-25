"use client";

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
};

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Roteiro</p>
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

        <div className="grid gap-4 p-5 lg:grid-cols-[0.95fr_1.05fr] lg:p-6">
          <div className="space-y-4 rounded-[26px] border border-border bg-muted/20 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Titulo</label>
              <Input value={script.title} onChange={(event) => onChange({ ...script, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gancho</label>
              <Textarea
                value={script.hook}
                onChange={(event) => onChange({ ...script, hook: event.target.value })}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt base</label>
              <Textarea
                value={script.prompt}
                onChange={(event) => onChange({ ...script, prompt: event.target.value })}
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contexto e referencias</label>
              <Textarea
                value={script.referenceContext}
                onChange={(event) => onChange({ ...script, referenceContext: event.target.value })}
                className="min-h-[120px]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Texto falado</label>
              <Textarea
                value={script.spoken}
                onChange={(event) => onChange({ ...script, spoken: event.target.value })}
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
                    onChange={(event) => {
                      const nextTakes = [...script.takes];
                      nextTakes[index] = event.target.value;
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
                onChange={(event) => onChange({ ...script, cta: event.target.value })}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Legenda</label>
              <Textarea
                value={script.caption}
                onChange={(event) => onChange({ ...script, caption: event.target.value })}
                className="min-h-[130px]"
              />
            </div>
          </div>
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
