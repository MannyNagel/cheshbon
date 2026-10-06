import { Linking } from 'react-native';

import { supabase } from '@/src/services/supabaseClient';

export type GoogleDriveStatus = {
  configured: boolean;
  connected: boolean;
  documentUrl: string | null;
  lastSyncedAt: string | null;
};

export async function getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  const response = await authenticatedRequest('/api/google-drive?action=status');
  return readPayload<GoogleDriveStatus>(response, 'Could not read Google Drive status.');
}

export async function connectGoogleDrive() {
  const response = await authenticatedRequest('/api/google-drive?action=auth-url');
  const payload = await readPayload<{ url: string }>(response, 'Could not begin Google Drive connection.');
  if (typeof window !== 'undefined') {
    window.location.assign(payload.url);
    return;
  }
  await Linking.openURL(payload.url);
}

export async function syncGoogleDriveMirror() {
  const response = await authenticatedRequest('/api/google-drive?action=sync', {
    method: 'POST',
  });
  return readPayload<GoogleDriveStatus & { synced: boolean }>(response, 'Could not update the Google Doc mirror.');
}

export async function syncGoogleDriveMirrorIfConnected() {
  try {
    const result = await syncGoogleDriveMirror();
    return result.connected && result.synced ? result : null;
  } catch (error) {
    console.warn('Automatic Google Drive mirror update failed.', error);
    return null;
  }
}

export async function disconnectGoogleDrive() {
  const response = await authenticatedRequest('/api/google-drive?action=disconnect', { method: 'DELETE' });
  await readPayload<{ disconnected: boolean }>(response, 'Could not disconnect Google Drive.');
}

async function authenticatedRequest(path: string, init: RequestInit = {}) {
  if (!supabase) throw new Error('Sign in before using Google Drive.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in before using Google Drive.');
  return fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function readPayload<T>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    if (response.status === 504) {
      throw new Error('The Google Drive update timed out before it finished. Please try again.');
    }
    throw new Error(payload?.error ?? fallback);
  }
  return payload;
}

