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
import { Eye, Loader2, PencilLine, X } from 'lucide-react';
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

function SortableRecordingCard({
  card,
  onView,
  onEdit,
  loading
}: {
  card: RecordingCard;
  onView: (card: RecordingCard) => void;
  onEdit: (card: RecordingCard) => void;
  loading: boolean;
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
      className={cn(isDragging ? 'opacity-60' : 'opacity-100')}
    >
      <div className="rounded-[22px] border border-border bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{card.title}</p>
            <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-foreground">{card.hook}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onView(card)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Ver roteiro"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(card)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Editar roteiro"
            >
              <PencilLine className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] bg-muted/30 px-3 py-3 text-[12px] leading-6 text-muted-foreground">
          {card.notes || 'Sem observacoes por enquanto. Use o modo de edicao para adicionar indicacoes de gravacao.'}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
            {...attributes}
            {...listeners}
          >
            Arrastar
          </button>
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
  loadingId
}: {
  column: { key: RecordingColumnKey; label: string };
  cards: RecordingCard[];
  onView: (card: RecordingCard) => void;
  onEdit: (card: RecordingCard) => void;
  loadingId: string | null;
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
                loading={loadingId === card.id}
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

function RecordingViewModal({ card, onClose }: { card: RecordingCard; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.66)] p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-[32px] bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Modo leitura</p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">{card.title}</h3>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Observacoes</p>
              <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
                {card.notes || 'Nenhuma observacao adicionada ainda para esta gravacao.'}
              </p>
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
                {card.takes.map((take, index) => (
                  <div key={`${card.id}-${index}`} className="rounded-[22px] border border-border bg-white px-4 py-3 text-[15px] leading-7 text-foreground">
                    {index + 1}. {take}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordingEditModal({
  card,
  saving,
  onChange,
  onSave,
  onClose
}: {
  card: RecordingEditorState;
  saving: boolean;
  onChange: (nextValue: RecordingEditorState) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Editar gravacao</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{card.title}</h3>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Gancho</label>
              <Textarea value={card.hook} onChange={(event) => onChange({ ...card, hook: event.target.value })} className="min-h-[110px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas de gravacao</label>
              <Textarea value={card.notes} onChange={(event) => onChange({ ...card, notes: event.target.value })} className="min-h-[160px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link do Drive</label>
              <Input
                value={card.driveUrl ?? ''}
                onChange={(event) => onChange({ ...card, driveUrl: event.target.value })}
                placeholder="https://drive.google.com/..."
              />
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
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar ajustes
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
  const [viewingCard, setViewingCard] = useState<RecordingCard | null>(null);
  const [editingCard, setEditingCard] = useState<RecordingEditorState | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const groupedCards = useMemo(() => {
    return recordingColumns.map((column) => ({
      ...column,
      cards: sortColumnCards(cards.filter((card) => card.column === column.key))
    }));
  }, [cards]);

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
            driveUrl: item.driveUrl
          })
        })
      )
    );

    if (responses.some((response) => !response.ok)) {
      throw new Error('Falha ao persistir a nova ordem do Kanban.');
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

  async function saveEditedCard() {
    if (!editingCard) {
      return;
    }

    setLoadingId(editingCard.id);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/scripts/${editingCard.scriptId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          title: editingCard.title,
          hook: editingCard.hook,
          spoken: editingCard.spoken,
          takes: editingCard.takes,
          cta: editingCard.cta,
          caption: editingCard.caption,
          status: editingCard.column,
          boardOrder: editingCard.order,
          notes: editingCard.notes,
          driveUrl: editingCard.driveUrl
        })
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
      setEditingCard(null);
      toast.success('Ajustes de gravacao atualizados.');
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
        title="Kanban limpo para producao"
        description="Acompanhe o que ja foi aprovado, o que esta em gravacao, o que subiu para o Drive e o que ja foi editado, sempre na mesma linha e sem excesso visual."
      />

      <Card className="rounded-[28px] border-border/90 bg-white/95">
        <CardContent className="space-y-5 p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Fluxo horizontal</p>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                Arraste os roteiros entre as etapas. O olho abre uma tela de leitura para gravar e o lapis abre a edicao completa.
              </p>
            </div>
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {cards.length} roteiros em producao
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <div className="flex min-w-max gap-4">
                {groupedCards.map((column) => (
                  <RecordingColumn
                    key={column.key}
                    column={column}
                    cards={column.cards}
                    onView={setViewingCard}
                    onEdit={setEditingCard}
                    loadingId={loadingId}
                  />
                ))}
              </div>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      {viewingCard ? <RecordingViewModal card={viewingCard} onClose={() => setViewingCard(null)} /> : null}
      {editingCard ? (
        <RecordingEditModal
          card={editingCard}
          saving={loadingId === editingCard.id}
          onChange={setEditingCard}
          onSave={saveEditedCard}
          onClose={() => setEditingCard(null)}
        />
      ) : null}
    </div>
  );
}
