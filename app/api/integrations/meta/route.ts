import { NextResponse } from 'next/server';
import { fetchInstagramInsights } from '@/services/integrations/meta';

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: 'meta-graph',
    data: await fetchInstagramInsights()
  });
}
