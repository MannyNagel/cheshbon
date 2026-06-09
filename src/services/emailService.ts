import { supabase } from '@/src/services/supabaseClient';

type EmailAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

export async function emailSelf(input: {
  subject: string;
  text: string;
  attachments: EmailAttachment[];
}) {
  if (!supabase) throw new Error('Account email is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in before emailing yourself.');

  const response = await fetch('/api/email-self', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as { sent?: boolean; to?: string; error?: string } | null;
  if (!response.ok || !payload?.sent) {
    throw new Error(payload?.error ?? 'Could not send email.');
  }
  return payload.to ?? 'your account email';
}

export async function emailRawDataToSelf(json: string) {
  return emailSelf({
    subject: `Daily Cheshbon raw data export - ${new Date().toLocaleDateString()}`,
    text: 'Your raw Daily Cheshbon data export is attached as JSON.',
    attachments: [
      {
        filename: `daily-cheshbon-raw-data-${new Date().toISOString().slice(0, 10)}.json`,
        content: json,
        contentType: 'application/json; charset=utf-8',
      },
    ],
  });
}

export async function emailWeeklyReportToSelf(
  reportMarkdown: string,
  range: { weekStart: string; weekEnd?: string; reportThrough?: string },
  weeklyDataJson: string,
) {
  const end = range.reportThrough ?? range.weekEnd ?? range.weekStart;
  return emailSelf({
    subject: `Daily Cheshbon weekly report - ${range.weekStart} to ${end}`,
    text: 'Your Daily Cheshbon weekly report and the raw weekly data used for it are attached.',
    attachments: [
      {
        filename: `daily-cheshbon-weekly-report-${range.weekStart}-to-${end}.md`,
        content: reportMarkdown,
        contentType: 'text/markdown; charset=utf-8',
      },
      {
        filename: `daily-cheshbon-weekly-data-${range.weekStart}-to-${end}.json`,
        content: weeklyDataJson,
        contentType: 'application/json; charset=utf-8',
      },
    ],
  });
}
