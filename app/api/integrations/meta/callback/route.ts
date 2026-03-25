import { NextResponse } from 'next/server';

import {
  exchangeCodeForMetaToken,
  exchangeForLongLivedMetaToken,
  getMetaTokenCookieName
} from '@/services/integrations/meta';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorReason = url.searchParams.get('error_reason');
  const errorDescription = url.searchParams.get('error_description');
  const [workspace = 'demo', module = 'posts'] = (url.searchParams.get('state') ?? 'demo:posts').split(':');
  const redirectUrl = new URL(`/${workspace}/${module}`, url.origin);

  if (error) {
    redirectUrl.searchParams.set('instagram', 'cancelled');
    if (errorReason) {
      redirectUrl.searchParams.set('reason', errorReason);
    }
    if (errorDescription) {
      redirectUrl.searchParams.set('description', errorDescription);
    }

    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set('instagram', 'missing-code');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const shortLivedToken = await exchangeCodeForMetaToken(code, url.origin);
    const accessToken = await exchangeForLongLivedMetaToken(shortLivedToken);
    const response = NextResponse.redirect(new URL(`/${workspace}/${module}?instagram=connected`, url.origin));

    response.cookies.set(getMetaTokenCookieName(), accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 45
    });

    return response;
  } catch {
    redirectUrl.searchParams.set('instagram', 'error');
    return NextResponse.redirect(redirectUrl);
  }
}
