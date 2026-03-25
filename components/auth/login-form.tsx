"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/constants';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const schema = z.object({
  email: z.string().email('Digite um e-mail válido'),
  password: z.string().min(6, 'Digite sua senha')
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    }
  });

  async function handleDemoAccess() {
    setLoadingDemo(true);
    try {
      document.cookie = 'contentos-demo=1; path=/; max-age=2592000; samesite=lax';
      router.push('/demo/dashboard');
    } finally {
      setLoadingDemo(false);
    }
  }

  const onSubmit = async (values: FormValues) => {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      toast.error('Credenciais do Supabase ausentes. Entre em modo demo.')
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    document.cookie = 'contentos-demo=1; path=/; max-age=2592000; samesite=lax';
    toast.success('Login realizado com sucesso');
    router.push('/demo/dashboard');
  };

  return (
    <Card className="glass border-white/60 shadow-glow">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Conta demo pronta
        </div>
        <CardTitle>Acesse o ContentOS</CardTitle>
        <CardDescription>Use sua conta Supabase ou entre imediatamente com a demo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="text-sm font-medium">E-mail</label>
            <Input {...register('email')} autoComplete="email" placeholder="seu@email.com" />
            {errors.email ? <p className="text-sm text-rose-600">{errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <Input {...register('password')} type="password" autoComplete="current-password" placeholder="••••••••" />
            {errors.password ? <p className="text-sm text-rose-600">{errors.password.message}</p> : null}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar
          </Button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="w-full" onClick={handleDemoAccess} disabled={loadingDemo}>
            {loadingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Entrar como demo
          </Button>
          <div className="rounded-2xl border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Credenciais demo</p>
            <p className="mt-1 break-words">Email: {DEMO_EMAIL}</p>
            <p className="break-words">Senha: {DEMO_PASSWORD}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
