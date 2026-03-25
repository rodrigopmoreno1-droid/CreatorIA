import { NextResponse } from 'next/server';

import { buildMetaConnectUrl } from '@/services/integrations/meta';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const workspace = searchParams.get('workspace') ?? 'demo';
  const module = searchParams.get('module') ?? 'posts';
  const state = `${workspace}:${module}`;
  const connectUrl = buildMetaConnectUrl(state, url.origin);

  if (!connectUrl) {
    return NextResponse.redirect(new URL(`/${workspace}/${module}?instagram=missing-config`, request.url));
  }

  return NextResponse.redirect(connectUrl);
}
