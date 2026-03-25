import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWorkspaceForUser } from '@/lib/workspace-server';

function buildRedirectUrl(request: Request, path: string) {
  return new URL(path, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextPath = url.searchParams.get('next') || '/';
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(buildRedirectUrl(request, '/login?auth=config-error'));
  }

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        throw error;
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash
      });

      if (error) {
        throw error;
      }
    } else {
      return NextResponse.redirect(buildRedirectUrl(request, '/login?auth=missing-token'));
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(buildRedirectUrl(request, '/login?auth=no-session'));
    }

    const workspace = await ensureWorkspaceForUser(user);

    if (workspace) {
      return NextResponse.redirect(buildRedirectUrl(request, `/${workspace.workspaceSlug}/dashboard`));
    }

    return NextResponse.redirect(buildRedirectUrl(request, '/setup'));
  } catch {
    return NextResponse.redirect(buildRedirectUrl(request, `/login?auth=callback-error&next=${encodeURIComponent(nextPath)}`));
  }
}
