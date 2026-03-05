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

  const systemPrompt = `You are a Senior Medical-Legal Researcher specializing in finding statistical and quantitative evidence from peer-reviewed literature to support claims in medical-legal reports.

Your job is to identify specific factual claims in the report that would be strengthened by citing published statistics, outcomes data, clinical trial results, or evidence-based guidelines. For each gap, generate a precise PubMed search query that would find the best supporting evidence.

You MUST respond with CONCISE valid JSON: an array of objects with "topic" (a PubMed-optimized search query), and "reason" (1 sentence explaining what statistic or evidence this would provide).
Return 5-8 gaps maximum.`;

  const userPrompt = `Analyze this medical-legal report and identify 5-8 specific claims or assertions that need statistical evidence or published data to back them up.

For each gap, generate a SPECIFIC PubMed search query designed to find quantitative data — outcomes, effect sizes, incidence rates, clinical trial results, or guideline recommendations with cited statistics.

IMPORTANT: The "topic" field must be a targeted PubMed search query, NOT a vague topic name. Include relevant medical terms, drug names, scales (e.g., NIHSS), and outcome measures.

Report to analyze:
${truncatedContent}

Return ONLY a JSON array. Example format:
[
  {"topic": "tenecteplase NIHSS improvement outcomes acute ischemic stroke clinical trial", "reason": "Report claims NIHSS should improve after tenecteplase — needs expected improvement ranges from published trials."},
  {"topic": "door-to-needle time thrombolysis outcomes mortality systematic review", "reason": "Report references treatment delays — needs published data on how delays affect patient outcomes."},
  {"topic": "aspirin dual antiplatelet therapy recurrent stroke prevention RCT", "reason": "Report recommends antiplatelet therapy — needs efficacy statistics from randomized trials."}
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
