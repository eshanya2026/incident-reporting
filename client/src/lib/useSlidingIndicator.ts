import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tracks the position/width of the active tab so a sliding indicator can glide to it instead of
 * snapping instantly (the moving-highlight tab effect from https://codepen.io/Gelsot/pen/eMOvOP).
 * A ResizeObserver on the active tab keeps the indicator in sync when its label changes size
 * (e.g. a count badge loading in after data arrives).
 */
export function useSlidingIndicator(activeKey: string) {
  const nodes = useRef<Record<string, HTMLElement | null>>({});
  const [rect, setRect] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const el = nodes.current[activeKey];
    if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
    const el = nodes.current[activeKey];
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeKey, measure]);

  const registerTab = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      nodes.current[key] = el;
    },
    []
  );

  return { indicatorStyle: rect, registerTab };
}
