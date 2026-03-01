# Plan: Claude Chat Function in the Legal Writer

## What Was Built

A conversational **"Chat with Claude"** feature in the Legal Writer tab, powered by Anthropic's Claude via a **Vercel serverless API route** (no API key exposed to the browser).

---

## Architecture

```
Browser (React)                    Vercel Serverless (/api)        Anthropic
──────────────                    ──────────────────────           ─────────

  LegalChat.tsx                     api/legal-chat.js
  ┌──────────────┐                 ┌──────────────────┐
  │ User types    │  POST /api/    │ Reads ANTHROPIC_  │  Claude API
  │ instructions  │──legal-chat──▶ │ API_KEY from      │─────────────▶
  │               │                │ process.env       │
  │ Streaming     │◀── SSE ───────│ Streams response  │◀─────────────
  │ response      │                │ back via SSE      │
  └──────────────┘                 └──────────────────┘
        │
        ▼
  claudeService.ts
  (fetch + SSE parsing)
```

**Key design decision:** The Anthropic API key lives in Vercel environment variables (`ANTHROPIC_API_KEY`, no `VITE_` prefix) and is only accessed server-side. The browser never sees it.

---

## Files Created

| File | Purpose |
|------|---------|
| `api/legal-chat.js` | Vercel serverless endpoint. Receives conversation history + case context, calls Claude with streaming, returns SSE stream to the browser. |
| `services/claudeService.ts` | Client-side service. Builds case context from case data, calls `/api/legal-chat` via fetch, parses SSE stream, and calls `onChunk` callback with accumulated text. |
| `components/LegalChat.tsx` | Full chat panel UI. Slide-out overlay with message history, multi-line input, streaming display, and per-response action buttons (Copy, Insert into Draft, Replace Draft). |

## Files Modified

| File | Change |
|------|--------|
| `types.ts` | Added `legalChatHistory` field to `Case` interface for Firestore persistence |
| `components/AnnotationRollup.tsx` | Added "Chat with Claude" button, state hooks, and `LegalChat` component rendering with insert/replace handlers |
| `.env.template` | Added `ANTHROPIC_API_KEY` (server-side only) |
| `package.json` | Added `@anthropic-ai/sdk` dependency |

---

## How It Works

1. User clicks **"Chat with Claude"** (violet button) in the Legal Writer toolbar
2. A full-screen slide-out chat panel opens from the right
3. Case context is automatically loaded: annotations, PDF text, documents, expert credentials, current draft
4. User types instructions (e.g., "I'm writing a report in the defense of Dr. Peterson...")
5. The request goes to `/api/legal-chat` → Claude API (streaming)
6. Response streams back in real-time via SSE
7. After completion, the user can:
   - **Copy** — clipboard
   - **Insert into Draft** — appends Claude's response (parsed to HTML) to the current editor content
   - **Replace Draft** — overwrites the entire draft (with confirmation)
8. Multi-turn: user can follow up ("Expand the thrombolytics section", "Add a paragraph about...")
9. Chat history persists to Firestore (last 50 messages per case)

---

## Setup Required

1. **Vercel environment variable:** Add `ANTHROPIC_API_KEY` in Vercel dashboard (Settings → Environment Variables)
2. **Local development:** Use `vercel dev` instead of `vite dev` to test the `/api/legal-chat` endpoint locally, or deploy to a preview branch
3. The `@anthropic-ai/sdk` dependency is already installed

---

## Model Configuration

Currently set to `claude-sonnet-4-20250514` in `api/legal-chat.js`. Can be changed to:
- `claude-opus-4-20250514` for complex multi-factor analysis
- Or made configurable via an environment variable / UI toggle

---

## Future Enhancements

- **Replace Regenerate Draft:** The chat could eventually replace the template-based "Regenerate Draft" button by sending pre-built prompts through the same Claude pipeline
- **Model toggle in UI:** Let the user pick Sonnet (fast) vs Opus (thorough)
- **Raise PDF context limit:** Claude's 200K context window allows much more source text than the current 12K char cap
- **Move OpenAI calls server-side too:** Same pattern could secure the existing OpenAI key
