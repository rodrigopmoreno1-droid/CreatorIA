export type RoleName = 'super_admin' | 'admin' | 'social_media' | 'filmmaker' | 'blogueira' | 'viewer';

export type WorkspaceSlug = string;

export type InstagramMediaItem = {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY' | 'REELS' | 'UNKNOWN';
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink?: string;
  likeCount?: number;
  commentsCount?: number;
  timestamp?: string;
};

export type InstagramStoryItem = {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'STORY' | 'REELS' | 'UNKNOWN';
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
};

export type InstagramAccountSummary = {
  id: string;
  username: string;
  pageName?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  mediaCount?: number;
};

export type InstagramConnectionSnapshot = {
  ok: boolean;
  connected: boolean;
  usingWorkspaceToken: boolean;
  provider: 'meta-graph';
  message: string;
  connectUrl?: string;
  account?: InstagramAccountSummary;
  insights: Array<{ metric: string; value: number }>;
  media: InstagramMediaItem[];
  stories: InstagramStoryItem[];
};

export type ModuleKey =
  | 'dashboard'
  | 'calendar'
  | 'ideas'
  | 'scripts'
  | 'stories'
  | 'pipeline'
  | 'library'
  | 'feed'
  | 'posts'
  | 'metrics'
  | 'competitors'
  | 'products'
  | 'creators'
  | 'ai'
  | 'billing'
  | 'admin';
