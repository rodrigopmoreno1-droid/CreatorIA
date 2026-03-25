"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function SetupForm({
  defaultFullName,
  defaultCompanyName,
  email
}: {
  defaultFullName: string;
  defaultCompanyName: string;
  email: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim() || !companyName.trim()) {
      toast.error('Preencha seu nome e o nome da empresa.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          fullName,
          companyName,
          email
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; workspace?: { workspaceSlug: string } }
        | null;

      if (!response.ok || !payload?.workspace?.workspaceSlug) {
        throw new Error(payload?.error ?? 'Nao foi possivel finalizar sua configuracao.');
      }

      toast.success('Workspace configurado com sucesso.');
      router.push(`/${payload.workspace.workspaceSlug}/dashboard`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel finalizar sua configuracao.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_30px_60px_rgba(15,23,42,0.08)]">
      <CardHeader>
        <CardTitle>Finalize sua configuracao</CardTitle>
        <CardDescription>
          Falta so confirmar os dados basicos da empresa para abrir o workspace corretamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Seu nome</label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Empresa</label>
            <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">E-mail</label>
            <Input value={email} disabled />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar no Creator AI
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
