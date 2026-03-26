import { NextResponse } from 'next/server';

import { buildCompetitorAnalysisFallback, buildCompetitorFacts, captureCompetitorSources } from '@/lib/competitor-intelligence';
import { resolveWorkspaceDataAccess, toCompetitorRecord } from '@/lib/platform-data';
import { organizeCompetitorAnalysis } from '@/services/ai';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspace: string; competitorId: string }> }
) {
  const { workspace, competitorId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data: existing, error: existingError } = await admin
    .from('competitors')
    .select('id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,last_analyzed_at')
    .eq('company_id', context.companyId)
    .eq('id', competitorId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? 'Perfil nao encontrado.' }, { status: 404 });
  }

  if (!existing.handle && !existing.website) {
    return NextResponse.json({ error: 'Informe ao menos o Instagram ou o website para gerar a analise.' }, { status: 400 });
  }

  await admin
    .from('competitors')
    .update({
      analysis_status: 'running',
      analysis_error: null
    })
    .eq('company_id', context.companyId)
    .eq('id', competitorId);

  try {
    const competitorInput = {
      id: existing.id,
      name: existing.name,
      handle: existing.handle ?? '',
      website: existing.website ?? '',
      type: existing.profile_type === 'reference' || existing.profile_type === 'inspiration' ? existing.profile_type : 'competitor',
      niche: existing.niche ?? '',
      notes: existing.notes ?? '',
      logoUrl: existing.logo_url ?? '',
      tags: Array.isArray(existing.tags) ? existing.tags.filter((tag): tag is string => typeof tag === 'string') : []
    };

    const { snapshot, suggestedLogoUrl } = await captureCompetitorSources(competitorInput);
    const facts = buildCompetitorFacts(snapshot, competitorInput);
    const fallback = buildCompetitorAnalysisFallback({
      competitor: competitorInput,
      snapshot,
      facts
    });

    const analysis = await organizeCompetitorAnalysis({
      competitor: competitorInput,
      snapshot,
      facts
    }).catch(() => fallback);

    await admin
      .from('competitor_posts')
      .delete()
      .eq('company_id', context.companyId)
      .eq('competitor_id', competitorId);

    if (snapshot.topPosts.length) {
      const { error: insertPostsError } = await admin
        .from('competitor_posts')
        .insert(
          snapshot.topPosts.map((post) => ({
            company_id: context.companyId,
            competitor_id: competitorId,
            published_at: post.postedAt,
            post_type: post.format,
            caption: post.caption,
            metrics: post.metrics,
            media_url: post.mediaUrl || null,
            source_url: post.sourceUrl || null,
            thumbnail_url: post.thumbnailUrl || null,
            metadata: {
              captionLead: post.captionLead,
              accessibilityCaption: post.accessibilityCaption,
              hookPattern: post.hookPattern,
              ctaPatterns: post.ctaPatterns,
              storytellingPatterns: post.storytellingPatterns,
              shortcode: post.shortcode
            }
          }))
        );

      if (insertPostsError) {
        throw new Error(insertPostsError.message);
      }
    }

    const { data, error } = await admin
      .from('competitors')
      .update({
        logo_url: suggestedLogoUrl || existing.logo_url || null,
        analysis_status: 'completed',
        analysis_error: null,
        analysis,
        source_snapshot: snapshot,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('company_id', context.companyId)
      .eq('id', competitorId)
      .select('id,company_id,name,handle,niche,website,notes,created_at,updated_at,profile_type,logo_url,tags,analysis_status,analysis_error,analysis,source_snapshot,last_analyzed_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Nao foi possivel salvar a analise.');
    }

    return NextResponse.json({
      competitor: toCompetitorRecord(
        data as {
          id: string;
          company_id: string;
          name: string;
          handle: string | null;
          niche: string | null;
          website: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          profile_type?: string | null;
          logo_url?: string | null;
          tags?: unknown;
          analysis_status?: string | null;
          analysis_error?: string | null;
          analysis?: unknown;
          source_snapshot?: unknown;
          last_analyzed_at?: string | null;
        }
      )
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel gerar a analise.';

    await admin
      .from('competitors')
      .update({
        analysis_status: 'error',
        analysis_error: message
      })
      .eq('company_id', context.companyId)
      .eq('id', competitorId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
