import { NextResponse } from 'next/server';

import {
  analyzeCompetitors,
  analyzeMetrics,
  chatWithAi,
  extractProductsFromSource,
  generateCaption,
  generateHooks,
  generateIdeas,
  generateScript,
  generateScriptVariants,
  generateStories,
  generateStoryboard,
  rewriteHumanTone,
  suggestCalendar
} from '@/services/ai';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string; prompt?: string; workspace?: string; payload?: Record<string, unknown> }
    | null;

  if (!body?.action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  try {
    switch (body.action) {
      case 'chat': {
        const content = await chatWithAi({
          prompt: body.prompt ?? '',
          workspace: body.workspace
        });
        return NextResponse.json({ content });
      }
      case 'generateIdeas':
        return NextResponse.json({ content: await generateIdeas((body.payload ?? {}) as never) });
      case 'generateHooks':
        return NextResponse.json({ content: await generateHooks((body.payload ?? {}) as never) });
      case 'generateScript':
        return NextResponse.json({ content: await generateScript((body.payload ?? {}) as never) });
      case 'generateScriptVariants':
        return NextResponse.json({ content: await generateScriptVariants((body.payload ?? {}) as never) });
      case 'generateStoryboard':
        return NextResponse.json({ content: await generateStoryboard((body.payload ?? {}) as never) });
      case 'generateStories':
        return NextResponse.json({ content: await generateStories((body.payload ?? {}) as never) });
      case 'generateCaption':
        return NextResponse.json({ content: await generateCaption((body.payload ?? {}) as never) });
      case 'rewriteHumanTone':
        return NextResponse.json({ content: await rewriteHumanTone((body.payload ?? {}) as never) });
      case 'extractProducts':
        return NextResponse.json({ content: await extractProductsFromSource((body.payload ?? {}) as never) });
      case 'analyzeMetrics':
        return NextResponse.json({ content: await analyzeMetrics((body.payload ?? {}) as never) });
      case 'analyzeCompetitors':
        return NextResponse.json({ content: await analyzeCompetitors((body.payload ?? {}) as never) });
      case 'suggestCalendar':
        return NextResponse.json({ content: await suggestCalendar((body.payload ?? {}) as never) });
      default:
        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel processar a requisicao.';
    console.error('[api/ai]', body.action, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
