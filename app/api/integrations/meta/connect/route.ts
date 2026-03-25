import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';

import {
  buildMetaConnectUrl,
  getMetaStateCookieName,
  serializeMetaOAuthState
} from '@/services/integrations/meta';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspace = url.searchParams.get('workspace') ?? 'demo';
  const module = url.searchParams.get('module') ?? 'posts';
  const pageId = url.searchParams.get('pageId') ?? undefined;
  const nonce = randomUUID();
  const state = serializeMetaOAuthState({
    workspace,
    module,
    nonce,
    pageId
  });
  const connectUrl = buildMetaConnectUrl(state);

  if (!connectUrl) {
    return NextResponse.redirect(new URL(`/${workspace}/${module}?instagram=missing-config`, url.origin));
  }

  const response = NextResponse.redirect(connectUrl);

  response.cookies.set(getMetaStateCookieName(), nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10
  });

  return response;
}
