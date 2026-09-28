# Google Drive mirror setup

Daily Cheshbon keeps Supabase as its source of truth. When a signed-in user connects Google Drive, the app creates a private Google Doc named **Daily Cheshbon Data Mirror** and refreshes it after successful cloud backups.

## Google Cloud

1. Open the Google Cloud project used for Daily Cheshbon sign-in.
2. Enable the **Google Drive API** and **Google Docs API**.
3. Open the existing OAuth 2.0 Web client, or create one for the website.
4. Add this authorized redirect URI exactly:

   `https://dailycheshbon.com/api/google-drive-callback`

5. Keep the existing Supabase callback URI used for Google sign-in.

The app requests only `drive.file`, so it can create and update its own mirror document without access to unrelated Drive files.

## Supabase

Run [`supabase/google-drive-schema.sql`](supabase/google-drive-schema.sql) in the Supabase SQL editor. The table has RLS enabled and intentionally has no client policies. Only the server service role can read the encrypted refresh token.

## Vercel

Add these variables for Production, Preview, and Development as appropriate:

- `DAILY_CHESHBON_APP_ORIGIN=https://dailycheshbon.com`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (already used by server-side Daily Cheshbon jobs)

Generate a long random encryption value and keep it stable. Changing it disconnects existing Drive connections because previously stored refresh tokens can no longer be decrypted.

After saving the variables, redeploy the latest production commit. Sign in to Daily Cheshbon, open Settings, connect Google Drive, and press **Update now** once. Later cloud backups update the document automatically.
