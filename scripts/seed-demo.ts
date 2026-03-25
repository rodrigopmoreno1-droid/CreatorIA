import { createClient } from '@supabase/supabase-js';
import { getWorkspaceSnapshot } from '../lib/demo-data.js';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/constants.js';

type EnvKeys =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

function getEnv(name: EnvKeys) {
  return process.env[name] ?? '';
}

function assertEnv() {
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function findOrCreateDemoUser() {
  const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.users.find((user) => user.email === DEMO_EMAIL);

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'Rodrigo Moreno',
        role: 'super_admin'
      }
    });
    return { supabase, userId: existing.id };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Rodrigo Moreno',
      role: 'super_admin'
    }
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Failed to create demo auth user');
  }

  return { supabase, userId: data.user.id };
}

async function main() {
  assertEnv();
  const snapshot = getWorkspaceSnapshot('demo');
  const { supabase, userId } = await findOrCreateDemoUser();

  await supabase.from('companies').delete().eq('slug', snapshot.slug);

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      slug: snapshot.slug,
      name: snapshot.company,
      legal_name: snapshot.company,
      plan_slug: snapshot.plan.toLowerCase(),
      status: 'active',
      website: 'https://contentos.app'
    })
    .select()
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message ?? 'Failed to create company');
  }

  await supabase.from('roles').upsert([
    { id: 'super_admin', label: 'Super Admin', description: 'Owner of the SaaS', permissions: ['*'] },
    { id: 'admin', label: 'Admin', description: 'Company administrator', permissions: ['manage:*'] },
    { id: 'social_media', label: 'Social Media', description: 'Content planner', permissions: ['content:*'] },
    { id: 'filmmaker', label: 'Filmmaker', description: 'Video production', permissions: ['scripts:*'] },
    { id: 'blogueira', label: 'Blogueira', description: 'Creator profile', permissions: ['stories:*'] },
    { id: 'viewer', label: 'Viewer', description: 'Read only', permissions: ['read:*'] }
  ]);

  await supabase.from('users').upsert({
    id: userId,
    full_name: 'Rodrigo Moreno',
    email: DEMO_EMAIL,
    timezone: 'America/Recife'
  });

  await supabase.from('memberships').upsert({
    company_id: company.id,
    user_id: userId,
    role_id: 'super_admin',
    status: 'active'
  });

  const brandId = crypto.randomUUID();
  const productIds = snapshot.products.map(() => crypto.randomUUID());
  const creatorIds = snapshot.creators.map(() => crypto.randomUUID());
  const ideaIds = snapshot.ideas.map(() => crypto.randomUUID());
  const scriptIds = snapshot.scripts.map(() => crypto.randomUUID());
  const storySequenceId = crypto.randomUUID();
  const postIds = snapshot.posts.map(() => crypto.randomUUID());
  const pipelineIds = snapshot.pipelineCards.map(() => crypto.randomUUID());
  const assetIds = snapshot.assets.map(() => crypto.randomUUID());
  const competitorIds = snapshot.competitors.map(() => crypto.randomUUID());

  await supabase.from('brands').insert({
    id: brandId,
    company_id: company.id,
    name: snapshot.name,
    instagram_handle: '@ateliermoreno',
    niche: snapshot.industry,
    voice: 'premium, direto e humano',
    colors: { primary: '#0f766e', accent: '#111827' }
  });

  await supabase.from('products').insert(
    snapshot.products.map((product, index) => ({
      id: productIds[index],
      company_id: company.id,
      brand_id: brandId,
      name: product.name,
      benefits: product.benefit,
      audience: product.audience,
      price: Number(product.price.replace(/[^\d,]/g, '').replace(',', '.')) || null,
      restrictions: product.restrictions,
      metadata: { tags: product.tags }
    }))
  );

  await supabase.from('creators').insert(
    snapshot.creators.map((creator, index) => ({
      id: creatorIds[index],
      company_id: company.id,
      name: creator.name,
      instagram_handle: creator.handle,
      niche: creator.niche,
      history: creator.history,
      metrics: { summary: creator.metrics, accent: creator.accent }
    }))
  );

  await supabase.from('content_ideas').insert(
    snapshot.ideas.map((idea, index) => ({
      id: ideaIds[index],
      company_id: company.id,
      brand_id: brandId,
      product_id: productIds[index % productIds.length],
      title: idea.title,
      hook: idea.hook,
      source: idea.source,
      score: idea.score,
      status: 'approved',
      tags: idea.tags
    }))
  );

  await supabase.from('scripts').insert(
    snapshot.scripts.map((script, index) => ({
      id: scriptIds[index],
      company_id: company.id,
      idea_id: ideaIds[index % ideaIds.length],
      title: script.title,
      hook: script.hook,
      spoken_text: script.hook,
      cta: script.cta,
      storyboard: script.beats
    }))
  );

  await supabase.from('story_sequences').insert({
    id: storySequenceId,
    company_id: company.id,
    title: 'Sequência demo',
    status: 'scheduled',
    scheduled_for: new Date().toISOString(),
    notes: 'Demo seed'
  });

  await supabase.from('story_items').insert(
    snapshot.stories.flatMap((story, index) => [
      {
        company_id: company.id,
        sequence_id: storySequenceId,
        position: index * 2,
        item_type: 'text',
        content: { title: story.title, hook: story.hook },
        cta: 'Arraste para o calendário'
      }
    ])
  );

  await supabase.from('posts').insert(
    snapshot.posts.map((post, index) => ({
      id: postIds[index],
      company_id: company.id,
      brand_id: brandId,
      product_id: productIds[index % productIds.length],
      title: post.title,
      caption: `${post.title} | seed demo`,
      hashtags: post.tags,
      location: 'Recife',
      scheduled_for: new Date().toISOString(),
      status: post.status.toLowerCase(),
      metrics: { engagement: post.engagement },
      feed_position: index
    }))
  );

  await supabase.from('pipeline_cards').insert(
    snapshot.pipelineCards.map((card, index) => ({
      id: pipelineIds[index],
      company_id: company.id,
      title: card.title,
      column_key: card.column,
      order_index: index,
      assignee_user_id: userId,
      tags: card.tags,
      priority: card.priority
    }))
  );

  await supabase.from('assets').insert(
    snapshot.assets.map((asset, index) => ({
      id: assetIds[index],
      company_id: company.id,
      brand_id: brandId,
      product_id: productIds[index % productIds.length],
      title: asset.title,
      file_url: 'https://example.com/file',
      storage_path: `assets/${asset.id}`,
      drive_url: `https://drive.google.com/file/d/${asset.id}`,
      mime_type: asset.type,
      size_bytes: 1024 * 1024,
      tags: [asset.tag],
      source: asset.source
    }))
  );

  await supabase.from('metrics').insert(
    snapshot.metrics.series.flatMap((series) =>
      series.points.map((point) => ({
        company_id: company.id,
        post_id: postIds[0],
        metric_key: series.name.toLowerCase(),
        metric_date: new Date(),
        value: point.value,
        breakdown: { label: point.label }
      }))
    )
  );

  await supabase.from('competitors').insert(
    snapshot.competitors.map((competitor, index) => ({
      id: competitorIds[index],
      company_id: company.id,
      name: competitor.name,
      handle: competitor.handle,
      niche: snapshot.industry,
      website: 'https://example.com',
      sentiment: competitor.sentiment.toLowerCase(),
      notes: competitor.insight,
      monitored: true
    }))
  );

  await supabase.from('competitor_posts').insert(
    snapshot.competitors.flatMap((competitor, index) =>
      competitor.topPosts.map((topPost) => ({
        company_id: company.id,
        competitor_id: competitorIds[index],
        published_at: new Date().toISOString(),
        post_type: topPost.format,
        caption: topPost.title,
        metrics: { metric: topPost.metric },
        media_url: 'https://example.com/media.jpg'
      }))
    )
  );

  await supabase.from('notes').insert(
    snapshot.notes.map((note) => ({
      company_id: company.id,
      title: note.title,
      body: note.body,
      author_name: note.author,
      entity_type: 'workspace'
    }))
  );

  await supabase.from('calendar_events').insert(
    snapshot.calendarEvents.map((event) => ({
      company_id: company.id,
      title: event.title,
      starts_at: `${event.date}T09:00:00.000Z`,
      ends_at: `${event.date}T10:00:00.000Z`,
      event_type: event.type,
      status: 'scheduled',
      owner_user_id: userId,
      metadata: { owner: event.owner }
    }))
  );

  await supabase.from('feature_flags').upsert(
    snapshot.featureFlags.map((flag) => ({
      company_id: company.id,
      key: flag.id,
      name: flag.name,
      enabled: flag.enabled,
      description: flag.description,
      scope: flag.scope
    })),
    { onConflict: 'company_id,key' }
  );

  const subscription = await supabase
    .from('subscriptions')
    .insert({
      company_id: company.id,
      plan_slug: company.plan_slug,
      status: 'active',
      provider: 'stripe',
      provider_customer_id: `cus_${company.slug}`,
      provider_subscription_id: `sub_${company.slug}`,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    })
    .select()
    .single();

  if (subscription.data) {
    await supabase.from('invoices').insert(
      snapshot.invoices.map((invoice, index) => ({
        company_id: company.id,
        subscription_id: subscription.data?.id,
        provider_invoice_id: invoice.number,
        number: invoice.number,
        amount_cents: 14900 + index * 100,
        currency: 'BRL',
        status: invoice.status.toLowerCase(),
        issued_at: new Date(invoice.date).toISOString(),
        due_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        paid_at: invoice.status === 'Pago' ? new Date().toISOString() : null,
        pdf_url: 'https://example.com/invoice.pdf'
      }))
    );
  }

  await supabase.from('usage_logs').insert(
    snapshot.usage.map((usage) => ({
      company_id: company.id,
      feature_key: usage.metric.toLowerCase(),
      quantity: usage.used,
      unit: 'count',
      metadata: { limit: usage.limit }
    }))
  );

  console.log('Demo workspace seeded successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
