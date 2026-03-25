import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  fetchInstagramInsights,
  getMetaTokenCookieName,
  publishInstagramPost
} from '@/services/integrations/meta';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(getMetaTokenCookieName())?.value;
  const data = await fetchInstagramInsights(accessToken);

  return NextResponse.json(data, { status: 200 });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(getMetaTokenCookieName())?.value;
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

  const data = await publishInstagramPost(body, accessToken);

  return NextResponse.json(data, { status: data.ok ? 200 : 400 });
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    connected: false,
    message: 'Conta do Instagram desconectada deste navegador.'
  });

  response.cookies.set(getMetaTokenCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });

  return response;
}
