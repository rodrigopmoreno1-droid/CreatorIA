import { randomUUID } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  PRODUCT_IMPORT_ALLOWED_MIME_TYPES,
  PRODUCT_IMPORT_BUCKET,
  PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES,
  sanitizeStorageFileName
} from '@/lib/product-import-storage';

type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export async function ensureProductImportBucket(admin: SupabaseAdminClient) {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  if (buckets.some((bucket) => bucket.name === PRODUCT_IMPORT_BUCKET)) {
    return;
  }

  const { error } = await admin.storage.createBucket(PRODUCT_IMPORT_BUCKET, {
    public: false,
    fileSizeLimit: PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: PRODUCT_IMPORT_ALLOWED_MIME_TYPES
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function buildProductImportStoragePath(companyId: string, fileName: string) {
  return `companies/${companyId}/product-imports/${Date.now()}-${randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export async function createProductImportUploadToken(input: {
  admin: SupabaseAdminClient;
  companyId: string;
  fileName: string;
}) {
  await ensureProductImportBucket(input.admin);

  const path = buildProductImportStoragePath(input.companyId, input.fileName);
  const { data, error } = await input.admin.storage.from(PRODUCT_IMPORT_BUCKET).createSignedUploadUrl(path, {
    upsert: true
  });

  if (error || !data) {
    throw new Error(error?.message ?? 'Nao foi possivel preparar o upload do arquivo.');
  }

  return {
    bucket: PRODUCT_IMPORT_BUCKET,
    path: data.path,
    token: data.token
  };
}
