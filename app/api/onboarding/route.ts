import { NextResponse } from 'next/server';

import { createWorkspaceForUser, getCurrentWorkspaceContext } from '@/lib/workspace-server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponivel.' }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Sessao nao encontrada.' }, { status: 401 });
  }

  const existingWorkspace = await getCurrentWorkspaceContext();

  if (existingWorkspace) {
    return NextResponse.json({ workspace: existingWorkspace });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        fullName?: string;
        companyName?: string;
        email?: string;
      }
    | null;

  const fullName =
    body?.fullName?.trim() || user.user_metadata?.full_name?.trim() || user.email?.split('@')[0] || 'Novo usuario';
  const companyName = body?.companyName?.trim() || user.user_metadata?.company_name?.trim();
  const email = user.email ?? body?.email?.trim();

  if (!companyName || !email) {
    return NextResponse.json({ error: 'Nome da empresa e e-mail sao obrigatorios.' }, { status: 400 });
  }

  try {
    const workspace = await createWorkspaceForUser({
      userId: user.id,
      fullName,
      email,
      companyName
    });

    return NextResponse.json({ workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel concluir a configuracao.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
