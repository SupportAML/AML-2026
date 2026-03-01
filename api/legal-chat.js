import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, caseContext } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemPrompt = buildSystemPrompt(caseContext || {});

  // Set up streaming response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 12000,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Claude API error:', error);

    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || 'Claude API request failed' });
    }

    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
    res.end();
  }
}

function buildSystemPrompt(ctx) {
  const parts = [
    'You are a Physician Expert and medical-legal consultant assisting with drafting formal Medical-Legal Reports for litigation.',
    'Tone: authoritative, clinical, precise, and court-ready.',
    '',
    'CRITICAL RULES:',
    '1) Use ONLY the provided case notes, annotations, and document list when referencing specific case facts.',
    '2) Do NOT fabricate facts; if a detail is missing, state it as a limitation.',
    '3) Be thorough and comprehensive. Do not be overly concise.',
    '4) Prefer narrative paragraphs over bullet-only sections unless the user requests bullets.',
    '5) When drafting report sections, use proper Markdown formatting:',
    '   - Main title: "# MEDICAL-LEGAL REPORT" (all caps)',
    '   - Major sections: "## I. SECTION NAME" (Roman numerals, all caps)',
    '   - Sub-sections: "### A. Sub-section" (bold label optional)',
    '   - Use horizontal rules (---) between major sections',
    '   - Use full paragraphs with blank lines between them',
    '6) You may draw on your medical knowledge to explain clinical reasoning, standard of care, pharmacology, and medical literature — but always clearly distinguish between case-specific facts (from the provided data) and general medical knowledge.',
    '7) When the user asks you to draft a report or section, produce court-ready prose that can be directly inserted into a formal report.',
    '8) You can also answer medical-legal questions, explain clinical concepts, suggest arguments, or help refine existing text.',
  ];

  if (ctx.caseTitle || ctx.caseDescription) {
    parts.push('', '--- CASE INFORMATION ---');
    if (ctx.caseTitle) parts.push(`Case Title: ${ctx.caseTitle}`);
    if (ctx.caseDescription) parts.push(`Case Description: ${ctx.caseDescription}`);
  }

  if (ctx.qualifications) {
    parts.push('', '--- EXPERT CREDENTIALS ---');
    parts.push(ctx.qualifications);
  }

  if (ctx.documents) {
    parts.push('', '--- DOCUMENTS REVIEWED ---');
    parts.push(ctx.documents);
  }

  if (ctx.annotations) {
    parts.push('', '--- PDF ANNOTATIONS & EVIDENCE EXCERPTS ---');
    parts.push(ctx.annotations);
  }

  if (ctx.pdfTextContext) {
    parts.push('', '--- PDF TEXT EXCERPTS (FROM SOURCE DOCUMENTS) ---');
    parts.push(ctx.pdfTextContext);
  }

  if (ctx.clinicalNotes) {
    parts.push('', '--- CASE NOTES / CLINICAL NOTES ---');
    parts.push(ctx.clinicalNotes);
  }

  if (ctx.currentDraft) {
    parts.push('', '--- CURRENT REPORT DRAFT (for reference/editing) ---');
    parts.push(ctx.currentDraft);
  }

  return parts.join('\n');
}
