import { NextResponse } from 'next/server';
import { fetchInstagramInsights, publishInstagramPost } from '@/services/integrations/meta';

export async function GET() {
  const data = await fetchInstagramInsights();

  return NextResponse.json({
    ok: true,
    provider: 'meta-graph',
    data
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        caption?: string;
        mediaUrl?: string;
        mediaType?: 'IMAGE' | 'REELS';
        scheduledAt?: string;
        shareToFeed?: boolean;
      }
    | null;

  if (!body) {
    return NextResponse.json({ ok: false, message: 'Payload ausente.' }, { status: 400 });
  }

  const data = await publishInstagramPost(body);

  return NextResponse.json(data, { status: data.ok ? 200 : 400 });
}
