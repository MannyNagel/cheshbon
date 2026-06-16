const tls = require('node:tls');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const DEFAULT_FROM_NAME = 'Daily Cheshbon';
const SENT_MARKER_KEY = 'morning_email_last_sent_date';

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    validateCronRequest(request);
    const config = getConfig();
    const today = todayIsoInTimeZone('America/New_York');
    const yesterday = addDaysIso(today, -1);
    const [users, snapshots] = await Promise.all([
      listSupabaseUsers(config),
      listCloudSnapshots(config),
    ]);
    const usersById = new Map(users.filter((user) => user.email).map((user) => [user.id, user]));
    const results = [];

    for (const row of snapshots) {
      const user = usersById.get(row.user_id);
      if (!user?.email) continue;
      const snapshot = normalizeSnapshot(row.snapshot);
      if (!morningReminderEnabled(snapshot)) {
        results.push({ userId: row.user_id, email: user.email, skipped: 'morning reminder off' });
        continue;
      }
      if (getPreference(snapshot, SENT_MARKER_KEY) === today) {
        results.push({ userId: row.user_id, email: user.email, skipped: 'already sent today' });
        continue;
      }

      const body = buildMorningEmail({ snapshot, today, yesterday, user });
      await sendSmtpMail({
        from: config.emailUser,
        password: config.emailPassword,
        to: user.email,
        subject: `Good morning - Daily Cheshbon - ${today}`,
        text: body,
      });
      setPreference(snapshot, SENT_MARKER_KEY, today);
      await updateCloudSnapshot(config, row.user_id, snapshot);
      results.push({ userId: row.user_id, email: user.email, sent: true });
    }

    return response.status(200).json({
      date: today,
      processed: results.length,
      sent: results.filter((item) => item.sent).length,
      skipped: results.filter((item) => item.skipped).length,
      results,
    });
  } catch (error) {
    return response.status(error?.statusCode ?? 500).json({
      error: error instanceof Error ? error.message : 'Could not send morning reminder emails.',
    });
  }
};

function validateCronRequest(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;
  const header = request.headers.authorization ?? request.headers.Authorization;
  if (header !== `Bearer ${cronSecret}`) {
    throw httpError(401, 'Unauthorized.');
  }
}

function getConfig() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const emailUser = process.env.DAILY_CHESHBON_EMAIL_USER;
  const emailPassword = process.env.DAILY_CHESHBON_EMAIL_PASSWORD;
  if (!supabaseUrl || !serviceRoleKey) {
    throw httpError(500, 'Supabase service access is not configured on the server.');
  }
  if (!emailUser || !emailPassword) {
    throw httpError(500, 'Daily Cheshbon email is not configured on the server.');
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), serviceRoleKey, emailUser, emailPassword };
}

async function listSupabaseUsers(config) {
  const users = [];
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const result = await fetch(`${config.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: serviceHeaders(config),
    });
    if (!result.ok) throw httpError(result.status, `Could not list Supabase users: ${await result.text()}`);
    const payload = await result.json();
    const nextUsers = Array.isArray(payload?.users) ? payload.users : [];
    users.push(...nextUsers);
    if (nextUsers.length < perPage) break;
  }
  return users;
}

async function listCloudSnapshots(config) {
  const result = await fetch(`${config.supabaseUrl}/rest/v1/cloud_snapshots?select=user_id,snapshot`, {
    headers: serviceHeaders(config),
  });
  if (!result.ok) throw httpError(result.status, `Could not read cloud snapshots: ${await result.text()}`);
  const payload = await result.json();
  return Array.isArray(payload) ? payload : [];
}

async function updateCloudSnapshot(config, userId, snapshot) {
  const result = await fetch(`${config.supabaseUrl}/rest/v1/cloud_snapshots?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      ...serviceHeaders(config),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ snapshot, updated_at: new Date().toISOString() }),
  });
  if (!result.ok) throw httpError(result.status, `Could not update morning email sent marker: ${await result.text()}`);
}

function serviceHeaders(config) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };
}

function normalizeSnapshot(snapshot) {
  const next = snapshot && typeof snapshot === 'object' ? snapshot : {};
  if (!next.tables || typeof next.tables !== 'object') next.tables = {};
  return next;
}

function morningReminderEnabled(snapshot) {
  return getPreference(snapshot, 'morning_reminder_enabled') !== '0';
}

function getPreference(snapshot, key) {
  const row = (snapshot.tables?.app_preferences ?? []).find((item) => item?.key === key);
  return typeof row?.value === 'string' ? row.value : null;
}

function setPreference(snapshot, key, value) {
  const rows = Array.isArray(snapshot.tables.app_preferences) ? [...snapshot.tables.app_preferences] : [];
  const now = new Date().toISOString();
  const existing = rows.find((row) => row?.key === key);
  if (existing) {
    existing.value = value;
    existing.updated_at = now;
  } else {
    rows.push({ key, value, created_at: now, updated_at: now });
  }
  snapshot.tables.app_preferences = rows;
}

function buildMorningEmail({ snapshot, today, yesterday, user }) {
  const name = displayName(user);
  const dailyAvodah = latestPracticeText(snapshot, today, {
    ids: ['practice_daily_avodah'],
    nameIncludes: ['daily avodah'],
  });
  const weeklyAvodah = latestPracticeText(snapshot, today, {
    ids: ['practice_weekly_avodah'],
    nameIncludes: ['weekly avodah'],
  });
  const monthlyAvodah = latestPracticeText(snapshot, today, {
    ids: ['practice_rosh_chodesh_improvement'],
    nameIncludes: ['monthly avodah', 'rosh chodesh avodah'],
  });
  const completedReview = buildYesterdayReview(snapshot, yesterday);

  return [
    `Good morning${name ? ` ${name}` : ''},`,
    '',
    'Here is your Daily Cheshbon morning reminder.',
    '',
    '## Current Avodah',
    formatAvodahLine('Daily Avodah', dailyAvodah),
    formatAvodahLine('Weekly Avodah', weeklyAvodah),
    formatAvodahLine('Monthly Avodah', monthlyAvodah),
    '',
    `## Yesterday's Completed Review (${yesterday})`,
    ...completedReview,
    '',
    'Have a focused, intentional day.',
  ].join('\n');
}

function latestPracticeText(snapshot, today, selector) {
  const practices = snapshot.tables?.practices ?? [];
  const matchingIds = new Set(
    practices
      .filter((practice) => {
        const name = String(practice?.name ?? '').toLowerCase();
        return selector.ids.includes(practice?.id) || selector.nameIncludes.some((part) => name.includes(part));
      })
      .map((practice) => practice.id)
      .filter(Boolean),
  );
  if (!matchingIds.size) return null;

  const metricIds = new Set(
    (snapshot.tables?.metrics ?? [])
      .filter((metric) => matchingIds.has(metric?.practice_id) && metric?.metric_type === 'text')
      .map((metric) => metric.id)
      .filter(Boolean),
  );
  const entriesById = new Map(
    (snapshot.tables?.daily_entries ?? [])
      .filter((entry) => matchingIds.has(entry?.practice_id) && entry?.entry_date < today)
      .map((entry) => [entry.id, entry]),
  );
  const values = [];
  for (const value of snapshot.tables?.entry_metric_values ?? []) {
    if (!metricIds.has(value?.metric_id)) continue;
    const entry = entriesById.get(value?.entry_id);
    const text = cleanText(value?.value_text);
    if (entry && text) values.push({ date: entry.entry_date, text });
  }
  for (const entry of entriesById.values()) {
    const text = cleanText(entry.note);
    if (text) values.push({ date: entry.entry_date, text });
  }
  return values.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function formatAvodahLine(label, value) {
  if (!value) return `- ${label}: Not found yet.`;
  return `- ${label} (${value.date}): ${value.text}`;
}

function buildYesterdayReview(snapshot, yesterday) {
  const session = (snapshot.tables?.daily_review_sessions ?? []).find((row) => row?.review_date === yesterday);
  if (!session) return ['No review was found for yesterday.'];
  if (!session.completed_at) return ['Yesterday has a saved review, but it was not marked complete.'];

  const lines = [
    `Completed: yes`,
    `Sleep: ${session.bed_time || 'n/a'} to ${session.wake_time || 'n/a'}`,
    ...optionalLine('Note', session.note),
  ];
  const entries = reviewEntries(snapshot, yesterday);
  if (!entries.length) return [...lines, '', 'No practice entries were found.'];

  lines.push('', 'Practices reviewed:');
  for (const entry of entries) {
    lines.push(formatReviewEntry(entry));
  }
  return lines;
}

function reviewEntries(snapshot, date) {
  const practicesById = new Map((snapshot.tables?.practices ?? []).map((row) => [row.id, row]));
  const domainsById = new Map((snapshot.tables?.domains ?? []).map((row) => [row.id, row]));
  const metricsById = new Map((snapshot.tables?.metrics ?? []).map((row) => [row.id, row]));
  const blockersById = new Map((snapshot.tables?.blockers ?? []).map((row) => [row.id, row]));
  const blockerIdsByEntryId = new Map();
  for (const row of snapshot.tables?.entry_blockers ?? []) {
    const list = blockerIdsByEntryId.get(row.entry_id) ?? [];
    list.push(row.blocker_id);
    blockerIdsByEntryId.set(row.entry_id, list);
  }
  const valuesByEntryId = new Map();
  for (const value of snapshot.tables?.entry_metric_values ?? []) {
    const metric = metricsById.get(value.metric_id);
    if (!metric) continue;
    const list = valuesByEntryId.get(value.entry_id) ?? [];
    list.push(formatMetricValue(metric, value));
    valuesByEntryId.set(value.entry_id, list.filter(Boolean));
  }

  return (snapshot.tables?.daily_entries ?? [])
    .filter((entry) => entry.entry_date === date)
    .map((entry) => {
      const practice = practicesById.get(entry.practice_id);
      const domain = domainsById.get(practice?.domain_id);
      const blockers = (blockerIdsByEntryId.get(entry.id) ?? [])
        .map((blockerId) => blockersById.get(blockerId)?.name)
        .filter(Boolean);
      return {
        practiceName: practice?.name ?? 'Practice',
        domainName: domain?.name ?? 'Domain',
        status: entry.status,
        note: cleanText(entry.note),
        values: valuesByEntryId.get(entry.id) ?? [],
        blockers,
      };
    })
    .sort((a, b) => a.domainName.localeCompare(b.domainName) || a.practiceName.localeCompare(b.practiceName));
}

function formatReviewEntry(entry) {
  const details = [
    entry.status ? `status: ${entry.status}` : null,
    ...entry.values,
    entry.blockers.length ? `blockers: ${entry.blockers.join(', ')}` : null,
    entry.note ? `note: ${entry.note}` : null,
  ].filter(Boolean);
  return `- ${entry.practiceName} (${entry.domainName})${details.length ? ` - ${details.join('; ')}` : ''}`;
}

function formatMetricValue(metric, value) {
  if (metric.metric_type === 'boolean' && value.value_boolean != null) {
    return `${metric.name}: ${value.value_boolean ? 'yes' : 'no'}`;
  }
  if ((metric.metric_type === 'scale' || metric.metric_type === 'number') && value.value_number != null) {
    return `${metric.name}: ${value.value_number}`;
  }
  if (metric.metric_type === 'text' && cleanText(value.value_text)) {
    return `${metric.name}: ${cleanText(value.value_text)}`;
  }
  return null;
}

function optionalLine(label, value) {
  const text = cleanText(value);
  return text ? [`${label}: ${text}`] : [];
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function displayName(user) {
  const metadata = user.user_metadata ?? {};
  const name = metadata.full_name ?? metadata.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function todayIsoInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysIso(date, delta) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + delta));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

async function sendSmtpMail({ from, password, to, subject, text }) {
  const socket = tls.connect({
    host: SMTP_HOST,
    port: SMTP_PORT,
    servername: SMTP_HOST,
  });

  let buffer = '';
  const pending = [];
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    flushResponses();
  });

  function flushResponses() {
    const response = parseResponse(buffer);
    if (!response) return;
    buffer = buffer.slice(response.length);
    const next = pending.shift();
    if (next) next(response);
    flushResponses();
  }

  function readResponse() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Email server timed out.')), 20000);
      pending.push((smtpResponse) => {
        clearTimeout(timeout);
        resolve(smtpResponse);
      });
      flushResponses();
    });
  }

  function writeLine(line) {
    socket.write(`${line}\r\n`);
  }

  try {
    await expect(readResponse(), 220);
    writeLine('EHLO dailycheshbon.com');
    await expect(readResponse(), 250);
    writeLine('AUTH LOGIN');
    await expect(readResponse(), 334);
    writeLine(Buffer.from(from).toString('base64'));
    await expect(readResponse(), 334);
    writeLine(Buffer.from(password).toString('base64'));
    await expect(readResponse(), 235);
    writeLine(`MAIL FROM:<${from}>`);
    await expect(readResponse(), 250);
    writeLine(`RCPT TO:<${to}>`);
    await expect(readResponse(), 250);
    writeLine('DATA');
    await expect(readResponse(), 354);
    socket.write(`${buildTextMessage({ from, to, subject, text })}\r\n.\r\n`);
    await expect(readResponse(), 250);
    writeLine('QUIT');
    await readResponse().catch(() => null);
  } finally {
    socket.end();
  }
}

function buildTextMessage({ from, to, subject, text }) {
  return [
    `From: ${DEFAULT_FROM_NAME} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(text),
  ].join('\r\n');
}

function parseResponse(value) {
  const lines = value.split(/\r\n/);
  if (lines.length < 2) return null;
  let consumed = 0;
  const responseLines = [];
  for (const line of lines) {
    if (!line) {
      consumed += 2;
      continue;
    }
    responseLines.push(line);
    consumed += line.length + 2;
    if (/^\d{3} /.test(line)) {
      return {
        code: Number(line.slice(0, 3)),
        message: responseLines.join('\n'),
        length: consumed,
      };
    }
  }
  return null;
}

async function expect(responsePromise, code) {
  const smtpResponse = await responsePromise;
  if (smtpResponse.code !== code) {
    throw new Error(`Email server rejected the message: ${smtpResponse.message}`);
  }
}

function dotStuff(value) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function encodeHeader(value) {
  const clean = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x00-\x7F]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
