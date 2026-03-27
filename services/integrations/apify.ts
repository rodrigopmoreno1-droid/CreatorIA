type ApifyDatasetItem = Record<string, unknown>;

export type ApifyInstagramCapture = {
  profile: ApifyDatasetItem | null;
  posts: ApifyDatasetItem[];
  reels: ApifyDatasetItem[];
  notes: string[];
  used: boolean;
};

const APIFY_ACTORS = {
  profile: 'apify~instagram-profile-scraper',
  posts: 'apify~instagram-post-scraper',
  postsFallback: 'apify~instagram-scraper',
  reels: 'apify~instagram-reel-scraper'
} as const;

function getApifyToken() {
  return process.env.APIFY_API_TOKEN?.trim() ?? '';
}

function getApifyUserId() {
  return process.env.APIFY_USER_ID?.trim() ?? '';
}

function asArray(value: unknown) {
  return Array.isArray(value) ? (value as ApifyDatasetItem[]) : [];
}

async function runActorDatasetItems(actorId: string, input: Record<string, unknown>, maxItems: number) {
  const token = getApifyToken();

  if (!token) {
    return [];
  }

  const url = new URL(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`);
  url.searchParams.set('token', token);
  url.searchParams.set('format', 'json');
  url.searchParams.set('clean', 'true');
  url.searchParams.set('maxItems', String(maxItems));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(input),
    cache: 'no-store'
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Apify actor ${actorId} failed with status ${response.status}.`);
  }

  const payload = await response.json().catch(() => null);

  if (Array.isArray(payload)) {
    return payload as ApifyDatasetItem[];
  }

  if (payload && typeof payload === 'object') {
    const itemArrays = [asArray((payload as { items?: unknown }).items), asArray((payload as { data?: unknown }).data)];
    const items = itemArrays.find((item) => item.length > 0);
    if (items) {
      return items;
    }
  }

  return [];
}

async function fetchApifyInstagramProfileCapture(handle: string, notes: string[]): Promise<ApifyInstagramCapture | null> {
  const normalizedHandle = handle.replace(/^@/, '').trim().toLowerCase();
  const token = getApifyToken();

  if (!normalizedHandle || !token) {
    return null;
  }

  const [profileResult] = await Promise.allSettled([
    runActorDatasetItems(APIFY_ACTORS.profile, { usernames: [normalizedHandle], maxPosts: 8 }, 1),
  ]);

  const profileItems = profileResult.status === 'fulfilled' ? profileResult.value : [];
  if (profileResult.status === 'rejected') {
    notes.push(`Instagram Profile Scraper: ${profileResult.reason instanceof Error ? profileResult.reason.message : 'falha na captura.'}`);
  }

  const profile = profileItems[0] ?? null;

  if (!profile) {
    return null;
  }

  return {
    profile,
    posts: Array.isArray(profile.posts) ? profile.posts : [],
    reels: [],
    notes: [
      getApifyUserId() ? `Apify user configurado: ${getApifyUserId()}.` : 'Apify user nao configurado.',
      'Instagram Profile Scraper usado para captura leve.',
      ...(notes.length ? notes : ['Captura realizada com Apify.'])
    ],
    used: true
  };
}

export async function fetchApifyInstagramCapture(
  handle: string,
  options?: { deep?: boolean }
): Promise<ApifyInstagramCapture | null> {
  const normalizedHandle = handle.replace(/^@/, '').trim().toLowerCase();
  const token = getApifyToken();

  if (!normalizedHandle || !token) {
    return null;
  }

  const profileUrl = `https://www.instagram.com/${normalizedHandle}/`;
  const notes: string[] = [];

  const profileCapture = await fetchApifyInstagramProfileCapture(normalizedHandle, notes);

  if (!options?.deep) {
    return profileCapture;
  }

  const [postResult, reelResult] = await Promise.allSettled([
    runActorDatasetItems(
      APIFY_ACTORS.posts,
      { username: [normalizedHandle, profileUrl], resultsLimit: 15, dataDetailLevel: 'basicData' },
      15
    ),
    runActorDatasetItems(
      APIFY_ACTORS.reels,
      { username: [normalizedHandle], resultsLimit: 6, skipPinnedPosts: true },
      6
    )
  ]);

  let postItems = postResult.status === 'fulfilled' ? postResult.value : [];
  if (postResult.status === 'rejected') {
    notes.push(`Instagram Post Scraper: ${postResult.reason instanceof Error ? postResult.reason.message : 'falha na captura.'}`);
  }

  let reelItems = reelResult.status === 'fulfilled' ? reelResult.value : [];
  if (reelResult.status === 'rejected') {
    notes.push(`Instagram Reel Scraper: ${reelResult.reason instanceof Error ? reelResult.reason.message : 'falha na captura.'}`);
  }

  const needFallbackPosts = postItems.length < 3 && profileCapture?.profile;
  if (needFallbackPosts) {
    const fallbackPosts = await runActorDatasetItems(
      APIFY_ACTORS.postsFallback,
      { directUrls: [profileUrl], resultsType: 'posts', resultsLimit: 12 },
      12
    ).catch((error: unknown) => {
      notes.push(`Instagram Scraper: ${error instanceof Error ? error.message : 'falha na captura.'}`);
      return [];
    });

    if (fallbackPosts.length > postItems.length) {
      postItems = fallbackPosts;
    }
  }

  const profile = profileCapture?.profile ?? null;
  const mergedPosts = [...(profileCapture?.posts ?? []), ...postItems, ...reelItems].filter(Boolean);

  if (!profile && !postItems.length && !reelItems.length) {
    return null;
  }

  return {
    profile,
    posts: postItems.length ? postItems : profileCapture?.posts ?? [],
    reels: reelItems,
    notes: [
      getApifyUserId() ? `Apify user configurado: ${getApifyUserId()}.` : 'Apify user nao configurado.',
      'Instagram Profile Scraper, Instagram Post Scraper e Instagram Reel Scraper foram usados na captura completa.',
      ...(notes.length ? notes : ['Captura realizada com Apify.']),
      mergedPosts.length ? `Total bruto de registros combinados: ${mergedPosts.length}.` : 'Captura completa sem registros combinados.'
    ],
    used: true
  };
}
