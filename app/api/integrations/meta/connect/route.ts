import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';

import {
  getMetaConnectRequest,
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
  const connectRequest = getMetaConnectRequest(state);
  const connectUrl = connectRequest.url;

  if (!connectUrl) {
    const redirectUrl = new URL(`/${workspace}/${module}`, url.origin);
    const status = connectRequest.errorCode === 'missing-config-id' ? 'missing-business-config' : 'missing-config';
    redirectUrl.searchParams.set('instagram', status);

    if (connectRequest.errorCode) {
      console.warn('[meta.connect] unable to start Meta OAuth flow', {
        workspace,
        module,
        mode: connectRequest.mode,
        reason: connectRequest.errorCode
      });
    }

    return NextResponse.redirect(redirectUrl);
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
