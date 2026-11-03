import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus, X, RotateCcw, Check, Loader2, Send, AlertTriangle, Lock, Info, Users, Clock, CheckCheck } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';
import { PageHeader, Notice, Button, inputClass } from '../components/ui/primitives';

interface Variable {
  key: string;
  label: string;
  sample: string;
}
interface Content {
  title: string;
  message: string;
  details: string[];
}
interface Template {
  key: string;
  name: string;
  sentTo: string;
  sentWhen: string;
  variables: Variable[];
  defaults: Content;
  current: Content;
  enabled: boolean;
  customized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}
interface ListResponse {
  templates: Template[];
  approvedTemplate: {
    header: string;
    body: string;
    footer: string;
    name: string | null;
  };
  limits: {
    title: number;
    message: number;
    detailLine: number;
    details: number;
    content: number;
  };
  delivery: { enabled: boolean; templateConfigured: boolean };
}
interface Preview {
  content: string;
  contentLength: number;
  truncated: boolean;
  recipient: string;
  link: string;
  problems: string[];
}
interface Draft extends Content {
  enabled: boolean;
}

const sameDraft = (a: Draft, b: Draft) =>
  a.enabled === b.enabled && a.title === b.title && a.message === b.message && a.details.join('\n') === b.details.join('\n');

const TEST_NUMBER_KEY = 'incidentReporting.whatsappTestNumber';
const readStored = () => {
  try {
    return localStorage.getItem(TEST_NUMBER_KEY) ?? '';
  } catch {
    return '';
  }
};

/** Debounces a value so the preview isn't re-rendered on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function WhatsappTemplatesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => api.get('/whatsapp-templates'),
  });
  const list = (data as any)?.data as ListResponse | undefined;

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = list?.templates.find((t) => t.key === selectedKey) ?? list?.templates[0];

  const saved: Draft | null = selected
    ? {
        ...selected.current,
        details: [...selected.current.details],
        enabled: selected.enabled,
      }
    : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const editing = draft ?? saved;
  const dirty = Boolean(draft && saved && !sameDraft(draft, saved));

  const [busy, setBusy] = useState<'save' | 'reset' | 'test' | null>(null);
  const [testNumber, setTestNumber] = useState(readStored);

  // Remembers which field and cursor position a placeholder chip should go into
  const lastField = useRef<{
    field: 'title' | 'message' | number;
    start: number;
    end: number;
  }>({ field: 'message', start: -1, end: -1 });
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const choose = (key: string) => {
    if (key === selected?.key) return;
    if (dirty && !window.confirm('You have unsaved changes to this message. Discard them?')) return;
    setDraft(null);
    setSelectedKey(key);
    lastField.current = { field: 'message', start: -1, end: -1 };
  };

  const update = (patch: Partial<Draft>) => editing && setDraft({ ...editing, ...patch });

  const debouncedContent = useDebounced(
    editing
      ? {
          title: editing.title,
          message: editing.message,
          details: editing.details,
        }
      : null,
    250
  );
  const preview = useQuery({
    queryKey: ['whatsapp-preview', selected?.key, debouncedContent],
    queryFn: () => api.post(`/whatsapp-templates/${selected!.key}/preview`, debouncedContent),
    enabled: Boolean(selected && debouncedContent),
    placeholderData: keepPreviousData,
  });
  const previewData = (preview.data as any)?.data as Preview | undefined;

  const remember = (field: 'title' | 'message' | number) => (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    lastField.current = {
      field,
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const insertPlaceholder = (key: string) => {
    if (!editing) return;
    const token = `{${key}}`;
    const { field, start, end } = lastField.current;
    const current = field === 'title' ? editing.title : field === 'message' ? editing.message : (editing.details[field] ?? '');
    const s = start < 0 ? current.length : start;
    const e = end < 0 ? current.length : end;
    const next = current.slice(0, s) + token + current.slice(e);
    if (field === 'title') update({ title: next });
    else if (field === 'message') update({ message: next });
    else
      update({
        details: editing.details.map((d, i) => (i === field ? next : d)),
      });
    const caret = s + token.length;
    lastField.current = { field, start: caret, end: caret };
    requestAnimationFrame(() => {
      const el = inputRefs.current[String(field)];
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });

  const save = async () => {
    if (!selected || !editing) return;
    setBusy('save');
    try {
      await api.put(`/whatsapp-templates/${selected.key}`, editing);
      await refresh();
      setDraft(null);
      toast.success(`"${selected.name}" saved`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the message'));
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!selected) return;
    if (!window.confirm(`Reset "${selected.name}" to the original wording? Your edits will be lost and the message will be switched on.`))
      return;
    setBusy('reset');
    try {
      await api.post(`/whatsapp-templates/${selected.key}/reset`);
      await refresh();
      setDraft(null);
      toast.success(`"${selected.name}" reset to default`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reset the message'));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    if (!selected || !editing) return;
    setBusy('test');
    try {
      try {
        localStorage.setItem(TEST_NUMBER_KEY, testNumber);
      } catch {
        /* storage unavailable */
      }
      const res: any = await api.post(`/whatsapp-templates/${selected.key}/test`, { ...editing, whatsappNumber: testNumber });
      toast.success(res?.message || 'Test message sent');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send the test message'));
    } finally {
      setBusy(null);
    }
  };

  const problems = previewData?.problems ?? [];
  const limits = list?.limits;

  return (
    <div className="space-y-6 pb-16 text-clinicalText-primary">
      <PageHeader
        icon={MessageCircle}
        title="WhatsApp Messages"
        description="Edit what each WhatsApp notification says and preview it exactly as it will arrive. Changes apply to the next message sent."
      />

      {isLoading && <div className="h-[34rem] rounded-2xl bg-white border border-slate-200 animate-pulse" aria-label="Loading" />}
      {error && <Notice tone="error">{errorMessage(error, 'Could not load WhatsApp messages')}</Notice>}

      {list && !list.delivery.enabled && (
        <Notice tone="warning">
          WhatsApp sending is switched off on this server, so nothing is actually sent. You can still edit and preview the messages.
        </Notice>
      )}
      {list && list.delivery.enabled && !list.delivery.templateConfigured && (
        <Notice tone="warning">
          No approved WATI template is configured (WATI_TEMPLATE_NAME), so messages only reach people with an open WhatsApp chat.
        </Notice>
      )}

      {list && selected && editing && limits && (
        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] items-start">
          {/* Message list */}
          <nav aria-label="WhatsApp messages" className="bg-white rounded-2xl border border-slate-200 shadow-card p-2 lg:sticky lg:top-24">
            {list.templates.map((t) => {
              const active = t.key === selected.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => choose(t.key)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition cursor-pointer ${
                    active ? 'bg-[#FBF1EA] ring-1 ring-[#E3C2AE]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`font-semibold text-[13.5px] leading-snug ${active ? 'text-[#5C1A22]' : 'text-clinicalText-primary'}`}>
                      {t.name}
                    </span>
                    {active && dirty ? <span className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" /> : null}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">{t.sentTo}</div>
                  <div className="flex gap-1.5 mt-1.5">
                    {!t.enabled && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10.5px] font-bold">Off</span>
                    )}
                    {t.customized && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10.5px] font-bold">
                        Edited
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem] items-start min-w-0">
            {/* Editor */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-card min-w-0" aria-labelledby="wa-editor-title">
              <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="wa-editor-title" className="text-[17px] font-bold text-clinicalText-primary">
                    {selected.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {selected.sentTo}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> When {selected.sentWhen.charAt(0).toLowerCase() + selected.sentWhen.slice(1)}
                    </span>
                  </div>
                  {selected.updatedAt && (
                    <div className="mt-1 text-[11.5px] text-slate-400">
                      Last edited{' '}
                      {new Date(selected.updatedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {selected.updatedBy ? ` by ${selected.updatedBy}` : ''}
                    </div>
                  )}
                </div>
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="text-[13px] font-semibold text-clinicalText-secondary">
                    {editing.enabled ? 'Sending on' : 'Sending off'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editing.enabled}
                    onClick={() => update({ enabled: !editing.enabled })}
                    className={`relative w-11 h-6 rounded-full transition cursor-pointer ${editing.enabled ? 'bg-[#25A244]' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editing.enabled ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </label>
              </div>

              {!editing.enabled && (
                <div className="mx-5 mt-4">
                  <Notice tone="info">While this is off, nobody gets this WhatsApp message. The in-app notification is still shown.</Notice>
                </div>
              )}

              <div className="p-5 space-y-5">
                <FieldBlock label="Title" hint="Shown in bold at the top" count={editing.title.length} max={limits.title}>
                  <input
                    ref={(el) => {
                      inputRefs.current.title = el;
                    }}
                    value={editing.title}
                    onChange={(e) => update({ title: e.target.value })}
                    onSelect={remember('title')}
                    onFocus={remember('title')}
                    className={`${inputClass} !text-[13px]`}
                    maxLength={limits.title + 20}
                  />
                </FieldBlock>

                <FieldBlock label="Message" count={editing.message.length} max={limits.message}>
                  <textarea
                    ref={(el) => {
                      inputRefs.current.message = el;
                    }}
                    value={editing.message}
                    onChange={(e) => update({ message: e.target.value })}
                    onSelect={remember('message')}
                    onFocus={remember('message')}
                    rows={3}
                    className={`${inputClass} !text-[13px] resize-y`}
                  />
                </FieldBlock>

                <div>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="text-[13px] font-semibold text-clinicalText-primary">Detail lines</span>
                    <span className="text-[12px] text-slate-500">A line is skipped when its placeholder has no value</span>
                  </div>
                  <div className="space-y-2">
                    {editing.details.map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          ref={(el) => {
                            inputRefs.current[String(i)] = el;
                          }}
                          value={line}
                          onChange={(e) =>
                            update({
                              details: editing.details.map((d, j) => (j === i ? e.target.value : d)),
                            })
                          }
                          onSelect={remember(i)}
                          onFocus={remember(i)}
                          aria-label={`Detail line ${i + 1}`}
                          className={`${inputClass} !text-[13px] ${line.length > limits.detailLine ? '!border-red-400' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            update({
                              details: editing.details.filter((_, j) => j !== i),
                            });
                            lastField.current = {
                              field: 'message',
                              start: -1,
                              end: -1,
                            };
                          }}
                          aria-label={`Remove detail line ${i + 1}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {editing.details.length < limits.details && (
                    <button
                      type="button"
                      onClick={() => {
                        const i = editing.details.length;
                        update({ details: [...editing.details, ''] });
                        lastField.current = { field: i, start: 0, end: 0 };
                        requestAnimationFrame(() => inputRefs.current[String(i)]?.focus());
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#7A2430] hover:underline cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add a line
                    </button>
                  )}
                </div>

                <div className="rounded-xl bg-[#FBF6EE] border border-[#EEDCC8] p-3.5">
                  <div className="text-[12.5px] font-semibold text-[#5C1A22] mb-2">Placeholders: click to insert where your cursor is</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertPlaceholder(v.key)}
                        title={`Example: ${v.sample}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E3C9B2] text-[12.5px] hover:border-[#7A2430] hover:bg-[#FFFDFB] cursor-pointer"
                      >
                        <code className="font-mono text-[12px] text-[#7A2430]">{`{${v.key}}`}</code>
                        <span className="text-slate-500">{v.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-2">
                    Formatting: <code className="font-mono">*bold*</code>, <code className="font-mono">_italic_</code>. Line breaks are not
                    allowed by WhatsApp here, so the parts are joined with " | ".
                  </div>
                </div>

                {problems.length > 0 && (
                  <Notice tone="error">
                    <ul className="list-disc pl-4 space-y-0.5">
                      {problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </div>

              <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <Button onClick={save} busy={busy === 'save'} disabled={!dirty || busy !== null || problems.length > 0}>
                  {busy !== 'save' && <Check className="w-4 h-4" />}
                  Save
                </Button>
                {dirty && (
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={busy !== null}
                    className="px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Discard changes
                  </button>
                )}
                {selected.customized && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy !== null}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-[#7A2430] hover:bg-[#FBF1EA] cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Reset to default
                  </button>
                )}
              </div>
            </section>

            {/* Preview */}
            <section aria-labelledby="wa-preview-title" className="xl:sticky xl:top-24 space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <h2 id="wa-preview-title" className="text-[13px] font-bold uppercase tracking-wider text-[#5C1A22]">
                  Preview
                </h2>
                {preview.isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-label="Updating preview" />}
              </div>
              <PhonePreview approved={list.approvedTemplate} preview={previewData} off={!editing.enabled} />
              {previewData && (
                <div
                  className={`text-[12px] flex items-start gap-1.5 ${previewData.truncated ? 'text-red-700 font-semibold' : 'text-slate-500'}`}
                >
                  {previewData.truncated ? (
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  <span>
                    {previewData.truncated
                      ? `Too long: ${previewData.contentLength} of ${limits.content} characters with the sample values, so the end is cut off. Shorten the text.`
                      : `${previewData.contentLength} of ${limits.content} characters with the sample values. Real values may be longer.`}
                  </span>
                </div>
              )}
              <p className="text-[12px] text-slate-500 flex items-start gap-1.5">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  The greyed parts come from the WhatsApp template approved in WATI
                  {list.approvedTemplate.name ? ` (${list.approvedTemplate.name})` : ''} and can only be changed there.
                </span>
              </p>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
                <label htmlFor="wa-test-number" className="text-[13px] font-semibold text-clinicalText-primary">
                  Send a test to your phone
                </label>
                <p className="text-[12px] text-slate-500 mt-0.5 mb-2">Uses the wording above, even if not saved, with the sample values.</p>
                <div className="flex gap-2">
                  <input
                    id="wa-test-number"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    placeholder="91 98765 43210"
                    inputMode="tel"
                    className={`${inputClass} !text-[13px] min-w-0`}
                  />
                  <button
                    type="button"
                    onClick={sendTest}
                    disabled={
                      busy !== null ||
                      !testNumber.trim() ||
                      problems.length > 0 ||
                      !list.delivery.enabled ||
                      !list.delivery.templateConfigured
                    }
                    title={
                      !list.delivery.enabled || !list.delivery.templateConfigured
                        ? 'WhatsApp sending is not set up on this server'
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25A244] text-white text-[13px] font-bold hover:bg-[#1F8C3A] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldBlock({
  label,
  hint,
  count,
  max,
  children,
}: {
  label: string;
  hint?: string;
  count: number;
  max: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[13px] font-semibold text-clinicalText-primary">
          {label}
          {hint && <span className="ml-2 font-normal text-[12px] text-slate-500">{hint}</span>}
        </span>
        <span className={`text-[11.5px] tabular-nums ${count > max ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
          {count}/{max}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Renders WhatsApp's *bold*, _italic_ and ~strike~ markers. */
function WaText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/\S+)/g), [text]);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*[^*]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
        if (/^_[^_]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
        if (/^~[^~]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
        if (/^https?:\/\//.test(p))
          return (
            <span key={i} className="text-[#027EB5] break-all">
              {p}
            </span>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function PhonePreview({ approved, preview, off }: { approved: ListResponse['approvedTemplate']; preview?: Preview; off: boolean }) {
  // Split the approved body around {{1}} {{2}} {{3}} so the fixed and editable parts can be told apart
  const segments = approved.body.split(/(\{\{[123]\}\})/g);
  const now = new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className={`rounded-[1.6rem] border-[6px] border-[#1F2C34] bg-[#1F2C34] shadow-xl overflow-hidden ${off ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#075E54] text-white">
        <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">AH</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight truncate">Adhiparasakthi Hospitals</div>
          <div className="text-[11px] text-white/70">Business account</div>
        </div>
      </div>
      <div
        className="px-3 py-4 min-h-[22rem]"
        style={{
          backgroundColor: '#EFE7DE',
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        {off && (
          <div className="mx-auto mb-3 w-fit px-3 py-1 rounded-lg bg-[#FFF5C4] text-[11.5px] text-[#54656F] font-semibold">
            Switched off: not sent
          </div>
        )}
        <div className="relative max-w-[92%] bg-white rounded-lg rounded-tl-none shadow-sm px-2.5 pt-2 pb-1.5 text-[13.5px] leading-[1.38] text-[#111B21]">
          <div className="text-slate-400 font-bold mb-1">{approved.header}</div>
          <div className="whitespace-pre-wrap break-words">
            {segments.map((seg, i) => {
              if (seg === '{{1}}') return <span key={i}>{preview?.recipient ?? 'Name'}</span>;
              if (seg === '{{2}}')
                return (
                  <span key={i} className="bg-[#FFF8E1] rounded-sm outline outline-1 outline-[#F2D589]">
                    {preview ? <WaText text={preview.content} /> : '…'}
                  </span>
                );
              if (seg === '{{3}}')
                return (
                  <span key={i} className="text-[#027EB5] break-all">
                    {preview?.link ?? 'link'}
                  </span>
                );
              return (
                <span key={i} className="text-slate-400">
                  {seg}
                </span>
              );
            })}
          </div>
          <div className="mt-1.5 text-[12px] text-slate-400">{approved.footer}</div>
          <div className="flex justify-end items-center gap-1 text-[10.5px] text-slate-400 -mt-0.5">
            {now} <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
          </div>
        </div>
      </div>
    </div>
  );
}
