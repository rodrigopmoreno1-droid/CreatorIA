import { NextResponse } from 'next/server';

import { resolveWorkspaceDataAccess, toContentReferenceItem } from '@/lib/platform-data';

type ReferencePayload = {
  competitorId?: string;
  competitorName?: string;
  title?: string;
  content?: string;
  hookType?: string;
  ctaType?: string;
  format?: string;
  imageUrl?: string;
  notes?: string;
  liked?: boolean;
  category?: string;
  source?: 'manual' | 'analysis';
  sourceInsightId?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function GET(_request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('content_references')
    .select('id,company_id,competitor_id,title,content,hook_type,cta_type,format,image_url,notes,liked,category,source,source_insight_id,source_url,metadata,created_at,updated_at,competitors(name)')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    references: (data ?? []).map((row) =>
      toContentReferenceItem(
        row as {
          id: string;
          company_id: string;
          competitor_id: string | null;
          title: string;
          content: string;
          hook_type: string | null;
          cta_type: string | null;
          format: string | null;
          image_url: string | null;
          notes: string | null;
          liked: boolean | null;
          category: string | null;
          source: string | null;
          source_insight_id: string | null;
          source_url: string | null;
          metadata: unknown;
          created_at: string;
          updated_at: string;
          competitors?: { name?: string | null } | null;
        }
      )
    )
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ReferencePayload | null;

  if (!body?.content?.trim()) {
    return NextResponse.json({ error: 'Conteudo da referencia e obrigatorio.' }, { status: 400 });
  }

  const { admin, context } = access;

  if (body.sourceInsightId) {
    const { data: existing } = await admin
      .from('content_references')
      .select('id,company_id,competitor_id,title,content,hook_type,cta_type,format,image_url,notes,liked,category,source,source_insight_id,source_url,metadata,created_at,updated_at,competitors(name)')
      .eq('company_id', context.companyId)
      .eq('source_insight_id', body.sourceInsightId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await admin
        .from('content_references')
        .update({ liked: true })
        .eq('company_id', context.companyId)
        .eq('id', existing.id)
        .select('id,company_id,competitor_id,title,content,hook_type,cta_type,format,image_url,notes,liked,category,source,source_insight_id,source_url,metadata,created_at,updated_at,competitors(name)')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar a referencia.' }, { status: 500 });
      }

      return NextResponse.json({
        reference: toContentReferenceItem(
          data as {
            id: string;
            company_id: string;
            competitor_id: string | null;
            title: string;
            content: string;
            hook_type: string | null;
            cta_type: string | null;
            format: string | null;
            image_url: string | null;
            notes: string | null;
            liked: boolean | null;
            category: string | null;
            source: string | null;
            source_insight_id: string | null;
            source_url: string | null;
            metadata: unknown;
            created_at: string;
            updated_at: string;
            competitors?: { name?: string | null } | null;
          }
        )
      });
    }
  }

  const { data, error } = await admin
    .from('content_references')
    .insert({
      company_id: context.companyId,
      competitor_id: body.competitorId || null,
      title: body.title?.trim() || 'Referencia salva',
      content: body.content.trim(),
      hook_type: body.hookType?.trim() || null,
      cta_type: body.ctaType?.trim() || null,
      format: body.format?.trim() || null,
      image_url: body.imageUrl?.trim() || null,
      notes: body.notes?.trim() || null,
      liked: body.liked ?? true,
      category: body.category?.trim() || '',
      source: body.source === 'analysis' ? 'analysis' : 'manual',
      source_insight_id: body.sourceInsightId?.trim() || '',
      source_url: body.sourceUrl?.trim() || null,
      metadata: {
        competitorName: body.competitorName?.trim() || '',
        origin: body.source === 'analysis' ? 'competitors-analysis' : 'manual-reference',
        ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {})
      }
    })
    .select('id,company_id,competitor_id,title,content,hook_type,cta_type,format,image_url,notes,liked,category,source,source_insight_id,source_url,metadata,created_at,updated_at,competitors(name)')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel salvar a referencia.' }, { status: 500 });
  }

  return NextResponse.json({
    reference: toContentReferenceItem(
      data as {
        id: string;
        company_id: string;
        competitor_id: string | null;
        title: string;
        content: string;
        hook_type: string | null;
        cta_type: string | null;
        format: string | null;
        image_url: string | null;
        notes: string | null;
        liked: boolean | null;
        category: string | null;
        source: string | null;
        source_insight_id: string | null;
        source_url: string | null;
        metadata: unknown;
        created_at: string;
        updated_at: string;
        competitors?: { name?: string | null } | null;
      }
    )
  });
}
