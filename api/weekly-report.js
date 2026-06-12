const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.5';
const MAX_PROMPT_CHARS = 18000;
const TEXT_LIMIT = 180;

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const data = body?.data;
    if (!data || typeof data !== 'object') {
      return response.status(400).json({ error: 'Weekly report data is required.' });
    }
    const compactData = buildCompactReportData(data);
    const userPrompt = buildUserPrompt(compactData);

    const completionResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_WEEKLY_REPORT_MODEL || DEFAULT_MODEL,
        reasoning: { effort: 'low' },
        max_output_tokens: 3200,
        instructions: buildSystemPrompt(),
        input: userPrompt,
      }),
    });

    const payload = await completionResponse.json().catch(() => null);
    if (!completionResponse.ok) {
      return response.status(completionResponse.status).json({
        error: payload?.error?.message || 'OpenAI report generation failed.',
      });
    }

    const report = extractOutputText(payload);
    if (!report) {
      return response.status(502).json({ error: 'OpenAI returned an empty report.' });
    }

    return response.status(200).json({ report });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not generate weekly report.',
    });
  }
};

function buildSystemPrompt() {
  return `Write a concise Markdown weekly report for Daily Cheshbon, a cheshbon hanefesh app. Be warm, honest, specific, and evidence-based. Do not provide therapy, medical, or halachic rulings. Avoid overclaiming causation.

Use these sections:
# Weekly Report
date range line
## Executive Summary
## What Improved
## Where I Fell Short
## What Went Well
## What Did Not Go Well
## Patterns Worth Noticing
## Domain-by-Domain Review
## Practice Notes
## Questions for Next Week

Use the data only. Mention sparse data when relevant. Keep the report useful and readable.`;
}

function buildUserPrompt(data) {
  let brief = buildAnalysisBrief(data);
  if (brief.length > MAX_PROMPT_CHARS) {
    brief = buildAnalysisBrief(buildTinyReportData(data));
  }
  if (brief.length > MAX_PROMPT_CHARS) {
    brief = buildAnalysisBrief(buildMinimalReportData(data));
  }
  return brief;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const text = [];
  for (const item of asArray(payload?.output)) {
    for (const content of asArray(item?.content)) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        text.push(content.text);
      }
    }
  }
  return text.join('\n').trim();
}

function buildAnalysisBrief(data) {
  return [
    'Generate a Daily Cheshbon weekly report from this curated analysis brief.',
    '',
    `Period: ${data.weekStart} to ${data.reportThrough || data.weekEnd}`,
    `Previous comparison period: ${data.previousWeekLabel || 'not available'}`,
    '',
    'Domain signals:',
    formatScoreLines(data.domains),
    '',
    'Practice signals:',
    formatScoreLines(data.practices),
    '',
    'Daily reviews:',
    formatDailyLines(data.daily),
    '',
    'Blockers:',
    formatBlockerLines(data.blockers),
    '',
    'Notable practice entries and notes:',
    formatEntryLines(data.notableEntries),
  ].join('\n');
}

function formatScoreLines(items) {
  const lines = asArray(items).map((item) => {
    const parts = [
      `- ${item.name || 'Unnamed'}`,
      item.domain ? `domain=${item.domain}` : null,
      item.avg == null ? null : `avg=${item.avg}/5`,
      item.prev == null ? null : `prev=${item.prev}/5`,
      item.delta == null ? null : `delta=${item.delta}`,
      `entries=${item.entries ?? 0}`,
      `done=${item.done ?? 0}`,
      `partial=${item.partial ?? 0}`,
      `missed=${item.missed ?? 0}`,
      `text=${item.textEntries ?? 0}`,
    ].filter(Boolean);
    return parts.join('; ');
  });
  return lines.length ? lines.join('\n') : '- No score data.';
}

function formatDailyLines(days) {
  const lines = asArray(days).map((day) => {
    const pieces = [
      `- ${day.date}`,
      `completed=${day.completed ? 'yes' : 'no'}`,
      day.avg == null ? null : `avg=${day.avg}/5`,
      day.dayRating == null ? null : `day_rating=${day.dayRating}/5`,
      formatList('wins', day.wins),
      formatList('struggles', day.struggles),
      formatList('patterns', day.patterns),
      formatList('adjustments', day.adjustments),
      formatList('notes', day.notes),
      formatReflections(day.reflections),
    ].filter(Boolean);
    return pieces.join('; ');
  });
  return lines.length ? lines.join('\n') : '- No daily review data.';
}

function formatBlockerLines(blockers) {
  const lines = asArray(blockers).map((blocker) => {
    const practices = cleanList(blocker.practices, 6, 60).join(', ');
    return `- ${blocker.name || 'Unnamed'}: ${blocker.count ?? 0}${practices ? `; practices=${practices}` : ''}`;
  });
  return lines.length ? lines.join('\n') : '- No blockers recorded.';
}

function formatEntryLines(entries) {
  const lines = asArray(entries).map((entry) => {
    const parts = [
      `- ${entry.date}`,
      entry.practice,
      entry.domain ? `domain=${entry.domain}` : null,
      entry.score == null ? null : `score=${entry.score}/5`,
      entry.status ? `status=${entry.status}` : null,
      entry.note ? `note="${entry.note}"` : null,
      entry.text ? `text="${entry.text}"` : null,
    ].filter(Boolean);
    return parts.join('; ');
  });
  return lines.length ? lines.join('\n') : '- No notable entries.';
}

function formatList(label, values) {
  const cleaned = cleanList(values, 3, TEXT_LIMIT);
  return cleaned.length ? `${label}=${cleaned.join(' | ')}` : null;
}

function formatReflections(reflections) {
  const cleaned = asArray(reflections)
    .slice(0, 4)
    .map((entry) => `${entry.practice || 'Reflection'}: ${entry.text || ''}`)
    .filter((value) => value.trim());
  return cleaned.length ? `reflections=${cleaned.join(' | ')}` : null;
}

function buildCompactReportData(data) {
  const domains = limitBySignal(asArray(data.domains), 14).map(compactScoreItem);
  const practices = limitBySignal(asArray(data.practices), 42).map((item) => ({
    ...compactScoreItem(item),
    domain: clean(item.domainName, 70),
  }));
  const daily = asArray(data.daily).map((day) => ({
    date: day.date,
    label: day.label,
    completed: Boolean(day.completed),
    avg: numberOrNull(day.average),
    dayRating: numberOrNull(day.generalDayRating),
    wins: cleanList(day.wins, 3, TEXT_LIMIT),
    struggles: cleanList(day.struggles, 3, TEXT_LIMIT),
    patterns: cleanList(day.patterns, 3, TEXT_LIMIT),
    adjustments: cleanList(day.adjustments, 3, TEXT_LIMIT),
    notes: cleanList(day.notes, 4, TEXT_LIMIT),
    reflections: asArray(day.textReflections)
      .filter((entry) => clean(entry.text))
      .slice(0, 8)
      .map((entry) => ({
        practice: clean(entry.practiceName, 70),
        domain: clean(entry.domainName, 70),
        text: clean(entry.text, TEXT_LIMIT),
      })),
  }));
  const blockers = asArray(data.blockers).slice(0, 12).map((blocker) => ({
    name: clean(blocker.blockerName, 80),
    count: blocker.count,
    practices: cleanList(blocker.practices, 8, 70),
    domains: cleanList(blocker.domains, 6, 70),
  }));
  const notableEntries = selectNotableEntries(asArray(data.rawEntries));

  return {
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    reportThrough: data.reportThrough,
    currentWeekLabel: data.currentWeekLabel,
    previousWeekLabel: data.previousWeekLabel,
    domains,
    practices,
    daily,
    blockers,
    notableEntries,
  };
}

function buildTinyReportData(data) {
  return {
    ...data,
    domains: asArray(data.domains).slice(0, 10),
    practices: asArray(data.practices).slice(0, 25),
    daily: asArray(data.daily).map((day) => ({
      date: day.date,
      completed: day.completed,
      avg: day.avg,
      dayRating: day.dayRating,
      wins: cleanList(day.wins, 1, 120),
      struggles: cleanList(day.struggles, 1, 120),
      patterns: cleanList(day.patterns, 1, 120),
      adjustments: cleanList(day.adjustments, 1, 120),
      notes: cleanList(day.notes, 1, 120),
      reflections: asArray(day.reflections).slice(0, 2).map((entry) => ({
        practice: entry.practice,
        text: clean(entry.text, 120),
      })),
    })),
    blockers: asArray(data.blockers).slice(0, 8),
    notableEntries: asArray(data.notableEntries).slice(0, 18).map((entry) => ({
      date: entry.date,
      practice: entry.practice,
      score: entry.score,
      status: entry.status,
      note: clean(entry.note, 120),
      text: clean(entry.text, 120),
    })),
  };
}

function buildMinimalReportData(data) {
  return {
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    reportThrough: data.reportThrough,
    currentWeekLabel: data.currentWeekLabel,
    previousWeekLabel: data.previousWeekLabel,
    domains: asArray(data.domains).slice(0, 8).map((item) => ({
      name: item.name,
      avg: item.avg,
      prev: item.prev,
      delta: item.delta,
      missed: item.missed,
      textEntries: item.textEntries,
    })),
    practices: asArray(data.practices).slice(0, 18).map((item) => ({
      name: item.name,
      domain: item.domain,
      avg: item.avg,
      prev: item.prev,
      delta: item.delta,
      missed: item.missed,
      textEntries: item.textEntries,
    })),
    daily: asArray(data.daily).map((day) => ({
      date: day.date,
      completed: day.completed,
      avg: day.avg,
      dayRating: day.dayRating,
      wins: cleanList(day.wins, 1, 80),
      struggles: cleanList(day.struggles, 1, 80),
      patterns: cleanList(day.patterns, 1, 80),
      adjustments: cleanList(day.adjustments, 1, 80),
      notes: cleanList(day.notes, 1, 80),
      reflections: asArray(day.reflections).slice(0, 1).map((entry) => ({
        practice: entry.practice,
        text: clean(entry.text, 80),
      })),
    })),
    blockers: asArray(data.blockers).slice(0, 5).map((blocker) => ({
      name: blocker.name,
      count: blocker.count,
      practices: cleanList(blocker.practices, 3, 50),
    })),
    notableEntries: asArray(data.notableEntries).slice(0, 10).map((entry) => ({
      date: entry.date,
      practice: entry.practice,
      score: entry.score,
      status: entry.status,
      note: clean(entry.note, 80),
      text: clean(entry.text, 80),
    })),
  };
}

function compactScoreItem(item) {
  return {
    name: clean(item.name, 90),
    avg: numberOrNull(item.average),
    prev: numberOrNull(item.previousAverage),
    delta: numberOrNull(item.delta),
    entries: item.entries ?? 0,
    done: item.done ?? 0,
    partial: item.partial ?? 0,
    missed: item.missed ?? 0,
    textEntries: item.textEntries ?? 0,
  };
}

function selectNotableEntries(entries) {
  return entries
    .filter((entry) => clean(entry.note) || clean(entry.text) || entry.status === 'missed' || entry.status === 'partial' || lowScore(entry))
    .sort((a, b) => entrySignal(b) - entrySignal(a))
    .slice(0, 45)
    .map((entry) => ({
      date: entry.date,
      domain: clean(entry.domainName, 70),
      practice: clean(entry.practiceName, 90),
      metric: clean(entry.metricName, 70),
      type: entry.metricType ?? null,
      status: entry.status ?? null,
      score: numberOrNull(entry.score),
      note: clean(entry.note, TEXT_LIMIT),
      text: clean(entry.text, TEXT_LIMIT),
    }));
}

function limitBySignal(items, limit) {
  return [...items]
    .sort((a, b) => scoreSignal(b) - scoreSignal(a) || String(a.name ?? '').localeCompare(String(b.name ?? '')))
    .slice(0, limit);
}

function scoreSignal(item) {
  const delta = Math.abs(Number(item.delta ?? 0));
  const missed = Number(item.missed ?? 0);
  const text = Number(item.textEntries ?? 0);
  const entries = Number(item.entries ?? 0);
  const low = item.average == null ? 0 : Math.max(0, 3 - Number(item.average));
  return delta * 4 + missed * 2 + text * 1.5 + low + entries * 0.1;
}

function entrySignal(entry) {
  return (clean(entry.note) ? 6 : 0) + (clean(entry.text) ? 6 : 0) + (entry.status === 'missed' ? 4 : 0) + (entry.status === 'partial' ? 2 : 0) + (lowScore(entry) ? 3 : 0);
}

function lowScore(entry) {
  return typeof entry.score === 'number' && entry.score <= 2;
}

function cleanList(values, limit, textLimit) {
  return [...new Set(asArray(values).map((value) => clean(value, textLimit)).filter(Boolean))].slice(0, limit);
}

function clean(value, limit = TEXT_LIMIT) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}
