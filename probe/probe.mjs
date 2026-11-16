// Temporary: probes candidate sources from GitHub's network. Removed before merge.
const UA = 'Mozilla/5.0 (compatible; OneInstantNewsProbe/0.1)';
const get = async (url) => {
  const ctrl = AbortSignal.timeout(20000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: ctrl, redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, url: r.url, type: r.headers.get('content-type'), body: buf.toString('utf8') };
  } catch (e) { return { status: 0, url, type: '', body: String(e?.cause?.code ?? e) }; }
};
const squash = (s) => s.replace(/\s+/g, ' ');
const feeds = (await import('./candidates.json', { with: { type: 'json' } })).default;

console.log('=== FEEDS ===');
for (const u of feeds.feeds) {
  const r = await get(u);
  const items = (r.body.match(/<(item|entry)[\s>]/g) || []).length;
  const titles = [...r.body.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/g)].slice(0, 4).map((m) => squash(m[1]).slice(0, 120));
  const dates = [...r.body.matchAll(/<(pubDate|updated|published|dc:date|sent)[^>]*>([^<]+)</g)].slice(0, 3).map((m) => m[2]);
  console.log(`\n# ${u}\n  -> ${r.status} ${r.type} ${r.body.length}B final=${r.url}\n  items=${items} titles=${JSON.stringify(titles)} dates=${JSON.stringify(dates)}`);
  if (items === 0) console.log('  head: ' + squash(r.body).slice(0, 300));
}

console.log('\n=== INDEX PAGES (feed links) ===');
for (const u of feeds.pages) {
  const r = await get(u);
  const links = [...new Set([...r.body.matchAll(/href="([^"]*(?:rss|RSS|feed|atom|\.xml)[^"]*)"/g)].map((m) => m[1]))].slice(0, 40);
  console.log(`\n# ${u}\n  -> ${r.status} ${r.body.length}B\n  ${links.join('\n  ')}`);
}

console.log('\n=== TELEGRAM ===');
let best = '', bestN = 0;
for (const ch of feeds.telegram) {
  const r = await get(`https://t.me/s/${ch}`);
  const title = (r.body.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
  const msgs = (r.body.match(/class="tgme_widget_message_wrap/g) || []).length;
  const times = [...r.body.matchAll(/<time datetime="([^"]+)"/g)].map((m) => m[1]);
  const subs = (r.body.match(/<span class="counter_value">([^<]+)<\/span> <span class="counter_type">subscribers/) || [])[1];
  if (msgs > bestN) { best = ch; bestN = msgs; }
  console.log(`# ${ch} -> ${r.status} final=${r.url} title=${title} subs=${subs} msgs=${msgs} last=${times.at(-1)} first=${times[0]}`);
}
if (best) {
  const r = await get(`https://t.me/s/${best}`);
  const i = r.body.indexOf('<div class="tgme_widget_message_wrap');
  console.log('\n=== TELEGRAM DUMP ' + best + ' ===\n' + r.body.slice(i, i + 6000));
}

console.log('\n=== BLUESKY ===');
for (const q of feeds.bluesky) {
  const r = await get(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(q)}&limit=8`);
  let actors = [];
  try { actors = JSON.parse(r.body).actors; } catch { console.log(`# ${q} -> ${r.status} ${r.body.slice(0, 200)}`); continue; }
  const handles = actors.map((a) => a.did);
  const p = await get(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${handles.map((h) => 'actors=' + h).join('&')}`);
  let profiles = [];
  try { profiles = JSON.parse(p.body).profiles; } catch {}
  console.log(`# ${q}`);
  for (const a of profiles) console.log(`  ${a.handle} | ${squash(a.displayName ?? '')} | followers=${a.followersCount} posts=${a.postsCount} | ${squash(a.description ?? '').slice(0, 80)}`);
}

console.log('\n=== MASTODON ===');
for (const q of feeds.mastodon) {
  const r = await get(`https://mastodon.social/api/v2/search?type=accounts&limit=6&q=${encodeURIComponent(q)}`);
  try {
    for (const a of JSON.parse(r.body).accounts) console.log(`  [${q}] ${a.acct} | ${a.display_name} | followers=${a.followers_count} statuses=${a.statuses_count} last=${a.last_status_at}`);
  } catch { console.log(`# ${q} -> ${r.status} ${r.body.slice(0, 200)}`); }
}
