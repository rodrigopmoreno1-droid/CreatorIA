import 'server-only';

type ApifyDatasetItem = Record<string, unknown>;

export type ApifyInstagramCapture = {
  profile: ApifyDatasetItem | null;
  posts: ApifyDatasetItem[];
  reels: ApifyDatasetItem[];
  notes: string[];
  used: boolean;
};

const APIFY_ACTORS = {
  profile: 'apify/instagram-profile-scraper',
  posts: 'apify/instagram-scraper',
  reels: 'apify/instagram-reel-scraper'
} as const;

function getApifyToken() {
  return process.env.APIFY_API_TOKEN?.trim() ?? '';
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

export async function fetchApifyInstagramCapture(handle: string): Promise<ApifyInstagramCapture | null> {
  const normalizedHandle = handle.replace(/^@/, '').trim().toLowerCase();
  const token = getApifyToken();

  if (!normalizedHandle || !token) {
    return null;
  }

  const profileUrl = `https://www.instagram.com/${normalizedHandle}/`;

  const [profileResult, postsResult, reelsResult] = await Promise.allSettled([
    runActorDatasetItems(APIFY_ACTORS.profile, { usernames: [normalizedHandle] }, 1),
    runActorDatasetItems(APIFY_ACTORS.posts, { directUrls: [profileUrl], resultsType: 'posts', resultsLimit: 30 }, 30),
    runActorDatasetItems(APIFY_ACTORS.reels, { username: [normalizedHandle], resultsLimit: 20 }, 20)
  ]);

  const notes: string[] = [];

  const profileItems = profileResult.status === 'fulfilled' ? profileResult.value : [];
  if (profileResult.status === 'rejected') {
    notes.push(`Instagram Profile Scraper: ${profileResult.reason instanceof Error ? profileResult.reason.message : 'falha na captura.'}`);
  }

  const postItems = postsResult.status === 'fulfilled' ? postsResult.value : [];
  if (postsResult.status === 'rejected') {
    notes.push(`Instagram Scraper: ${postsResult.reason instanceof Error ? postsResult.reason.message : 'falha na captura.'}`);
  }

  const reelItems = reelsResult.status === 'fulfilled' ? reelsResult.value : [];
  if (reelsResult.status === 'rejected') {
    notes.push(`Instagram Reel Scraper: ${reelsResult.reason instanceof Error ? reelsResult.reason.message : 'falha na captura.'}`);
  }

  const profile = profileItems[0] ?? null;

  if (!profile && !postItems.length && !reelItems.length) {
    return null;
  }

  return {
    profile,
    posts: postItems,
    reels: reelItems,
    notes: notes.length ? notes : ['Captura realizada com Apify.'],
    used: true
  };
}
