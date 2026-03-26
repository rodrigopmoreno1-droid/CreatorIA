"use client";

import { useMemo, useRef, useState } from 'react';
import { AudioLines, FileUp, Loader2, Mic, PencilLine, Plus, Square, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageIntro } from '@/components/platform/page-intro';
import { useSpeechCapture } from '@/hooks/use-speech-capture';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES } from '@/lib/product-import-storage';
import type { ProductDraft, ProductItem } from '@/types/platform';

type ProductFormState = ProductDraft & {
  id?: string;
};

type ImportedProductDraft = ProductFormState & {
  id: string;
};

type ImportFileReference = {
  bucket: string;
  storagePath: string;
  mimeType: string;
  name: string;
  sizeBytes: number;
  text?: string;
  pageTexts?: string[];
};

const emptyForm: ProductFormState = {
  name: '',
  benefits: '',
  audience: '',
  price: '',
  discountPrice: '',
  restrictions: '',
  pain: '',
  benefit: ''
};

function createDraftFromProduct(product: ProductItem): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    benefits: product.benefits,
    audience: product.audience,
    price: product.price,
    discountPrice: product.discountPrice,
    restrictions: product.restrictions,
    pain: product.pain,
    benefit: product.benefit
  };
}

function normalizeImportedProducts(payload: unknown): ImportedProductDraft[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const raw = payload as { products?: unknown };
  if (!Array.isArray(raw.products)) {
    return [];
  }

  return raw.products
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const rawItem = item as Record<string, unknown>;

      const name = typeof rawItem.name === 'string' ? rawItem.name.trim() : '';

      // Skip products without a real name or with generic fallback names
      if (!name || /^Produto\s+\d+$/i.test(name)) {
        return null;
      }

      return {
        id: `imported-${Date.now()}-${index}`,
        name,
        benefits: typeof rawItem.benefits === 'string' ? rawItem.benefits : '',
        audience: typeof rawItem.audience === 'string' ? rawItem.audience : '',
        price: typeof rawItem.price === 'string' || typeof rawItem.price === 'number' ? String(rawItem.price) : '',
        discountPrice:
          typeof rawItem.discountPrice === 'string' || typeof rawItem.discountPrice === 'number'
            ? String(rawItem.discountPrice)
            : '',
        restrictions: typeof rawItem.restrictions === 'string' ? rawItem.restrictions : '',
        pain: typeof rawItem.pain === 'string' ? rawItem.pain : '',
        benefit: typeof rawItem.benefit === 'string' ? rawItem.benefit : ''
      };
    })
    .filter((item): item is ImportedProductDraft => Boolean(item));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.0', '')} MB`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractBrowserImportText(file: File) {
  const mimeType = file.type || 'application/octet-stream';

  if (mimeType === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdfjs = (await import('pdfjs-dist/webpack.mjs')) as typeof import('pdfjs-dist/webpack.mjs');
    const { getDocument } = pdfjs;
    const buffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    const pageTexts: string[] = [];

    try {
      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const content = await page.getTextContent();
        const text = (content.items as Array<{ str?: string } | { [key: string]: unknown }>)
          .map((item) => (typeof item === 'object' && item && 'str' in item ? String(item.str ?? '') : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text) {
          pageTexts.push(text);
        }
      }
    } finally {
      await pdf.destroy().catch(() => null);
    }

    if (pageTexts.length) {
      return {
        text: pageTexts.join('\n\n'),
        pageTexts
      };
    }
  }

  if (
    mimeType.startsWith('text/') ||
    ['application/json', 'application/xml', 'text/csv', 'text/tsv'].includes(mimeType)
  ) {
    const text = (await file.text()).trim();

    if (text) {
      return {
        text,
        pageTexts: text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
      };
    }
  }

  return null;
}

function isRetryableImportAnalysisError(message: string) {
  return /nao foi possivel analisar a importacao|nao foi possivel acessar o arquivo importado|failed to fetch|network|tempo esgotado/i.test(
    message
  );
}

function ProductRowEditor({
  product,
  onChange,
  onRemove
}: {
  product: ImportedProductDraft;
  onChange: (next: ImportedProductDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <Input
          value={product.name}
          onChange={(event) => onChange({ ...product, name: event.target.value })}
          className="h-9 rounded-xl"
          placeholder="Nome"
        />
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition hover:bg-muted"
          aria-label="Remover item importado"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={product.price}
          onChange={(event) => onChange({ ...product, price: event.target.value })}
          className="h-9 rounded-xl"
          placeholder="Preco"
        />
        <Input
          value={product.discountPrice}
          onChange={(event) => onChange({ ...product, discountPrice: event.target.value })}
          className="h-9 rounded-xl"
          placeholder="Preco de desconto"
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={product.audience}
          onChange={(event) => onChange({ ...product, audience: event.target.value })}
          className="h-9 rounded-xl"
          placeholder="Publico"
        />
        <Input
          value={product.restrictions}
          onChange={(event) => onChange({ ...product, restrictions: event.target.value })}
          className="h-9 rounded-xl"
          placeholder="Restricoes"
        />
      </div>

      <Textarea
        value={product.benefits}
        onChange={(event) => onChange({ ...product, benefits: event.target.value })}
        className="mt-3 min-h-[76px] rounded-[16px]"
        placeholder="Beneficios"
      />
    </div>
  );
}

export function ProductsWorkspace({ workspace, initialProducts }: { workspace: string; initialProducts: ProductItem[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importSource, setImportSource] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importDrafts, setImportDrafts] = useState<ImportedProductDraft[]>([]);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [importFileRef, setImportFileRef] = useState<ImportFileReference | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importRunRef = useRef(0);

  const voiceCapture = useSpeechCapture({
    onTranscript: async (text) => {
      let refinedText = text;

      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            action: 'rewriteHumanTone',
            payload: {
              text
            }
          })
        });

        const payload = (await response.json().catch(() => null)) as { content?: unknown; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Nao foi possivel refinar a transcricao.');
        }

        if (typeof payload?.content === 'string' && payload.content.trim()) {
          refinedText = payload.content;
        }
      } catch {
        // Continua com a transcricao original se o refinamento falhar.
      }

      setImportSource(refinedText);
      setImportDrafts([]);
      toast.success('Transcrição pronta. Analisando o catálogo...');
      void handleImportAnalysis(refinedText, importFileRef);
    }
  });

  const canImport = useMemo(() => Boolean(importSource.trim() || importFileRef), [importFileRef, importSource]);
  const importTimeEstimate = useMemo(() => {
    if (analysisBusy) {
      return 'Análise em andamento. Esse catálogo pode levar até 2 minutos.';
    }

    if (voiceCapture.isProcessing) {
      return 'A transcrição pode levar até 1 minuto antes da análise começar.';
    }

    const sizeBytes = importFileRef?.sizeBytes ?? 0;

    if (!sizeBytes && importSource.trim()) {
      return 'A análise desse texto costuma levar de 30 segundos a 1 minuto.';
    }

    if (sizeBytes < 2 * 1024 * 1024) {
      return 'Esse arquivo costuma analisar em até 30 segundos.';
    }

    if (sizeBytes < 8 * 1024 * 1024) {
      return 'Esse arquivo costuma analisar em até 1 minuto.';
    }

    return 'Esse arquivo pode levar até 2 minutos para analisar.';
  }, [analysisBusy, importFileRef?.sizeBytes, importSource, voiceCapture.isProcessing]);

  async function clearImportedFile(fileRef: ImportFileReference | null) {
    if (!fileRef) {
      return;
    }

    try {
      const response = await fetch(`/api/workspaces/${workspace}/products/import-upload`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          bucket: fileRef.bucket,
          storagePath: fileRef.storagePath
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Nao foi possivel remover o arquivo importado.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel remover o arquivo importado.';
      toast.error(message);
      throw error;
    }
  }

  async function resetImportFlow(options?: { keepSource?: boolean; keepDrafts?: boolean; clearFile?: boolean }) {
    const fileRef = options?.clearFile === false ? null : importFileRef;

    if (fileRef) {
      try {
        await clearImportedFile(fileRef);
      } catch {
        // The helper already surfaced the error. Continue resetting the UI so the user can retry cleanly.
      }
    }

    if (!options?.keepSource) {
      setImportSource('');
    }

    if (!options?.keepDrafts) {
      setImportDrafts([]);
    }

    setImportFileRef(null);
    setImportFileName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function runImportAnalysis(input?: { sourceText?: string; fileRef?: ImportFileReference | null }) {
    const sourceText = input?.sourceText ?? importSource.trim();
    const fileRef = input?.fileRef ?? importFileRef;

    if (!sourceText && !fileRef) {
      toast.error('Adicione um arquivo, uma transcricao ou uma descricao antes de analisar.');
      return;
    }

    const runId = importRunRef.current + 1;
    importRunRef.current = runId;
    setAnalysisBusy(true);

    try {
      let nextDrafts: ImportedProductDraft[] = [];
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            action: 'extractProducts',
            payload: {
              prompt: sourceText,
              sourceText,
              file: fileRef
            }
          })
        });

        const payload = (await response.json().catch(() => null)) as { content?: unknown; error?: string } | null;

        if (!response.ok) {
          lastError = new Error(payload?.error ?? 'Nao foi possivel analisar a importacao.');

          if (attempt === 0 && isRetryableImportAnalysisError(lastError.message)) {
            await sleep(700);
            continue;
          }

          throw lastError;
        }

        const content = payload?.content as { products?: unknown; _error?: string; _stage?: string } | undefined;

        // Surface extraction-stage errors from the backend
        if (content?._error && (!Array.isArray(content.products) || !content.products.length)) {
          throw new Error(content._error);
        }

        nextDrafts = normalizeImportedProducts(content);
        lastError = null;
        break;
      }

      if (!nextDrafts.length) {
        throw new Error('Nenhum produto identificado no conteudo enviado. Verifique se o arquivo contem nomes de produtos, precos ou descricoes claras.');
      }

      if (importRunRef.current === runId) {
        setImportDrafts(nextDrafts);
      }

      toast.success(`${nextDrafts.length} produtos prontos para revisao.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel analisar a importacao.';
      toast.error(message);
    } finally {
      if (importRunRef.current === runId) {
        setAnalysisBusy(false);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('Digite o nome do produto.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = form.id ? `/api/workspaces/${workspace}/products/${form.id}` : `/api/workspaces/${workspace}/products`;
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
        form.id ? current.map((item) => (item.id === payload.product!.id ? payload.product! : item)) : [payload.product!, ...current]
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

  async function handleImportAnalysis(sourceTextOverride?: string, fileRefOverride?: ImportFileReference | null) {
    const nextSourceText = sourceTextOverride ?? importSource.trim();
    const nextFileRef = fileRefOverride ?? importFileRef;

    if (!nextSourceText && !nextFileRef) {
      toast.error('Adicione um arquivo, uma transcricao ou uma descricao antes de analisar.');
      return;
    }

    await runImportAnalysis({
      sourceText: nextSourceText,
      fileRef: nextFileRef
    });
  }

  async function importProducts() {
    if (!importDrafts.length) {
      return;
    }

    setImportBusy(true);
    const fileRef = importFileRef;

    try {
      const response = await fetch(`/api/workspaces/${workspace}/products`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          products: importDrafts
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { products?: ProductItem[]; error?: string }
        | { product?: ProductItem; error?: string }
        | null;

      if (!response.ok || !payload) {
        throw new Error((payload as { error?: string } | null)?.error ?? 'Nao foi possivel importar os produtos.');
      }

      const nextProducts = 'products' in payload && Array.isArray(payload.products) ? payload.products : 'product' in payload && payload.product ? [payload.product] : [];

      if (!nextProducts.length) {
        throw new Error('Nenhum produto foi criado.');
      }

      setProducts((current) => [...nextProducts, ...current]);
      setImportDrafts([]);
      try {
        await clearImportedFile(fileRef);
      } catch {
        toast.warning('Os produtos foram importados, mas o arquivo temporario nao pôde ser removido.');
      }

      setImportSource('');
      setImportFileRef(null);
      setImportFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success(`${nextProducts.length} produtos importados.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel importar os produtos.';
      toast.error(message);
    } finally {
      setImportBusy(false);
    }
  }

  async function handleFileChange(file: File | null) {
    if (!file) {
      return;
    }

    if (file.size > PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES) {
      toast.error(`O arquivo precisa ter no maximo ${Math.round(PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`);
      return;
    }

    const previousFileRef = importFileRef;
    setUploadBusy(true);

    try {
      const extracted = await extractBrowserImportText(file).catch(() => null);
      const response = await fetch(`/api/workspaces/${workspace}/products/import-upload`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            upload?: {
              bucket?: string;
              path?: string;
              token?: string;
            };
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.upload?.bucket || !payload.upload.path || !payload.upload.token) {
        throw new Error(payload?.error ?? 'Nao foi possivel preparar o upload do arquivo.');
      }

      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        throw new Error('Supabase nao configurado para upload de arquivos.');
      }

      const { error: uploadError } = await supabase.storage
        .from(payload.upload.bucket)
        .uploadToSignedUrl(payload.upload.path, payload.upload.token, file, {
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setImportFileRef({
        bucket: payload.upload.bucket,
        storagePath: payload.upload.path,
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
        sizeBytes: file.size,
        text: extracted?.text,
        pageTexts: extracted?.pageTexts
      });
      setImportFileName(file.name);
      setImportDrafts([]);

      if (previousFileRef?.storagePath && previousFileRef.storagePath !== payload.upload.path) {
        void clearImportedFile(previousFileRef).catch(() => null);
      }

      toast.success(`Arquivo pronto para analise (${formatFileSize(file.size)}).`);
      await handleImportAnalysis(importSource.trim(), {
        bucket: payload.upload.bucket,
        storagePath: payload.upload.path,
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
        sizeBytes: file.size,
        text: extracted?.text,
        pageTexts: extracted?.pageTexts
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel ler o arquivo.';
      toast.error(message);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

    setUploadBusy(false);
  }

  return (
    <div className="space-y-4">
      <PageIntro eyebrow="Produtos" title="Base que alimenta roteiro e operacao" />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[28px] border-border/90 bg-white/95">
          <CardContent className="p-5 lg:p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preco</label>
                  <Input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preco de desconto</label>
                  <Input
                    value={form.discountPrice}
                    onChange={(event) => setForm((current) => ({ ...current, discountPrice: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Beneficios</label>
                  <Textarea
                    value={form.benefits}
                    onChange={(event) => setForm((current) => ({ ...current, benefits: event.target.value }))}
                    className="min-h-[112px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Publico</label>
                  <Textarea
                    value={form.audience}
                    onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                    className="min-h-[112px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Restricoes</label>
                <Textarea
                  value={form.restrictions}
                  onChange={(event) => setForm((current) => ({ ...current, restrictions: event.target.value }))}
                  className="min-h-[88px]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dor principal</label>
                  <Input
                    value={form.pain}
                    onChange={(event) => setForm((current) => ({ ...current, pain: event.target.value }))}
                    placeholder="Ex: nao consegue emagrecer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Benefício principal</label>
                  <Input
                    value={form.benefit}
                    onChange={(event) => setForm((current) => ({ ...current, benefit: event.target.value }))}
                    placeholder="Ex: perde gordura sem cortar carboidrato"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {form.id ? 'Atualizar' : 'Salvar'}
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
                <p className="text-sm font-semibold text-foreground">Importar em lote</p>
              </div>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {importDrafts.length ? `${importDrafts.length} em revisao` : 'Importacao limpa'}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="justify-start"
                disabled={uploadBusy || analysisBusy || importBusy}
              >
                {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                {uploadBusy ? 'Enviando...' : 'Arquivo'}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={voiceCapture.isRecording ? voiceCapture.stop : voiceCapture.start}
                className="justify-start"
                disabled={!voiceCapture.isSupported || voiceCapture.isProcessing || analysisBusy || importBusy}
              >
                {voiceCapture.isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {voiceCapture.isRecording ? 'Parar' : 'Voz'}
              </Button>
              <Button type="button" onClick={() => void handleImportAnalysis()} disabled={analysisBusy || importBusy || uploadBusy || !canImport}>
                {analysisBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
                {analysisBusy ? 'Analisando...' : 'Analisar'}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />

            {voiceCapture.error ? (
              <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                {voiceCapture.error}
              </div>
            ) : null}

            <p className="text-[12px] leading-5 text-muted-foreground">
              Arquivos de imagem e PDF sobem direto para o Storage com suporte para ate{' '}
              {Math.round(PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB e sao removidos logo depois que os produtos sao importados.
            </p>

            <p className="text-[12px] leading-5 text-muted-foreground">{importTimeEstimate}</p>

            <div className="space-y-2">
              <label className="text-sm font-medium">O que o arquivo ou a voz traz</label>
              <Textarea
                value={importSource}
                onChange={(event) => setImportSource(event.target.value)}
                className="min-h-[130px]"
                placeholder="Cole uma lista, descreva os produtos ou fale por até 2 minutos."
              />
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                {importFileName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    <span>{importFileName}</span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={() => {
                        void resetImportFlow({ keepSource: true, keepDrafts: false });
                      }}
                      aria-label="Remover arquivo importado"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {importFileRef ? (
                  <span className="rounded-full border border-border px-2.5 py-1">{formatFileSize(importFileRef.sizeBytes)}</span>
                ) : null}
                {analysisBusy ? <span className="rounded-full border border-border px-2.5 py-1">analisando...</span> : null}
                {importBusy ? <span className="rounded-full border border-border px-2.5 py-1">importando...</span> : null}
                {voiceCapture.isRecording ? <span className="rounded-full border border-border px-2.5 py-1">gravando...</span> : null}
                {voiceCapture.isProcessing ? <span className="rounded-full border border-border px-2.5 py-1">transcrevendo...</span> : null}
              </div>
            </div>

            {importDrafts.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Revisao</p>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      void resetImportFlow({ keepSource: false, keepDrafts: false });
                    }}
                    disabled={analysisBusy || importBusy}
                  >
                    Limpar
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {importDrafts.map((draft) => (
                    <ProductRowEditor
                      key={draft.id}
                      product={draft}
                      onChange={(next) => setImportDrafts((current) => current.map((item) => (item.id === draft.id ? next : item)))}
                      onRemove={() => setImportDrafts((current) => current.filter((item) => item.id !== draft.id))}
                    />
                  ))}
                </div>
                <Button type="button" onClick={importProducts} disabled={importBusy || analysisBusy}>
                  {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Importar tudo
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/90 bg-white/95">
        <CardContent className="space-y-4 p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Produtos cadastrados</p>
            </div>
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {products.length} itens
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {products.length ? (
              products.map((product) => (
                <div key={product.id} className="rounded-[22px] border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1.5 text-[12px] text-muted-foreground">
                        {product.price || '—'} {product.discountPrice ? `· ${product.discountPrice}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setForm(createDraftFromProduct(product))}
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
                    <div className="mt-3 rounded-[16px] border border-border bg-white px-3 py-2 text-[13px] leading-6 text-muted-foreground">
                      {product.benefits}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-border bg-muted/20 p-4 text-[13px] leading-6 text-muted-foreground">
                Nenhum produto cadastrado ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
