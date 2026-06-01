import { exportAllData, importAllData } from '@/src/repositories/cheshbonRepo';
import { isSupabaseConfigured, supabase } from '@/src/services/supabaseClient';

export type CloudStatus = {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  name: string | null;
  lastSyncedAt: string | null;
};

export async function getCloudStatus(): Promise<CloudStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return { configured: false, signedIn: false, email: null, name: null, lastSyncedAt: null };
  }
  const { data: sessionData, error: sessionError } = await withTimeout(
    supabase.auth.getSession(),
    8000,
    'Could not read the account session. Please refresh and try again.',
  );
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return { configured: true, signedIn: false, email: null, name: null, lastSyncedAt: null };

  let lastSyncedAt: string | null = null;
  try {
    const snapshotRequest = Promise.resolve(
      supabase
        .from('cloud_snapshots')
        .select('updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    );
    const { data, error } = await withTimeout(
      snapshotRequest,
      5000,
      'Cloud status timed out.',
    );
    if (error) throw error;
    lastSyncedAt = data?.updated_at ?? null;
  } catch {
    lastSyncedAt = null;
  }

  return {
    configured: true,
    signedIn: true,
    email: user.email ?? null,
    name: getUserDisplayName(user.user_metadata),
    lastSyncedAt,
  };
}

export async function signInToCloud(email: string, password: string) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return pullCloudDataToLocalIfAvailable();
}

export async function signUpForCloud(name: string, email: string, password: string) {
  const client = requireSupabase();
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Name is required to create an account.');
  const { error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: trimmedName,
        name: trimmedName,
      },
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (data.url && typeof window !== 'undefined') {
    window.location.assign(data.url);
  }
}

export async function completeOAuthRedirectIfPresent() {
  if (!isSupabaseConfigured || !supabase || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const errorDescription = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (errorDescription) {
    cleanAuthUrl(url);
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
  }

  const code = url.searchParams.get('code');
  if (code) {
    try {
      const { error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        8000,
        'Google sign-in is taking longer than expected.',
      );
      if (error) throw error;
    } catch (error) {
      const session = await getSessionIfAvailable();
      if (!session) {
        throw error;
      }
    } finally {
      cleanAuthUrl(url);
    }
    return 'Signed in with Google.';
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    try {
      const { error } = await withTimeout(
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
        8000,
        'Google sign-in is taking longer than expected.',
      );
      if (error) throw error;
    } finally {
      cleanAuthUrl(url);
    }
    return 'Signed in with Google.';
  }

  return null;
}

export async function signOutOfCloud() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function pushLocalDataToCloud() {
  const client = requireSupabase();
  const user = await requireUser();
  return pushLocalDataForUser(client, user.id);
}

export async function pushLocalDataToCloudIfSignedIn() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) return null;
  return pushLocalDataForUser(supabase, userId);
}

async function pushLocalDataForUser(client: NonNullable<typeof supabase>, userId: string) {
  const snapshot = JSON.parse(await exportAllData());
  const now = new Date().toISOString();
  const { error } = await client.from('cloud_snapshots').upsert(
    {
      user_id: userId,
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
  const syncedAt = await pullCloudDataForUser(client, user.id);
  if (!syncedAt) throw new Error('No cloud backup found for this account yet.');
  return syncedAt;
}

export async function pullCloudDataToLocalIfAvailable() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  return pullCloudDataForUser(supabase, userId);
}

async function pullCloudDataForUser(client: NonNullable<typeof supabase>, userId: string) {
  const { data, error } = await client
    .from('cloud_snapshots')
    .select('snapshot, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.snapshot) return null;
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

function getAuthRedirectUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/settings`;
  }
  return undefined;
}

function cleanAuthUrl(url: URL) {
  if (typeof window === 'undefined') return;
  const cleanSearch = new URLSearchParams(url.search);
  for (const key of ['code', 'state', 'error', 'error_code', 'error_description']) {
    cleanSearch.delete(key);
  }
  const query = cleanSearch.toString();
  window.history.replaceState(null, document.title, `${url.pathname}${query ? `?${query}` : ''}`);
}

async function getSessionIfAvailable() {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.auth.getSession(), 3000, 'Session check timed out.');
    if (error) return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getUserDisplayName(metadata: Record<string, unknown> | null | undefined) {
  const name = metadata?.full_name ?? metadata?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}
