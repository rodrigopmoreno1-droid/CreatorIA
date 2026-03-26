import { NextResponse } from 'next/server';

import { resolveWorkspaceDataAccess, toProductItem } from '@/lib/platform-data';

type ProductPayload = {
  name?: string;
  benefits?: string;
  audience?: string;
  price?: string;
  discountPrice?: string;
  restrictions?: string;
  pain?: string;
  benefit?: string;
};

function toNumericPrice(value?: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function toMetadata(payload: ProductPayload) {
  return {
    discountPrice: payload.discountPrice?.trim() ?? '',
    pain: payload.pain?.trim() ?? '',
    benefit: payload.benefit?.trim() ?? ''
  };
}

function normalizePayload(payload: ProductPayload, fallbackName?: string) {
  const name = payload.name?.trim() || fallbackName?.trim() || '';

  if (!name) {
    return null;
  }

  return {
    name,
    benefits: payload.benefits?.trim() || null,
    audience: payload.audience?.trim() || null,
    price: toNumericPrice(payload.price),
    restrictions: payload.restrictions?.trim() || null,
    metadata: toMetadata(payload)
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { data, error } = await admin
    .from('products')
    .select('id,name,benefits,audience,price,restrictions,metadata,created_at')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    products: (data ?? []).map((row) =>
      toProductItem(
        row as {
          id: string;
          name: string;
          benefits: string | null;
          audience: string | null;
          price: number | string | null;
          restrictions: string | null;
          metadata: unknown;
          created_at: string;
        }
      )
    )
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | (ProductPayload & { products?: ProductPayload[] })
    | null;

  const { admin, context } = access;

  if (Array.isArray(body?.products) && body.products.length > 0) {
    const rows = body.products
      .map((item, index) => normalizePayload(item, `Produto ${index + 1}`))
      .filter((item): item is NonNullable<ReturnType<typeof normalizePayload>> => Boolean(item));

    if (!rows.length) {
      return NextResponse.json({ error: 'Nenhum produto valido foi encontrado no lote.' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('products')
      .insert(rows.map((row) => ({ company_id: context.companyId, ...row })))
      .select('id,name,benefits,audience,price,restrictions,metadata,created_at');

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Nao foi possivel criar os produtos.' }, { status: 500 });
    }

    return NextResponse.json({
      products: data.map((row) =>
        toProductItem(
          row as {
            id: string;
            name: string;
            benefits: string | null;
            audience: string | null;
            price: number | string | null;
            restrictions: string | null;
            metadata: unknown;
            created_at: string;
          }
        )
      )
    });
  }

  const normalized = normalizePayload(body ?? {});

  if (!normalized) {
    return NextResponse.json({ error: 'Nome do produto e obrigatorio.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('products')
    .insert({
      company_id: context.companyId,
      ...normalized
    })
    .select('id,name,benefits,audience,price,restrictions,metadata,created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel criar o produto.' }, { status: 500 });
  }

  return NextResponse.json({
    product: toProductItem(
      data as {
        id: string;
        name: string;
        benefits: string | null;
        audience: string | null;
        price: number | string | null;
        restrictions: string | null;
        metadata: unknown;
        created_at: string;
      }
    )
  });
}
