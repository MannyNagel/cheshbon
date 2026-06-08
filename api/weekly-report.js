const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const MAX_PROMPT_CHARS = 18000;
const TEXT_LIMIT = 180;

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'GROQ_API_KEY is not configured on the server.' });
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const data = body?.data;
    if (!data || typeof data !== 'object') {
      return response.status(400).json({ error: 'Weekly report data is required.' });
    }
    const compactData = buildCompactReportData(data);
    const userPrompt = buildUserPrompt(compactData);

    const completionResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_WEEKLY_REPORT_MODEL || DEFAULT_MODEL,
        temperature: 0.35,
        max_completion_tokens: 3200,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    const payload = await completionResponse.json().catch(() => null);
    if (!completionResponse.ok) {
      return response.status(completionResponse.status).json({
        error: payload?.error?.message || 'Groq report generation failed.',
      });
    }

    const report = payload?.choices?.[0]?.message?.content;
    if (!report) {
      return response.status(502).json({ error: 'Groq returned an empty report.' });
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
  let json = JSON.stringify(data);
  if (json.length > MAX_PROMPT_CHARS) {
    json = JSON.stringify(buildTinyReportData(data));
  }
  if (json.length > MAX_PROMPT_CHARS) {
    json = JSON.stringify(buildMinimalReportData(data));
  }
  return `Generate a weekly report from this compact Daily Cheshbon data. JSON:${json}`;
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
    generatedAt: data.generatedAt,
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
    generatedAt: data.generatedAt,
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
