import { currentUser } from '@clerk/nextjs/server';
import { getServiceSupabase } from '@/lib/supabase';

type AppUserRecord = {
  id: string;
  clerk_user_id: string;
  email: string;
};

export async function ensureAppUserRecord(clerkUserId: string): Promise<AppUserRecord> {
  const supabase = getServiceSupabase();

  const { data: existingUser, error: readError } = await supabase
    .from('users')
    .select('id, clerk_user_id, email')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to load app user: ${readError.message}`);
  }

  if (existingUser) {
    return existingUser as AppUserRecord;
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    `${clerkUserId}@replymind.local`;

  const { data: insertedUser, error: insertError } = await supabase
    .from('users')
    .upsert(
      {
        clerk_user_id: clerkUserId,
        email,
      },
      { onConflict: 'clerk_user_id' },
    )
    .select('id, clerk_user_id, email')
    .single();

  if (insertError) {
    throw new Error(`Failed to create app user: ${insertError.message}`);
  }

  return insertedUser as AppUserRecord;
}
