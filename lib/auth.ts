import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get('contentos-demo')?.value;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      user: null,
      isDemo: demoCookie === '1'
    };
  }

  const { data } = await supabase.auth.getUser();

  return {
    user: data.user,
    isDemo: demoCookie === '1'
  };
}

export async function hasDemoAccess() {
  const cookieStore = await cookies();
  return cookieStore.get('contentos-demo')?.value === '1';
}
