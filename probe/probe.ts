// Temporary (iter 6): real headlines for the classifier corpus, regional source discovery, AEMET zone codes, IGN sample.
// Runs from GitHub's network (the dev network cannot reach the feeds). Removed before merge.
import { ADAPTERS, adapterFor } from '../pipeline/src/adapters/registry.ts';
import { parseFeed } from '../pipeline/src/adapters/rss-adapter.ts';
import { decodeBody, FetchHttpClient } from '../pipeline/src/infra/http.ts';
import { SOURCES } from '../pipeline/src/sources/index.ts';

const http = new FetchHttpClient({ timeoutMs: 15_000, retries: 0 });
const UA = 'Mozilla/5.0 (compatible; OneInstantNews/1.0; feed reader)';
const text = async (url: string) => {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
    return { status: r.status, url: r.url, body: r.ok ? await r.text() : '' };
  } catch (e) {
    return { status: 0, url, body: String((e as { cause?: { code?: string } })?.cause?.code ?? e) };
  }
};
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();
const headline = (t: string, s: string) => oneLine(t || s.split('\n')[0] || '').slice(0, 180);
const iso = (ms: number) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16) : 'none');

console.log('##### CORPUS (current catalogue)');
await Promise.all(SOURCES.filter((s) => s.enabled !== false && s.adapter !== 'cap').map(async (s) => {
  try {
    const raw = await adapterFor(ADAPTERS, s).read(s, http);
    const lines = raw.slice(0, 30).map((it) => `CORPUS\t${s.id}\t${headline(it.title, it.summary)}\t${oneLine(it.title ? it.summary : '').slice(0, 140)}`);
    console.log(lines.join('\n'));
  } catch (e) {
    console.log(`CORPUS-FAIL\t${s.id}\t${e}`);
  }
}));

console.log('\n##### REGIONAL DISCOVERY');
const CANDIDATES: Record<string, string[]> = {
  an: ['canalsur.es', 'diariodesevilla.es', 'ideal.es', 'diariosur.es', 'eldiario.es/andalucia/'],
  ar: ['heraldo.es', 'elperiodicodearagon.com', 'aragondigital.es', 'cartv.es'],
  as: ['lne.es', 'elcomercio.es', 'rtpa.es'],
  ib: ['ultimahora.es', 'diariodemallorca.es', 'ib3.org'],
  cn: ['canarias7.es', 'laprovincia.es', 'rtvc.es', 'eldia.es'],
  cb: ['eldiariomontanes.es', 'eldiario.es/cantabria/'],
  cl: ['elnortedecastilla.es', 'leonoticias.com', 'rtvcyl.es'],
  cm: ['cmmedia.es', 'latribunadetoledo.es', 'encastillalamancha.es'],
  ct: ['3cat.cat/3catinfo/', 'elperiodico.com', 'ara.cat', 'naciodigital.cat'],
  ex: ['hoy.es', 'elperiodicoextremadura.com', 'canalextremadura.es'],
  ga: ['lavozdegalicia.es', 'farodevigo.es', 'crtvg.es', 'galiciapress.es'],
  md: ['telemadrid.es', 'madridiario.es', 'eldiario.es/madrid/'],
  mc: ['laverdad.es', 'laopiniondemurcia.es', '7tvregiondemurcia.es'],
  nc: ['diariodenavarra.es', 'noticiasdenavarra.com', 'navarra.com'],
  pv: ['eitb.eus/es/', 'elcorreo.com', 'diariovasco.com', 'deia.eus'],
  ri: ['larioja.com', 'nuevecuatrouno.com', 'rioja2.com'],
  vc: ['apuntmedia.es', 'levante-emv.com', 'lasprovincias.es', 'informacion.es', 'valenciaplaza.com'],
  ce: ['elfarodeceuta.es', 'ceutaactualidad.com', 'ceutaldia.com'],
  ml: ['elfarodemelilla.es', 'melillahoy.es'],
};
const GUESSES = ['rss/2.0/portada', 'rss/2.0/portada/', 'rss/', 'rss', 'feed/', 'rss.xml', 'rss/portada.xml', 'index.xml'];

async function tryFeed(url: string): Promise<string | null> {
  try {
    const items = parseFeed(decodeBody(await http.get(url)));
    if (!items.length) return null;
    const newest = Math.max(...items.map((i) => i.publishedAt).filter(Number.isFinite));
    const sample = items.slice(0, 10).map((it) => headline(it.title, it.summary));
    return `${items.length} items, newest ${iso(newest)}\n` + sample.map((t) => `   · ${t}`).join('\n');
  } catch {
    return null;
  }
}

await Promise.all(Object.entries(CANDIDATES).flatMap(([region, domains]) => domains.map(async (d) => {
  const base = `https://www.${d}${d.includes('/') ? '' : '/'}`.replace('www.3cat', 'www.3cat');
  const home = await text(base);
  const found = [...home.body.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)]
    .map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1])
    .filter((h): h is string => !!h)
    .map((h) => new URL(h.replace(/&amp;/g, '&'), home.url || base).href);
  const urls = [...new Set([...found.slice(0, 4), ...GUESSES.map((g) => new URL(g, base).href)])];
  const out = [`REGION\t${region}\t${d}\thome ${home.status} -> ${home.url}\tdiscovered ${found.length}: ${found.slice(0, 6).join(' ')}`];
  let ok = 0;
  for (const u of urls) {
    if (ok >= 2) break;
    const r = await tryFeed(u);
    if (r) { ok++; out.push(`  FEED ${u} -> ${r}`); }
  }
  if (!ok) out.push('  NO FEED');
  console.log(out.join('\n'));
})));

console.log('\n##### BLUESKY SEARCH');
for (const q of ['112', 'emergencias', 'protección civil', 'emergències', 'À Punt', '3Cat', 'EITB', 'Canal Sur', 'Telemadrid', 'CRTVG', 'IB3', 'Aragón TV', 'CMM', 'RTPA', 'RTVC Canarias', 'Navarra', 'Murcia', 'Extremadura', 'Ceuta', 'Melilla', 'La Rioja', 'Cantabria', 'Galicia', 'Asturias', 'Generalitat', 'Junta de Andalucía', 'Comunidad de Madrid', 'Gobierno de Canarias']) {
  const r = await text(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(q)}&limit=8`);
  try {
    const actors = (JSON.parse(r.body).actors ?? []) as { handle: string; displayName?: string }[];
    console.log(`BSKY\t${q}\t` + actors.map((a) => `${a.handle} (${a.displayName ?? ''})`).join(' | '));
  } catch { console.log(`BSKY\t${q}\tERR ${r.status}`); }
}

console.log('\n##### TELEGRAM 112');
for (const ch of ['sos112', '112cv', 'emergencias112cv', '112andalucia', '112cyl', 'emergenciasmadrid', 'Emergencias112CLM', 'emergenciescat', 'protecciocivil', 'gva112', 'SOSDeiak', '112canarias', '112asturias', 'emergencias112ga', 'aemet_esp', 'emergencias112rioja', 'SOS_Aragon']) {
  const r = await text(`https://t.me/s/${ch}`);
  const n = (r.body.match(/tgme_widget_message_text/g) ?? []).length;
  const last = [...r.body.matchAll(/datetime="([^"]+)"/g)].at(-1)?.[1] ?? '';
  console.log(`TG\t${ch}\t${r.status}\t${n} posts\tlast ${last}`);
}

console.log('\n##### AEMET CAP zone codes');
const cap = await text('https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml');
for (const m of cap.body.matchAll(/<title>([^<]+)<\/title>[\s\S]*?<link>[^<]*?(AFAZ\d+)/g)) console.log(`CAP\t${m[2]}\t${m[1]}`);

console.log('\n##### IGN');
const ign = await text('https://www.ign.es/ign/RssTools/sismologia.xml');
console.log(`IGN ${ign.status} ${ign.body.length}B\n` + ign.body.slice(0, 3500));
