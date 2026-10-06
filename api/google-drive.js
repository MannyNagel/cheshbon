const crypto = require('node:crypto');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DOCS_URL = 'https://docs.googleapis.com/v1/documents';
const MAX_DOCUMENT_CHARS = 900_000;
const DOCUMENT_NAME = 'Daily Cheshbon Data Mirror';

module.exports = async function handler(request, response) {
  response.setHeader('X-Daily-Cheshbon-Drive-Version', '2026-10-06-2');
  const action = readQueryValue(request.query?.action) || 'status';

  try {
    if (action === 'callback') return handleCallback(request, response);

    // Configuration names are safe to expose and make deployment setup issues
    // diagnosable without revealing any secret values.
    if (action === 'status' && request.method === 'GET' && !isConfigured()) {
      return response.status(200).json({
        configured: false,
        connected: false,
        missingConfiguration: missingConfiguration(),
      });
    }

    const user = await getSupabaseUser(request.headers.authorization);
    if (action === 'status' && request.method === 'GET') return handleStatus(user, response);
    if (action === 'auth-url' && request.method === 'GET') return handleAuthUrl(user, response);
    if (action === 'sync' && request.method === 'POST') return handleSync(user, request, response);
    if (action === 'disconnect' && request.method === 'DELETE') return handleDisconnect(user, response);

    response.setHeader('Allow', 'GET, POST, DELETE');
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return response.status(error?.statusCode ?? 500).json({
      error: publicErrorMessage(error),
    });
  }
};

async function handleStatus(user, response) {
  if (!isConfigured()) {
    return response.status(200).json({ configured: false, connected: false });
  }
  const connection = await getConnection(user.id);
  return response.status(200).json({
    configured: true,
    connected: Boolean(connection),
    documentUrl: connection?.document_url ?? null,
    lastSyncedAt: connection?.last_synced_at ?? null,
  });
}

async function handleAuthUrl(user, response) {
  requireConfiguration();
  const state = signState({ sub: user.id, exp: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return response.status(200).json({ url: `${GOOGLE_AUTH_URL}?${params.toString()}` });
}

async function handleCallback(request, response) {
  const destination = new URL('/settings', appOrigin());
  try {
    requireConfiguration();
    const oauthError = readQueryValue(request.query?.error);
    if (oauthError) throw httpError(400, 'Google Drive authorization was cancelled.');

    const state = verifyState(readQueryValue(request.query?.state));
    const code = readQueryValue(request.query?.code);
    if (!code) throw httpError(400, 'Google Drive did not return an authorization code.');

    const tokens = await exchangeAuthorizationCode(code);
    if (!tokens.refresh_token) {
      throw httpError(400, 'Google did not return long-term Drive access. Please connect again.');
    }

    await upsertConnection(state.sub, {
      encrypted_refresh_token: encryptSecret(tokens.refresh_token),
      updated_at: new Date().toISOString(),
    });
    destination.searchParams.set('drive', 'connected');
  } catch (error) {
    console.error('Google Drive callback failed.', error);
    destination.searchParams.set('drive', 'error');
  }
  return response.redirect(302, destination.toString());
}

async function handleSync(user, request, response) {
  requireConfiguration();
  const connection = await driveStep('loading the saved Drive connection', () => getConnection(user.id));
  if (!connection) {
    return response.status(200).json({ configured: true, connected: false, synced: false });
  }

  const snapshot = await driveStep('loading the cloud backup', () => getCloudSnapshot(user.id));
  if (!snapshot) throw httpError(404, 'No cloud backup was found for this account.');
  const markdown = await driveStep('preparing the readable export', () =>
    sanitizeDocumentText(buildReadableCloudExport(snapshot)),
  );
  if (!markdown) throw httpError(400, 'The Daily Cheshbon export is empty.');
  if (markdown.length > MAX_DOCUMENT_CHARS) {
    throw httpError(413, 'The Google Doc mirror is too large to update. Contact support so it can be divided into yearly documents.');
  }

  const refreshToken = await driveStep('reading the saved Google authorization', () =>
    decryptSecret(connection.encrypted_refresh_token),
  );
  const accessToken = await driveStep('refreshing Google authorization', () =>
    refreshGoogleAccessToken(refreshToken),
  );
  let documentId = connection.document_id;
  let documentUrl = connection.document_url;

  if (documentId) {
    const exists = await driveStep('opening the existing Google Doc', () =>
      googleDocumentExists(documentId, accessToken),
    );
    if (!exists) {
      documentId = null;
      documentUrl = null;
    }
  }

  if (!documentId) {
    const document = await driveStep('finding or creating the Google Doc', async () =>
      (await findExistingGoogleDocument(accessToken)) || (await createGoogleDocument(accessToken)),
    );
    documentId = document.id;
    documentUrl = document.webViewLink || googleDocumentUrl(documentId);

    // Remember the file before inserting content. If Google Docs rejects the
    // write, a retry should repair this document instead of creating another.
    await driveStep('saving the Google Doc reference', () =>
      updateConnection(user.id, {
        document_id: documentId,
        document_url: documentUrl,
        updated_at: new Date().toISOString(),
      }),
    );
  }

  await driveStep('writing the Google Doc', () => replaceGoogleDocument(documentId, markdown, accessToken));
  const lastSyncedAt = new Date().toISOString();
  await driveStep('saving the completed backup time', () =>
    updateConnection(user.id, {
      document_id: documentId,
      document_url: documentUrl || googleDocumentUrl(documentId),
      last_synced_at: lastSyncedAt,
      updated_at: lastSyncedAt,
    }),
  );

  return response.status(200).json({
    configured: true,
    connected: true,
    synced: true,
    documentUrl: documentUrl || googleDocumentUrl(documentId),
    lastSyncedAt,
  });
}

async function driveStep(description, operation) {
  try {
    return await operation();
  } catch (error) {
    if (error?.expose || (error?.statusCode && error.statusCode < 500)) throw error;
    console.error(`Google Drive failed while ${description}.`, error);
    const wrapped = httpError(502, `Google Drive failed while ${description}.`);
    wrapped.expose = true;
    throw wrapped;
  }
}

async function handleDisconnect(user, response) {
  requireConfiguration();
  const connection = await getConnection(user.id);
  if (connection?.encrypted_refresh_token) {
    const refreshToken = decryptSecret(connection.encrypted_refresh_token);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => null);
  }
  await deleteConnection(user.id);
  return response.status(200).json({ disconnected: true });
}

async function exchangeAuthorizationCode(code) {
  const result = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(),
    }),
  });
  const payload = await result.json().catch(() => null);
  if (!result.ok) throw httpError(400, payload?.error_description || 'Google Drive authorization failed.');
  return payload;
}

async function refreshGoogleAccessToken(refreshToken) {
  const result = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await result.json().catch(() => null);
  if (!result.ok || !payload?.access_token) {
    throw httpError(401, 'Google Drive access expired. Reconnect Google Drive in Settings.');
  }
  return payload.access_token;
}

async function googleDocumentExists(documentId, accessToken) {
  const result = await fetch(`${GOOGLE_DOCS_URL}/${encodeURIComponent(documentId)}?fields=documentId`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (result.status === 404) return false;
  if (!result.ok) throw await googleApiError(result, 'Could not open the Google Doc mirror.');
  return true;
}

async function findExistingGoogleDocument(accessToken) {
  const query = [
    `name = '${DOCUMENT_NAME.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.document'",
    'trashed = false',
  ].join(' and ');
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    orderBy: 'modifiedTime desc',
    pageSize: '1',
    fields: 'files(id,webViewLink,modifiedTime)',
  });
  const result = await fetch(`${GOOGLE_DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.ok) throw await googleApiError(result, 'Could not find the existing Google Doc mirror.');
  const payload = await result.json();
  return Array.isArray(payload?.files) ? payload.files[0] ?? null : null;
}

async function createGoogleDocument(accessToken) {
  const result = await fetch(`${GOOGLE_DRIVE_FILES_URL}?fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DOCUMENT_NAME,
      mimeType: 'application/vnd.google-apps.document',
      description: 'Private, generated mirror of Daily Cheshbon data for personal review and analysis.',
    }),
  });
  if (!result.ok) throw await googleApiError(result, 'Could not create the Google Doc mirror.');
  return result.json();
}

async function replaceGoogleDocument(documentId, markdown, accessToken) {
  const documentResult = await fetch(`${GOOGLE_DOCS_URL}/${encodeURIComponent(documentId)}?fields=body(content(endIndex))`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!documentResult.ok) throw await googleApiError(documentResult, 'Could not read the Google Doc mirror.');
  const document = await documentResult.json();
  const content = Array.isArray(document?.body?.content) ? document.body.content : [];
  const endIndex = content.length ? Number(content[content.length - 1]?.endIndex ?? 1) : 1;
  const requests = [];
  if (endIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: markdown } });

  const updateResult = await fetch(`${GOOGLE_DOCS_URL}/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  if (!updateResult.ok) throw await googleApiError(updateResult, 'Could not update the Google Doc mirror.');
}

async function googleApiError(result, fallback) {
  const payload = await result.json().catch(() => null);
  const message = payload?.error?.message;
  if (result.status === 403 && /docs api|docs\.googleapis\.com|has not been used|is disabled/i.test(message || '')) {
    return httpError(424, 'Google Docs API is not enabled for the Daily Cheshbon Google project.');
  }
  const error = httpError(result.status === 401 ? 401 : 502, message || fallback);
  error.expose = true;
  return error;
}

async function getSupabaseUser(authorization) {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw httpError(401, 'Sign in before using Google Drive.');
  const config = supabaseConfig();
  const result = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!result.ok) throw httpError(401, 'Sign in before using Google Drive.');
  return result.json();
}

async function getConnection(userId) {
  const result = await supabaseServiceRequest(
    `/rest/v1/google_drive_connections?user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );
  const rows = await result.json();
  return rows[0] ?? null;
}

async function getCloudSnapshot(userId) {
  const result = await supabaseServiceRequest(
    `/rest/v1/cloud_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=snapshot`,
  );
  const rows = await result.json();
  return rows[0]?.snapshot ?? null;
}

async function upsertConnection(userId, values) {
  const result = await supabaseServiceRequest('/rest/v1/google_drive_connections?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, ...values }),
  });
  await result.text();
}

async function updateConnection(userId, values) {
  const result = await supabaseServiceRequest(
    `/rest/v1/google_drive_connections?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(values),
    },
  );
  await result.text();
}

async function deleteConnection(userId) {
  const result = await supabaseServiceRequest(
    `/rest/v1/google_drive_connections?user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  await result.text();
}

async function supabaseServiceRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config.serviceKey) throw httpError(503, 'Google Drive storage is not configured.');
  const result = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!result.ok) {
    console.error('Google Drive connection storage failed.', result.status, await result.text());
    throw httpError(503, 'Google Drive connection storage is not ready.');
  }
  return result;
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(value) {
  const [encoded, signature] = String(value ?? '').split('.');
  if (!encoded || !signature) throw httpError(400, 'Google Drive connection state is invalid.');
  const expected = crypto.createHmac('sha256', stateSecret()).update(encoded).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw httpError(400, 'Google Drive connection state is invalid.');
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload?.sub || !payload?.exp || payload.exp < Date.now()) {
    throw httpError(400, 'Google Drive connection has expired. Please try again.');
  }
  return payload;
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(value) {
  const [version, iv, tag, encrypted] = String(value ?? '').split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw httpError(500, 'Stored Google Drive access is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function encryptionKey() {
  return crypto.createHash('sha256').update(process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY || '').digest();
}

function stateSecret() {
  return `${process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY}:oauth-state`;
}

function sanitizeDocumentText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() + '\n';
}

function buildReadableCloudExport(snapshot) {
  const tables = snapshot?.tables ?? {};
  const domains = rows(tables.domains);
  const practices = rows(tables.practices);
  const metrics = rows(tables.metrics);
  const routines = rows(tables.routine_templates).filter((routine) => !routine.deleted_at);
  const schedules = rows(tables.routine_schedules).filter((schedule) => Number(schedule.active ?? 1) === 1);
  const sections = rows(tables.review_sections);
  const routinePractices = rows(tables.routine_practices).filter((item) => !item.archived_from);
  const sessions = rows(tables.daily_review_sessions);
  const resets = rows(tables.reset_events);
  const entries = rows(tables.daily_entries);
  const metricValues = rows(tables.entry_metric_values);
  const weeklyReviews = rows(tables.weekly_reviews);
  const weeklyReports = rows(tables.weekly_reports);
  const avodahExperiments = rows(tables.avodah_experiments);
  const avodahEntries = rows(tables.avodah_daily_entries);
  const avodahWeeklyReviews = rows(tables.avodah_weekly_reviews);
  const avodahFinalReviews = rows(tables.avodah_final_reviews);

  const domainById = byId(domains);
  const practiceById = byId(practices);
  const metricById = byId(metrics);
  const sectionById = byId(sections);
  const routineById = byId(routines);
  const metricValuesByEntry = groupBy(metricValues, 'entry_id');
  const entriesByDate = groupBy(entries, 'entry_date');
  const resetsByDate = groupBy(resets, 'reset_date');
  const schedulesByRoutine = groupBy(schedules, 'routine_template_id');
  const practicesByRoutine = groupBy(routinePractices, 'routine_template_id');

  const lines = [
    '# Daily Cheshbon Data Mirror',
    '',
    `Updated from cloud: ${new Date().toISOString()}`,
    snapshot?.exportedAt ? `Cloud snapshot: ${snapshot.exportedAt}` : null,
    '',
    'This is a private, generated copy for personal review and analysis. Daily Cheshbon remains the source of truth.',
    '',
    '## Domains',
  ].filter(Boolean);

  if (!domains.length) lines.push('No domains.');
  for (const domain of sortByName(domains)) {
    lines.push(
      [`- ${textValue(domain.name, 'Unnamed domain')}`, Number(domain.active ?? 1) === 1 ? null : 'inactive', domain.description ? `description: ${domain.description}` : null]
        .filter(Boolean)
        .join('; '),
    );
  }

  lines.push('', '## Practices');

  if (!practices.length) lines.push('No practices.');
  for (const practice of sortByName(practices)) {
    const practiceMetrics = metrics
      .filter((metric) => metric.practice_id === practice.id && Number(metric.active ?? 1) === 1)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
    lines.push(
      [
        `- ${textValue(practice.name, 'Unnamed practice')}`,
        `domain: ${textValue(domainById.get(practice.domain_id)?.name, 'Unknown')}`,
        practice.parent_practice_id
          ? `sub-practice of: ${textValue(practiceById.get(practice.parent_practice_id)?.name, 'Unknown practice')}`
          : null,
        Number(practice.active ?? 1) === 1 ? null : 'inactive',
        practiceMetrics.length
          ? `metrics: ${practiceMetrics.map((metric) => {
              const role = Number(metric.is_primary ?? 0) === 1 ? 'primary' : 'sub-practice';
              const metricDomain = metric.domain_id ? `, domain: ${textValue(domainById.get(metric.domain_id)?.name, 'Unknown')}` : '';
              return `${textValue(metric.name, 'Metric')} (${textValue(metric.metric_type, 'unknown')}, ${role}${metricDomain})`;
            }).join(', ')}`
          : null,
        practice.weekly_target ? `weekly target: ${practice.weekly_target}` : null,
        practice.description ? `description: ${practice.description}` : null,
      ]
        .filter(Boolean)
        .join('; '),
    );
  }

  lines.push('', '## Routines');
  if (!routines.length) lines.push('No routines.');
  for (const routine of [...routines].sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))) {
    lines.push(`### ${textValue(routine.name, 'Unnamed routine')}${Number(routine.active ?? 1) === 1 ? '' : ' (inactive)'}`);
    const routineSchedules = schedulesByRoutine.get(routine.id) ?? [];
    for (const schedule of routineSchedules) {
      const dateRange = schedule.start_date || schedule.end_date
        ? `${textValue(schedule.start_date, 'any start')} to ${textValue(schedule.end_date, 'any end')}`
        : 'ongoing';
      lines.push(`- Schedule: ${textValue(schedule.days_of_week, 'all days')}; ${dateRange}`);
    }
    const assignments = (practicesByRoutine.get(routine.id) ?? []).sort(
      (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
    );
    for (const assignment of assignments) {
      const practice = practiceById.get(assignment.practice_id);
      const section = sectionById.get(assignment.review_section_id);
      lines.push(
        `- ${textValue(section?.name, 'Overview')}: ${textValue(practice?.name, 'Unknown practice')}${Number(assignment.enabled ?? 1) === 1 ? '' : ' (disabled)'}`,
      );
    }
    lines.push('');
  }

  lines.push('## Review History');
  const reviewDates = new Set([
    ...sessions.map((session) => session.review_date),
    ...resets.map((reset) => reset.reset_date),
    ...entries.map((entry) => entry.entry_date),
  ].filter(Boolean));
  const sessionByDate = new Map(sessions.map((session) => [session.review_date, session]));
  for (const date of [...reviewDates].sort().reverse()) {
    const session = sessionByDate.get(date);
    lines.push(`### ${date}`);
    lines.push(`Review: ${session?.completed_at ? 'complete' : 'incomplete'}`);
    appendOptionalLine(lines, 'Day rating', session?.general_day_rating == null ? null : `${session.general_day_rating}/5`);
    appendOptionalLine(lines, 'Win', session?.main_win);
    appendOptionalLine(lines, 'Struggle', session?.main_struggle);
    appendOptionalLine(lines, 'Pattern noticed', session?.pattern_noticed);
    appendOptionalLine(lines, 'Adjustment for tomorrow', session?.adjustment_for_tomorrow);
    appendOptionalLine(lines, 'Review note', session?.note);

    const dailyResets = resetsByDate.get(date) ?? [];
    if (dailyResets.length) {
      lines.push('Resets:');
      for (const reset of dailyResets) {
        lines.push(
          [
            `- ${formatCloudResetTime(reset.initiated_at)}`,
            `trigger: ${textValue(reset.trigger, 'Not specified')}${reset.trigger_detail ? ` (${reset.trigger_detail})` : ''}`,
            `what mattered next: ${textValue(reset.what_matters_next, 'Not recorded')}`,
            reset.first_action ? `first action: ${reset.first_action}` : null,
            `outcome: ${formatCloudResetOutcome(reset.outcome)}`,
            reset.outcome_reflection ? `reflection: ${reset.outcome_reflection}` : null,
          ].filter(Boolean).join('; '),
        );
      }
    }

    const dailyEntries = entriesByDate.get(date) ?? [];
    if (!dailyEntries.length) lines.push('- No practice entries.');
    for (const entry of dailyEntries) {
      const practice = practiceById.get(entry.practice_id);
      const domain = domainById.get(practice?.domain_id);
      const values = metricValuesByEntry.get(entry.id) ?? [];
      const parts = [
        `- ${textValue(practice?.name, 'Unknown practice')}`,
        practice?.parent_practice_id
          ? `sub-practice of: ${textValue(practiceById.get(practice.parent_practice_id)?.name, 'Unknown practice')}`
          : null,
        domain?.name ? `domain: ${domain.name}` : null,
        entry.status ? `status: ${entry.status}` : null,
        ...values.map((value) => formatCloudMetricValue(value, metricById.get(value.metric_id), domainById, practice?.domain_id)),
        entry.note ? `note: ${entry.note}` : null,
        Number(entry.remind_tomorrow ?? 0) === 1 ? 'marked for tomorrow' : null,
      ].filter(Boolean);
      lines.push(parts.join('; '));
    }
    lines.push('');
  }
  if (!reviewDates.size) lines.push('No daily reviews.', '');

  lines.push('## Avodah Experiments');
  if (!avodahExperiments.length) lines.push('No Avodah experiments.');
  for (const experiment of [...avodahExperiments].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))) {
    lines.push(
      `### ${textValue(experiment.title, 'Untitled experiment')} (${textValue(experiment.experiment_type, 'avodah')})`,
      `Status: ${textValue(experiment.status, 'unknown')}`,
      `Dates: ${textValue(experiment.start_date, 'unknown')} to ${textValue(experiment.review_date, 'unknown')}`,
      `Goal: ${textValue(experiment.goal, 'Not recorded')}`,
      `Behavior: ${textValue(experiment.behavior, 'Not recorded')}`,
    );
    appendOptionalLine(lines, 'Hypothesis', experiment.hypothesis);
    if (experiment.parent_experiment_id) lines.push(`Modified from: ${experiment.parent_experiment_id}`);
    const experimentEntries = avodahEntries
      .filter((entry) => entry.experiment_id === experiment.id)
      .sort((a, b) => String(b.review_date).localeCompare(String(a.review_date)));
    for (const entry of experimentEntries) {
      lines.push(
        [`- ${entry.review_date}`, entry.opportunity == null ? 'opportunity not answered' : `opportunity ${Number(entry.opportunity) ? 'yes' : 'no'}`, entry.response ? `response ${String(entry.response).replace(/_/g, ' ')}` : null, entry.reflection ? `reflection: ${entry.reflection}` : null]
          .filter(Boolean)
          .join('; '),
      );
    }
    for (const review of avodahWeeklyReviews.filter((item) => item.experiment_id === experiment.id)) {
      lines.push(`- Week of ${review.week_start_date}: ${textValue(review.learning, 'No learning recorded')}${review.decision ? `; decision ${review.decision}` : ''}`);
    }
    const finalReview = avodahFinalReviews.find((item) => item.experiment_id === experiment.id);
    if (finalReview) {
      lines.push(`Final review: helped ${textValue(finalReview.helped, 'not answered')}; changed: ${textValue(finalReview.what_changed, 'not recorded')}; learned: ${textValue(finalReview.learned, 'not recorded')}; decision: ${textValue(finalReview.decision, 'not recorded')}`);
    }
    lines.push('');
  }

  lines.push('## Weekly Reflections');
  if (!weeklyReviews.length) lines.push('No weekly reflections.');
  for (const review of [...weeklyReviews].sort((a, b) => String(b.week_start_date).localeCompare(String(a.week_start_date)))) {
    lines.push(`### Week of ${textValue(review.week_start_date, 'Unknown date')}`);
    appendOptionalLine(lines, 'What went well', review.what_went_well);
    appendOptionalLine(lines, 'What needs work', review.what_needs_work);
    appendOptionalLine(lines, 'Pattern noticed', review.pattern_noticed);
    appendOptionalLine(lines, 'One kabbalah', review.one_kabbalah);
    appendOptionalLine(lines, 'Notes', review.notes);
    lines.push('');
  }

  lines.push('## Saved Weekly Reports');
  if (!weeklyReports.length) lines.push('No saved weekly reports.');
  for (const report of [...weeklyReports].sort((a, b) => String(b.week_start_date).localeCompare(String(a.week_start_date)))) {
    lines.push(
      `### ${textValue(report.week_start_date, 'Unknown')} to ${textValue(report.week_end_date, 'Unknown')}`,
      '',
      textValue(report.report_markdown, 'No report text.'),
      '',
    );
  }

  return lines.join('\n');
}

function formatCloudResetTime(value) {
  if (!value) return 'Time not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `Initiated ${date.toISOString()}`;
}

function formatCloudResetOutcome(outcome) {
  if (outcome === 'worked') return 'worked';
  if (outcome === 'partially') return 'partially worked';
  if (outcome === 'did_not_work') return "didn't work";
  return 'not reviewed yet';
}

function formatCloudMetricValue(value, metric, domainById, practiceDomainId) {
  const name = textValue(metric?.name, 'Metric');
  const metricDomain = metric?.domain_id && metric.domain_id !== practiceDomainId
    ? ` [${textValue(domainById?.get(metric.domain_id)?.name, 'Unknown domain')}]`
    : '';
  if (value.value_boolean != null) return `${name}${metricDomain}: ${Number(value.value_boolean) ? 'yes' : 'no'}`;
  if (value.value_number != null) return `${name}${metricDomain}: ${value.value_number}`;
  if (value.value_text) return `${name}${metricDomain}: ${value.value_text}`;
  if (value.value_json) return `${name}${metricDomain}: ${value.value_json}`;
  return `${name}${metricDomain}: no response`;
}

function appendOptionalLine(lines, label, value) {
  if (value == null || String(value).trim() === '') return;
  lines.push(`${label}: ${String(value).trim()}`);
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item?.[key];
    if (value == null) continue;
    const list = grouped.get(value) ?? [];
    list.push(item);
    grouped.set(value, list);
  }
  return grouped;
}

function sortByName(items) {
  return [...items].sort((a, b) => textValue(a.name, '').localeCompare(textValue(b.name, '')));
}

function textValue(value, fallback) {
  return value == null || String(value).trim() === '' ? fallback : String(value).trim();
}

function publicErrorMessage(error) {
  if (error?.expose) return error.message;
  if (error?.statusCode && error.statusCode < 500) return error.message;
  if (error?.message === 'Google Drive access expired. Reconnect Google Drive in Settings.') return error.message;
  return 'Google Drive could not be updated. Please try again.';
}

function supabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw httpError(503, 'Account verification is not configured.');
  return { url, anonKey, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

function requireConfiguration() {
  if (!isConfigured()) throw httpError(503, 'Google Drive is not configured on the server yet.');
}

function isConfigured() {
  return missingConfiguration().length === 0;
}

function missingConfiguration() {
  return [
    'GOOGLE_DRIVE_CLIENT_ID',
    'GOOGLE_DRIVE_CLIENT_SECRET',
    'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ].filter((name) => !process.env[name]);
}

function callbackUrl() {
  return `${appOrigin()}/api/google-drive-callback`;
}

function appOrigin() {
  return (process.env.DAILY_CHESHBON_APP_ORIGIN || 'https://dailycheshbon.com').replace(/\/$/, '');
}

function googleDocumentUrl(documentId) {
  return `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`;
}

function readQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports._test = { buildReadableCloudExport, sanitizeDocumentText };
