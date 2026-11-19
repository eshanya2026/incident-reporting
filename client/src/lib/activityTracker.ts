import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api';

// Activity for the Super Admin audit log: which screens are opened, and how long the app is used
// actively (mouse / keyboard), left idle (5+ minutes without input) or hidden in a background tab.
// Sent in small batches; a failed send is simply dropped — tracking never gets in anyone's way.

type ActivityEvent = { action: string; summary: string; at: string; meta?: Record<string, string | number | boolean> };
type Presence = 'active' | 'idle' | 'away';

const IDLE_AFTER_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const TICK_MS = 5 * 1000;

let queue: ActivityEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
const buckets = { activeMs: 0, idleMs: 0, awayMs: 0 };
let lastTick = Date.now();
let lastInputAt = Date.now();
let state: Presence = 'active';

const signedIn = () => {
  try {
    return Boolean(localStorage.getItem('accessToken'));
  } catch {
    return false;
  }
};

const takePresence = () => {
  const p = { ...buckets, state };
  buckets.activeMs = buckets.idleMs = buckets.awayMs = 0;
  return p;
};

const flush = async (withPresence = false) => {
  if (!signedIn()) return;
  const events = queue.splice(0, 50);
  const presence = withPresence ? takePresence() : undefined;
  if (!events.length && !presence) return;
  try {
    await api.post('/audit/activity', { events, ...(presence ? { presence } : {}) });
  } catch {
    /* dropped */
  }
};

/** Records something the person did in the app (sent within a couple of seconds). */
export const trackActivity = (action: string, summary: string, meta?: ActivityEvent['meta']) => {
  if (!signedIn()) return;
  queue.push({ action, summary, at: new Date().toISOString(), meta });
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(false), 1500);
};

const SCREENS: Array<[RegExp, string]> = [
  [/^\/?$/, 'Home'],
  [/^\/dashboard/, 'Dashboard'],
  [/^\/incidents\/new/, 'Report Incident'],
  [/^\/incidents\/[^/]+/, 'Incident details'],
  [/^\/incidents\/?$/, 'All Incidents'],
  [/^\/my-reports/, 'My Reports'],
  [/^\/triage/, 'Triage Inbox'],
  [/^\/review/, 'Review & RCA Queue'],
  [/^\/my-department/, "My Department's Incidents"],
  [/^\/capas/, 'CAPA'],
  [/^\/reports/, 'Reports'],
  [/^\/insights/, 'AI Insights'],
  [/^\/admin/, 'Administration'],
  [/^\/access-control/, 'Access Control'],
  [/^\/whatsapp-messages/, 'WhatsApp Messages'],
  [/^\/audit-log/, 'Audit Log'],
  [/^\/profile|^\/change-password/, 'Profile'],
];
const screenName = (path: string) => SCREENS.find(([re]) => re.test(path))?.[1] ?? path;

const setState = (next: Presence) => {
  if (next === state) return;
  const prev = state;
  state = next;
  if (next === 'away') trackActivity('PRESENCE_TAB_HIDDEN', 'Switched away from the app (tab hidden)');
  else if (prev === 'away') trackActivity('PRESENCE_TAB_VISIBLE', 'Came back to the app');
  if (next === 'idle') trackActivity('PRESENCE_IDLE', 'Idle (no activity for 5 minutes)');
  else if (prev === 'idle' && next === 'active') trackActivity('PRESENCE_ACTIVE', 'Active again after being idle');
};

/** Adds the time since the last tick to the current presence bucket, then re-evaluates presence. */
const tick = () => {
  const now = Date.now();
  const elapsed = Math.min(now - lastTick, 2 * TICK_MS); // a sleeping laptop doesn't count
  lastTick = now;
  if (state === 'away') buckets.awayMs += elapsed;
  else if (state === 'idle') buckets.idleMs += elapsed;
  else buckets.activeMs += elapsed;
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  setState(hidden ? 'away' : now - lastInputAt >= IDLE_AFTER_MS ? 'idle' : 'active');
};

/** Runs inside the signed-in layout: screen tracking, presence ticks, heartbeats, window-close beacon. */
export function useActivityTracker() {
  const location = useLocation();

  useEffect(() => {
    trackActivity('SCREEN_OPENED', `Opened ${screenName(location.pathname)}`, { screen: screenName(location.pathname), path: location.pathname });
  }, [location.pathname]);

  useEffect(() => {
    lastTick = Date.now();
    lastInputAt = Date.now();
    state = document.visibilityState === 'hidden' ? 'away' : 'active';

    let lastMove = 0;
    const onInput = () => {
      const now = Date.now();
      if (now - lastMove < 1000) return; // throttle mouse moves
      lastMove = now;
      lastInputAt = now;
      if (state === 'idle') {
        tick();
      }
    };
    const onVisibility = () => tick();
    const onPageHide = () => {
      tick();
      const token = (() => {
        try {
          return localStorage.getItem('accessToken');
        } catch {
          return null;
        }
      })();
      if (!token) return;
      const body = JSON.stringify({
        token,
        events: [...queue.splice(0), { action: 'PRESENCE_WINDOW_CLOSED', summary: 'Closed the app window', at: new Date().toISOString() }],
        presence: takePresence(),
      });
      try {
        navigator.sendBeacon('/api/v1/audit/activity/beacon', new Blob([body], { type: 'application/json' }));
      } catch {
        /* ignore */
      }
    };

    const inputEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];
    inputEvents.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    const tickTimer = setInterval(tick, TICK_MS);
    const beatTimer = setInterval(() => {
      tick();
      void flush(true);
    }, HEARTBEAT_MS);

    return () => {
      inputEvents.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      clearInterval(tickTimer);
      clearInterval(beatTimer);
      tick();
      void flush(true);
    };
  }, []);
}
