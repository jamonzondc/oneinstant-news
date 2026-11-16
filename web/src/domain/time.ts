// Time labels in Spanish. All inputs in epoch seconds; `now` is injected for testability.

const clock = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const dayClock = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function relativeTime(at: number, now: number): string {
  const min = Math.floor((now - at) / 60);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

/** "14:05" today, "14 nov, 23:10" otherwise. */
export function clockTime(at: number, now: number): string {
  const a = new Date(at * 1000);
  const n = new Date(now * 1000);
  return a.toDateString() === n.toDateString() ? clock.format(a) : dayClock.format(a);
}

/** "14 nov, 23:10" always: for text read later, out of the app (sharing). */
export const dayTime = (at: number): string => dayClock.format(new Date(at * 1000));
