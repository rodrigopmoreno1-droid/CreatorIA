"use client";

import { useState } from 'react';
import { Loader2, PencilLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import type { ProductItem } from '@/types/platform';

type ProductFormState = {
  id?: string;
  name: string;
  benefits: string;
  audience: string;
  price: string;
  restrictions: string;
};

const emptyForm: ProductFormState = {
  name: '',
  benefits: '',
  audience: '',
  price: '',
  restrictions: ''
};

export function ProductsWorkspace({
  workspace,
  initialProducts
}: {
  workspace: string;
  initialProducts: ProductItem[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('Digite o nome do produto.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = form.id
        ? `/api/workspaces/${workspace}/products/${form.id}`
        : `/api/workspaces/${workspace}/products`;
      const method = form.id ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const payload = (await response.json().catch(() => null)) as { product?: ProductItem; error?: string } | null;

      if (!response.ok || !payload?.product) {
        throw new Error(payload?.error ?? 'Nao foi possivel salvar o produto.');
      }

      setProducts((current) =>
        form.id
          ? current.map((item) => (item.id === payload.product!.id ? payload.product! : item))
          : [payload.product!, ...current]
      );
      setForm(emptyForm);
      toast.success(form.id ? 'Produto atualizado.' : 'Produto criado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o produto.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function removeProduct(productId: string) {
    setBusyId(productId);

    try {
      const response = await fetch(`/api/workspaces/${workspace}/products/${productId}`, {
        method: 'DELETE'
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel remover o produto.');
      }

      setProducts((current) => current.filter((item) => item.id !== productId));
      if (form.id === productId) {
        setForm(emptyForm);
      }
      toast.success('Produto removido.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel remover o produto.';
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Produtos"
        title="Base que alimenta roteiro e operacao"
        description="Cadastre cada produto com beneficios, publico e restricoes para que a IA e o time partam sempre do mesmo contexto."
      />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[28px] border-border/90 bg-white/95">
          <CardContent className="p-5 lg:p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do produto</label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Beneficios</label>
                  <Textarea
                    value={form.benefits}
                    onChange={(event) => setForm((current) => ({ ...current, benefits: event.target.value }))}
                    className="min-h-[140px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Publico</label>
                  <Textarea
                    value={form.audience}
                    onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                    className="min-h-[140px]"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[0.42fr_0.58fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preco</label>
                  <Input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Restricoes</label>
                  <Textarea
                    value={form.restrictions}
                    onChange={(event) => setForm((current) => ({ ...current, restrictions: event.target.value }))}
                    className="min-h-[84px]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {form.id ? 'Atualizar produto' : 'Salvar produto'}
                </Button>
                <Button variant="outline" type="button" onClick={() => setForm(emptyForm)}>
                  Limpar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/90 bg-white/95">
          <CardContent className="space-y-4 p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Produtos cadastrados</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Tudo o que vai servir de contexto nas geracoes de roteiro e no restante da operacao.
                </p>
              </div>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {products.length} itens
              </span>
            </div>

            <div className="space-y-3">
              {products.length ? (
                products.map((product) => (
                  <div key={product.id} className="rounded-[24px] border border-border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                          {[product.audience, product.price].filter(Boolean).join(' · ') || 'Sem publico ou preco informado ainda.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setForm(product)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white transition hover:bg-muted"
                          aria-label="Editar produto"
                        >
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-rose-600 transition hover:bg-rose-50"
                          aria-label="Remover produto"
                        >
                          {busyId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {product.benefits ? (
                      <div className="mt-4 rounded-[18px] border border-border bg-white px-4 py-3 text-[13px] leading-6 text-muted-foreground">
                        {product.benefits}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-border bg-muted/20 p-5 text-[13px] leading-6 text-muted-foreground">
                  Nenhum produto cadastrado ainda. Comece por aqui para contextualizar a IA e os roteiros.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
