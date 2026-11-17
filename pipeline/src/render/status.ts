// estado.html: which sources answered in the last build, generated with the data (no JavaScript).
// Linked from the app when some source is not updating, so readers know what is missing and since when.
import { REGIONS, type Snapshot } from '../../../contract/news.ts';
import type { SourceReport } from '../build.ts';
import { CSS, esc } from './lite.ts';

const dayHm = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Short, reader-facing reason: feed errors are technical ("HTTP 503", "ETIMEDOUT", "no usable items (…)"). */
export function reasonText(error = ''): string {
  if (/^no usable items|empty feed/.test(error)) return 'sin noticias recientes';
  if (/timeout|ETIMEDOUT|abort/i.test(error)) return 'no responde a tiempo';
  if (/HTTP \d+/.test(error)) return `error del servidor (${/HTTP (\d+)/.exec(error)![1]})`;
  return error ? 'no accesible' : '';
}

const kindLabel: Record<string, string> = { media: 'medio', official: 'oficial', social: 'red social' };

export function renderStatus(snap: Snapshot, report: SourceReport[]): string {
  const byId = new Map(report.map((r) => [r.id, r]));
  const rows = snap.sources
    .map((s) => ({ s, r: byId.get(s.id) }))
    .map(({ s, r }) => ({ s, r, ok: r?.ok ?? s.lastOk >= snap.generatedAt }))
    .sort((a, b) => a.s.name.localeCompare(b.s.name, 'es'));
  const line = ({ s, r, ok }: (typeof rows)[number]) => {
    const where = `${s.region ? REGIONS[s.region] : 'Nacional'}, ${kindLabel[s.kind]}`;
    const n = r?.items ?? 0;
    const count = `${n} ${n === 1 ? 'noticia' : 'noticias'}`;
    const saved = n ? `${count} ${n === 1 ? 'guardada' : 'guardadas'}` : 'Sin noticias guardadas';
    const reason = reasonText(r?.error);
    const detail = ok
      ? count
      : `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. Última vez: ${s.lastOk ? dayHm.format(s.lastOk * 1000) : 'nunca'}. ${saved}.`;
    return `<li><b>${esc(s.name)}</b> <small>(${where})</small><br>${esc(detail)}</li>`;
  };
  const down = rows.filter((x) => !x.ok);
  const up = rows.filter((x) => x.ok);
  return (
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Estado de las fuentes · OneInstant News</title><meta name="theme-color" content="#0d0f1e"><meta name="color-scheme" content="dark light">' +
    `<style>${CSS}</style><h1>Estado de las fuentes</h1>` +
    `<p>Comprobado a las ${dayHm.format(snap.generatedAt * 1000)} (hora peninsular): ${up.length} de ${rows.length} fuentes al día. ` +
    '<a href="./">Volver</a></p>' +
    (down.length
      ? `<h2>Sin actualizar (${down.length})</h2><p>Se muestran sus últimas noticias mientras sigan siendo recientes.</p><ul>${down.map(line).join('')}</ul>`
      : '') +
    `<h2>Al día (${up.length})</h2><ul>${up.map(line).join('')}</ul></html>`
  );
}
