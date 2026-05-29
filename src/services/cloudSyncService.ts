import { exportAllData, importAllData } from '@/src/repositories/cheshbonRepo';
import { isSupabaseConfigured, supabase } from '@/src/services/supabaseClient';

export type CloudStatus = {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  lastSyncedAt: string | null;
};

export async function getCloudStatus(): Promise<CloudStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return { configured: false, signedIn: false, email: null, lastSyncedAt: null };
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return { configured: true, signedIn: false, email: null, lastSyncedAt: null };

  const { data, error } = await supabase
    .from('cloud_snapshots')
    .select('updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  return {
    configured: true,
    signedIn: true,
    email: user.email ?? null,
    lastSyncedAt: data?.updated_at ?? null,
  };
}

export async function signInToCloud(email: string, password: string) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpForCloud(email: string, password: string) {
  const client = requireSupabase();
  const { error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
}

export async function signOutOfCloud() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function pushLocalDataToCloud() {
  const client = requireSupabase();
  const user = await requireUser();
  const snapshot = JSON.parse(await exportAllData());
  const now = new Date().toISOString();
  const { error } = await client.from('cloud_snapshots').upsert(
    {
      user_id: user.id,
      snapshot,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  return now;
}

export async function pullCloudDataToLocal() {
  const client = requireSupabase();
  const user = await requireUser();
  const { data, error } = await client
    .from('cloud_snapshots')
    .select('snapshot, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.snapshot) throw new Error('No cloud backup found for this account yet.');
  try {
    await importAllData(JSON.stringify(data.snapshot));
  } catch (importError) {
    throw new Error(importError instanceof Error ? `Cloud restore failed: ${importError.message}` : 'Cloud restore failed.');
  }
  return data.updated_at as string;
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

async function requireUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in before syncing.');
  return data.user;
}
