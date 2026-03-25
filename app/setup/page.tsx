import { redirect } from 'next/navigation';

import { SetupForm } from '@/components/auth/setup-form';
import { getAuthenticatedUser, getCurrentWorkspaceContext } from '@/lib/workspace-server';

export default async function SetupPage() {
  const user = await getAuthenticatedUser();

  if (!user?.email) {
    redirect('/login');
  }

  const workspace = await getCurrentWorkspaceContext();

  if (workspace) {
    redirect(`/${workspace.workspaceSlug}/dashboard`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#eef2f8_0%,#f6f7fb_48%,#f4f4f1_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.05),transparent_22%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="surface-shell rounded-[2rem] p-6 lg:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Creator AI</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground">
              Seu login ja foi confirmado. Agora vamos abrir sua operacao.
            </h1>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Essa etapa existe para garantir que todo usuario autenticado tenha um workspace valido e nao fique preso num loop de login.
            </p>
          </section>

          <div className="flex items-center">
            <SetupForm
              defaultFullName={user.user_metadata?.full_name?.trim() || user.email.split('@')[0] || ''}
              defaultCompanyName={user.user_metadata?.company_name?.trim() || ''}
              email={user.email}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
