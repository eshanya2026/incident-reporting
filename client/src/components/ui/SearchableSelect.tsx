import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  group?: string;
}

/**
 * A `<select>` replacement with a search box, for lists too long to scan by eye (departments,
 * categories, users). The empty/"All ..." choice is just another option with value="" — same
 * convention as a native `<select><option value="">...`.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  className = '',
  containerClassName = 'inline-block',
  disabled = false,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  className?: string;
  /** Classes for the wrapper; pass "block w-full" to make the select fill its parent. */
  containerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q));
  }, [options, query]);

  const indexOf = useMemo(() => {
    const m = new Map<SearchableSelectOption, number>();
    filtered.forEach((o, i) => m.set(o, i));
    return m;
  }, [filtered]);

  const grouped = useMemo(() => {
    if (!filtered.some((o) => o.group)) return [{ group: undefined as string | undefined, items: filtered }];
    const map = new Map<string, SearchableSelectOption[]>();
    for (const o of filtered) {
      const key = o.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.entries()].map(([group, items]) => ({ group: group || undefined, items }));
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    itemRefs.current.get(highlight)?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const commit = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) commit(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${className} inline-flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${selected?.label ? '' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-max min-w-full max-w-xs sm:max-w-sm bg-white border border-clinicalBorder rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">No matches</div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group ?? '__root'}>
                  {group && (
                    <div className="px-3 pt-2 pb-1 text-[11.5px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 bg-white">
                      {group}
                    </div>
                  )}
                  {items.map((opt) => {
                    const idx = indexOf.get(opt) ?? -1;
                    const isHighlighted = idx === highlight;
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={`${group ?? ''}:${opt.value}`}
                        type="button"
                        ref={(el) => {
                          if (el) itemRefs.current.set(idx, el);
                          else itemRefs.current.delete(idx);
                        }}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => commit(opt)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer ${
                          isHighlighted ? 'bg-[#FFF5F5] text-[#8B1E23]' : 'text-clinicalText-primary hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#8B1E23] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
