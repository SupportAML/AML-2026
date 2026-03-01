import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const REPORT_TEMPLATES = {
  ime: {
    label: 'IME Report',
    template: `
I. HEADER
II. QUESTION PRESENTED / SCOPE
III. DOCUMENTS REVIEWED
IV. HISTORY & RECORDS REVIEW
V. EXAMINATION SUMMARY (IF PROVIDED)
VI. DIAGNOSTIC STUDIES
VII. ANALYSIS
VIII. OPINIONS
IX. EXPERT DISCLOSURES (IF PROVIDED)
X. LIMITATIONS
XI. CERTIFICATION`
  },
  causation: {
    label: 'Causation Analysis',
    template: `
I. HEADER
II. QUESTION PRESENTED
III. DOCUMENTS REVIEWED
IV. MEDICAL HISTORY & TIMELINE
V. MEDICAL ANALYSIS
VI. CAUSATION OPINION(S)
VII. ALTERNATIVE CAUSES
VIII. EXPERT DISCLOSURES (IF PROVIDED)
IX. LIMITATIONS
X. CERTIFICATION`
  },
  rebuttal: {
    label: 'Rebuttal Report',
    template: `
I. HEADER
II. SUMMARY OF OPPOSING OPINIONS
III. DOCUMENTS REVIEWED
IV. REBUTTAL ANALYSIS
V. SUPPORTING FACTS/DATA
VI. CONCLUSIONS / OPINIONS
VII. EXPERT DISCLOSURES (IF PROVIDED)
VIII. LIMITATIONS
IX. CERTIFICATION`
  },
  chronology: {
    label: 'Chronology Summary',
    template: `
I. HEADER
II. DOCUMENTS REVIEWED
III. CLINICAL TIMELINE
IV. KEY CLINICAL FINDINGS
V. ANALYTICAL NOTES
VI. LIMITATIONS
VII. CERTIFICATION`
  },
  deposition: {
    label: 'Deposition Prep Memo',
    template: `
I. HEADER
II. PURPOSE & SCOPE
III. KEY FACTS
IV. KEY MEDICAL ISSUES
V. LIKELY LINES OF QUESTIONING
VI. EXHIBIT LIST
VII. RISK AREAS / WEAKNESSES
VIII. LIMITATIONS
IX. CERTIFICATION`
  }
};

function resolveTemplate(templateKey) {
  if (!templateKey) return undefined;
  const key = templateKey.trim().toLowerCase();
  if (REPORT_TEMPLATES[key]) return REPORT_TEMPLATES[key];
  return { label: 'Custom Template', template: templateKey };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { caseContext, templateId } = req.body;

  if (!caseContext) {
    return res.status(400).json({ error: 'caseContext is required' });
  }

  const resolvedTemplate = resolveTemplate(templateId);

  const systemPrompt = [
    'You are a Physician Expert drafting a formal Medical-Legal Report for litigation.',
    'Tone: authoritative, clinical, precise, and court-ready.',
    'CRITICAL RULES:',
    '1) Use ONLY the provided case notes, annotations, and document list.',
    '2) Do NOT fabricate facts; if a detail is missing, state it as a limitation.',
    '3) Be thorough and comprehensive. Do not be overly concise.',
    '4) Prefer narrative paragraphs over bullet-only sections unless the template demands bullets.',
    '5) If asked to include U.S. expert disclosure elements, list them and mark missing items as \'Not provided\'.'
  ].join('\n');

  const userPrompt = `
You are drafting a professional Medical-Legal Report for litigation purposes in the United States.

FORMAT REQUIREMENTS (match the example style):
- Use Markdown headings so sizes are consistent:
  - Main title: "# MEDICAL-LEGAL REPORT" (all caps).
  - Major sections: "## I. INTRODUCTION AND PURPOSE" (Roman numerals, all caps).
  - Sub-sections: "### A. The Index Traumatic Event" (bold label is optional).
- Then provide "**DATE OF REPORT:** ***" on its own line (all caps, bold label).
- Then provide "**PREPARED BY:** <Name>" on its own line (all caps, bold label).
- Insert a horizontal rule after the header block: "---".
- Insert a horizontal rule between major sections.
- Use full paragraphs with blank lines between paragraphs.
- Keep a formal tone and explicit medical reasoning.
- Preserve any citations exactly as provided.

**CASE INFORMATION:**
- Title: "${caseContext.caseTitle || ''}"
- Description: ${caseContext.caseDescription || 'No description provided'}

**EXPERT CREDENTIALS:**
${caseContext.qualifications || 'Medical Expert'}

**DOCUMENTS REVIEWED:**
${caseContext.documents || 'No documents listed'}

**PDF ANNOTATIONS & EVIDENCE EXCERPTS:**
${caseContext.annotations || 'No annotations available'}

**PDF TEXT EXCERPTS (FROM SOURCE DOCUMENTS):**
${caseContext.pdfTextContext || 'Not available'}

**WRITER COMMENTS / REVIEW NOTES:**
${caseContext.writerComments || 'None provided'}

**CASE NOTES / CLINICAL NOTES:**
${caseContext.clinicalNotes || 'None provided'}

---

**TASK:** Generate a complete, professional Medical-Legal Report.

Length guidance: aim for approximately 3200-5200 words unless the provided evidence is very limited; if limited, still provide a full structure and explicitly note limitations.
Each major section should include multiple paragraphs with reasoning, not just a single short paragraph. Use professional narrative prose.
If U.S. expert-report elements are relevant and the data is provided (e.g., qualifications, publications, prior testimony, compensation), include them in the appropriate section. If not provided, state the limitation.

If a template is provided below, follow its structure exactly. If not, use a standard professional format with clear headings and subheadings.

**REPORT STRUCTURE/TEMPLATE (use these as your Roman numeral section titles; ALL CAPS, BOLD):**
${resolvedTemplate?.template || `
1. HEADER: Case name, date, and expert identification.
2. INTRODUCTION: Brief case overview and purpose of the report.
3. DOCUMENTS REVIEWED: Detailed list of all materials examined.
4. PATIENT HISTORY & TIMELINE: Chronological clinical summary.
5. MEDICAL ANALYSIS: Clinical findings, standard of care, and causation.
6. PROFESSIONAL OPINION: Final conclusions and recommendations.
7. LIMITATIONS: Identify missing data or uncertainties.
`}

Template selected: ${resolvedTemplate?.label || 'Standard Medical-Legal Report'}.

Format the report professionally with proper sections, clinical terminology, and courtroom-appropriate language. Preserve any source citations that appear in the notes (e.g., ("Source", p. X)).
`;

  // Set up streaming response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Claude generate-report error:', error);

    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || 'Claude API request failed' });
    }

    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
    res.end();
  }
}
