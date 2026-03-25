import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  fetchInstagramConnectionSnapshot,
  publishInstagramPost
} from '@/services/integrations/meta';
import {
  deleteMetaConnection,
  getMetaTokenCookieName,
  loadMetaConnection,
  parseMetaCookieConnection
} from '@/services/integrations/meta-storage';

export const runtime = 'nodejs';

async function resolveWorkspaceConnection(request: Request) {
  const url = new URL(request.url);
  const workspace = url.searchParams.get('workspace') ?? 'demo';
  const cookieStore = await cookies();
  const rawCookieValue = cookieStore.get(getMetaTokenCookieName())?.value;
  const browserConnection = parseMetaCookieConnection(rawCookieValue);
  const persistedConnection = browserConnection ? null : await loadMetaConnection(workspace);

  return {
    workspace,
    rawCookieValue,
    browserConnection,
    persistedConnection
  };
}

export async function GET(request: Request) {
  const { workspace, rawCookieValue, browserConnection, persistedConnection } = await resolveWorkspaceConnection(request);
  const data = await fetchInstagramConnectionSnapshot({
    browserConnection,
    persistedConnection,
    fallbackAccessToken: browserConnection || persistedConnection ? null : rawCookieValue,
    connectState: `${workspace}:posts`
  });

  return NextResponse.json(data, { status: 200 });
}

export async function POST(request: Request) {
  const { rawCookieValue, browserConnection, persistedConnection } = await resolveWorkspaceConnection(request);
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

  const data = await publishInstagramPost(body, {
    connection: browserConnection ?? persistedConnection,
    fallbackAccessToken: browserConnection || persistedConnection ? null : rawCookieValue
  });

  return NextResponse.json(data, { status: data.ok ? 200 : 400 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const workspace = url.searchParams.get('workspace') ?? 'demo';
  const response = NextResponse.json({
    ok: true,
    connected: false,
    message: 'Conta do Instagram desconectada deste workspace.'
  });

  response.cookies.set(getMetaTokenCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });

  const persisted = await deleteMetaConnection(workspace);

  if (!persisted.deleted) {
    console.warn('[meta.api] database disconnect skipped', {
      workspace,
      reason: persisted.reason ?? 'unknown'
    });
  }

  return response;
}
