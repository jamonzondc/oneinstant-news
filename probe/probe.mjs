// Temporary: dumps raw samples of candidate sources from GitHub's network. Removed before merge.
const UA = 'Mozilla/5.0 (compatible; OneInstantNewsProbe/0.1)';
const get = async (url) => {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
    return { status: r.status, url: r.url, type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()).toString('utf8') };
  } catch (e) { return { status: 0, url, type: '', body: String(e?.cause?.code ?? e) }; }
};
const dumps = [
  ['https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_RSS.xml', '<item>', 5000],
  ['https://www.aemet.es/documentos_d/eltiempo/prediccion/avisos/rss/CAP_AFAE_wah_ATOM.xml', '<entry>', 3000],
  ['https://www.lamoncloa.gob.es/Paginas/rss.aspx', '<item>', 1500],
  ['https://www.ign.es/ign/RssTools/sismologia.xml', '<item>', 1200],
  ['https://bsky.app/profile/rtvenoticias.rtve.es/rss', '<item>', 1500],
  ['https://t.me/s/policianacional', 'tgme_widget_message_text', 5000],
  ['https://t.me/s/malditobulo', 'tgme_widget_message_wrap', 7000],
];
for (const [url, marker, len] of dumps) {
  const r = await get(url);
  const i = Math.max(0, r.body.indexOf(marker));
  console.log(`\n===== ${url} -> ${r.status} ${r.type} ${r.body.length}B\n` + r.body.slice(0, 400) + '\n-----\n' + r.body.slice(i, i + len).replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>'));
}
// One CAP file linked from the AEMET feed.
const rss = (await get(dumps[0][0])).body;
const links = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
console.log('\n===== CAP links sample: ' + JSON.stringify(links.slice(0, 6)));
for (const l of links.slice(2, 3)) {
  const r = await get(l);
  console.log(`\n===== CAP ${l} -> ${r.status} ${r.type} ${r.body.length}B\n` + r.body.slice(0, 6000));
}
