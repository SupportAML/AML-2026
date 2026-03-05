import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const maxContentLength = 50000;
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '\n\n[Report truncated for analysis]'
    : content;

  const systemPrompt = `You are a Senior Medical-Legal Researcher. Identify the TOP 5-8 CRITICAL research gaps in this report.
You MUST respond with CONCISE valid JSON: an array of objects with "topic" (short phrase) and "reason" (1 sentence max) fields.
Keep responses brief - aim for 5-8 gaps maximum.`;

  const userPrompt = `Analyze this report and identify the TOP 5-8 most critical research gaps where additional medical literature would strengthen the case:

${truncatedContent}

Return ONLY a JSON array. Example format:
[
  {"topic": "Post-operative monitoring standards", "reason": "Report lacks specific guidelines reference."},
  {"topic": "Medication interaction data", "reason": "No peer-reviewed studies cited for drug combination."}
]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON array from response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const startIdx = jsonText.indexOf('[');
    if (startIdx !== -1) {
      let depth = 0;
      for (let i = startIdx; i < jsonText.length; i++) {
        if (jsonText[i] === '[') depth++;
        if (jsonText[i] === ']') depth--;
        if (depth === 0) {
          jsonText = jsonText.substring(startIdx, i + 1);
          break;
        }
      }
    }

    const gaps = JSON.parse(jsonText);
    return res.status(200).json({ gaps });
  } catch (error) {
    console.error('research-gaps error:', error);
    return res.status(500).json({ gaps: [] });
  }
}
