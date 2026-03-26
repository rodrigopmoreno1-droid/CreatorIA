"use client";

import { useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Eye, GripVertical, LayoutGrid, List, Loader2, PencilLine, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { recordingColumns } from '@/lib/platform-navigation';
import { cn } from '@/lib/utils';
import type { RecordingCard, RecordingColumnKey } from '@/types/platform';

type RecordingEditorState = RecordingCard;

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function findColumn(cards: RecordingCard[], cardId: string) {
  return cards.find((card) => card.id === cardId)?.column ?? null;
}

function sortColumnCards(cards: RecordingCard[]) {
  return [...cards].sort((left, right) => left.order - right.order);
}

function reorderWithinColumn(cards: RecordingCard[], column: RecordingColumnKey, activeId: string, overId: string) {
  const columnCards = sortColumnCards(cards.filter((item) => item.column === column));
  const oldIndex = columnCards.findIndex((item) => item.id === activeId);
  const newIndex = columnCards.findIndex((item) => item.id === overId);

  if (oldIndex === -1 || newIndex === -1) {
    return cards;
  }

  const reordered = arrayMove(columnCards, oldIndex, newIndex).map((item, index) => ({
    ...item,
    order: index
  }));

  return cards.map((card) => reordered.find((item) => item.id === card.id) ?? card);
}

function moveAcrossColumns(
  cards: RecordingCard[],
  activeId: string,
  targetColumn: RecordingColumnKey,
  overId?: string
) {
  const activeCard = cards.find((card) => card.id === activeId);

  if (!activeCard) {
    return cards;
  }

  const sourceColumn = activeCard.column;
  const sourceCards = sortColumnCards(cards.filter((item) => item.column === sourceColumn && item.id !== activeId)).map(
    (item, index) => ({
      ...item,
      order: index
    })
  );
  const targetCards = sortColumnCards(cards.filter((item) => item.column === targetColumn && item.id !== activeId));
  const targetIndex = overId ? targetCards.findIndex((item) => item.id === overId) : targetCards.length;
  const safeTargetIndex = targetIndex < 0 ? targetCards.length : targetIndex;

  const nextTargetCards = [...targetCards];
  nextTargetCards.splice(safeTargetIndex, 0, {
    ...activeCard,
    column: targetColumn,
    order: safeTargetIndex
  });

  const normalizedTargetCards = nextTargetCards.map((item, index) => ({
    ...item,
    order: index
  }));

  return cards
    .filter((item) => item.id !== activeId)
    .map((item) => sourceCards.find((candidate) => candidate.id === item.id) ?? normalizedTargetCards.find((candidate) => candidate.id === item.id) ?? item)
    .concat(normalizedTargetCards.find((item) => item.id === activeId) ?? []);
}

type RecordingViewMode = 'flow' | 'list' | 'cards';

type RecordingFieldDraft = {
  key: string;
  value: string;
};

type RecordingFormState = RecordingCard;

const recordingViewModes: Array<{ key: RecordingViewMode; label: string; icon: typeof LayoutGrid }> = [
  { key: 'flow', label: 'Fluxo', icon: LayoutGrid },
  { key: 'list', label: 'Lista', icon: List },
  { key: 'cards', label: 'Blocos', icon: LayoutGrid }
];

function cardCategory(card: RecordingCard) {
  return card.category?.trim() || recordingColumns.find((column) => column.key === card.column)?.label || 'Geral';
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function padTakeList(takes: string[], minimum = 5) {
  const nextTakes = [...takes];

  while (nextTakes.length < minimum) {
    nextTakes.push('');
  }

  return nextTakes;
}

function createEmptyRecordingCard(column: RecordingColumnKey): RecordingFormState {
  const tempId = `draft-${crypto.randomUUID()}`;

  return {
    id: tempId,
    scriptId: tempId,
    title: '',
    category: recordingColumns.find((item) => item.key === column)?.label ?? 'Geral',
    dueDate: '',
    labels: [],
    fields: [],
    hook: '',
    spoken: '',
    takes: ['', '', '', '', ''],
    cta: '',
    caption: '',
    contentType: '',
    column,
    order: 0,
    notes: '',
    updatedAt: new Date().toISOString()
  };
}

function buildRecordingFormFromCard(card: RecordingCard): RecordingFormState {
  return {
    ...card,
    takes: padTakeList(card.takes.length ? card.takes : []),
    labels: card.labels ?? [],
    fields: card.fields ?? []
  };
}

function buildRecordingPayload(card: RecordingFormState, status: RecordingColumnKey) {
  return {
    title: card.title.trim(),
    hook: card.hook.trim(),
    spoken: card.spoken.trim(),
    takes: card.takes.map((take) => take.trim()).filter(Boolean),
    cta: card.cta.trim(),
    caption: card.caption.trim(),
    status,
    boardOrder: card.order,
    notes: card.notes.trim(),
    driveUrl: card.driveUrl?.trim() || '',
    category: card.category.trim(),
    dueDate: card.dueDate.trim(),
    labels: card.labels,
    fields: card.fields
  };
}

function SortableRecordingCard({
  card,
  onView,
  onEdit,
  onDelete,
  loading,
  deleting
}: {
  card: RecordingCard;
  onView: (card: RecordingCard) => void;
  onEdit: (card: RecordingCard) => void;
  onDelete: (card: RecordingCard) => void;
  loading: boolean;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn('touch-none select-none cursor-grab active:cursor-grabbing', isDragging ? 'opacity-60' : 'opacity-100')}
      {...attributes}
      {...listeners}
    >
      <div className="rounded-[22px] border border-border bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {cardCategory(card)}
              </span>
              {card.dueDate ? (
                <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {card.dueDate}
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
            <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-foreground">{card.hook}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onView(card)}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Ver roteiro"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(card)}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Editar roteiro"
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(card)}
              onPointerDownCapture={(event) => event.stopPropagation()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
              aria-label="Remover roteiro"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] bg-muted/30 px-3 py-3 text-[12px] leading-6 text-muted-foreground">
          {card.notes || 'Sem observacoes por enquanto. Use o modo de edicao para adicionar indicacoes de gravacao.'}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {card.labels.map((label) => (
            <span key={`${card.id}-${label}`} className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <GripVertical className="h-3.5 w-3.5" />
            Arraste o bloco inteiro
          </span>
          <span className="text-[11px] text-muted-foreground">
            {loading ? 'salvando...' : formatDateLabel(card.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecordingColumn({
  column,
  cards,
  onView,
  onEdit,
  onDelete,
  onAdd,
  loadingId,
  deletingId
}: {
  column: { key: RecordingColumnKey; label: string };
  cards: RecordingCard[];
  onView: (card: RecordingCard) => void;
  onEdit: (card: RecordingCard) => void;
  onDelete: (card: RecordingCard) => void;
  onAdd: (column: RecordingColumnKey) => void;
  loadingId: string | null;
  deletingId: string | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${column.key}`
  });

  return (
    <div ref={setNodeRef} className="flex w-[320px] shrink-0 flex-col rounded-[26px] border border-border bg-white/85 p-3">
      <div className="mb-3 flex items-center justify-between px-2 pt-1">
        <div>
          <p className="text-sm font-semibold text-foreground">{column.label}</p>
          <p className="text-[12px] text-muted-foreground">{cards.length} itens</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(column.key)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
          aria-label={`Adicionar bloco em ${column.label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <SortableContext items={cards.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {cards.length ? (
            cards.map((card) => (
              <SortableRecordingCard
                key={card.id}
                card={card}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                loading={loadingId === card.id}
                deleting={deletingId === card.id}
              />
            ))
          ) : (
            <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
              Arraste um roteiro para esta etapa quando ele chegar aqui na producao.
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function RecordingViewModal({
  card,
  onClose,
  onEdit,
  onDelete,
  deleting
}: {
  card: RecordingCard;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.66)] p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-[32px] bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Modo leitura</p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">{card.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {cardCategory(card)}
              </span>
              {card.dueDate ? (
                <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {card.dueDate}
                </span>
              ) : null}
              {card.labels.map((label) => (
                <span key={`${card.id}-view-${label}`} className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>
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

        <div className="grid flex-1 gap-6 overflow-y-auto px-5 py-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-6">
          <div className="space-y-4 rounded-[26px] border border-border bg-muted/20 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Gancho</p>
              <p className="mt-3 text-lg font-medium leading-8 text-foreground">{card.hook}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">CTA</p>
              <p className="mt-3 text-[15px] leading-7 text-foreground">{card.cta}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Legenda</p>
              <p className="mt-3 text-[14px] leading-7 text-foreground">
                {card.caption || 'Nenhuma legenda adicionada ainda para este bloco.'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Observacoes</p>
              <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
                {card.notes || 'Nenhuma observacao adicionada ainda para esta gravacao.'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Campos</p>
              <div className="mt-3 space-y-2">
                {card.fields.length ? (
                  card.fields.map((field) => (
                    <div key={`${card.id}-field-${field.key}`} className="rounded-[18px] border border-border bg-white px-3 py-2 text-[13px] leading-6 text-foreground">
                      <span className="font-medium">{field.key || 'Campo'}:</span> {field.value || 'vazio'}
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] leading-6 text-muted-foreground">Sem campos extras.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Texto falado</p>
              <p className="mt-4 text-[18px] leading-9 text-foreground">{card.spoken}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Takes</p>
              <div className="mt-4 space-y-3">
                {card.takes.length ? (
                  card.takes.map((take, index) => (
                    <div key={`${card.id}-${index}`} className="rounded-[22px] border border-border bg-white px-4 py-3 text-[15px] leading-7 text-foreground">
                      {index + 1}. {take}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-border bg-white px-4 py-3 text-[13px] leading-6 text-muted-foreground">
                    Nenhum take definido ainda.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 lg:px-6">
          <Button variant="outline" onClick={onEdit}>
            <PencilLine className="h-4 w-4" />
            Editar bloco
          </Button>
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={deleting}
            className="border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover bloco
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}

function RecordingDeleteModal({
  card,
  onClose,
  onConfirm,
  processing
}: {
  card: RecordingCard | null;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}) {
  if (!card) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Confirmar acao</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">Remover este bloco?</h3>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              Esta acao remove o roteiro do fluxo e da lista de gravacoes. Verifique se voce realmente quer apagar agora.
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-[18px] border border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bloco</p>
            <p className="mt-1 text-sm font-medium text-foreground">{card.title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {cardCategory(card)} {card.dueDate ? `· ${card.dueDate}` : ''}
            </p>
          </div>
          <div className="rounded-[18px] border border-border bg-white px-4 py-3 text-[13px] leading-6 text-muted-foreground">
            {card.hook || 'Sem gancho informado.'}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={processing}
            className="border border-rose-200 bg-rose-600 text-white hover:bg-rose-700"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Apagar bloco
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecordingEditModal({
  title,
  card,
  saving,
  onDelete,
  onChange,
  onSave,
  onClose
}: {
  title: string;
  card: RecordingEditorState;
  saving: boolean;
  onDelete?: () => void;
  onChange: (nextValue: RecordingEditorState) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Bloco</p>
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

        <div className="grid gap-4 p-5 lg:grid-cols-[0.94fr_1.06fr] lg:p-6">
          <div className="space-y-4 rounded-[26px] border border-border bg-muted/20 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Titulo</label>
              <Input value={card.title} onChange={(event) => onChange({ ...card, title: event.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[0.72fr_0.28fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <Input
                  value={card.category}
                  onChange={(event) => onChange({ ...card, category: event.target.value })}
                  placeholder="Ex.: Conteudo, Venda, Bastidor"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data</label>
                <Input
                  type="date"
                  value={card.dueDate}
                  onChange={(event) => onChange({ ...card, dueDate: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gancho</label>
              <Textarea value={card.hook} onChange={(event) => onChange({ ...card, hook: event.target.value })} className="min-h-[110px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas de gravacao</label>
              <Textarea value={card.notes} onChange={(event) => onChange({ ...card, notes: event.target.value })} className="min-h-[160px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Etiquetas</label>
              <Input
                value={card.labels.join(', ')}
                onChange={(event) => onChange({ ...card, labels: parseCommaList(event.target.value) })}
                placeholder="Ex.: campanha, venda, urgente"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link do Drive</label>
              <Input
                value={card.driveUrl ?? ''}
                onChange={(event) => onChange({ ...card, driveUrl: event.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Campos livres</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...card, fields: [...card.fields, { key: '', value: '' }] })}
                >
                  <Plus className="h-4 w-4" />
                  Campo
                </Button>
              </div>
              <div className="space-y-2">
                {card.fields.length ? (
                  card.fields.map((field, index) => (
                    <div key={`${card.id}-field-${index}`} className="grid gap-2 sm:grid-cols-[0.46fr_0.46fr_0.08fr]">
                      <Input
                        value={field.key}
                        onChange={(event) => {
                          const nextFields = [...card.fields];
                          nextFields[index] = { ...field, key: event.target.value };
                          onChange({ ...card, fields: nextFields });
                        }}
                        placeholder="Nome"
                      />
                      <Input
                        value={field.value}
                        onChange={(event) => {
                          const nextFields = [...card.fields];
                          nextFields[index] = { ...field, value: event.target.value };
                          onChange({ ...card, fields: nextFields });
                        }}
                        placeholder="Valor"
                      />
                      <button
                        type="button"
                        onClick={() => onChange({ ...card, fields: card.fields.filter((_, fieldIndex) => fieldIndex !== index) })}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition hover:bg-muted"
                        aria-label="Remover campo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-border bg-white px-4 py-3 text-[13px] leading-6 text-muted-foreground">
                    Adicione campos para categorias, fontes, prazos ou qualquer filtro extra.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Texto falado</label>
              <Textarea value={card.spoken} onChange={(event) => onChange({ ...card, spoken: event.target.value })} className="min-h-[180px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Takes</label>
              <div className="space-y-2">
                {card.takes.map((take, index) => (
                  <Input
                    key={`${card.id}-${index}`}
                    value={take}
                    onChange={(event) => {
                      const nextTakes = [...card.takes];
                      nextTakes[index] = event.target.value;
                      onChange({ ...card, takes: nextTakes });
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CTA</label>
              <Textarea value={card.cta} onChange={(event) => onChange({ ...card, cta: event.target.value })} className="min-h-[100px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Legenda</label>
              <Textarea value={card.caption} onChange={(event) => onChange({ ...card, caption: event.target.value })} className="min-h-[120px]" />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          {onDelete ? (
            <Button
              variant="outline"
              onClick={onDelete}
              className="border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Remover bloco
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar bloco
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RecordingsWorkspace({
  workspace,
  initialCards
}: {
  workspace: string;
  initialCards: RecordingCard[];
}) {
  const [cards, setCards] = useState(sortColumnCards(initialCards));
  const [viewMode, setViewMode] = useState<RecordingViewMode>('flow');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewingCard, setViewingCard] = useState<RecordingCard | null>(null);
  const [editingCard, setEditingCard] = useState<RecordingEditorState | null>(null);
  const [editingMode, setEditingMode] = useState<'create' | 'edit' | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<RecordingCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const categoryOptions = useMemo(() => {
    const categories = cards.map((card) => cardCategory(card));
    return ['all', ...Array.from(new Set(categories))];
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (activeCategory === 'all') {
      return cards;
    }

    return cards.filter((card) => cardCategory(card) === activeCategory);
  }, [cards, activeCategory]);

  const groupedCards = useMemo(() => {
    return recordingColumns.map((column) => ({
      ...column,
      cards: sortColumnCards(filteredCards.filter((card) => card.column === column.key))
    }));
  }, [filteredCards]);

  const listCards = useMemo(() => sortColumnCards(filteredCards), [filteredCards]);

  async function persistCards(nextCards: RecordingCard[], affectedColumns: RecordingColumnKey[]) {
    const affectedItems = nextCards
      .filter((item) => affectedColumns.includes(item.column))
      .map((item) => ({
        ...item
      }));

    const responses = await Promise.all(
      affectedItems.map((item) =>
        fetch(`/api/workspaces/${workspace}/scripts/${item.scriptId}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            title: item.title,
            hook: item.hook,
            spoken: item.spoken,
            takes: item.takes,
            cta: item.cta,
            caption: item.caption,
            status: item.column,
            boardOrder: item.order,
            notes: item.notes,
            driveUrl: item.driveUrl,
            category: item.category,
            dueDate: item.dueDate,
            labels: item.labels,
            fields: item.fields
          })
        })
      )
    );

    if (responses.some((response) => !response.ok)) {
      throw new Error('Falha ao persistir a nova ordem do fluxo.');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeColumn = findColumn(cards, activeId);

    if (!activeColumn) {
      return;
    }

    const overColumn = overId.startsWith('column-')
      ? (overId.replace('column-', '') as RecordingColumnKey)
      : findColumn(cards, overId);

    if (!overColumn) {
      return;
    }

    const nextCards =
      activeColumn === overColumn
        ? reorderWithinColumn(cards, activeColumn, activeId, overId)
        : moveAcrossColumns(cards, activeId, overColumn, overId.startsWith('column-') ? undefined : overId);

    setCards(nextCards);
    setLoadingId(activeId);

    try {
      await persistCards(nextCards, activeColumn === overColumn ? [activeColumn] : [activeColumn, overColumn]);
    } catch {
      toast.error('Nao foi possivel salvar a nova ordem. Vamos manter a interface local por enquanto.');
    } finally {
      setLoadingId(null);
    }
  }

  function openCreateCard(column: RecordingColumnKey) {
    setEditingCard(createEmptyRecordingCard(column));
    setEditingMode('create');
  }

  function openEditCard(card: RecordingCard) {
    setEditingCard(buildRecordingFormFromCard(card));
    setEditingMode('edit');
  }

  function requestDeleteCard(card: RecordingCard) {
    setPendingDeleteCard(card);
  }

  async function deleteCard(card: RecordingCard) {
    setDeletingId(card.id);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${card.scriptId}`, {
        method: 'DELETE'
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel apagar o bloco.');
      }

      setCards((current) => current.filter((item) => item.id !== card.id));

      if (viewingCard?.id === card.id) {
        setViewingCard(null);
      }

      if (editingCard?.id === card.id) {
        setEditingCard(null);
        setEditingMode(null);
      }

      toast.success('Bloco removido.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel apagar o bloco.';
      toast.error(message);
    } finally {
      setDeletingId(null);
      setPendingDeleteCard(null);
    }
  }

  async function saveCard() {
    if (!editingCard || !editingMode) {
      return;
    }

    setLoadingId(editingCard.id);

    try {
      if (editingMode === 'create') {
        const response = await fetch(`/api/workspaces/${workspace}/scripts`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            ...buildRecordingPayload(editingCard, editingCard.column),
            status: editingCard.column
          })
        });

        const payload = (await response.json().catch(() => null)) as { scripts?: Array<{ id?: string; updatedAt?: string }>; error?: string } | null;

        if (!response.ok || !payload?.scripts?.length) {
          throw new Error(payload?.error ?? 'Nao foi possivel criar o bloco.');
        }

        const created = payload.scripts[0];
        setCards((current) => [
          {
            ...editingCard,
            id: created?.id ?? editingCard.id,
            scriptId: created?.id ?? editingCard.scriptId,
            updatedAt: created?.updatedAt ?? new Date().toISOString()
          },
          ...current
        ]);
        toast.success('Bloco criado.');
      } else {
        const response = await fetch(`/api/workspaces/${workspace}/scripts/${editingCard.scriptId}`, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(buildRecordingPayload(editingCard, editingCard.column))
        });

        const payload = (await response.json().catch(() => null)) as { script?: { updatedAt?: string }; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Nao foi possivel salvar os ajustes.');
        }

        setCards((current) =>
          current.map((item) =>
            item.id === editingCard.id
              ? {
                  ...editingCard,
                  updatedAt: payload?.script?.updatedAt ?? new Date().toISOString()
                }
              : item
          )
        );
        toast.success('Bloco atualizado.');
      }

      setEditingCard(null);
      setEditingMode(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar os ajustes.';
      toast.error(message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Gravacoes"
        title="Gravacoes"
      />

      <Card className="rounded-[24px] border-border/90 bg-white/95">
        <CardContent className="space-y-4 p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {categoryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setActiveCategory(option)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition',
                    activeCategory === option
                      ? 'border-[#17171b] bg-[#17171b] text-white'
                      : 'border-border bg-white text-muted-foreground hover:bg-muted'
                  )}
                >
                  {option === 'all' ? 'Todas' : option}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-full border border-border bg-muted/30 p-1">
                {recordingViewModes.map((mode) => {
                  const Icon = mode.icon;
                  const active = viewMode === mode.key;

                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setViewMode(mode.key)}
                      className={cn(
                        'inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12px] font-medium transition',
                        active ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {filteredCards.length} blocos
              </span>
            </div>
          </div>

          {viewMode === 'flow' ? (
            <div className="overflow-x-auto pb-2">
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                <div className="flex min-w-max gap-4">
                  {groupedCards.map((column) => (
                    <RecordingColumn
                      key={column.key}
                      column={column}
                      cards={column.cards}
                      onView={setViewingCard}
                      onEdit={openEditCard}
                      onDelete={requestDeleteCard}
                      onAdd={openCreateCard}
                      loadingId={loadingId}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              </DndContext>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-2">
              {listCards.length ? (
                listCards.map((card) => (
                  <div key={card.id} className="rounded-[20px] border border-border bg-white p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            {cardCategory(card)}
                          </span>
                          {card.dueDate ? (
                            <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              {card.dueDate}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">{card.hook}</p>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                          {card.caption || 'Nenhuma legenda definida ainda.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingCard(card)}
                          onPointerDownCapture={(event) => event.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
                          aria-label="Ver bloco"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCard(card)}
                          onPointerDownCapture={(event) => event.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
                          aria-label="Editar bloco"
                        >
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteCard(card)}
                          onPointerDownCapture={(event) => event.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                          aria-label="Remover bloco"
                          disabled={deletingId === card.id}
                        >
                          {deletingId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
                  Nenhum bloco nesta visualizacao.
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {listCards.length ? (
                listCards.map((card) => (
                  <div key={card.id} className="rounded-[22px] border border-border bg-white p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-foreground">{card.hook}</p>
                        <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                          {card.caption || 'Nenhuma legenda definida ainda.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreateCard(card.column)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
                        aria-label="Adicionar bloco"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {cardCategory(card)}
                      </span>
                      {card.labels.map((label) => (
                        <span key={`${card.id}-${label}`} className="rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingCard(card)}
                        onPointerDownCapture={(event) => event.stopPropagation()}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-white px-3 text-[12px] font-medium text-foreground transition hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditCard(card)}
                        onPointerDownCapture={(event) => event.stopPropagation()}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-white px-3 text-[12px] font-medium text-foreground transition hover:bg-muted"
                      >
                        <PencilLine className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteCard(card)}
                        onPointerDownCapture={(event) => event.stopPropagation()}
                        className="inline-flex h-8 items-center gap-2 rounded-full border border-rose-200 bg-white px-3 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                        disabled={deletingId === card.id}
                      >
                        {deletingId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground md:col-span-2 xl:col-span-3">
                  Nenhum bloco nesta visualizacao.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {viewingCard ? (
        <RecordingViewModal
          card={viewingCard}
          onClose={() => setViewingCard(null)}
          onEdit={() => {
            const current = viewingCard;
            if (!current) {
              return;
            }

            setViewingCard(null);
            openEditCard(current);
          }}
          onDelete={() => requestDeleteCard(viewingCard!)}
          deleting={deletingId === viewingCard.id}
        />
      ) : null}
      {editingCard ? (
        <RecordingEditModal
          title={editingMode === 'create' ? 'Novo bloco' : 'Editar bloco'}
          card={editingCard}
          saving={loadingId === editingCard.id}
          onChange={setEditingCard}
          onDelete={
            editingMode === 'edit'
              ? () => {
                  if (editingCard) {
                    requestDeleteCard(editingCard);
                  }
                }
              : undefined
          }
          onSave={saveCard}
          onClose={() => {
            setEditingCard(null);
            setEditingMode(null);
          }}
        />
      ) : null}
      <RecordingDeleteModal
        card={pendingDeleteCard}
        onClose={() => setPendingDeleteCard(null)}
        onConfirm={() => {
          if (!pendingDeleteCard) {
            return;
          }

          void deleteCard(pendingDeleteCard);
        }}
        processing={deletingId === pendingDeleteCard?.id}
      />
    </div>
  );
}
