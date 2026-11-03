import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Sparkles, Send, Loader2, RotateCcw, AlertTriangle, MessageSquarePlus, ShieldAlert, X } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/useAction';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Incident numbers in an answer that link to incidents the asker can open. */
  cited?: Array<{ number: string; id: string }>;
  error?: boolean;
}

const HOSPITAL_SUGGESTIONS = [
  'Which department needs the most attention right now?',
  'What incident types keep repeating this year?',
  'List the open sentinel and permanent-harm incidents.',
  'Which incidents are past the HOD deadline?',
  'Compare medication errors and patient falls.',
  'What should Quality focus on this month?',
];
const DEPARTMENT_SUGGESTIONS = [
  'Which of my open incidents should I deal with first?',
  'What keeps repeating in my department?',
  'Has anything come back after we closed it?',
  'How quickly are we closing incidents?',
];

const storageKey = (scopeKey: string) => `incidentReporting.askAi.${scopeKey}`;
const loadHistory = (scopeKey: string): ChatMessage[] => {
  try {
    const raw = sessionStorage.getItem(storageKey(scopeKey));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Renders an answer with in-scope incident numbers turned into links. */
function AnswerText({ text, cited = [] }: { text: string; cited?: ChatMessage['cited'] }) {
  const idByNumber = new Map(cited.map((c) => [c.number, c.id]));
  const parts = text.split(/(INC-\d{4}-\d{6})/g);
  return (
    <>
      {parts.map((part, i) => {
        const id = idByNumber.get(part);
        return id ? (
          <Link
            key={i}
            to={`/incidents/${id}`}
            className="inline-block px-1.5 rounded-md bg-[#FAF3EC] border border-[#E9D3BC] font-mono font-bold text-[12px] text-[#5C1A22] hover:bg-[#F4E6D7] align-baseline"
          >
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

interface ChatStatus {
  enabled: boolean;
  scope: { kind: 'HOSPITAL' | 'DEPARTMENT'; key: string; label: string };
  coverage: { incidents: number; since: string | null };
  dailyLimit: number;
  remainingToday: number;
}

/**
 * Ask AI. Independent of the Insights page: it loads its own status and always covers every
 * incident since the beginning in the user's full scope, whatever period or department the page shows.
 */
export default function AskAiChat({ onClose }: { onClose?: () => void }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['ask-ai-status'],
    queryFn: () => api.get('/insights/chat'),
  });
  const status = (data as any)?.data as ChatStatus | undefined;

  if (!status) {
    return (
      <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.4)] flex flex-col h-full overflow-hidden">
        <div className="brand-gradient text-white flex items-center justify-between gap-2 pl-4 pr-2 py-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <h2 className="text-[14px] font-bold">Ask AI</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Ask AI" className="p-2 rounded-lg hover:bg-white/15 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center text-[13px] text-slate-500">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-label="Loading" />
          ) : (
            errorMessage(error, 'Ask AI is not available right now.')
          )}
        </div>
      </section>
    );
  }

  const coverage = status.coverage.since
    ? `all ${status.coverage.incidents} incidents since ${dayjs(status.coverage.since).format('MMM YYYY')}`
    : 'all incidents';
  return (
    <ChatPanel
      scopeKey={status.scope.key}
      scopeLabel={status.scope.label}
      coverageLabel={coverage}
      hospitalWide={status.scope.kind === 'HOSPITAL'}
      enabled={status.enabled}
      remainingToday={status.remainingToday}
      dailyLimit={status.dailyLimit}
      onClose={onClose}
    />
  );
}

function ChatPanel({
  scopeKey,
  scopeLabel,
  coverageLabel,
  hospitalWide,
  enabled,
  remainingToday,
  dailyLimit,
  onClose,
}: {
  /** Changes when the asker switches scope, which starts a fresh conversation. */
  scopeKey: string;
  scopeLabel: string;
  coverageLabel: string;
  hospitalWide: boolean;
  enabled: boolean;
  remainingToday?: number;
  dailyLimit?: number;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(scopeKey));
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | undefined>(remainingToday);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setRemaining(remainingToday), [remainingToday]);

  // A different scope is a different conversation
  useEffect(() => {
    setMessages(loadHistory(scopeKey));
  }, [scopeKey]);

  // Survives opening a cited incident and coming back
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(scopeKey), JSON.stringify(messages));
    } catch {
      // private mode / storage full: the chat still works for this visit
    }
  }, [messages, scopeKey]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, pending]);

  // Opened as a floating panel: ready to type, and Escape closes it. Read through a ref so a new
  // onClose from each parent render doesn't re-run this (and steal focus) every time.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  const send = async (question: string, history: ChatMessage[] = messages) => {
    const text = question.trim();
    if (!text || pending) return;
    const conversation = [...history.filter((m) => !m.error), { role: 'user' as const, content: text }];
    setMessages(conversation);
    setDraft('');
    setPending(true);
    try {
      const res: any = await api.post('/insights/chat', {
        messages: conversation.map(({ role, content }) => ({ role, content })),
      });
      setMessages([...conversation, { role: 'assistant', content: res.data.answer, cited: res.data.cited }]);
      setRemaining(res.data.remainingToday);
    } catch (err: any) {
      setMessages([
        ...conversation,
        {
          role: 'assistant',
          content: errorMessage(err, 'The AI could not answer right now.'),
          error: true,
        },
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const retry = () => {
    const lastQuestionIndex = messages.map((m) => m.role).lastIndexOf('user');
    if (lastQuestionIndex === -1) return;
    void send(messages[lastQuestionIndex].content, messages.slice(0, lastQuestionIndex));
  };

  const outOfQuestions = remaining !== undefined && remaining <= 0;
  const canAsk = enabled && !pending && !outOfQuestions;
  const suggestions = hospitalWide ? HOSPITAL_SUGGESTIONS : DEPARTMENT_SUGGESTIONS;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.4)] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="brand-gradient text-white flex items-center justify-between gap-2 pl-4 pr-2 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-white/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold leading-tight">Ask AI</h2>
            <p className="text-[11.5px] text-white/75 truncate">
              {scopeLabel} · {coverageLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={pending}
              title="Start a new chat"
              aria-label="Start a new chat"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 disabled:opacity-50 cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close Ask AI"
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-[#FFFCF8] to-white" aria-live="polite">
        {messages.length === 0 && (
          <div className="min-h-full flex flex-col justify-center gap-4 py-2">
            <div className="space-y-1">
              <h3 className="text-[15px] font-bold text-clinicalText-primary">What would you like to know?</h3>
              <p className="text-[12.5px] text-clinicalText-secondary leading-relaxed">
                Ask in plain words. The AI reads your incident records and links the incidents behind each answer.
              </p>
            </div>
            {enabled ? (
              <div className="grid grid-cols-1 gap-2 w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    disabled={!canAsk}
                    className="text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#D9BB9A] hover:bg-[#FFFAF4] text-[13px] text-clinicalText-primary transition cursor-pointer disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                AI isn't switched on for this server yet, so questions can't be answered.
              </p>
            )}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#5C1A22] text-white text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-3 items-start">
              <span
                className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center ${
                  m.error ? 'bg-red-50 border border-red-200' : 'bg-[#FAF3EC] border border-[#E9D3BC]'
                }`}
              >
                {m.error ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <Sparkles className="w-4 h-4 text-[#7A2430]" />}
              </span>
              <div className="min-w-0 max-w-[92%] space-y-2">
                <div
                  className={`px-4 py-3 rounded-2xl rounded-tl-md text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                    m.error ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-white border border-slate-200 text-clinicalText-primary'
                  }`}
                >
                  {m.error ? m.content : <AnswerText text={m.content} cited={m.cited} />}
                </div>
                {m.error && i === messages.length - 1 && (
                  <button
                    type="button"
                    onClick={retry}
                    disabled={!canAsk}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5C1A22] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Try again
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {pending && (
          <div className="flex gap-3 items-start">
            <span className="w-8 h-8 shrink-0 rounded-xl bg-[#FAF3EC] border border-[#E9D3BC] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#7A2430]" />
            </span>
            <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-white border border-slate-200 text-[13px] text-clinicalText-secondary space-y-1">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#7A2430]" />
                Reading your incidents… {elapsed > 0 && <span className="tabular-nums text-slate-400">{elapsed}s</span>}
              </div>
              {elapsed >= 12 && <p className="text-[12px] text-slate-400">The AI service is busy, so this can take up to a minute.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 px-4 sm:px-5 py-3.5 space-y-2 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="ask-ai-input" className="sr-only">
            Your question
          </label>
          <textarea
            id="ask-ai-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split('\n').length))}
            maxLength={2000}
            disabled={!enabled || outOfQuestions}
            placeholder={
              !enabled
                ? 'AI is not switched on'
                : outOfQuestions
                  ? "You've used today's questions"
                  : 'Ask about incidents, departments, trends…'
            }
            className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#7A2430] focus:ring-2 focus:ring-[#7A2430]/15 text-[14px] leading-relaxed outline-none transition disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canAsk || !draft.trim()}
            aria-label="Send question"
            className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-[#7A2430] to-[#5C1A22] text-white flex items-center justify-center shadow-button-red hover:brightness-110 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Send className="w-[18px] h-[18px]" />}
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11.5px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> No patient names or UHIDs. AI-written: check linked incidents.
          </span>
          {remaining !== undefined && dailyLimit !== undefined && (
            <span className="tabular-nums">
              {remaining} of {dailyLimit} questions left today
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
