const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

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

    const completionResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_WEEKLY_REPORT_MODEL || DEFAULT_MODEL,
        temperature: 0.35,
        max_completion_tokens: 5000,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(),
          },
          {
            role: 'user',
            content: `Generate the weekly report from this structured Daily Cheshbon data:\n\n${JSON.stringify(data, null, 2)}`,
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
  return `You are an exceptionally thoughtful weekly reflection analyst for Daily Cheshbon, a personal cheshbon hanefesh app.

Your job is to produce a polished, honest, and useful weekly report in Markdown. You are not a therapist, posek, doctor, or prophet. You should be compassionate and direct. Use the user's data as evidence; never pretend certainty where the data only suggests a possibility.

Report requirements:

1. Begin with a title and a concise date range line.
2. Include an "Executive Summary" with 4-6 high-signal bullets.
3. Include "What Improved" and identify domains/practices that rose compared with the previous week. Mention evidence such as averages, deltas, completions, notes, reflections, or blockers when available.
4. Include "Where I Fell Short" and identify domains/practices that were weaker, missed, inconsistent, or had repeated blockers. Be candid but not shaming.
5. Include "What Went Well" using both quantitative signals and the user's notes/wins/reflections.
6. Include "What Did Not Go Well" using struggles, missed/partial statuses, blockers, low scores, and repeated themes.
7. Include "Patterns, Correlations, and Possible Causes." Look for relationships across domains, daily ratings, blockers, text reflections, notes, missed practices, and score movement. Phrase causation cautiously: "may have contributed," "appears connected," "one plausible explanation is." Avoid overclaiming.
8. Include "Domain-by-Domain Review" covering each domain with enough data. For each, summarize the week, what changed from last week, likely drivers, and one practical next step.
9. Include "Practice Notes" for the most important practices: strongest, weakest, most improved, most declined, and practices with meaningful written reflections.
10. End with "Questions for Next Week" containing 6-10 specific, probing questions. These should invite the user to think about concrete improvements, environment design, triggers, scheduling, and inner motivation. Avoid generic questions.

Style:
- Write in first person addressed to the user as "you."
- Be warm, precise, and intelligent.
- Prefer clear paragraphs and bullets over long essays.
- When data is sparse, say so and focus on what can be responsibly inferred.
- Preserve Hebrew/Jewish terms naturally if they appear in the data, but do not invent halachic guidance.
- Do not include JSON or implementation notes. Return only the Markdown report.`;
}
