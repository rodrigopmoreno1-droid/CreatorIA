import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  exchangeCodeForMetaToken,
  exchangeForLongLivedMetaToken,
  getMetaStateCookieName,
  parseMetaOAuthState,
  resolveMetaConnectionFromUserToken
} from '@/services/integrations/meta';
import {
  getMetaTokenCookieName,
  persistMetaConnection,
  serializeMetaCookieConnection
} from '@/services/integrations/meta-storage';

export const runtime = 'nodejs';

function clearStateCookie(response: NextResponse) {
  response.cookies.set(getMetaStateCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });

  return response;
}

function buildWorkspaceRedirect(workspace: string, module: string, status: string, extras?: Record<string, string>) {
  const redirectUrl = new URL(`/${workspace}/${module}`, 'https://creator-ia.vercel.app');
  redirectUrl.searchParams.set('instagram', status);

  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  return redirectUrl;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const metaState = parseMetaOAuthState(url.searchParams.get('state'));
  const workspace = metaState?.workspace ?? 'demo';
  const module = metaState?.module ?? 'posts';
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorReason = url.searchParams.get('error_reason');
  const errorDescription = url.searchParams.get('error_description');
  const storedNonce = cookieStore.get(getMetaStateCookieName())?.value;

  if (error) {
    console.warn('[meta.callback] user cancelled or Meta rejected the OAuth flow', {
      workspace,
      module,
      reason: errorReason ?? error
    });

    return clearStateCookie(
      NextResponse.redirect(
        buildWorkspaceRedirect(workspace, module, 'cancelled', {
          reason: errorReason ?? error,
          description: errorDescription ?? ''
        })
      )
    );
  }

  if (!metaState || !storedNonce || storedNonce !== metaState.nonce) {
    console.warn('[meta.callback] invalid or missing OAuth state', {
      workspace,
      module
    });

    return clearStateCookie(
      NextResponse.redirect(buildWorkspaceRedirect(workspace, module, 'invalid-state'))
    );
  }

  if (!code) {
    return clearStateCookie(
      NextResponse.redirect(buildWorkspaceRedirect(workspace, module, 'missing-code'))
    );
  }

  try {
    const shortLivedToken = await exchangeCodeForMetaToken(code);
    const longLivedToken = await exchangeForLongLivedMetaToken(shortLivedToken.accessToken);
    const resolved = await resolveMetaConnectionFromUserToken(longLivedToken.accessToken, {
      pageId: metaState.pageId,
      connectState: `${workspace}:${module}`,
      usingWorkspaceToken: true
    });

    const persisted = await persistMetaConnection({
      workspaceSlug: workspace,
      ...resolved.connection,
      metadata: {
        pagesCount: resolved.pagesCount,
        eligiblePagesCount: resolved.eligiblePagesCount,
        pageSelection: resolved.pageSelection,
        connectedAt: new Date().toISOString()
      }
    });

    const response = NextResponse.redirect(
      buildWorkspaceRedirect(workspace, module, 'connected', {
        persisted: persisted.persisted ? 'true' : 'false'
      })
    );

    response.cookies.set(getMetaTokenCookieName(), serializeMetaCookieConnection(resolved.connection), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 45
    });

    if (!persisted.persisted) {
      console.warn('[meta.callback] Meta connection was established but database persistence was skipped', {
        workspace,
        module,
        reason: persisted.reason ?? 'unknown'
      });
    }

    return clearStateCookie(response);
  } catch (error) {
    console.error('[meta.callback] failed to finalize Meta connection', {
      workspace,
      module,
      reason: error instanceof Error ? error.message.slice(0, 240) : 'unknown error'
    });

    return clearStateCookie(
      NextResponse.redirect(buildWorkspaceRedirect(workspace, module, 'error'))
    );
  }
}
