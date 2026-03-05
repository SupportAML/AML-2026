import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, article } = req.body;

  if (!content || !article) {
    return res.status(400).json({ error: 'content and article are required' });
  }

  const systemPrompt = `You are a medical-legal citation expert.

CRITICAL RULES:
- DO NOT modify the report header, case title, case identification, dates, "Prepared by" lines, author information, expert credentials, or any metadata sections.
- DO NOT modify the first 10 lines of the report under any circumstances.
- ONLY insert citations into the BODY paragraphs where the research is clinically relevant.
- Preserve ALL existing formatting, section headers, numbering, and structure exactly as-is.
- Add the citation in-line using standard legal citation format (e.g., "Author et al., Journal, Year").
- If a bibliography/references section exists, append the full citation there. If not, create one at the end.
- The changes should be minimal and surgical — only add the citation text, do not rewrite surrounding content.

You MUST respond with valid JSON matching this structure:
{
  "newContent": "string",
  "explanation": "string"
}`;

  const userPrompt = `Propose a MINIMAL citation insertion for this article into the report. Only modify body paragraphs where the research is relevant. Do NOT touch headers, metadata, or case identification.\n\nArticle: ${JSON.stringify(article)}\n\nReport:\n${content}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

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

    const parsed = JSON.parse(jsonText);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('smart-cite error:', error);
    return res.status(500).json({
      newContent: content,
      explanation: 'Citation insertion failed.',
    });
  }
}
