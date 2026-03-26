"use client";

import { Fragment, useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Eye, Film, GripVertical, LayoutGrid, List, Loader2, Package, PencilLine, Plus, Trash2, User, Users, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { getContentFormatBadgeClass, getContentFormatLabel } from '@/lib/content-format-meta';
import { recordingColumns } from '@/lib/platform-navigation';
import { cn } from '@/lib/utils';
import type { RecordingCard, RecordingColumnKey } from '@/types/platform';

type RecordingEditorState = RecordingCard;

const COLUMN_COLORS: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-100',
  production: 'bg-blue-50 text-blue-700 border-blue-100',
  recording: 'bg-amber-50 text-amber-700 border-amber-100',
  drive: 'bg-purple-50 text-purple-700 border-purple-100',
  editing: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  edited: 'bg-teal-50 text-teal-700 border-teal-100',
  scheduled: 'bg-sky-50 text-sky-700 border-sky-100',
  posted: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const FORMAT_LABELS: Record<string, string> = {
  reels: 'Reels',
  stories: 'Stories',
  video_curto: 'Vídeo curto',
  carrossel: 'Carrossel',
  post: 'Post estático'
};

const BLOCK_TYPE_OPTIONS = [
  { value: 'video', label: 'Vídeo' },
  { value: 'photo', label: 'Foto' },
  { value: 'ensaio', label: 'Ensaio' },
  { value: 'captacao', label: 'Captação' },
  { value: 'outro', label: 'Outro' }
] as const;

function blockTypeLabel(value: string | undefined): string {
  if (!value || value === 'video') return 'Vídeo';
  return BLOCK_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatDueDateBR(value: string): string {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function findColumn(cards: RecordingCard[], cardId: string) {
  return cards.find((card) => card.id === cardId)?.column ?? null;
}

function sortColumnCards(cards: RecordingCard[]) {
  return [...cards].sort((left, right) => left.order - right.order);
}

function DropPositionIndicator() {
  return (
    <div className="rounded-[18px] border-2 border-dashed border-sky-300 bg-sky-100/70 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.08)]">
      Soltar aqui
    </div>
  );
}

function DragPreviewCard({ card }: { card: RecordingCard }) {
  return (
    <div className="w-[320px] rounded-[24px] border border-sky-200 bg-white p-4 shadow-[0_26px_70px_rgba(15,23,42,0.2)] ring-1 ring-sky-100">
      <div className="flex flex-wrap items-center gap-1.5">
        {card.productName ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Package className="h-2.5 w-2.5" />
            {card.productName}
          </span>
        ) : null}
        {card.contentType ? (
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(card.contentType))}>
            {getContentFormatLabel(card.contentType)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{card.title}</p>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{card.hook}</p>
    </div>
  );
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

type RecordingViewMode = 'flow' | 'list' | 'cards' | 'person';

type RecordingFieldDraft = {
  key: string;
  value: string;
};

type RecordingFormState = RecordingCard;

const recordingViewModes: Array<{ key: RecordingViewMode; label: string; icon: typeof LayoutGrid }> = [
  { key: 'flow', label: 'Fluxo', icon: LayoutGrid },
  { key: 'list', label: 'Lista', icon: List },
  { key: 'cards', label: 'Blocos', icon: LayoutGrid },
  { key: 'person', label: 'Por pessoa', icon: Users }
];

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
    blockType: 'video',
    column,
    order: 0,
    notes: '',
    assignee: '',
    updatedAt: new Date().toISOString()
  };
}

function buildRecordingFormFromCard(card: RecordingCard): RecordingFormState {
  return {
    ...card,
    takes: padTakeList(card.takes.length ? card.takes : []),
    labels: card.labels ?? [],
    fields: card.fields ?? [],
    assignee: card.assignee ?? ''
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
    fields: card.fields,
    assignee: card.assignee?.trim() ?? '',
    blockType: card.blockType ?? 'video'
  };
}

function SortableRecordingCard({
  card, onView, onEdit, onDelete, loading, deleting
}: {
  card: RecordingCard;
  onView: (card: RecordingCard) => void;
  onEdit: (card: RecordingCard) => void;
  onDelete: (card: RecordingCard) => void;
  loading: boolean;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'touch-none select-none cursor-grab active:cursor-grabbing',
        isDragging ? 'z-0 scale-[0.985] opacity-30' : 'opacity-100'
      )}
      {...attributes}
      {...listeners}
    >
      <div className="rounded-[22px] border border-border bg-white p-4 shadow-soft">
        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {card.productName ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Package className="h-2.5 w-2.5" />
              {card.productName}
            </span>
          ) : null}
          {card.contentType ? (
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(card.contentType))}>
              {getContentFormatLabel(card.contentType)}
            </span>
          ) : null}
          {card.blockType && card.blockType !== 'video' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Film className="h-2.5 w-2.5" />
              {blockTypeLabel(card.blockType)}
            </span>
          ) : null}
        </div>

        {/* Title + hook */}
        <p className={cn('truncate text-sm font-semibold text-foreground', (card.productName || card.contentType) ? 'mt-2' : '')}>
          {card.title}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{card.hook}</p>

        {/* Assignee */}
        {card.assignee ? (
          <div className="mt-2 flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{card.assignee}</span>
          </div>
        ) : null}

        {/* Notes */}
        {card.notes ? (
          <div className="mt-3 rounded-[16px] bg-muted/30 px-3 py-2 text-[12px] leading-5 text-muted-foreground line-clamp-2">
            {card.notes}
          </div>
        ) : null}

        {/* Actions + footer */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onView(card)}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Ver"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(card)}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Editar"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(card)}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
              aria-label="Remover"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {card.dueDate ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDueDateBR(card.dueDate)}
              </span>
            ) : null}
            {loading ? (
              <span className="text-[11px] text-muted-foreground">salvando...</span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
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
  deletingId,
  activeDropTarget,
  dropIndicatorId,
  showEndIndicator,
  activeCardId
}: {
  column: { key: RecordingColumnKey; label: string };
  cards: RecordingCard[];
  onView: (card: RecordingCard) => void;
  onEdit: (card: RecordingCard) => void;
  onDelete: (card: RecordingCard) => void;
  onAdd: (column: RecordingColumnKey) => void;
  loadingId: string | null;
  deletingId: string | null;
  activeDropTarget: boolean;
  dropIndicatorId?: string;
  showEndIndicator: boolean;
  activeCardId: string | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${column.key}`
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[320px] shrink-0 flex-col rounded-[26px] border bg-white/85 p-3 transition-all duration-200',
        activeDropTarget
          ? 'border-sky-300 bg-sky-50/60 shadow-[0_18px_50px_rgba(14,165,233,0.12)] ring-1 ring-sky-200/70'
          : 'border-border'
      )}
    >
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
              <Fragment key={card.id}>
                {dropIndicatorId === card.id && activeCardId !== card.id ? <DropPositionIndicator /> : null}
                <SortableRecordingCard
                  card={card}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  loading={loadingId === card.id}
                  deleting={deletingId === card.id}
                />
              </Fragment>
            ))
          ) : (
            <div
              className={cn(
                'rounded-[20px] border border-dashed bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground transition-colors',
                activeDropTarget ? 'border-sky-300 bg-sky-100/60 text-sky-700' : 'border-border'
              )}
            >
              Arraste um roteiro para esta etapa quando ele chegar aqui na producao.
            </div>
          )}
          {showEndIndicator ? <DropPositionIndicator /> : null}
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
  deleting,
  onMarkEdited,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  navIndex,
  navTotal
}: {
  card: RecordingCard;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  onMarkEdited?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  navIndex?: number;
  navTotal?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.66)] p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-[32px] bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Modo leitura</p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">{card.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {card.productName ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Package className="h-2.5 w-2.5" />
                  {card.productName}
                </span>
              ) : null}
              {card.contentType ? (
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]', getContentFormatBadgeClass(card.contentType))}>
                  {getContentFormatLabel(card.contentType)}
                </span>
              ) : null}
              {card.assignee ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <User className="h-2.5 w-2.5" />
                  {card.assignee}
                </span>
              ) : null}
              {card.blockType && card.blockType !== 'video' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Film className="h-2.5 w-2.5" />
                  {blockTypeLabel(card.blockType)}
                </span>
              ) : null}
              {card.dueDate ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDueDateBR(card.dueDate)}
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
          {onMarkEdited && card.column === 'editing' ? (
            <Button
              onClick={onMarkEdited}
              className="border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Marcar como Editado → Postagens
            </Button>
          ) : null}
          <Button onClick={onClose}>Fechar</Button>
          {(onPrev || onNext) ? (
            <div className="flex items-center gap-2 ml-auto">
              {navIndex !== undefined && navTotal !== undefined ? (
                <span className="text-[12px] text-muted-foreground">{navIndex + 1} / {navTotal}</span>
              ) : null}
              <button
                type="button"
                onClick={onPrev}
                disabled={!hasPrev}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted disabled:opacity-40"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted disabled:opacity-40"
                aria-label="Próximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
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
              {card.dueDate ? formatDueDateBR(card.dueDate) : ''}
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
  onClose,
  assignees
}: {
  title: string;
  card: RecordingEditorState;
  saving: boolean;
  onDelete?: () => void;
  onChange: (nextValue: RecordingEditorState) => void;
  onSave: () => void;
  onClose: () => void;
  assignees: string[];
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
              <label className="text-sm font-medium">Tipo de bloco</label>
              <select
                value={card.blockType ?? 'video'}
                onChange={(e) => onChange({ ...card, blockType: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-xl border border-border bg-white px-3 text-sm text-foreground focus:outline-none"
              >
                {BLOCK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsável pela gravação</label>
              <Input
                value={card.assignee ?? ''}
                onChange={(e) => onChange({ ...card, assignee: e.target.value })}
                list={`assignees-${card.id}`}
                placeholder="Ex.: Bárbara, João..."
              />
              {assignees.length > 0 ? (
                <datalist id={`assignees-${card.id}`}>
                  {assignees.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              ) : null}
              {assignees.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {assignees.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onChange({ ...card, assignee: a })}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                        card.assignee === a
                          ? 'border-foreground bg-foreground text-white'
                          : 'border-border bg-white text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              ) : null}
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
  const [filterColumn, setFilterColumn] = useState<RecordingColumnKey | 'all'>('all');
  const [filterFormat, setFilterFormat] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [assignees, setAssignees] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`creatorai:assignees:${workspace}`);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<RecordingEditorState | null>(null);
  const [editingMode, setEditingMode] = useState<'create' | 'edit' | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<RecordingCard | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ column: RecordingColumnKey; overId?: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function persistAssignee(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAssignees((current) => {
      if (current.includes(trimmed)) return current;
      const next = [...current, trimmed].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      try {
        localStorage.setItem(`creatorai:assignees:${workspace}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const availableFormats = useMemo(
    () => [...new Set(cards.map((c) => c.contentType).filter(Boolean))].sort(),
    [cards]
  );

  const availableProducts = useMemo(
    () => [...new Set(cards.map((c) => c.productName ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [cards]
  );

  const availableAssignees = useMemo(
    () => [...new Set([...assignees, ...cards.map((c) => c.assignee ?? '').filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [cards, assignees]
  );

  const activeFilterCount = useMemo(
    () => [filterColumn, filterFormat, filterProduct, filterAssignee].filter((f) => f !== 'all').length,
    [filterColumn, filterFormat, filterProduct, filterAssignee]
  );

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (filterColumn !== 'all' && card.column !== filterColumn) return false;
      if (filterFormat !== 'all' && card.contentType !== filterFormat) return false;
      if (filterProduct !== 'all' && (card.productName ?? '') !== filterProduct) return false;
      if (filterAssignee !== 'all' && (card.assignee ?? '') !== filterAssignee) return false;
      return true;
    });
  }, [cards, filterColumn, filterFormat, filterProduct, filterAssignee]);

  const groupedCards = useMemo(() => {
    return recordingColumns.map((column) => ({
      ...column,
      cards: sortColumnCards(filteredCards.filter((card) => card.column === column.key))
    }));
  }, [filteredCards]);

  const listCards = useMemo(() => sortColumnCards(filteredCards), [filteredCards]);
  const activeDragCard = useMemo(
    () => (activeCardId ? cards.find((card) => card.id === activeCardId) ?? null : null),
    [activeCardId, cards]
  );

  const viewableCards = useMemo(() => filteredCards, [filteredCards]);
  const viewingCardIndex = useMemo(
    () => (viewingCardId ? viewableCards.findIndex((c) => c.id === viewingCardId) : -1),
    [viewableCards, viewingCardId]
  );
  const viewingCard = viewingCardIndex >= 0 ? viewableCards[viewingCardIndex] : null;

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
            fields: item.fields,
            assignee: item.assignee ?? '',
            blockType: item.blockType ?? 'video'
          })
        })
      )
    );

    if (responses.some((response) => !response.ok)) {
      throw new Error('Falha ao persistir a nova ordem do fluxo.');
    }
  }

  function syncActiveCardState(nextCards: RecordingCard[], activeId: string) {
    const nextCard = nextCards.find((item) => item.id === activeId);

    if (!nextCard) {
      return;
    }

    setViewingCardId((current) => (current === activeId ? activeId : current));
    setEditingCard((current) => (current?.id === activeId ? { ...current, ...nextCard } : current));
  }

  async function moveCardToColumn(activeId: string, targetColumn: RecordingColumnKey, overId?: string) {
    const activeColumn = findColumn(cards, activeId);

    if (!activeColumn) {
      return;
    }

    const nextCards =
      activeColumn === targetColumn
        ? overId && overId !== activeId
          ? reorderWithinColumn(cards, activeColumn, activeId, overId)
          : cards
        : moveAcrossColumns(cards, activeId, targetColumn, overId);

    if (nextCards === cards) {
      return;
    }

    setCards(nextCards);
    syncActiveCardState(nextCards, activeId);
    setLoadingId(activeId);

    try {
      await persistCards(nextCards, activeColumn === targetColumn ? [activeColumn] : [activeColumn, targetColumn]);
    } catch {
      toast.error('Nao foi possivel salvar a nova ordem do fluxo. Vamos manter a interface local por enquanto.');
    } finally {
      setLoadingId(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const nextActiveId = String(event.active.id);
    const column = findColumn(cards, nextActiveId);

    setActiveCardId(nextActiveId);
    setDropIndicator(column ? { column, overId: nextActiveId } : null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;

    if (!over) {
      setDropIndicator(null);
      return;
    }

    const overId = String(over.id);
    const overColumn = overId.startsWith('column-')
      ? (overId.replace('column-', '') as RecordingColumnKey)
      : findColumn(cards, overId);

    if (!overColumn) {
      setDropIndicator(null);
      return;
    }

    setDropIndicator({
      column: overColumn,
      overId: overId.startsWith('column-') ? undefined : overId
    });
  }

  function resetDragState() {
    setActiveCardId(null);
    setDropIndicator(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    resetDragState();

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

    await moveCardToColumn(activeId, overColumn, overId.startsWith('column-') ? undefined : overId);
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

  function openViewCard(card: RecordingCard) {
    setViewingCardId(card.id);
  }

  function navToPrev() {
    if (viewingCardIndex > 0) {
      setViewingCardId(viewableCards[viewingCardIndex - 1].id);
    }
  }

  function navToNext() {
    if (viewingCardIndex < viewableCards.length - 1) {
      setViewingCardId(viewableCards[viewingCardIndex + 1].id);
    }
  }

  async function handleMarkEdited(cardId: string) {
    setLoadingId(cardId);
    try {
      const res = await fetch(`/api/workspaces/${workspace}/scripts/${cardId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'edited' })
      });
      if (!res.ok) throw new Error();
      setCards((current) => current.filter((c) => c.id !== cardId));
      setViewingCardId(null);
      toast.success('Conteúdo marcado como Editado. Agora aparece em Postagens.');
    } catch {
      toast.error('Erro ao atualizar status.');
    } finally {
      setLoadingId(null);
    }
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

      if (viewingCardId === card.id) {
        setViewingCardId(null);
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

      persistAssignee(editingCard.assignee ?? '');
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
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterColumn}
                onChange={(e) => setFilterColumn(e.target.value as RecordingColumnKey | 'all')}
                className="h-8 cursor-pointer rounded-full border border-border bg-white px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-muted focus:outline-none"
              >
                <option value="all">Todos os status</option>
                {recordingColumns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label}
                  </option>
                ))}
              </select>

              {availableFormats.length > 0 ? (
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="h-8 cursor-pointer rounded-full border border-border bg-white px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-muted focus:outline-none"
                >
                  <option value="all">Todos os formatos</option>
                  {availableFormats.map((f) => (
                  <option key={f} value={f}>
                      {getContentFormatLabel(f)}
                  </option>
                ))}
              </select>
              ) : null}

              {availableProducts.length > 0 ? (
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="h-8 cursor-pointer rounded-full border border-border bg-white px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-muted focus:outline-none"
                >
                  <option value="all">Todos os produtos</option>
                  {availableProducts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : null}

              {availableAssignees.length > 0 ? (
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="h-8 cursor-pointer rounded-full border border-border bg-white px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-muted focus:outline-none"
                >
                  <option value="all">Todas as pessoas</option>
                  {availableAssignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              ) : null}

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilterColumn('all');
                    setFilterFormat('all');
                    setFilterProduct('all');
                    setFilterAssignee('all');
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <X className="h-3 w-3" />
                  Limpar filtros ({activeFilterCount})
                </button>
              ) : null}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={resetDragState}
              >
                <div className="flex min-w-max gap-4">
                  {groupedCards.map((column) => (
                    <RecordingColumn
                      key={column.key}
                      column={column}
                      cards={column.cards}
                      onView={openViewCard}
                      onEdit={openEditCard}
                      onDelete={requestDeleteCard}
                      onAdd={openCreateCard}
                      loadingId={loadingId}
                      deletingId={deletingId}
                      activeDropTarget={dropIndicator?.column === column.key}
                      dropIndicatorId={dropIndicator?.column === column.key ? dropIndicator?.overId : undefined}
                      showEndIndicator={dropIndicator?.column === column.key && !dropIndicator?.overId}
                      activeCardId={activeCardId}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={null}>
                  {activeDragCard ? <DragPreviewCard card={activeDragCard} /> : null}
                </DragOverlay>
              </DndContext>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-2">
              {listCards.length ? (
                listCards.map((card) => (
                  <div key={card.id} className="rounded-[20px] border border-border bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', COLUMN_COLORS[card.column] ?? 'bg-muted/40 text-muted-foreground border-border')}>
                            {recordingColumns.find((c) => c.key === card.column)?.label ?? card.column}
                          </span>
                          {card.productName ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Package className="h-2.5 w-2.5" />
                              {card.productName}
                            </span>
                          ) : null}
                          {card.contentType ? (
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(card.contentType))}>
                              {getContentFormatLabel(card.contentType)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{card.hook}</p>
                      </div>

                      <div className="hidden shrink-0 items-center gap-4 text-[12px] text-muted-foreground md:flex">
                        {card.assignee ? (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {card.assignee}
                          </span>
                        ) : null}
                        {card.dueDate ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDueDateBR(card.dueDate)}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="min-w-[132px]">
                          <select
                            value={card.column}
                            onChange={(event) => void moveCardToColumn(card.id, event.target.value as RecordingColumnKey)}
                            disabled={loadingId === card.id}
                            className="h-8 cursor-pointer rounded-xl border border-border bg-white px-2.5 text-[12px] font-medium text-foreground transition hover:bg-muted focus:outline-none"
                            aria-label={`Alterar status de ${card.title}`}
                          >
                            {recordingColumns.map((column) => (
                              <option key={`${card.id}-${column.key}`} value={column.key}>
                                {column.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button type="button" onClick={() => openViewCard(card)} onPointerDownCapture={(e) => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted" aria-label="Ver">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => openEditCard(card)} onPointerDownCapture={(e) => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted" aria-label="Editar">
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => requestDeleteCard(card)} onPointerDownCapture={(e) => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50" aria-label="Remover" disabled={deletingId === card.id}>
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
          ) : viewMode === 'cards' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {listCards.length ? (
                listCards.map((card) => (
                  <div key={card.id} className="rounded-[22px] border border-border bg-white p-4 shadow-soft">
                    {/* Column + actions */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', COLUMN_COLORS[card.column] ?? 'bg-muted/40 text-muted-foreground border-border')}>
                        {recordingColumns.find((c) => c.key === card.column)?.label ?? card.column}
                      </span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openViewCard(card)} onPointerDownCapture={(e) => e.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted" aria-label="Ver">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => openEditCard(card)} onPointerDownCapture={(e) => e.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted" aria-label="Editar">
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => requestDeleteCard(card)} onPointerDownCapture={(e) => e.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50" aria-label="Remover" disabled={deletingId === card.id}>
                          {deletingId === card.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Product + Format tags */}
                    {(card.productName || card.contentType) ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {card.productName ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Package className="h-2.5 w-2.5" />
                            {card.productName}
                          </span>
                        ) : null}
                        {card.contentType ? (
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getContentFormatBadgeClass(card.contentType))}>
                            {getContentFormatLabel(card.contentType)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Title + Hook */}
                    <p className="mt-2.5 truncate text-sm font-semibold text-foreground">{card.title}</p>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{card.hook}</p>

                    {/* Footer */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      {card.assignee ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {card.assignee}
                        </span>
                      ) : <span />}
                      {card.dueDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDueDateBR(card.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground md:col-span-2 xl:col-span-3">
                  Nenhum bloco nesta visualizacao.
                </div>
              )}
            </div>
          ) : viewMode === 'person' ? (
            <div className="space-y-6">
              {(() => {
                // Group cards by assignee
                const groups: Record<string, RecordingCard[]> = {};
                for (const card of filteredCards) {
                  const key = card.assignee?.trim() || 'Sem responsável';
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(card);
                }
                const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
                  if (a === 'Sem responsável') return 1;
                  if (b === 'Sem responsável') return -1;
                  return a.localeCompare(b, 'pt-BR');
                });

                if (!sortedGroups.length) {
                  return (
                    <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
                      Nenhum bloco nesta visualização.
                    </div>
                  );
                }

                return sortedGroups.map(([person, personCards]) => (
                  <div key={person} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{person}</p>
                        <p className="text-[12px] text-muted-foreground">{personCards.length} {personCards.length === 1 ? 'bloco' : 'blocos'}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {personCards.map((card) => (
                        <div key={card.id} className="rounded-[22px] border border-border bg-white p-4 shadow-soft">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap gap-1.5">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', COLUMN_COLORS[card.column] ?? 'bg-muted/40 text-muted-foreground border-border')}>
                                {recordingColumns.find((c) => c.key === card.column)?.label ?? card.column}
                              </span>
                              {card.blockType && card.blockType !== 'video' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  <Film className="h-2.5 w-2.5" />
                                  {blockTypeLabel(card.blockType)}
                                </span>
                              ) : null}
                              {card.contentType ? (
                                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                  {FORMAT_LABELS[card.contentType] ?? card.contentType}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => openViewCard(card)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted" aria-label="Ver">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => openEditCard(card)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted" aria-label="Editar">
                                <PencilLine className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {card.productName ? (
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{card.productName}</p>
                          ) : null}
                          <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{card.hook}</p>
                          {card.dueDate ? (
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDueDateBR(card.dueDate)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {viewingCard ? (
        <RecordingViewModal
          card={viewingCard}
          onClose={() => setViewingCardId(null)}
          onEdit={() => {
            const current = viewingCard;
            if (!current) return;
            setViewingCardId(null);
            openEditCard(current);
          }}
          onDelete={() => requestDeleteCard(viewingCard!)}
          deleting={deletingId === viewingCard?.id}
          onMarkEdited={viewingCard?.column === 'editing' ? () => handleMarkEdited(viewingCard.id) : undefined}
          onPrev={navToPrev}
          onNext={navToNext}
          hasPrev={viewingCardIndex > 0}
          hasNext={viewingCardIndex < viewableCards.length - 1}
          navIndex={viewingCardIndex}
          navTotal={viewableCards.length}
        />
      ) : null}
      {editingCard ? (
        <RecordingEditModal
          title={editingMode === 'create' ? 'Novo bloco' : 'Editar bloco'}
          card={editingCard}
          saving={loadingId === editingCard.id}
          onChange={setEditingCard}
          assignees={assignees}
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
