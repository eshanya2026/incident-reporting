import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tracks the position/width of the active tab so a sliding indicator can glide to it instead of
 * snapping instantly (the moving-highlight tab effect from https://codepen.io/Gelsot/pen/eMOvOP).
 * A ResizeObserver watches every registered tab, not just the active one: in a centered row, a
 * sibling resizing (e.g. a count badge loading in after data arrives) shifts the active tab's own
 * position too, even though the active tab's own size never changed.
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
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    Object.values(nodes.current).forEach((el) => el && observer.observe(el));
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
