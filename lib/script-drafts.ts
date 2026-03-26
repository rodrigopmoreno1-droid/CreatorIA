import type { CarrosselSlide, PostFields, ProductItem, ScriptItem, StorySlide } from '@/types/platform';

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

export function padTakeList(takes: string[], minimum = 5) {
  const nextTakes = [...takes];
  while (nextTakes.length < minimum) {
    nextTakes.push('');
  }
  return nextTakes;
}

export function buildEditableScript(script: ScriptItem): EditableScriptDraft {
  return {
    id: script.id,
    title: script.title,
    hook: script.hook,
    spoken: script.spoken,
    takes: padTakeList(script.takes.length ? script.takes : []),
    cta: script.cta,
    caption: script.caption,
    prompt: script.prompt,
    referenceContext: script.referenceContext,
    productId: script.productId,
    productName: script.productName,
    contentType: script.contentType,
    subOption: script.subOption,
    storySlides: script.storySlides.map((slide) => ({ ...slide })),
    carrosselSlides: script.carrosselSlides.map((slide) => ({ ...slide })),
    postFields: script.postFields ? { ...script.postFields } : null
  };
}

export function buildScriptSavePayloads(
  payload: unknown,
  context: {
    prompt: string;
    product?: ProductItem;
    contentType?: string;
    subOption?: string;
    referenceContext?: string;
    scheduledFor?: string;
    plannerMeta?: ScriptItem['plannerMeta'];
  }
) {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      return {
        title: typeof raw.title === 'string' ? raw.title : `Roteiro ${index + 1}`,
        hook: typeof raw.hook === 'string' ? raw.hook : '',
        spoken: typeof raw.spoken === 'string' ? raw.spoken : '',
        takes: padTakeList(Array.isArray(raw.takes) ? raw.takes.filter((take): take is string => typeof take === 'string') : []),
        cta: typeof raw.cta === 'string' ? raw.cta : '',
        caption: typeof raw.caption === 'string' ? raw.caption : '',
        prompt: context.prompt,
        referenceContext: context.referenceContext ?? '',
        productId: context.product?.id,
        productName: context.product?.name,
        contentType: context.contentType ?? 'reels',
        subOption: context.subOption ?? '',
        storySlides: Array.isArray(raw.storySlides) ? raw.storySlides : undefined,
        carrosselSlides: Array.isArray(raw.carrosselSlides) ? raw.carrosselSlides : undefined,
        postFields: raw.postFields && typeof raw.postFields === 'object' ? raw.postFields : undefined,
        status: 'draft',
        scheduledFor: context.scheduledFor ?? '',
        plannerMeta: context.plannerMeta ?? null
      };
    })
    .filter(Boolean) as Array<{
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
      contentType: string;
      subOption: string;
      storySlides?: unknown[];
      carrosselSlides?: unknown[];
      postFields?: unknown;
      status: string;
      scheduledFor: string;
      plannerMeta: ScriptItem['plannerMeta'];
    }>;
}
