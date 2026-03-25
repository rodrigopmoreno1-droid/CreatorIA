import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentUser() {
  const demoCookie = cookies().get('contentos-demo')?.value;
  const supabase = createSupabaseServerClient();

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

export function hasDemoAccess() {
  return cookies().get('contentos-demo')?.value === '1';
}
