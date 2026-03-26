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

export async function PATCH(request: Request, { params }: { params: Promise<{ workspace: string; productId: string }> }) {
  const { workspace, productId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as ProductPayload | null;
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'Nome do produto e obrigatorio.' }, { status: 400 });
  }

  const { admin, context } = access;
  const current = await admin
    .from('products')
    .select('metadata')
    .eq('company_id', context.companyId)
    .eq('id', productId)
    .single();

  const currentMetadata =
    current.data && typeof current.data.metadata === 'object' && current.data.metadata
      ? (current.data.metadata as Record<string, unknown>)
      : {};

  const nextMetadata = {
    ...currentMetadata,
    discountPrice: body?.discountPrice?.trim() ?? '',
    pain: body?.pain?.trim() ?? '',
    benefit: body?.benefit?.trim() ?? ''
  };

  const { data, error } = await admin
    .from('products')
    .update({
      name,
      benefits: body?.benefits?.trim() || null,
      audience: body?.audience?.trim() || null,
      price: toNumericPrice(body?.price),
      restrictions: body?.restrictions?.trim() || null,
      metadata: nextMetadata
    })
    .eq('company_id', context.companyId)
    .eq('id', productId)
    .select('id,name,benefits,audience,price,restrictions,metadata,created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Nao foi possivel atualizar o produto.' }, { status: 500 });
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ workspace: string; productId: string }> }) {
  const { workspace, productId } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const { admin, context } = access;
  const { error } = await admin
    .from('products')
    .delete()
    .eq('company_id', context.companyId)
    .eq('id', productId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
