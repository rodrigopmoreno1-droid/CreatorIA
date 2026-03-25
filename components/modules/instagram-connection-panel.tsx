"use client";
import { ExternalLink, Instagram, Loader2, RefreshCw, Unplug } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InstagramConnectionSnapshot } from '@/types';

type InstagramConnectionPanelProps = {
  data: InstagramConnectionSnapshot;
  loading?: boolean;
  syncing?: boolean;
  disconnecting?: boolean;
  onRefresh?: () => void;
  onDisconnect?: () => void;
  connectUrl: string;
};

export function InstagramConnectionPanel({
  data,
  loading = false,
  syncing = false,
  disconnecting = false,
  onRefresh,
  onDisconnect,
  connectUrl
}: InstagramConnectionPanelProps) {
  const account = data.account;
  const actionLabel = data.connected ? 'Conectado' : 'Conectar Instagram';

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.connected ? 'success' : 'outline'}>
              <Instagram className="mr-1 h-3 w-3" />
              {actionLabel}
            </Badge>
            {account?.username ? <Badge variant="outline">@{account.username}</Badge> : null}
            {data.usingWorkspaceToken ? <Badge variant="outline">Conta do navegador</Badge> : null}
          </div>
          <p className="mt-3 text-[13px] font-medium text-foreground">
            {account?.pageName ?? account?.username ?? 'Instagram Business'}
          </p>
          <p className="mt-1 max-w-2xl text-[12px] leading-6 text-muted-foreground">{data.message}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={connectUrl} className={cn(buttonVariants({ variant: data.connected ? 'outline' : 'default', size: 'sm' }))}>
            <Instagram className="h-4 w-4" />
            {data.connected ? 'Trocar conta' : 'Conectar'}
          </a>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || syncing}>
            {loading || syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
          {data.connected ? (
            <Button variant="outline" size="sm" onClick={onDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
              Desconectar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CompactKpi label="Followers" value={formatCount(account?.followersCount)} />
        <CompactKpi label="Posts" value={formatCount(account?.mediaCount ?? data.media.length)} />
        <CompactKpi label="Stories" value={formatCount(data.stories.length)} />
      </div>
    </div>
  );
}

export function InstagramStoryRail({
  stories
}: {
  stories: InstagramConnectionSnapshot['stories'];
}) {
  if (!stories.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-4 text-[12px] text-muted-foreground">
        Nenhum story disponível na conta conectada agora.
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {stories.map((story, index) => (
        <div key={story.id} className="min-w-[76px] text-center">
          <div className="story-ring mx-auto rounded-full p-[2px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background">
              {story.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={story.thumbnailUrl ?? story.mediaUrl}
                  alt={`Story ${index + 1}`}
                  className="h-full w-full rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">Story</span>
              )}
            </div>
          </div>
          <p className="mt-2 truncate text-[11px] text-foreground">Story {index + 1}</p>
        </div>
      ))}
    </div>
  );
}

export function InstagramMediaGrid({
  media
}: {
  media: InstagramConnectionSnapshot['media'];
}) {
  if (!media.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white p-4 text-[12px] text-muted-foreground">
        Conecte o Instagram para carregar o feed real aqui.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {media.slice(0, 9).map((item) => (
        <a
          key={item.id}
          href={item.permalink ?? '#'}
          target={item.permalink ? '_blank' : undefined}
          rel={item.permalink ? 'noreferrer' : undefined}
          className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
        >
          {item.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl ?? item.mediaUrl}
              alt={item.caption || 'Instagram post'}
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
            <span>{formatCount(item.likeCount)}</span>
            {item.permalink ? <ExternalLink className="h-3.5 w-3.5" /> : null}
          </div>
        </a>
      ))}
    </div>
  );
}

function CompactKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <p className="text-[10px] tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatCount(value?: number) {
  if (typeof value !== 'number') {
    return '—';
  }

  return new Intl.NumberFormat('pt-BR', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
}
