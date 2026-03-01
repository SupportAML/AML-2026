import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, instruction, isSelection } = req.body;

  if (!content || !instruction) {
    return res.status(400).json({ error: 'content and instruction are required' });
  }

  const systemPrompt = isSelection
    ? `You are a thoroughly trained Medical-Legal Report Editor.
You are editing ONLY a selected excerpt from a larger document.

You MUST respond with valid JSON matching this structure:
{
  "suggestions": [
    {
      "original": "exact text from the selection",
      "suggested": "rewritten version",
      "reason": "brief explanation of improvement"
    }
  ]
}

RULES:
1) Rewrite or rephrase ONLY the provided selection. Do not modify content outside this selection.
2) Produce 1-3 focused suggestions for the selected text.
3) The "original" field must be copied VERBATIM from the provided text.
4) The "suggested" field should be an improved version of that excerpt only.
5) Preserve formatting (bold, headings, spacing) where present.
6) Maintain the formal, court-ready medical-legal tone.
7) If no changes are needed, return an empty suggestions array.`

    : `You are a thoroughly trained Medical-Legal Report Editor.
You MUST respond with valid JSON matching this structure:
{
  "suggestions": [
    {
      "original": "exact text from the report",
      "suggested": "rewritten version",
      "reason": "brief explanation of improvement"
    }
  ]
}

RULES:
1) Review the ENTIRE report and produce 3-8 targeted improvements spread throughout the document.
2) Each suggestion must be a SMALL, RELEVANT excerpt (do NOT rewrite the entire report).
3) The "original" field must be copied VERBATIM from the report.
4) The "suggested" field should be an improved version of that excerpt only.
5) Maintain the formal, court-ready medical-legal tone.
6) If no changes are needed, return an empty suggestions array.`;

  const userPrompt = isSelection
    ? `Selected text to rewrite:\n\n${content}\n\nInstruction: ${instruction}`
    : `Report Content:\n\n${content}\n\nInstruction: ${instruction}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    let parsed;
    try {
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to extract JSON object
      const startIdx = jsonText.indexOf('{');
      if (startIdx !== -1) {
        let depth = 0;
        for (let i = startIdx; i < jsonText.length; i++) {
          if (jsonText[i] === '{') depth++;
          if (jsonText[i] === '}') depth--;
          if (depth === 0) {
            jsonText = jsonText.substring(startIdx, i + 1);
            break;
          }
        }
      }

      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return res.status(200).json({ suggestions: [] });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Claude suggest-edit error:', error);
    return res.status(500).json({ error: error.message || 'Claude API request failed' });
  }
}
