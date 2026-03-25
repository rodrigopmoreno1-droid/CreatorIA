export const PRODUCT_IMPORT_BUCKET = 'product-imports';
export const PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const PRODUCT_IMPORT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/*',
  'text/plain',
  'text/csv',
  'text/tsv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export function sanitizeStorageFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'arquivo';
}
