const tls = require('node:tls');

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const MAX_ATTACHMENT_CHARS = 1_500_000;

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const emailUser = process.env.DAILY_CHESHBON_EMAIL_USER;
    const emailPassword = process.env.DAILY_CHESHBON_EMAIL_PASSWORD;
    if (!emailUser || !emailPassword) {
      return response.status(500).json({ error: 'Daily Cheshbon email is not configured on the server.' });
    }

    const user = await getSupabaseUser(request.headers.authorization);
    if (!user?.email) {
      return response.status(401).json({ error: 'Sign in before emailing yourself.' });
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const subject = cleanHeader(body?.subject) || 'Daily Cheshbon export';
    const text = typeof body?.text === 'string' ? body.text : 'Attached from Daily Cheshbon.';
    const attachments = validateAttachments(body?.attachments);

    await sendSmtpMail({
      from: emailUser,
      password: emailPassword,
      to: user.email,
      subject,
      text,
      attachments,
    });

    return response.status(200).json({ sent: true, to: user.email });
  } catch (error) {
    return response.status(error?.statusCode ?? 500).json({
      error: error instanceof Error ? error.message : 'Could not send email.',
    });
  }
};

async function getSupabaseUser(authorization) {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw httpError(401, 'Sign in before emailing yourself.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw httpError(500, 'Account verification is not configured on the server.');
  }

  const result = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!result.ok) throw httpError(401, 'Sign in before emailing yourself.');
  return result.json();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateAttachments(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Email attachment is required.');
  }
  if (value.length > 2) {
    throw new Error('Too many attachments.');
  }
  return value.map((attachment) => {
    const filename = cleanFilename(attachment?.filename);
    const content = typeof attachment?.content === 'string' ? attachment.content : '';
    if (!filename || !content) throw new Error('Attachment filename and content are required.');
    if (content.length > MAX_ATTACHMENT_CHARS) throw new Error('Attachment is too large to email.');
    return {
      filename,
      content,
      contentType: cleanHeader(attachment?.contentType) || 'text/plain; charset=utf-8',
    };
  });
}

async function sendSmtpMail({ from, password, to, subject, text, attachments }) {
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
      pending.push((response) => {
        clearTimeout(timeout);
        resolve(response);
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
    socket.write(`${buildMimeMessage({ from, to, subject, text, attachments })}\r\n.\r\n`);
    await expect(readResponse(), 250);
    writeLine('QUIT');
    await readResponse().catch(() => null);
  } finally {
    socket.end();
  }
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
  const response = await responsePromise;
  if (response.code !== code) {
    throw new Error(`Email server rejected the message: ${response.message}`);
  }
}

function buildMimeMessage({ from, to, subject, text, attachments }) {
  const boundary = `daily-cheshbon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const parts = [
    `From: Daily Cheshbon <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(text),
  ];

  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      wrapBase64(Buffer.from(attachment.content, 'utf8').toString('base64')),
    );
  }

  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n');
}

function dotStuff(value) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function cleanHeader(value) {
  return typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim() : '';
}

function cleanFilename(value) {
  const text = cleanHeader(value).replace(/[^a-zA-Z0-9._-]/g, '-');
  return text.slice(0, 120);
}

function encodeHeader(value) {
  if (/^[\x00-\x7F]*$/.test(value)) return cleanHeader(value);
  return `=?UTF-8?B?${Buffer.from(cleanHeader(value), 'utf8').toString('base64')}?=`;
}
