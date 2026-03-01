# Plan: Add Claude Chat Function to the Legal Writer

## Context

The legal writer in `AnnotationRollup.tsx` currently generates reports via the "Generate/Regenerate Draft" button, which:
1. Opens a template selector (IME, Causation, Rebuttal, Chronology, Depo Prep)
2. Gathers all case data (annotations, PDF text, comments, credentials)
3. Calls `draftMedicalLegalReportStream()` in `openaiService.ts` → OpenAI GPT-4o
4. Streams the result into a contentEditable div

The goal is to add a **conversational chat panel** powered by Claude that lets you draft reports through natural-language instructions — similar to how you just used Claude chat to write the Dr. Peterson/tenecteplase defense report.

---

## Architecture Overview

### New Files
- `services/claudeService.ts` — Anthropic SDK client + chat function
- `components/LegalChat.tsx` — Chat panel UI component

### Modified Files
- `types.ts` — Add `LegalChatMessage` type and `legalChatHistory` field to `Case`
- `components/AnnotationRollup.tsx` — Integrate the chat panel alongside (or replacing) the draft button
- `.env.template` — Add `VITE_ANTHROPIC_API_KEY`
- `package.json` — Add `@anthropic-ai/sdk`

---

## Step-by-Step Plan

### Step 1: Install Anthropic SDK & Configure Environment

- `npm install @anthropic-ai/sdk`
- Add `VITE_ANTHROPIC_API_KEY=` to `.env.template`
- Add the actual key to `.env`

### Step 2: Create `services/claudeService.ts`

This mirrors the pattern in `openaiService.ts` but uses the Anthropic SDK.

**Key function: `chatWithLegalWriter()`**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

export const chatWithLegalWriter = async (
  conversationHistory: LegalChatMessage[],
  caseContext: {
    caseData: Case;
    annotations: Annotation[];
    pdfTextContext: string;
    qualifications: string;
  },
  onChunk: (text: string) => void
): Promise<string> => {
  const systemPrompt = buildLegalWriterSystemPrompt(caseContext);

  const messages = conversationHistory.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.text
  }));

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 12000,
    system: systemPrompt,
    messages
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      onChunk(fullText);
    }
  }
  return fullText;
};
```

**The system prompt** would be similar to the existing one in `openaiService.ts` (lines 481-569) — establishing the expert physician voice, injecting case annotations, PDF excerpts, expert credentials, and clinical notes — but adapted for the conversational flow. The key difference: instead of a one-shot "write the whole report," the system prompt sets up Claude as an expert collaborator who can:
- Draft sections on demand
- Revise based on feedback
- Argue specific medical-legal points when instructed
- Maintain the formal court-ready tone throughout

### Step 3: Add Types to `types.ts`

```typescript
export interface LegalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  appliedToReport?: boolean;  // track if this response was inserted into the draft
}
```

Add to the `Case` interface:
```typescript
legalChatHistory?: LegalChatMessage[];
```

### Step 4: Create `components/LegalChat.tsx`

A chat panel component modeled after the existing `DepositionSimulation.tsx` chat UI, but tailored for report drafting.

**Layout:** A slide-out panel or split view on the right side of the legal writer (similar to the existing Writer Comment Sidebar at lines 3717-3822 of AnnotationRollup.tsx).

**UI Elements:**
- Chat message history (scrollable, user messages on right, Claude responses on left)
- Text input area at the bottom (multi-line, supports long instructions like your Dr. Peterson prompt)
- "Send" button
- Per-response action buttons:
  - **"Insert into Draft"** — Parses the Claude response from markdown to HTML and appends/replaces content in the contentEditable editor
  - **"Replace Draft"** — Overwrites the entire draft with this response (with confirmation)
  - **"Copy"** — Copies response to clipboard
- A toggle to show/hide the case context being sent (transparency)
- Streaming indicator while Claude is responding

**Behavior:**
- On first open, auto-injects the case context (annotations, PDF text, credentials) into the system prompt — the user never has to manually paste case details
- Multi-turn: full conversation history is maintained and sent with each request, so Claude remembers prior instructions
- Chat history persists to Firestore via `onUpdateCase({ legalChatHistory: [...] })`
- "Clear Chat" button to start fresh

### Step 5: Integrate into AnnotationRollup.tsx

**Phase 1 (Addition):** Add a "Chat with Claude" button next to the existing "Generate/Regenerate Draft" button:

```
[Generate Draft]  [Chat with Claude]  [Save Version]  [Finalize & Export]
```

Clicking "Chat with Claude" toggles the `LegalChat` panel open on the right side (replacing the comment sidebar, or as a new tab).

**Phase 2 (Replacement path):** Eventually, the chat panel could become the primary drafting interface:
- User opens chat, gives instructions like "Write a defense report for Dr. Peterson explaining why tenecteplase was not indicated..."
- Claude streams the response
- User clicks "Insert into Draft" to populate the editor
- User can then say "Make the thrombolytics section more detailed" or "Add a section about the ED-neurologist consultation workflow"
- Each refinement updates the draft iteratively

The "Regenerate Draft" button could then become a quick-action that sends a pre-built prompt to the chat (essentially automating what the template selector does today, but through Claude).

### Step 6: Wire Up the Data Flow

The chat function needs the same case context that `draftMedicalLegalReportStream()` currently uses:

```
AnnotationRollup receives:
  ├── caseItem (Case)           ← case details, description
  ├── annotations (Annotation[])← all case annotations
  ├── docs (Document[])         ← document list
  ├── currentUser (UserProfile) ← expert credentials
  └── pdfTextContext            ← extracted via extractPdfTextForAnnotations()

These get passed to LegalChat as props, which feeds them into claudeService.ts
```

This mirrors the exact flow at lines 3848-3905 of AnnotationRollup.tsx today.

---

## How Your Dr. Peterson Prompt Would Work

With this feature, you would:

1. Open a case, navigate to the Legal Writer tab
2. Click "Chat with Claude" — the panel opens
3. Type your prompt exactly as you did:
   > "I'm writing a report in the defense of Dr. Peterson. I need to justify why tenecteplase was not offered... [full prompt]"
4. Claude receives your prompt **plus** all the case annotations, PDF excerpts, and your credentials automatically (no need to re-explain the case)
5. Claude streams back the full report in real-time
6. You click "Insert into Draft" — the report populates the editor
7. You can then say "Expand the section on NIHSS scoring thresholds" or "Add more about posterior circulation limitations"
8. Each iteration refines the draft further

---

## Important Considerations

### Browser-Side API Key
The current architecture calls OpenAI directly from the browser (`dangerouslyAllowBrowser: true`). The Claude integration would follow the same pattern for consistency. However, this exposes the API key in the client bundle. A future improvement would be to proxy through Firebase Cloud Functions (same concern exists for OpenAI today).

### Model Selection
- **Claude Sonnet 4** for standard drafting (fast, cost-effective, excellent writing)
- **Claude Opus 4** for complex multi-factor analysis (the Dr. Peterson scenario would benefit from this)
- Could add a model toggle in the chat UI, or default to Sonnet with an "Enhanced" mode for Opus

### Token/Context Management
- Claude's context window (200K tokens) is much larger than GPT-4o's, which is an advantage for cases with extensive medical records
- Conversation history will grow over a session — implement a sliding window or summarization strategy if the history gets very long
- The existing `pdfTextContext` is capped at 12K chars; with Claude's larger context, this limit could be raised

### Streaming
The Anthropic SDK supports streaming natively via `messages.stream()`, which maps well to the existing `onChunk` callback pattern used throughout the app (see `callOpenAIStream` at openaiService.ts:356-389).

---

## Summary: What Gets Built

| Component | Purpose | Effort |
|-----------|---------|--------|
| `claudeService.ts` | Anthropic SDK client + chat function | Small |
| `LegalChat.tsx` | Chat panel UI (messages, input, actions) | Medium |
| `AnnotationRollup.tsx` changes | Add chat button, wire up panel | Small |
| `types.ts` changes | New message type, case field | Trivial |
| Environment + dependencies | SDK install, API key config | Trivial |

The heaviest lift is the `LegalChat.tsx` component, but it can heavily borrow from the existing `DepositionSimulation.tsx` chat UI pattern — same message rendering, same scroll behavior, same input field, just different action buttons and a different AI backend.
