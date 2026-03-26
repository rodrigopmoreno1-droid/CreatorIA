"use client";

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Package,
  PencilLine,
  Phone,
  Plus,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import type { ProductItem, RecordingCard } from '@/types/platform';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Creator = {
  id: string;
  name: string;
  photo: string;
  handle: string;
  phone: string;
  email: string;
  city: string;
  niche: string;
  notes: string;
  cache: string;
  paymentMethod: string;
  pix: string;
  mediaKitUrl: string;
  availability: string;
  productIds: string[];
  createdAt: string;
};

type CreatorFormState = Omit<Creator, 'id' | 'createdAt'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function storageKey(workspace: string) {
  return `creatorai:creators:${workspace}`;
}

function loadCreators(workspace: string): Creator[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(workspace));
    return raw ? (JSON.parse(raw) as Creator[]) : [];
  } catch {
    return [];
  }
}

function saveCreators(workspace: string, creators: Creator[]) {
  try {
    localStorage.setItem(storageKey(workspace), JSON.stringify(creators));
  } catch {}
}

function emptyForm(): CreatorFormState {
  return {
    name: '',
    photo: '',
    handle: '',
    phone: '',
    email: '',
    city: '',
    niche: '',
    notes: '',
    cache: '',
    paymentMethod: '',
    pix: '',
    mediaKitUrl: '',
    availability: '',
    productIds: []
  };
}

const CONTENT_STATUS_LABELS: Record<string, string> = {
  approved: 'Aprovado',
  production: 'Em produção',
  recording: 'Gravando',
  drive: 'No Drive',
  editing: 'Em edição',
  edited: 'Editado',
  scheduled: 'Agendado',
  posted: 'Postado'
};

const CONTENT_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-100',
  production: 'bg-blue-50 text-blue-700 border-blue-100',
  recording: 'bg-amber-50 text-amber-700 border-amber-100',
  drive: 'bg-purple-50 text-purple-700 border-purple-100',
  editing: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  edited: 'bg-teal-50 text-teal-700 border-teal-100',
  scheduled: 'bg-sky-50 text-sky-700 border-sky-100',
  posted: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

function formatDueDateBR(value: string): string {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ─── Creator card ────────────────────────────────────────────────────────────

function CreatorCard({
  creator,
  onEdit,
  onView,
  onDelete
}: {
  creator: Creator;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-white p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {creator.photo ? (
            <img
              src={creator.photo}
              alt={creator.name}
              className="h-14 w-14 rounded-full border border-border object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/40">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{creator.name}</p>
          {creator.handle ? (
            <p className="text-[13px] text-muted-foreground">@{creator.handle.replace('@', '')}</p>
          ) : null}
          {creator.city ? (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {creator.city}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
            aria-label="Ver perfil"
          >
            <User className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
            aria-label="Editar"
          >
            <PencilLine className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
            aria-label="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {creator.niche ? (
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {creator.niche}
          </span>
        ) : null}
        {creator.cache ? (
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {creator.cache}
          </span>
        ) : null}
        {creator.availability ? (
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {creator.availability}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onView}
        className="mt-4 w-full rounded-[18px] border border-border bg-muted/20 py-2 text-[13px] font-medium text-muted-foreground transition hover:bg-muted"
      >
        Ver perfil completo
      </button>
    </div>
  );
}

// ─── Creator form modal ───────────────────────────────────────────────────────

function CreatorFormModal({
  title,
  form,
  products,
  saving,
  onChange,
  onSave,
  onClose
}: {
  title: string;
  form: CreatorFormState;
  products: ProductItem[];
  saving: boolean;
  onChange: (next: CreatorFormState) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  function toggleProduct(productId: string) {
    const next = form.productIds.includes(productId)
      ? form.productIds.filter((id) => id !== productId)
      : [...form.productIds, productId];
    onChange({ ...form, productIds: next });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Blogueira</p>
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

        <div className="grid gap-5 p-5 lg:grid-cols-2 lg:p-6">
          {/* Left column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">@ Instagram</label>
                <Input
                  value={form.handle}
                  onChange={(e) => onChange({ ...form, handle: e.target.value })}
                  placeholder="@perfil"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cidade</label>
                <Input
                  value={form.city}
                  onChange={(e) => onChange({ ...form, city: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => onChange({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => onChange({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nicho / Categoria</label>
              <Input
                value={form.niche}
                onChange={(e) => onChange({ ...form, niche: e.target.value })}
                placeholder="Saúde, Beleza, Moda..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Disponibilidade</label>
              <Input
                value={form.availability}
                onChange={(e) => onChange({ ...form, availability: e.target.value })}
                placeholder="Ex.: Semanas, Quinzenas, Mensal..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link da foto de perfil (URL)</label>
              <Input
                value={form.photo}
                onChange={(e) => onChange({ ...form, photo: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cachê</label>
                <Input
                  value={form.cache}
                  onChange={(e) => onChange({ ...form, cache: e.target.value })}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Forma de pagamento</label>
                <Input
                  value={form.paymentMethod}
                  onChange={(e) => onChange({ ...form, paymentMethod: e.target.value })}
                  placeholder="Pix, Transferência..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Pix / Conta bancária</label>
              <Input
                value={form.pix}
                onChange={(e) => onChange({ ...form, pix: e.target.value })}
                placeholder="CPF, e-mail ou chave pix"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link do mídia kit</label>
              <Input
                value={form.mediaKitUrl}
                onChange={(e) => onChange({ ...form, mediaKitUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
                className="min-h-[100px]"
                placeholder="Notas internas sobre a blogueira..."
              />
            </div>
            {products.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Produtos vinculados</label>
                <div className="flex flex-wrap gap-2">
                  {products.map((product) => {
                    const active = form.productIds.includes(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition',
                          active
                            ? 'border-foreground bg-foreground text-white'
                            : 'border-border bg-white text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <Package className="h-3 w-3" />
                        {product.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-white/95 px-5 py-4 backdrop-blur-sm lg:px-6">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={onSave} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Creator detail modal ─────────────────────────────────────────────────────

function CreatorDetailModal({
  creator,
  products,
  recordings,
  onClose,
  onEdit
}: {
  creator: Creator;
  products: ProductItem[];
  recordings: RecordingCard[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const assignedContent = useMemo(
    () => recordings.filter((r) => r.assignee?.toLowerCase() === creator.name.toLowerCase()),
    [recordings, creator.name]
  );

  const linkedProducts = useMemo(
    () => products.filter((p) => creator.productIds.includes(p.id)),
    [products, creator.productIds]
  );

  const schedule = useMemo(
    () =>
      assignedContent
        .filter((r) => r.dueDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [assignedContent]
  );

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.66)] p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-[32px] bg-white">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:px-6">
          <div className="flex items-center gap-4">
            {creator.photo ? (
              <img
                src={creator.photo}
                alt={creator.name}
                className="h-12 w-12 rounded-full border border-border object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/40">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold text-foreground">{creator.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                {creator.handle ? (
                  <span className="flex items-center gap-1">
                    <Instagram className="h-3.5 w-3.5" />
                    @{creator.handle.replace('@', '')}
                  </span>
                ) : null}
                {creator.city ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {creator.city}
                  </span>
                ) : null}
                {creator.niche ? <span>{creator.niche}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onEdit}>
              <PencilLine className="h-4 w-4" />
              Editar
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-4 p-5 lg:grid-cols-[0.4fr_0.6fr] lg:p-6">
            {/* Left: Info */}
            <div className="space-y-4">
              <div className="rounded-[22px] border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Contato</p>
                {creator.phone ? (
                  <div className="flex items-center gap-2 text-[13px] text-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {creator.phone}
                  </div>
                ) : null}
                {creator.email ? (
                  <div className="flex items-center gap-2 text-[13px] text-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {creator.email}
                  </div>
                ) : null}
                {(!creator.phone && !creator.email) ? (
                  <p className="text-[13px] text-muted-foreground">Nenhum contato cadastrado.</p>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Comercial</p>
                {creator.cache ? (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Cachê</span>
                    <span className="font-medium text-foreground">{creator.cache}</span>
                  </div>
                ) : null}
                {creator.paymentMethod ? (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span className="font-medium text-foreground">{creator.paymentMethod}</span>
                  </div>
                ) : null}
                {creator.pix ? (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Pix</span>
                    <span className="font-medium text-foreground">{creator.pix}</span>
                  </div>
                ) : null}
                {creator.availability ? (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Disponibilidade</span>
                    <span className="font-medium text-foreground">{creator.availability}</span>
                  </div>
                ) : null}
                {creator.mediaKitUrl ? (
                  <a
                    href={creator.mediaKitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-foreground underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver mídia kit
                  </a>
                ) : null}
              </div>

              {linkedProducts.length > 0 ? (
                <div className="rounded-[22px] border border-border bg-muted/20 p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Produtos vinculados</p>
                  <div className="space-y-2">
                    {linkedProducts.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-[14px] border border-border bg-white px-3 py-2">
                        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-[13px] font-medium text-foreground">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {creator.notes ? (
                <div className="rounded-[22px] border border-border bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Observações</p>
                  <p className="mt-3 text-[14px] leading-6 text-foreground">{creator.notes}</p>
                </div>
              ) : null}
            </div>

            {/* Right: Content + Schedule */}
            <div className="space-y-4">
              {/* Schedule */}
              <div className="rounded-[22px] border border-border bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Agenda ({schedule.length})
                  </p>
                </div>
                {schedule.length ? (
                  <div className="space-y-2">
                    {schedule.map((card) => (
                      <div key={`schedule-${card.id}`} className="flex items-center gap-3 rounded-[16px] border border-border bg-muted/20 px-3 py-2.5">
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-[12px] border border-border bg-white text-center">
                          <span className="text-[10px] font-semibold leading-none text-muted-foreground">{formatDueDateBR(card.dueDate).slice(3, 5)}</span>
                          <span className="text-[13px] font-bold leading-none text-foreground">{formatDueDateBR(card.dueDate).slice(0, 2)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">{card.title}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            {card.productName ? (
                              <span className="text-[11px] text-muted-foreground">{card.productName}</span>
                            ) : null}
                            {card.contentType ? (
                              <span className="text-[11px] text-muted-foreground">· {card.contentType}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', CONTENT_STATUS_COLORS[card.column] ?? 'bg-muted/40 text-muted-foreground border-border')}>
                          {CONTENT_STATUS_LABELS[card.column] ?? card.column}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] leading-6 text-muted-foreground">Nenhum conteúdo com data definida.</p>
                )}
              </div>

              {/* All assigned content */}
              <div className="rounded-[22px] border border-border bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-4">
                  Conteúdos atribuídos ({assignedContent.length})
                </p>
                {assignedContent.length ? (
                  <div className="space-y-2">
                    {assignedContent.map((card) => (
                      <div key={`content-${card.id}`} className="flex items-center gap-3 rounded-[16px] border border-border bg-muted/20 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">{card.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {[card.productName, card.contentType].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', CONTENT_STATUS_COLORS[card.column] ?? 'bg-muted/40 text-muted-foreground border-border')}>
                          {CONTENT_STATUS_LABELS[card.column] ?? card.column}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] leading-6 text-muted-foreground">
                    Nenhum conteúdo atribuído a {creator.name} ainda. Atribua conteúdos na página de Produção.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteCreatorModal({
  creator,
  onClose,
  onConfirm
}: {
  creator: Creator | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!creator) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Confirmar remoção</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">Remover {creator.name}?</h3>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              Os conteúdos atribuídos a esta pessoa não serão apagados.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} className="border border-rose-200 bg-rose-600 text-white hover:bg-rose-700">
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export function CreatorsWorkspace({
  workspace,
  products,
  recordings
}: {
  workspace: string;
  products: ProductItem[];
  recordings: RecordingCard[];
}) {
  const [creators, setCreators] = useState<Creator[]>(() => loadCreators(workspace));
  const [editingCreator, setEditingCreator] = useState<{ id: string | null; form: CreatorFormState } | null>(null);
  const [viewingCreator, setViewingCreator] = useState<Creator | null>(null);
  const [deletingCreator, setDeletingCreator] = useState<Creator | null>(null);
  const [search, setSearch] = useState('');

  const filteredCreators = useMemo(() => {
    if (!search.trim()) return creators;
    const q = search.toLowerCase();
    return creators.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.niche.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [creators, search]);

  function persistCreators(next: Creator[]) {
    setCreators(next);
    saveCreators(workspace, next);
  }

  function openCreate() {
    setEditingCreator({ id: null, form: emptyForm() });
  }

  function openEdit(creator: Creator) {
    setEditingCreator({
      id: creator.id,
      form: {
        name: creator.name,
        photo: creator.photo,
        handle: creator.handle,
        phone: creator.phone,
        email: creator.email,
        city: creator.city,
        niche: creator.niche,
        notes: creator.notes,
        cache: creator.cache,
        paymentMethod: creator.paymentMethod,
        pix: creator.pix,
        mediaKitUrl: creator.mediaKitUrl,
        availability: creator.availability,
        productIds: creator.productIds
      }
    });
    setViewingCreator(null);
  }

  function saveCreator() {
    if (!editingCreator) return;

    if (editingCreator.id) {
      // Edit
      const next = creators.map((c) =>
        c.id === editingCreator.id ? { ...c, ...editingCreator.form } : c
      );
      persistCreators(next);
    } else {
      // Create
      const newCreator: Creator = {
        ...editingCreator.form,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      persistCreators([newCreator, ...creators]);
    }

    setEditingCreator(null);
  }

  function confirmDelete() {
    if (!deletingCreator) return;
    persistCreators(creators.filter((c) => c.id !== deletingCreator.id));
    setDeletingCreator(null);
    if (viewingCreator?.id === deletingCreator.id) {
      setViewingCreator(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Blogueiras"
        title="Base de criadoras"
        description="Perfis completos, conteúdos atribuídos e agenda de gravação por pessoa."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nova blogueira
          </Button>
        }
      />

      <Card className="rounded-[24px] border-border/90 bg-white/95">
        <CardContent className="p-4 lg:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, @, nicho ou cidade..."
              className="max-w-sm"
            />
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {filteredCreators.length} {filteredCreators.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>

          {filteredCreators.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCreators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  onEdit={() => openEdit(creator)}
                  onView={() => setViewingCreator(creator)}
                  onDelete={() => setDeletingCreator(creator)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-border bg-muted/20 p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
                {search.trim()
                  ? 'Nenhuma blogueira encontrada para essa busca.'
                  : 'Nenhuma blogueira cadastrada ainda. Clique em "Nova blogueira" para começar.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {editingCreator ? (
        <CreatorFormModal
          title={editingCreator.id ? 'Editar blogueira' : 'Nova blogueira'}
          form={editingCreator.form}
          products={products}
          saving={false}
          onChange={(next) => setEditingCreator({ ...editingCreator, form: next })}
          onSave={saveCreator}
          onClose={() => setEditingCreator(null)}
        />
      ) : null}

      {viewingCreator ? (
        <CreatorDetailModal
          creator={viewingCreator}
          products={products}
          recordings={recordings}
          onClose={() => setViewingCreator(null)}
          onEdit={() => openEdit(viewingCreator)}
        />
      ) : null}

      <DeleteCreatorModal
        creator={deletingCreator}
        onClose={() => setDeletingCreator(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
