import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type WorkspaceMembership = {
  company_id: string;
  companies: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

export type WorkspaceContext = {
  companyId: string;
  workspaceSlug: string;
  companyName: string;
};

function slugifyCompanyName(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function getAuthenticatedUserId() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function getCurrentWorkspaceContext(): Promise<WorkspaceContext | null> {
  const userId = await getAuthenticatedUserId();
  const admin = createSupabaseAdminClient();

  if (!userId || !admin) {
    return null;
  }

  const { data, error } = await admin
    .from('memberships')
    .select('company_id,companies(id,slug,name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<WorkspaceMembership>();

  if (error || !data?.companies?.slug) {
    return null;
  }

  return {
    companyId: data.companies.id,
    workspaceSlug: data.companies.slug,
    companyName: data.companies.name
  };
}

export async function getWorkspaceContextForSlug(workspaceSlug: string): Promise<WorkspaceContext | null> {
  const userId = await getAuthenticatedUserId();
  const admin = createSupabaseAdminClient();

  if (!userId || !admin) {
    return null;
  }

  const { data, error } = await admin
    .from('memberships')
    .select('company_id,companies(id,slug,name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('companies.slug', workspaceSlug)
    .limit(1)
    .maybeSingle<WorkspaceMembership>();

  if (error || !data?.companies?.slug) {
    return null;
  }

  return {
    companyId: data.companies.id,
    workspaceSlug: data.companies.slug,
    companyName: data.companies.name
  };
}

async function ensureRoleExists(roleId: string, label: string) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  await admin
    .from('roles')
    .upsert({
      id: roleId,
      label,
      permissions: []
    }, { onConflict: 'id' });
}

async function buildUniqueCompanySlug(baseName: string) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  const baseSlug = slugifyCompanyName(baseName) || 'creator-ai';

  for (let index = 0; index < 10; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const { data, error } = await admin
      .from('companies')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now().toString().slice(-6)}`;
}

export async function createWorkspaceForUser(input: {
  userId: string;
  fullName: string;
  email: string;
  companyName: string;
}) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error('Supabase admin client indisponível.');
  }

  await ensureRoleExists('admin', 'Admin');

  const workspaceSlug = await buildUniqueCompanySlug(input.companyName);

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      slug: workspaceSlug,
      name: input.companyName,
      plan_slug: 'starter',
      status: 'active'
    })
    .select('id,slug,name')
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message ?? 'Não foi possível criar a empresa.');
  }

  const { error: profileError } = await admin
    .from('users')
    .upsert({
      id: input.userId,
      full_name: input.fullName,
      email: input.email
    }, { onConflict: 'id' });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: membershipError } = await admin
    .from('memberships')
    .upsert({
      company_id: company.id,
      user_id: input.userId,
      role_id: 'admin',
      status: 'active'
    }, { onConflict: 'company_id,user_id' });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  return {
    companyId: company.id,
    workspaceSlug: company.slug,
    companyName: company.name
  } satisfies WorkspaceContext;
}
