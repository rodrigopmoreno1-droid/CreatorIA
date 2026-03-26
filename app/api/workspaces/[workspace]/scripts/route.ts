import { NextResponse } from 'next/server';

import { buildScriptMetadata, resolveWorkspaceDataAccess, toScriptItem } from '@/lib/platform-data';
import type { ScriptPlannerMeta } from '@/types/platform';

type IncomingScript = {
  title?: string;
  productId?: string;
  productName?: string;
  prompt?: string;
  referenceContext?: string;
  hook?: string;
  spoken?: string;
  takes?: string[];
  cta?: string;
  caption?: string;
  status?: string;
  boardOrder?: number;
  notes?: string;
  driveUrl?: string;
  category?: string;
  dueDate?: string;
  labels?: string[];
  fields?: Array<{ key?: string; value?: string }>;
  contentType?: string;
  subOption?: string;
  storySlides?: unknown[];
  carrosselSlides?: unknown[];
  postFields?: unknown;
  assignee?: string;
  blockType?: string;
  scheduledFor?: string;
  plannerMeta?: ScriptPlannerMeta | null;
};

const allowedStatuses = new Set(['draft', 'approved', 'production', 'recording', 'drive', 'editing', 'edited', 'scheduled', 'posted']);

function sanitizeScriptPayload(script: IncomingScript) {
  const title = script.title?.trim();

  if (!title) {
    return null;
  }

  return {
    title,
    hook: script.hook?.trim() || null,
    spoken_text: script.spoken?.trim() || null,
    cta: script.cta?.trim() || null,
    status: script.status && allowedStatuses.has(script.status) ? script.status : 'draft',
    storyboard: buildScriptMetadata({
      caption: script.caption?.trim() || '',
      prompt: script.prompt?.trim() || '',
      referenceContext: script.referenceContext?.trim() || '',
      takes: script.takes ?? [],
      productId: script.productId?.trim() || '',
      productName: script.productName?.trim() || '',
      boardOrder: script.boardOrder ?? 0,
      notes: script.notes?.trim() || '',
      driveUrl: script.driveUrl?.trim() || '',
      category: script.category?.trim() || '',
      dueDate: script.dueDate?.trim() || '',
      labels: script.labels ?? [],
      fields: (script.fields ?? [])
        .map((item) => ({
          key: item.key?.trim() || '',
          value: item.value?.trim() || ''
        }))
        .filter((item) => item.key || item.value),
      contentType: script.contentType?.trim() || '',
      subOption: script.subOption?.trim() || '',
      storySlides: Array.isArray(script.storySlides) ? (script.storySlides as import('@/types/platform').StorySlide[]) : [],
      carrosselSlides: Array.isArray(script.carrosselSlides) ? (script.carrosselSlides as import('@/types/platform').CarrosselSlide[]) : [],
      postFields: (script.postFields && typeof script.postFields === 'object') ? script.postFields as import('@/types/platform').PostFields : null,
      assignee: script.assignee,
      blockType: script.blockType,
      scheduledFor: script.scheduledFor?.trim() || '',
      plannerMeta: script.plannerMeta ?? null
    })
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('scripts')
    .select('id,title,hook,spoken_text,cta,storyboard,status,created_at,updated_at')
    .eq('company_id', context.companyId)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    scripts: (data ?? []).map((row) =>
      toScriptItem(
        row as {
          id: string;
          title: string;
          hook: string | null;
          spoken_text: string | null;
          cta: string | null;
          storyboard: unknown;
          status: string | null;
          created_at: string;
          updated_at: string;
        }
      )
    )
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        scripts?: IncomingScript[];
      }
    | IncomingScript
    | null;

  const incomingScripts = Array.isArray((body as { scripts?: IncomingScript[] } | null)?.scripts)
    ? ((body as { scripts: IncomingScript[] }).scripts ?? [])
    : body
      ? [body as IncomingScript]
      : [];

  const payload = incomingScripts
    .map((item) => sanitizeScriptPayload(item))
    .filter((item): item is NonNullable<ReturnType<typeof sanitizeScriptPayload>> => Boolean(item));

  if (payload.length === 0) {
    return NextResponse.json({ error: 'Nenhum roteiro valido foi enviado.' }, { status: 400 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('scripts')
    .insert(
      payload.map((item) => ({
        company_id: context.companyId,
        ...item,
        status: item.status && allowedStatuses.has(item.status) ? item.status : 'draft'
      }))
    )
    .select('id,title,hook,spoken_text,cta,storyboard,status,created_at,updated_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    scripts: (data ?? []).map((row) =>
      toScriptItem(
        row as {
          id: string;
          title: string;
          hook: string | null;
          spoken_text: string | null;
          cta: string | null;
          storyboard: unknown;
          status: string | null;
          created_at: string;
          updated_at: string;
        }
      )
    )
  });
}
