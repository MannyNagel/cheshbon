create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  document_id text,
  document_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_drive_connections enable row level security;

-- Intentionally no user-facing policies. Only the server's service role may read
-- encrypted Google credentials; signed-in clients use the authenticated API.
