import React from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Shared building blocks for list / register / report screens: tabs, filter chips, search,
// pagination, stat tiles, empty state. Table styling itself lives in index.css (.data-table).

/** Class for a SearchableSelect (or input) inside a filter bar. */
export const filterControlClass =
  'w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#8B1E23]/10 focus:border-[#8B1E23] transition';

/** Segmented tab control with optional counts. */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ key: K; label: string; count?: number }>;
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto p-1 gap-1 bg-slate-100/90 border border-slate-200/70 rounded-2xl">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl text-sm whitespace-nowrap transition cursor-pointer ${
              isActive
                ? 'bg-white text-[#8B1E23] font-bold shadow-[0_2px_8px_-2px_rgba(15,23,42,0.18)]'
                : 'text-slate-600 font-medium hover:text-[#8B1E23] hover:bg-white/60'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`min-w-[22px] px-1.5 py-0.5 rounded-full text-[11.5px] font-bold text-center ${
                  isActive ? 'bg-gradient-to-br from-[#C62828] to-[#8B1E23] text-white' : 'bg-white text-slate-500 border border-slate-200'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Row of pill filters (single choice). */
export function FilterChips<K extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ key: K; label: string; count?: number }>;
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`h-9 px-4 rounded-full text-[13px] font-semibold border transition cursor-pointer inline-flex items-center gap-2 ${
              active
                ? 'bg-gradient-to-b from-[#C62828] to-[#8B1E23] text-white border-transparent shadow-[0_6px_14px_-6px_rgba(139,30,35,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#8B1E23]/40 hover:bg-[#FFF5F5] hover:text-[#68151A]'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`text-[11.5px] font-bold ${active ? 'text-white/85' : 'text-slate-400'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Search box with icon. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#8B1E23]/10 focus:border-[#8B1E23] transition"
      />
    </div>
  );
}

/** Card holding a set of filters. */
export function FilterBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-card ${className}`}>
      {children}
    </div>
  );
}

/** White card that wraps a table: optional header (title, subtitle, actions) and footer. */
export function ListCard({
  title,
  subtitle,
  actions,
  footer,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div>
            {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
      {footer && <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-sm text-slate-500">{footer}</div>}
    </div>
  );
}

/** Page X of Y footer with previous / next. */
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const btn =
    'h-9 px-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-[#FFF5F5] hover:text-[#8B1E23] hover:border-[#8B1E23]/30 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 disabled:hover:border-slate-200';
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span>
        <strong className="text-slate-800">{total}</strong> record{total === 1 ? '' : 's'} · Page{' '}
        <strong className="text-slate-800">{page}</strong> of {Math.max(totalPages, 1)}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={btn}>
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={btn}>
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const STAT_TONES = {
  red: { bar: '#C62828', tint: '#FDECEC', text: '#8B1E23' },
  amber: { bar: '#F59E0B', tint: '#FEF3C7', text: '#B45309' },
  blue: { bar: '#2563EB', tint: '#DBEAFE', text: '#1D4ED8' },
  violet: { bar: '#7C3AED', tint: '#EDE9FE', text: '#6D28D9' },
  green: { bar: '#059669', tint: '#D1FAE5', text: '#047857' },
  slate: { bar: '#64748B', tint: '#F1F5F9', text: '#475569' },
} as const;

/** Compact number tile for the top of a list. */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'red',
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof STAT_TONES;
  hint?: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-card p-4 pl-5 overflow-hidden flex items-center justify-between gap-3">
      <span className="absolute left-0 inset-y-0 w-1.5" style={{ background: t.bar }}></span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-3xl font-extrabold text-slate-900 mt-1 leading-none">{value}</p>
        {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
      </div>
      {Icon && (
        <span className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center" style={{ background: t.tint, color: t.text }}>
          <Icon className="w-5 h-5" />
        </span>
      )}
    </div>
  );
}

/** Message shown inside a table or list when there is nothing to show. */
export function EmptyState({ icon: Icon = Inbox, title, message }: { icon?: LucideIcon; title?: string; message: string }) {
  return (
    <div className="py-14 px-6 text-center">
      <span className="w-14 h-14 mx-auto rounded-2xl bg-[#FFF5F5] border border-[#FBD5D5] text-[#C62828] flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </span>
      {title && <p className="mt-4 text-base font-bold text-slate-800">{title}</p>}
      <p className={`text-sm text-slate-500 max-w-md mx-auto ${title ? 'mt-1' : 'mt-4'}`}>{message}</p>
    </div>
  );
}

/** Pulsing placeholder rows while a table loads. */
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c}>
              <div className={`h-4 rounded-md bg-slate-100 ${c === 0 ? 'w-24' : c % 2 ? 'w-32' : 'w-20'}`}></div>
              {c === 1 && <div className="h-3 rounded-md bg-slate-100 w-40 mt-2"></div>}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
