import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore, Toast, ToastType } from '../../store/useToastStore';

const STYLES: Record<ToastType, { icon: typeof CheckCircle2; border: string; iconColor: string; bar: string }> = {
  success: { icon: CheckCircle2, border: 'border-l-emerald-500', iconColor: 'text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: XCircle, border: 'border-l-[#C62828]', iconColor: 'text-[#C62828]', bar: 'bg-[#C62828]' },
  info: { icon: Info, border: 'border-l-sky-500', iconColor: 'text-sky-600', bar: 'bg-sky-500' },
};

function ToastCard({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);

  const close = () => {
    setLeaving(true);
    setTimeout(onDismiss, 180); // matches the exit transition below
  };

  // The progress bar IS the dismiss timer: when it finishes shrinking, the toast closes.
  // Web Animations API (not a CSS transition) so hovering can pause it precisely, mid-flight.
  useEffect(() => {
    if (!barRef.current) return;
    const anim = barRef.current.animate([{ width: '100%' }, { width: '0%' }], { duration: t.duration, easing: 'linear', fill: 'forwards' });
    anim.onfinish = close;
    animation.current = anim;
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { icon: Icon, border, iconColor, bar } = STYLES[t.type];

  return (
    <div
      role="status"
      onMouseEnter={() => animation.current?.pause()}
      onMouseLeave={() => animation.current?.play()}
      className={`relative w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-clinicalBorder ${border} border-l-4 overflow-hidden transition-all duration-200 ${
        leaving ? 'opacity-0 translate-x-3' : 'opacity-100 translate-x-0 animate-toast-in'
      }`}
    >
      <div className="flex items-start gap-3 p-3.5 pr-9">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
        <p className="text-xs font-medium text-clinicalText-primary leading-relaxed">{t.message}</p>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="h-0.5 bg-slate-100">
        <div ref={barRef} className={`h-full ${bar}`} style={{ width: '100%' }} />
      </div>
    </div>
  );
}

/** Renders active toasts, top-right, above everything. Mounted once near the app root. */
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
