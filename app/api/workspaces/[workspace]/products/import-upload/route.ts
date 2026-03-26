import { NextResponse } from 'next/server';

import { PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES } from '@/lib/product-import-storage';
import { createProductImportUploadToken, deleteProductImportFile } from '@/lib/supabase/storage';
import { resolveWorkspaceDataAccess } from '@/lib/platform-data';

type UploadPayload = {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

function isAllowedProductImportMimeType(mimeType: string) {
  return (
    mimeType.startsWith('image/') ||
    [
      'application/pdf',
      'text/plain',
      'text/csv',
      'text/tsv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ].includes(mimeType)
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as UploadPayload | null;
  const fileName = body?.fileName?.trim();
  const mimeType = body?.mimeType?.trim() || 'application/octet-stream';
  const sizeBytes = Number(body?.sizeBytes ?? 0);

  if (!fileName) {
    return NextResponse.json({ error: 'Nome do arquivo obrigatorio.' }, { status: 400 });
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: 'Tamanho do arquivo invalido.' }, { status: 400 });
  }

  if (sizeBytes > PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `O arquivo precisa ter no maximo ${Math.round(PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`
      },
      { status: 400 }
    );
  }

  if (!isAllowedProductImportMimeType(mimeType)) {
    return NextResponse.json({ error: 'Formato de arquivo nao suportado para importacao.' }, { status: 400 });
  }

  try {
    const upload = await createProductImportUploadToken({
      admin: access.admin,
      companyId: access.context.companyId,
      fileName
    });

    return NextResponse.json({
      upload,
      maxFileSizeBytes: PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel preparar o upload do arquivo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type DeletePayload = {
  bucket?: string;
  storagePath?: string;
};

export async function DELETE(request: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const access = await resolveWorkspaceDataAccess(workspace);

  if (!access) {
    return NextResponse.json({ error: 'Workspace nao encontrado.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as DeletePayload | null;
  const storagePath = body?.storagePath?.trim();

  if (!storagePath) {
    return NextResponse.json({ error: 'Caminho do arquivo obrigatorio.' }, { status: 400 });
  }

  try {
    await deleteProductImportFile({
      admin: access.admin,
      companyId: access.context.companyId,
      storagePath,
      bucket: body?.bucket?.trim() || undefined
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel remover o arquivo importado.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
