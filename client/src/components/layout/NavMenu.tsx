import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export interface NavLinkItem {
  label: string;
  path: string;
  icon: any;
  count?: number;
}

/** Pill classes shared by top-level nav links and group buttons. */
export const navPillClass = (isActive: boolean) =>
  `group/nav relative flex items-center gap-2 h-9 px-4 text-[14px] whitespace-nowrap rounded-full transition-colors duration-180 cursor-pointer ${
    isActive
      ? 'text-white font-semibold bg-gradient-to-r from-[#5C1A22] via-[#7A2430] to-[#9C3A42] shadow-[0_6px_14px_-4px_rgba(92,26,34,0.55)]'
      : 'text-[#475569] font-medium hover:text-[#3D0F16] hover:bg-white hover:shadow-[0_2px_8px_-2px_rgba(61,15,22,0.18)]'
  }`;

const MENU_WIDTH = 240;

/**
 * A nav pill that opens a small menu of related pages (e.g. Admin). The menu is rendered into
 * document.body with fixed positioning, because the nav row scrolls sideways on narrow screens and
 * would otherwise clip it.
 */
export default function NavMenu({ label, icon: Icon, items }: { label: string; icon: any; items: NavLinkItem[] }) {
  const location = useLocation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const activeItem = items.find((i) => location.pathname === i.path || location.pathname.startsWith(`${i.path}/`));
  const isActive = Boolean(activeItem);
  const totalCount = items.reduce((sum, i) => sum + (i.count || 0), 0);

  const place = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top: r.bottom + 6, left });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  // Close on navigation, outside click, Escape, scroll or resize
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={navPillClass(isActive)}
      >
        {isActive && (
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none"></span>
        )}
        <Icon className={`relative w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-[#94A3B8] group-hover/nav:text-[#7A2430]'}`} />
        <span className="relative">{isActive && activeItem ? `${label}: ${activeItem.label}` : label}</span>
        {totalCount > 0 && (
          <span
            className={`relative min-w-[18px] px-1.5 py-0.5 rounded-full text-[11.5px] font-bold text-center ${
              isActive ? 'bg-white text-[#5C1A22]' : 'bg-[#5C1A22] text-white'
            }`}
          >
            {totalCount}
          </span>
        )}
        <ChevronDown className={`relative w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''} ${isActive ? 'text-white' : 'text-[#94A3B8]'}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="z-50 bg-white rounded-2xl border border-[#E9DDC9] shadow-[0_18px_40px_-12px_rgba(61,15,22,0.35)] p-1.5 animate-tab-panel-in"
          >
            {items.map((item) => {
              const ItemIcon = item.icon;
              const current = item === activeItem;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  role="menuitem"
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    current ? 'bg-[#FAF3EC] text-[#5C1A22] font-semibold' : 'text-slate-700 hover:bg-[#FAF3EC] hover:text-[#3D0F16]'
                  }`}
                >
                  <ItemIcon className={`w-4 h-4 shrink-0 ${current ? 'text-[#7A2430]' : 'text-[#94A3B8]'}`} />
                  <span className="flex-1">{item.label}</span>
                  {Boolean(item.count) && (
                    <span className="min-w-[18px] px-1.5 py-0.5 rounded-full text-[11.5px] font-bold text-center bg-[#5C1A22] text-white">{item.count}</span>
                  )}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
