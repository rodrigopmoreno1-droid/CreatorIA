function normalizeUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;

  return withProtocol.replace(/\/+$/, '');
}

export function getSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);

    if (!normalized) {
      continue;
    }

    if (process.env.NODE_ENV === 'production' && normalized.includes('localhost')) {
      continue;
    }

    return normalized;
  }

  return process.env.NODE_ENV === 'production' ? 'https://creator-ia.vercel.app' : 'http://localhost:3000';
}
