import React from 'react';
import { Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Shared building blocks that follow the existing page styling (maroon accent, clinical greys).

export const inputClass =
  'w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition disabled:opacity-60';

export const labelClass = 'block text-xs font-semibold text-clinicalText-secondary mb-1';

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 font-semibold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const BUTTON_VARIANTS = {
  primary:
    'bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:brightness-110 active:scale-[0.99] text-white shadow-button-red',
  success: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md',
  secondary: 'bg-white hover:bg-slate-50 text-clinicalText-primary border border-clinicalBorder shadow-xs',
  danger: 'bg-white hover:bg-red-50 text-red-700 border border-red-200',
};

export function Button({
  variant = 'primary',
  busy,
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS; busy?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || busy} className={`${buttonBase} ${BUTTON_VARIANTS[variant]} ${className}`}>
      {busy && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

/** Page title card used across the app. */
export function PageHeader({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="hero-banner p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <span className="relative w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#E53935] via-[#C62828] to-[#8B1E23] ring-1 ring-white/25 shadow-[0_8px_18px_-6px_rgba(229,57,53,0.7),inset_0_1px_0_rgba(255,255,255,0.4)] flex items-center justify-center overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></span>
          <Icon className="w-6 h-6 text-white relative" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">{title}</h2>
          {description && <p className="text-xs sm:text-[14px] text-slate-300/80 mt-1">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Card({
  title,
  icon: Icon,
  actions,
  children,
  className = '',
  tone = 'default',
}: {
  title?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'action';
}) {
  const toneClass =
    tone === 'action' ? 'border-[#8B1E23]/30 ring-1 ring-[#8B1E23]/10 bg-gradient-to-b from-[#FFFBFB] to-white' : 'border-clinicalBorder bg-white';
  return (
    <section className={`rounded-2xl border shadow-card p-5 space-y-4 ${toneClass} ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3">
          {title && (
            <h3 className="text-sm font-bold text-clinicalText-primary flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4 text-maroon-700" />}
              {title}
            </h3>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12.5px] font-bold uppercase tracking-wider text-clinicalText-muted">{label}</div>
      <div className="text-xs text-clinicalText-primary mt-0.5 whitespace-pre-wrap">{children || '—'}</div>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'error'; children: React.ReactNode }) {
  const classes = {
    info: 'bg-slate-50 border-clinicalBorder text-clinicalText-secondary',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  }[tone];
  return <div className={`p-3 rounded-xl border text-xs ${classes}`}>{children}</div>;
}

/** Small "Edit" button for switching a read-only section into edit mode. */
export function EditToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[12.5px] font-semibold text-[#8B1E23] bg-white hover:bg-[#FFF5F5] border border-clinicalBorder rounded-lg cursor-pointer"
    >
      <Pencil className="w-3 h-3" /> Edit
    </button>
  );
}
