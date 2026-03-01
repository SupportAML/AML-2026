
import React, { useState, useRef, useEffect } from 'react';
import { parse } from 'marked';
import {
  SendHorizontalIcon,
  Loader2Icon,
  Trash2Icon,
  CopyIcon,
  FileTextIcon,
  ReplaceIcon,
  SparklesIcon,
  XIcon
} from 'lucide-react';
import { Case, Document, Annotation, UserProfile } from '../types';
import { LegalChatMessage, chatWithClaude, buildCaseContext } from '../services/claudeService';

interface LegalChatProps {
  caseItem: Case;
  docs: Document[];
  annotations: Annotation[];
  currentUser: UserProfile;
  pdfTextContext: string;
  reportContent: string;
  onInsertIntoDraft: (html: string) => void;
  onReplaceDraft: (html: string) => void;
  onUpdateCase: (c: Case) => Promise<void> | void;
  onClose: () => void;
}

const LegalChat: React.FC<LegalChatProps> = ({
  caseItem,
  docs,
  annotations,
  currentUser,
  pdfTextContext,
  reportContent,
  onInsertIntoDraft,
  onReplaceDraft,
  onUpdateCase,
  onClose
}) => {
  const [messages, setMessages] = useState<LegalChatMessage[]>(
    caseItem.legalChatHistory || []
  );
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: LegalChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const caseContext = buildCaseContext(
        caseItem,
        docs,
        annotations,
        pdfTextContext,
        currentUser,
        reportContent
      );

      const fullResponse = await chatWithClaude(
        updatedMessages,
        caseContext,
        (accumulated) => {
          setStreamingText(accumulated);
        }
      );

      const assistantMessage: LegalChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingText('');

      // Persist to case
      await onUpdateCase({
        ...caseItem,
        legalChatHistory: finalMessages.slice(-50), // Keep last 50 messages
      });
    } catch (error: any) {
      console.error('Claude chat error:', error);
      const errorMessage: LegalChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response from Claude. Please try again.'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;
    setMessages([]);
    setStreamingText('');
    await onUpdateCase({ ...caseItem, legalChatHistory: [] });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleInsert = (markdownText: string) => {
    const html = parse(markdownText) as string;
    onInsertIntoDraft(html);
  };

  const handleReplace = (markdownText: string) => {
    if (!confirm('This will replace your entire current draft. Continue?')) return;
    const html = parse(markdownText) as string;
    onReplaceDraft(html);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Chat Panel - slides in from right */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Claude Legal Drafting Assistant</h3>
              <p className="text-[10px] text-violet-200 font-medium">
                {caseItem.title} &middot; {annotations.length} annotations loaded
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-2 text-violet-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Clear chat history"
              >
                <Trash2Icon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-violet-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
                <SparklesIcon className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Draft with Claude</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md">
                Describe what you need — a full report, a specific section, or help with a medical-legal argument.
                Claude has your case data loaded and ready.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                {[
                  'Draft a defense report explaining why the standard of care was met',
                  'Write the causation analysis section with supporting literature',
                  'Help me argue why the treatment decision was clinically reasonable',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="text-left px-4 py-3 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-xl text-xs text-slate-600 hover:text-violet-700 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message history */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Message bubble */}
              <div
                className={`max-w-[90%] rounded-2xl px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md border border-slate-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div
                    className="prose prose-sm prose-slate max-w-none prose-headings:font-bold prose-p:my-2 prose-li:my-0.5 text-sm"
                    dangerouslySetInnerHTML={{ __html: parse(msg.content) as string }}
                  />
                )}
              </div>

              {/* Action buttons for assistant messages */}
              {msg.role === 'assistant' && !msg.content.startsWith('Error:') && (
                <div className="flex items-center gap-1.5 mt-2 ml-1">
                  <button
                    onClick={() => handleCopy(msg.content)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    <CopyIcon className="w-3 h-3" /> Copy
                  </button>
                  <button
                    onClick={() => handleInsert(msg.content)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Append to current draft"
                  >
                    <FileTextIcon className="w-3 h-3" /> Insert into Draft
                  </button>
                  <button
                    onClick={() => handleReplace(msg.content)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Replace entire draft with this response"
                  >
                    <ReplaceIcon className="w-3 h-3" /> Replace Draft
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {isStreaming && streamingText && (
            <div className="flex flex-col items-start">
              <div className="max-w-[90%] rounded-2xl rounded-bl-md px-5 py-4 bg-slate-100 border border-slate-200">
                <div
                  className="prose prose-sm prose-slate max-w-none prose-headings:font-bold prose-p:my-2 prose-li:my-0.5 text-sm"
                  dangerouslySetInnerHTML={{ __html: parse(streamingText) as string }}
                />
              </div>
            </div>
          )}

          {/* Streaming indicator (no text yet) */}
          {isStreaming && !streamingText && (
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <Loader2Icon className="w-4 h-4 animate-spin" />
              <span className="font-medium italic">Claude is thinking...</span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-slate-200 bg-white shrink-0">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you need — a report section, a medical argument, or edits to your draft..."
                disabled={isStreaming}
                rows={1}
                className="w-full resize-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all disabled:opacity-50"
                style={{ maxHeight: '200px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="w-10 h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center hover:bg-violet-700 disabled:opacity-30 transition-all shadow-lg shadow-violet-200 shrink-0"
            >
              {isStreaming ? (
                <Loader2Icon className="w-5 h-5 animate-spin" />
              ) : (
                <SendHorizontalIcon className="w-5 h-5" />
              )}
            </button>
          </form>
          <p className="text-[10px] text-slate-400 mt-2 px-1">
            Shift+Enter for new line. Claude has your case data, annotations, and current draft loaded.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalChat;
