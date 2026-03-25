"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type AuthMode = 'login' | 'signup';

async function ensureWorkspace(input: {
  fullName?: string;
  companyName?: string;
  email?: string;
}) {
  const response = await fetch('/api/onboarding', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; workspace?: { workspaceSlug: string } }
    | null;

  if (!response.ok || !payload?.workspace?.workspaceSlug) {
    throw new Error(payload?.error ?? 'Nao foi possivel configurar sua empresa.');
  }

  return payload.workspace.workspaceSlug;
}

export function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      toast.error('Supabase indisponivel no momento.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Login realizado com sucesso.');
    router.push('/');
    router.refresh();
  }

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      toast.error('Supabase indisponivel no momento.');
      return;
    }

    if (!fullName.trim() || !companyName.trim()) {
      toast.error('Preencha seu nome e o nome da empresa.');
      return;
    }

    setLoading(true);
    const signUpResult = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: fullName.trim(),
          company_name: companyName.trim()
        }
      }
    });

    if (signUpResult.error) {
      setLoading(false);
      toast.error(signUpResult.error.message);
      return;
    }

    if (!signUpResult.data.session) {
      const signInResult = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword
      });

      if (signInResult.error) {
        setLoading(false);
        toast.success('Conta criada. Confira seu e-mail para concluir a verificacao.');
        return;
      }
    }

    try {
      const workspaceSlug = await ensureWorkspace({
        fullName,
        companyName,
        email: signupEmail
      });

      toast.success('Conta criada e workspace configurado.');
      router.push(`/${workspaceSlug}/dashboard`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel concluir seu cadastro.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_30px_60px_rgba(15,23,42,0.08)]">
      <CardHeader className="space-y-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Creator AI
        </div>
        <div className="space-y-1">
          <CardTitle>Acesse sua operacao de conteudo</CardTitle>
          <CardDescription>
            Entre na conta da sua empresa ou crie um workspace novo com a estrutura inicial pronta.
          </CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-[0.85rem] px-3 py-2 text-[13px] font-medium transition ${
              mode === 'login' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-[0.85rem] px-3 py-2 text-[13px] font-medium transition ${
              mode === 'signup' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Criar conta
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {mode === 'login' ? (
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <Input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="email"
                placeholder="voce@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar na plataforma
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Seu nome</label>
                <Input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  placeholder="Rodrigo Moreno"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Empresa</label>
                <Input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Creator AI Studio"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <Input
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                autoComplete="email"
                placeholder="voce@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Crie uma senha segura"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar empresa e entrar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
