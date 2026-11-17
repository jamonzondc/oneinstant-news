import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toEntries } from '../src/domain/filters.ts';
import { plainText, shareContent } from '../src/domain/share.ts';
import { itemsHtml } from '../src/ui/render.ts';
import { sampleSnapshot } from './sample.ts';

const NOW = 1_800_000_000;

test('a shared item is plain text with title, summary, source and date, plus its link', () => {
  const entry = toEntries(sampleSnapshot(NOW))[0]!;
  const c = shareContent(entry);
  assert.equal(c.title, 'Apagón general: Protección Civil pide no colapsar las líneas del 112');
  assert.match(c.text, /^Apagón general: .+\nLlama solo en caso de emergencia real\..+\n— 112 Comunidad de Madrid, \d+ \w+, \d\d:\d\d$/);
  assert.equal(c.url, 'https://noticias.example/112madrid/0');
  assert.equal(plainText(c), `${c.text}\nhttps://noticias.example/112madrid/0`);
});

test('without summary or a safe link, the text is shorter and there is no url', () => {
  const snap = sampleSnapshot(NOW);
  snap.items = [{ ...snap.items[5]!, url: 'javascript:alert(1)' }];
  const c = shareContent(toEntries(snap)[0]!);
  assert.equal(c.text.split('\n').length, 2, 'title and source line');
  assert.equal(c.url, undefined);
  assert.equal(plainText(c), c.text);
});

test('share buttons are rendered only when the browser can share, indexed by position', () => {
  const entries = toEntries(sampleSnapshot(NOW));
  assert.ok(!itemsHtml(entries, NOW).includes('class="sh"'));
  const html = itemsHtml(entries, NOW, true);
  assert.equal(html.match(/<button type="button" class="sh" data-i="\d+">Compartir<\/button>/g)?.length, entries.length);
  assert.ok(html.includes('data-i="13"'));
});
