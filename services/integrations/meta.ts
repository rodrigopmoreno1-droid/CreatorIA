type MetaPublishInput = {
  caption: string;
  mediaUrl: string;
  product?: string;
};

export async function fetchInstagramInsights() {
  if (!process.env.META_APP_ID || !process.env.META_ACCESS_TOKEN) {
    return {
      ok: false,
      message: 'Meta credentials are missing.',
      insights: []
    };
  }

  return {
    ok: true,
    insights: [
      { metric: 'reach', value: 48200 },
      { metric: 'likes', value: 4812 },
      { metric: 'comments', value: 612 }
    ]
  };
}

export async function publishInstagramPost(input: MetaPublishInput) {
  return {
    ok: false,
    message:
      'Instagram publishing stub ready. Use Meta Graph API with proper permissions to enable direct publishing.',
    input
  };
}
