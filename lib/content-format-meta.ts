export const CONTENT_FORMAT_ORDER = ['reels', 'stories', 'video_curto', 'carrossel', 'post'] as const;

export type ContentFormatKey = (typeof CONTENT_FORMAT_ORDER)[number];

export const CONTENT_FORMAT_META: Record<ContentFormatKey, { label: string; badgeClass: string }> = {
  reels: {
    label: 'Reels',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700'
  },
  stories: {
    label: 'Stories',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700'
  },
  video_curto: {
    label: 'Vídeo curto',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700'
  },
  carrossel: {
    label: 'Carrossel',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700'
  },
  post: {
    label: 'Post estático',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700'
  }
};

export function getContentFormatLabel(format?: string) {
  if (!format) {
    return '';
  }

  return CONTENT_FORMAT_META[format as ContentFormatKey]?.label ?? format;
}

export function getContentFormatBadgeClass(format?: string) {
  if (!format) {
    return 'border-border bg-muted/40 text-muted-foreground';
  }

  return CONTENT_FORMAT_META[format as ContentFormatKey]?.badgeClass ?? 'border-border bg-muted/40 text-muted-foreground';
}
